-- 002_functions.sql — the four money events, atomic, ledger-backed.
-- Every mutation that touches stock lives here. The browser never writes stock directly.

-- ─────────────── DOCUMENT NUMBERING ───────────────

create sequence if not exists seq_invoice_no;
create sequence if not exists seq_batch_no;
create sequence if not exists seq_purchase_no;

create or replace function next_document_no(p_kind text)
returns text language plpgsql set search_path = public as $$
declare v_prefix text; v_n bigint;
begin
  select case p_kind
           when 'invoice'  then coalesce(invoice_prefix, 'INV-')
           when 'batch'    then coalesce(batch_prefix, 'B-')
           when 'purchase' then coalesce(purchase_prefix, 'PUR-')
           else ''
         end
    into v_prefix from app_settings where id = 1;

  v_n := case p_kind
           when 'invoice'  then nextval('seq_invoice_no')
           when 'batch'    then nextval('seq_batch_no')
           when 'purchase' then nextval('seq_purchase_no')
           else nextval('seq_invoice_no')
         end;

  return coalesce(v_prefix, '') || to_char(current_date, 'YYYY') || '-' || lpad(v_n::text, 4, '0');
end $$;

-- ─────────────── SHARED STOCK HELPERS ───────────────

-- Stock in: adds quantity and recomputes the moving weighted average.
create or replace function apply_stock_in(
  p_item_type text, p_item_id uuid, p_qty numeric, p_cost_per_kg numeric,
  p_movement_type text, p_ref_table text, p_ref_id uuid
) returns void language plpgsql set search_path = public as $$
declare
  v_old_stock numeric(14,3); v_old_avg numeric(14,4);
  v_new_stock numeric(14,3); v_new_avg numeric(14,4);
begin
  if p_item_type = 'raw' then
    select current_stock_kg, avg_cost_per_kg into v_old_stock, v_old_avg
      from raw_materials where id = p_item_id for update;
  else
    select current_stock_kg, avg_cost_per_kg into v_old_stock, v_old_avg
      from inks where id = p_item_id for update;
  end if;

  if v_old_stock is null then
    raise exception 'Item % not found', p_item_id using errcode = 'P0001';
  end if;

  v_new_stock := v_old_stock + p_qty;
  v_new_avg := case when v_new_stock > 0
                    then ((v_old_stock * v_old_avg) + (p_qty * p_cost_per_kg)) / v_new_stock
                    else p_cost_per_kg end;

  if p_item_type = 'raw' then
    update raw_materials
       set current_stock_kg = v_new_stock, avg_cost_per_kg = v_new_avg,
           last_price_per_kg = p_cost_per_kg, updated_at = now()
     where id = p_item_id;
  else
    update inks
       set current_stock_kg = v_new_stock, avg_cost_per_kg = v_new_avg, updated_at = now()
     where id = p_item_id;
  end if;

  insert into inventory_movements
    (item_type, item_id, movement_type, quantity_kg, cost_per_kg, balance_after, ref_table, ref_id)
  values (p_item_type, p_item_id, p_movement_type, p_qty, p_cost_per_kg, v_new_stock, p_ref_table, p_ref_id);
end $$;

-- Stock out: consumes quantity, average unchanged, returns the average as the cost snapshot.
create or replace function apply_stock_out(
  p_item_type text, p_item_id uuid, p_qty numeric,
  p_movement_type text, p_ref_table text, p_ref_id uuid
) returns numeric language plpgsql set search_path = public as $$
declare
  v_stock numeric(14,3); v_avg numeric(14,4); v_name text;
begin
  if p_item_type = 'raw' then
    select current_stock_kg, avg_cost_per_kg, name into v_stock, v_avg, v_name
      from raw_materials where id = p_item_id for update;
  else
    select current_stock_kg, avg_cost_per_kg, name into v_stock, v_avg, v_name
      from inks where id = p_item_id for update;
  end if;

  if v_stock is null then
    raise exception 'Item % not found', p_item_id using errcode = 'P0001';
  end if;

  if v_stock < p_qty then
    raise exception 'Not enough stock for %: have % kg, need % kg', v_name, v_stock, p_qty
      using errcode = 'P0001';
  end if;

  if p_item_type = 'raw' then
    update raw_materials set current_stock_kg = v_stock - p_qty, updated_at = now() where id = p_item_id;
  else
    update inks set current_stock_kg = v_stock - p_qty, updated_at = now() where id = p_item_id;
  end if;

  insert into inventory_movements
    (item_type, item_id, movement_type, quantity_kg, cost_per_kg, balance_after, ref_table, ref_id)
  values (p_item_type, p_item_id, p_movement_type, -p_qty, v_avg, v_stock - p_qty, p_ref_table, p_ref_id);

  return v_avg;   -- caller uses this as the cost snapshot
end $$;

-- Reverse a stock-in (cancellation only): removes quantity AND removes its cost
-- contribution from the average, so cancelling a purchase restores the prior WAC.
create or replace function reverse_stock_in(
  p_item_type text, p_item_id uuid, p_qty numeric, p_cost_per_kg numeric,
  p_movement_type text, p_ref_table text, p_ref_id uuid, p_notes text
) returns void language plpgsql set search_path = public as $$
declare
  v_stock numeric(14,3); v_avg numeric(14,4); v_name text;
  v_new_stock numeric(14,3); v_new_value numeric; v_new_avg numeric(14,4);
begin
  if p_item_type = 'raw' then
    select current_stock_kg, avg_cost_per_kg, name into v_stock, v_avg, v_name
      from raw_materials where id = p_item_id for update;
  else
    select current_stock_kg, avg_cost_per_kg, name into v_stock, v_avg, v_name
      from inks where id = p_item_id for update;
  end if;

  if v_stock < p_qty then
    raise exception 'Cannot reverse %: only % kg of % remains, % kg was received',
      p_ref_table, v_stock, v_name, p_qty using errcode = 'P0001';
  end if;

  v_new_stock := v_stock - p_qty;
  v_new_value := (v_stock * v_avg) - (p_qty * p_cost_per_kg);
  v_new_avg := case when v_new_stock > 0 then greatest(v_new_value / v_new_stock, 0) else 0 end;

  if p_item_type = 'raw' then
    update raw_materials set current_stock_kg = v_new_stock, avg_cost_per_kg = v_new_avg,
           updated_at = now() where id = p_item_id;
  else
    update inks set current_stock_kg = v_new_stock, avg_cost_per_kg = v_new_avg,
           updated_at = now() where id = p_item_id;
  end if;

  insert into inventory_movements
    (item_type, item_id, movement_type, quantity_kg, cost_per_kg, balance_after, ref_table, ref_id, notes)
  values (p_item_type, p_item_id, p_movement_type, -p_qty, p_cost_per_kg, v_new_stock,
          p_ref_table, p_ref_id, p_notes);
end $$;

-- ─────────────── 1. PURCHASE ───────────────

create or replace function record_purchase(payload jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid; v_line jsonb;
  v_subtotal numeric(14,2) := 0; v_qty numeric; v_price numeric;
  v_line_total numeric(14,2); v_landed numeric(14,4);
  v_extra numeric(14,2) := coalesce((payload->>'freight_cost')::numeric,0)
                          + coalesce((payload->>'other_cost')::numeric,0);
  v_key text := nullif(payload->>'idempotency_key', '');
  v_invoice text := nullif(payload->>'invoice_no', '');
begin
  if v_key is not null then
    select id into v_id from purchases where idempotency_key = v_key;
    if v_id is not null then return v_id; end if;
  end if;

  if payload->'items' is null or jsonb_array_length(payload->'items') = 0 then
    raise exception 'A purchase needs at least one line' using errcode = 'P0001';
  end if;

  for v_line in select * from jsonb_array_elements(payload->'items') loop
    v_subtotal := v_subtotal
      + round((v_line->>'quantity_kg')::numeric * (v_line->>'price_per_kg')::numeric, 2);
  end loop;

  if v_invoice is null then v_invoice := next_document_no('purchase'); end if;

  insert into purchases (supplier_id, invoice_no, purchase_date, subtotal, freight_cost,
                         other_cost, discount, total, paid_amount, notes, idempotency_key)
  values ((payload->>'supplier_id')::uuid,
          v_invoice,
          coalesce((payload->>'purchase_date')::date, current_date),
          v_subtotal,
          coalesce((payload->>'freight_cost')::numeric,0),
          coalesce((payload->>'other_cost')::numeric,0),
          coalesce((payload->>'discount')::numeric,0),
          v_subtotal + v_extra - coalesce((payload->>'discount')::numeric,0),
          coalesce((payload->>'paid_amount')::numeric,0),
          nullif(payload->>'notes',''), v_key)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(payload->'items') loop
    v_qty   := (v_line->>'quantity_kg')::numeric;
    v_price := (v_line->>'price_per_kg')::numeric;
    v_line_total := round(v_qty * v_price, 2);
    -- allocate freight + other cost by line value, not by weight
    v_landed := v_price + case when v_subtotal > 0
                               then (v_extra * (v_line_total / v_subtotal)) / v_qty else 0 end;

    insert into purchase_items (purchase_id, raw_material_id, quantity_kg, price_per_kg,
                                landed_cost_per_kg, line_total)
    values (v_id, (v_line->>'raw_material_id')::uuid, v_qty, v_price, v_landed, v_line_total);

    perform apply_stock_in('raw', (v_line->>'raw_material_id')::uuid,
                           v_qty, v_landed, 'purchase', 'purchases', v_id);
  end loop;

  if coalesce((payload->>'paid_amount')::numeric,0) > 0 then
    insert into payments (party_type, party_id, direction, amount, method, paid_on, ref_table, ref_id, notes)
    values ('supplier', (payload->>'supplier_id')::uuid, 'out',
            (payload->>'paid_amount')::numeric, nullif(payload->>'payment_method',''),
            coalesce((payload->>'purchase_date')::date, current_date),
            'purchases', v_id, 'Paid with purchase');
  end if;

  return v_id;
end $$;

create or replace function cancel_purchase(p_purchase_id uuid, p_reason text default null)
returns uuid language plpgsql set search_path = public as $$
declare v_p purchases%rowtype; v_row purchase_items%rowtype;
begin
  select * into v_p from purchases where id = p_purchase_id for update;
  if v_p.id is null then raise exception 'Purchase not found' using errcode = 'P0001'; end if;
  if v_p.status = 'cancelled' then raise exception 'Purchase is already cancelled' using errcode = 'P0001'; end if;

  for v_row in select * from purchase_items where purchase_id = p_purchase_id loop
    perform reverse_stock_in('raw', v_row.raw_material_id, v_row.quantity_kg,
                             v_row.landed_cost_per_kg, 'return', 'purchases', p_purchase_id,
                             coalesce(p_reason, 'Purchase cancelled'));
  end loop;

  update purchases set status = 'cancelled', cancelled_at = now(),
         notes = coalesce(notes || ' · ', '') || 'Cancelled: ' || coalesce(p_reason, 'no reason given')
   where id = p_purchase_id;
  return p_purchase_id;
end $$;

-- ─────────────── 2. PRODUCTION ───────────────

-- Create or update a DRAFT batch and its consumption lines. Consumes nothing.
create or replace function save_production_batch(payload jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid := nullif(payload->>'id','')::uuid;
  v_line jsonb;
  v_status text;
begin
  if payload->'items' is null or jsonb_array_length(payload->'items') = 0 then
    raise exception 'A batch needs at least one material line' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into production_batches (ink_id, batch_no, production_date, planned_qty_kg,
                                    labor_cost, overhead_cost, notes)
    values ((payload->>'ink_id')::uuid,
            coalesce(nullif(payload->>'batch_no',''), next_document_no('batch')),
            coalesce((payload->>'production_date')::date, current_date),
            (payload->>'planned_qty_kg')::numeric,
            coalesce((payload->>'labor_cost')::numeric,0),
            coalesce((payload->>'overhead_cost')::numeric,0),
            nullif(payload->>'notes',''))
    returning id into v_id;
  else
    select status into v_status from production_batches where id = v_id for update;
    if v_status is null then raise exception 'Batch not found' using errcode = 'P0001'; end if;
    if v_status <> 'draft' then
      raise exception 'Batch is % and can no longer be edited', v_status using errcode = 'P0001';
    end if;
    update production_batches
       set ink_id          = (payload->>'ink_id')::uuid,
           production_date = coalesce((payload->>'production_date')::date, production_date),
           planned_qty_kg  = (payload->>'planned_qty_kg')::numeric,
           labor_cost      = coalesce((payload->>'labor_cost')::numeric,0),
           overhead_cost   = coalesce((payload->>'overhead_cost')::numeric,0),
           notes           = nullif(payload->>'notes','')
     where id = v_id;
    delete from production_consumption where batch_id = v_id;
  end if;

  for v_line in select * from jsonb_array_elements(payload->'items') loop
    insert into production_consumption (batch_id, raw_material_id, quantity_kg)
    values (v_id, (v_line->>'raw_material_id')::uuid, (v_line->>'quantity_kg')::numeric);
  end loop;

  return v_id;
end $$;

create or replace function complete_production_batch(p_batch_id uuid, p_produced_qty numeric)
returns uuid language plpgsql set search_path = public as $$
declare
  v_batch production_batches%rowtype;
  v_ink inks%rowtype;
  v_row production_consumption%rowtype;
  v_avg numeric(14,4);
  v_material_cost numeric(14,2) := 0;
  v_packaging numeric(14,2);
  v_total numeric(14,2);
begin
  select * into v_batch from production_batches where id = p_batch_id for update;
  if v_batch.id is null then
    raise exception 'Batch not found' using errcode = 'P0001';
  end if;
  if v_batch.status <> 'draft' then
    raise exception 'Batch is already %', v_batch.status using errcode = 'P0001';
  end if;
  if p_produced_qty is null or p_produced_qty <= 0 then
    raise exception 'Produced quantity must be greater than zero' using errcode = 'P0001';
  end if;

  select * into v_ink from inks where id = v_batch.ink_id;

  for v_row in select * from production_consumption where batch_id = p_batch_id order by id loop
    v_avg := apply_stock_out('raw', v_row.raw_material_id, v_row.quantity_kg,
                             'production_out', 'production_batches', p_batch_id);
    update production_consumption
       set cost_per_kg = v_avg, line_cost = round(v_avg * v_row.quantity_kg, 2)
     where id = v_row.id;
    v_material_cost := v_material_cost + round(v_avg * v_row.quantity_kg, 2);
  end loop;

  v_packaging := round(p_produced_qty * v_ink.packaging_cost_per_kg, 2);
  v_total := v_material_cost + v_batch.labor_cost + v_batch.overhead_cost + v_packaging;

  update production_batches
     set produced_qty_kg = p_produced_qty,
         material_cost   = v_material_cost,
         packaging_cost  = v_packaging,
         total_cost      = v_total,
         cost_per_kg     = round(v_total / p_produced_qty, 4),
         status          = 'completed',
         completed_at    = now()
   where id = p_batch_id;

  perform apply_stock_in('ink', v_batch.ink_id, p_produced_qty,
                         round(v_total / p_produced_qty, 4),
                         'production_in', 'production_batches', p_batch_id);
  return p_batch_id;
end $$;

create or replace function cancel_production_batch(p_batch_id uuid, p_reason text default null)
returns uuid language plpgsql set search_path = public as $$
declare v_b production_batches%rowtype; v_row production_consumption%rowtype;
begin
  select * into v_b from production_batches where id = p_batch_id for update;
  if v_b.id is null then raise exception 'Batch not found' using errcode = 'P0001'; end if;
  if v_b.status = 'cancelled' then raise exception 'Batch is already cancelled' using errcode = 'P0001'; end if;

  if v_b.status = 'completed' then
    -- pull the produced ink back out, then return the consumed raw material
    perform reverse_stock_in('ink', v_b.ink_id, v_b.produced_qty_kg, v_b.cost_per_kg,
                             'return', 'production_batches', p_batch_id,
                             coalesce(p_reason, 'Batch cancelled'));
    for v_row in select * from production_consumption where batch_id = p_batch_id loop
      perform apply_stock_in('raw', v_row.raw_material_id, v_row.quantity_kg, v_row.cost_per_kg,
                             'return', 'production_batches', p_batch_id);
    end loop;
  end if;

  update production_batches set status = 'cancelled',
         notes = coalesce(notes || ' · ', '') || 'Cancelled: ' || coalesce(p_reason, 'no reason given')
   where id = p_batch_id;
  return p_batch_id;
end $$;

-- ─────────────── 3. SALE ───────────────

create or replace function record_sale(payload jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid; v_line jsonb;
  v_qty numeric; v_price numeric; v_cost numeric(14,4);
  v_subtotal numeric(14,2) := 0; v_cogs numeric(14,2) := 0;
  v_discount numeric(14,2) := coalesce((payload->>'discount')::numeric,0);
  v_key text := nullif(payload->>'idempotency_key','');
  v_invoice text := nullif(payload->>'invoice_no','');
begin
  if v_key is not null then
    select id into v_id from sales where idempotency_key = v_key;
    if v_id is not null then return v_id; end if;
  end if;

  if payload->'items' is null or jsonb_array_length(payload->'items') = 0 then
    raise exception 'A sale needs at least one line' using errcode = 'P0001';
  end if;

  if v_invoice is null then v_invoice := next_document_no('invoice'); end if;

  insert into sales (customer_id, invoice_no, sale_date, discount, paid_amount, notes, idempotency_key)
  values ((payload->>'customer_id')::uuid, v_invoice,
          coalesce((payload->>'sale_date')::date, current_date), v_discount,
          coalesce((payload->>'paid_amount')::numeric,0), nullif(payload->>'notes',''), v_key)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(payload->'items') loop
    v_qty   := (v_line->>'quantity_kg')::numeric;
    v_price := (v_line->>'price_per_kg')::numeric;
    v_cost  := apply_stock_out('ink', (v_line->>'ink_id')::uuid, v_qty, 'sale', 'sales', v_id);

    insert into sale_items (sale_id, ink_id, quantity_kg, price_per_kg, cost_per_kg_snapshot,
                            line_total, line_cost, line_profit)
    values (v_id, (v_line->>'ink_id')::uuid, v_qty, v_price, v_cost,
            round(v_qty*v_price,2), round(v_qty*v_cost,2), round(v_qty*(v_price-v_cost),2));

    v_subtotal := v_subtotal + round(v_qty*v_price,2);
    v_cogs     := v_cogs + round(v_qty*v_cost,2);
  end loop;

  update sales set subtotal = v_subtotal, total = v_subtotal - v_discount,
                   cogs_total = v_cogs, profit_total = (v_subtotal - v_discount) - v_cogs
   where id = v_id;

  if coalesce((payload->>'paid_amount')::numeric,0) > 0 then
    insert into payments (party_type, party_id, direction, amount, method, paid_on, ref_table, ref_id, notes)
    values ('customer', (payload->>'customer_id')::uuid, 'in',
            (payload->>'paid_amount')::numeric, nullif(payload->>'payment_method',''),
            coalesce((payload->>'sale_date')::date, current_date),
            'sales', v_id, 'Paid with sale');
  end if;

  return v_id;
end $$;

create or replace function cancel_sale(p_sale_id uuid, p_reason text default null)
returns uuid language plpgsql set search_path = public as $$
declare v_s sales%rowtype; v_row sale_items%rowtype;
begin
  select * into v_s from sales where id = p_sale_id for update;
  if v_s.id is null then raise exception 'Sale not found' using errcode = 'P0001'; end if;
  if v_s.status = 'cancelled' then raise exception 'Sale is already cancelled' using errcode = 'P0001'; end if;

  for v_row in select * from sale_items where sale_id = p_sale_id loop
    perform apply_stock_in('ink', v_row.ink_id, v_row.quantity_kg, v_row.cost_per_kg_snapshot,
                           'return', 'sales', p_sale_id);
  end loop;

  update sales set status = 'cancelled', cancelled_at = now(),
         notes = coalesce(notes || ' · ', '') || 'Cancelled: ' || coalesce(p_reason, 'no reason given')
   where id = p_sale_id;
  return p_sale_id;
end $$;

-- ─────────────── 4. ADJUSTMENT ───────────────

-- Sets stock to a counted quantity. Average is left alone unless p_cost_per_kg is given
-- (used for opening stock, where the correction carries its own valuation).
create or replace function adjust_stock(
  p_item_type text, p_item_id uuid, p_new_qty numeric, p_reason text,
  p_cost_per_kg numeric default null
) returns void language plpgsql set search_path = public as $$
declare
  v_stock numeric(14,3); v_avg numeric(14,4); v_diff numeric(14,3); v_new_avg numeric(14,4);
begin
  if p_new_qty is null or p_new_qty < 0 then
    raise exception 'Counted quantity cannot be negative' using errcode = 'P0001';
  end if;

  if p_item_type = 'raw' then
    select current_stock_kg, avg_cost_per_kg into v_stock, v_avg
      from raw_materials where id = p_item_id for update;
  else
    select current_stock_kg, avg_cost_per_kg into v_stock, v_avg
      from inks where id = p_item_id for update;
  end if;

  if v_stock is null then raise exception 'Item not found' using errcode = 'P0001'; end if;

  v_diff := p_new_qty - v_stock;
  v_new_avg := v_avg;

  -- A valued increase re-averages; a valued write-down of everything adopts the given cost.
  if p_cost_per_kg is not null and p_new_qty > 0 then
    if v_diff > 0 then
      v_new_avg := ((v_stock * v_avg) + (v_diff * p_cost_per_kg)) / p_new_qty;
    elsif v_stock = 0 then
      v_new_avg := p_cost_per_kg;
    end if;
  end if;

  if p_item_type = 'raw' then
    update raw_materials set current_stock_kg = p_new_qty, avg_cost_per_kg = v_new_avg,
           updated_at = now() where id = p_item_id;
  else
    update inks set current_stock_kg = p_new_qty, avg_cost_per_kg = v_new_avg,
           updated_at = now() where id = p_item_id;
  end if;

  if v_diff <> 0 then
    insert into inventory_movements
      (item_type, item_id, movement_type, quantity_kg, cost_per_kg, balance_after, notes)
    values (p_item_type, p_item_id, 'adjustment', v_diff, coalesce(p_cost_per_kg, v_new_avg),
            p_new_qty, p_reason);
  end if;
end $$;

-- ─────────────── FORMULA · PAYMENTS ───────────────

-- Replace an ink's formula in one transaction.
create or replace function save_ink_formula(p_ink_id uuid, p_items jsonb)
returns uuid language plpgsql set search_path = public as $$
declare v_line jsonb; v_i int := 0;
begin
  delete from ink_formula_items where ink_id = p_ink_id;
  for v_line in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into ink_formula_items (ink_id, raw_material_id, quantity_kg, note, sort_order)
    values (p_ink_id, (v_line->>'raw_material_id')::uuid, (v_line->>'quantity_kg')::numeric,
            nullif(v_line->>'note',''), v_i);
    v_i := v_i + 1;
  end loop;
  return p_ink_id;
end $$;

-- Record a payment against a supplier or customer, optionally against one document.
create or replace function record_payment(payload jsonb)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid;
  v_party text := payload->>'party_type';
  v_amount numeric(14,2) := (payload->>'amount')::numeric;
  v_ref_id uuid := nullif(payload->>'ref_id','')::uuid;
begin
  if v_amount is null or v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = 'P0001';
  end if;

  insert into payments (party_type, party_id, direction, amount, method, reference, paid_on,
                        ref_table, ref_id, notes)
  values (v_party, (payload->>'party_id')::uuid,
          case when v_party = 'supplier' then 'out' else 'in' end,
          v_amount, nullif(payload->>'method',''), nullif(payload->>'reference',''),
          coalesce((payload->>'paid_on')::date, current_date),
          nullif(payload->>'ref_table',''), v_ref_id, nullif(payload->>'notes',''))
  returning id into v_id;

  if v_ref_id is not null then
    if v_party = 'supplier' then
      update purchases set paid_amount = paid_amount + v_amount where id = v_ref_id;
    else
      update sales set paid_amount = paid_amount + v_amount where id = v_ref_id;
    end if;
  end if;

  return v_id;
end $$;

-- ─────────────── LOW-STOCK TRIGGER ───────────────

create or replace function check_stock_level() returns trigger language plpgsql
set search_path = public as $$
declare v_type text := case tg_table_name when 'raw_materials' then 'raw' else 'ink' end;
begin
  if not new.is_active then
    update stock_alerts set is_resolved = true, resolved_at = now()
     where item_id = new.id and not is_resolved;
    return new;
  end if;

  if new.current_stock_kg <= 0 then
    update stock_alerts set is_resolved = true, resolved_at = now()
     where item_id = new.id and level = 'warning' and not is_resolved;
    if not exists (select 1 from stock_alerts
                   where item_id = new.id and level = 'critical' and not is_resolved) then
      insert into stock_alerts (item_type, item_id, item_name, level, message)
      values (v_type, new.id, new.name, 'critical', new.name || ' is out of stock');
    end if;
  elsif new.current_stock_kg <= new.reorder_level_kg and new.reorder_level_kg > 0 then
    update stock_alerts set is_resolved = true, resolved_at = now()
     where item_id = new.id and level = 'critical' and not is_resolved;
    if not exists (select 1 from stock_alerts
                   where item_id = new.id and level = 'warning' and not is_resolved) then
      insert into stock_alerts (item_type, item_id, item_name, level, message)
      values (v_type, new.id, new.name, 'warning',
              new.name || ' is low: ' || trim(to_char(new.current_stock_kg, 'FM999999990.999'))
              || ' kg left (reorder at '
              || trim(to_char(new.reorder_level_kg, 'FM999999990.999')) || ' kg)');
    end if;
  else
    update stock_alerts set is_resolved = true, resolved_at = now()
     where item_id = new.id and not is_resolved;
  end if;
  return new;
end $$;

drop trigger if exists trg_raw_stock_level on raw_materials;
create trigger trg_raw_stock_level after update of current_stock_kg, reorder_level_kg, is_active
  on raw_materials for each row execute function check_stock_level();

drop trigger if exists trg_ink_stock_level on inks;
create trigger trg_ink_stock_level after update of current_stock_kg, reorder_level_kg, is_active
  on inks for each row execute function check_stock_level();

-- ─────────────── KEEP updated_at HONEST ───────────────

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_suppliers_touch on suppliers;
create trigger trg_suppliers_touch before update on suppliers
  for each row execute function touch_updated_at();
drop trigger if exists trg_customers_touch on customers;
create trigger trg_customers_touch before update on customers
  for each row execute function touch_updated_at();
