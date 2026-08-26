-- seed.sql — the worked example from the plan (Part C1), built entirely through the RPCs.
-- After a `supabase db reset` these numbers must come out exactly:
--   Blue Pigment WAC 1270.0000 · Process Blue cost/kg 714.5773 · sale profit 9416.91

do $$
declare
  v_sup uuid; v_cust uuid;
  v_pig uuid; v_resin uuid; v_solv uuid;
  v_ink uuid; v_batch uuid;
begin
  insert into suppliers (name, company, phone, city)
  values ('Karachi Pigments', 'Karachi Pigments (Pvt) Ltd', '0321-1234567', 'Karachi')
  returning id into v_sup;

  insert into customers (name, company, phone, city)
  values ('Ahmed Printers', 'Ahmed Printing Press', '0300-7654321', 'Lahore')
  returning id into v_cust;

  insert into raw_materials (name, code, category, reorder_level_kg, default_supplier_id)
  values ('Blue Pigment', 'PIG-BLU', 'pigment', 40, v_sup) returning id into v_pig;
  insert into raw_materials (name, code, category, reorder_level_kg, default_supplier_id)
  values ('Alkyd Resin', 'RES-ALK', 'resin', 60, v_sup) returning id into v_resin;
  insert into raw_materials (name, code, category, reorder_level_kg, default_supplier_id)
  values ('Solvent 100', 'SOL-100', 'solvent', 30, v_sup) returning id into v_solv;

  -- Purchase 1 — 100 kg @ 1,200 with 3,000 freight → landed 1,230/kg
  perform record_purchase(jsonb_build_object(
    'supplier_id', v_sup, 'purchase_date', (current_date - 30)::text,
    'freight_cost', 3000, 'paid_amount', 123000,
    'items', jsonb_build_array(
      jsonb_build_object('raw_material_id', v_pig, 'quantity_kg', 100, 'price_per_kg', 1200))));

  -- Supporting materials
  perform record_purchase(jsonb_build_object(
    'supplier_id', v_sup, 'purchase_date', (current_date - 28)::text, 'paid_amount', 105000,
    'items', jsonb_build_array(
      jsonb_build_object('raw_material_id', v_resin, 'quantity_kg', 200, 'price_per_kg', 400),
      jsonb_build_object('raw_material_id', v_solv, 'quantity_kg', 100, 'price_per_kg', 250))));

  -- Purchase 2 — 50 kg @ 1,350, no freight → WAC becomes 1,270.0000
  perform record_purchase(jsonb_build_object(
    'supplier_id', v_sup, 'purchase_date', (current_date - 14)::text, 'paid_amount', 0,
    'items', jsonb_build_array(
      jsonb_build_object('raw_material_id', v_pig, 'quantity_kg', 50, 'price_per_kg', 1350))));

  -- The ink and its formula
  insert into inks (name, code, color_hex, ink_type, batch_size_kg, labor_cost_per_batch,
                    overhead_cost_per_batch, packaging_cost_per_kg, expected_wastage_pct,
                    default_price_per_kg, reorder_level_kg)
  values ('Process Blue', 'INK-PB', '#1e5fa8', 'offset', 100, 2500, 1800, 12, 3, 950, 20)
  returning id into v_ink;

  perform save_ink_formula(v_ink, jsonb_build_array(
    jsonb_build_object('raw_material_id', v_pig,   'quantity_kg', 30),
    jsonb_build_object('raw_material_id', v_resin, 'quantity_kg', 55),
    jsonb_build_object('raw_material_id', v_solv,  'quantity_kg', 15)));

  -- Production: planned 100 kg, produced 97 kg
  v_batch := save_production_batch(jsonb_build_object(
    'ink_id', v_ink, 'production_date', (current_date - 7)::text,
    'planned_qty_kg', 100, 'labor_cost', 2500, 'overhead_cost', 1800,
    'items', jsonb_build_array(
      jsonb_build_object('raw_material_id', v_pig,   'quantity_kg', 30),
      jsonb_build_object('raw_material_id', v_resin, 'quantity_kg', 55),
      jsonb_build_object('raw_material_id', v_solv,  'quantity_kg', 15))));

  perform complete_production_batch(v_batch, 97);

  -- Sale: 40 kg @ 950
  perform record_sale(jsonb_build_object(
    'customer_id', v_cust, 'sale_date', (current_date - 3)::text, 'paid_amount', 20000,
    'items', jsonb_build_array(
      jsonb_build_object('ink_id', v_ink, 'quantity_kg', 40, 'price_per_kg', 950))));

  insert into customer_ink_prices (customer_id, ink_id, price_per_kg)
  values (v_cust, v_ink, 950);
end $$;

-- Verification — every line must read "PASS".
do $$
declare v numeric; v_msg text;
begin
  select avg_cost_per_kg into v from raw_materials where code = 'PIG-BLU';
  raise notice '% Blue Pigment WAC: % (expected 1270.0000)',
    case when v = 1270.0000 then 'PASS' else 'FAIL' end, v;

  select cost_per_kg into v from production_batches order by created_at desc limit 1;
  raise notice '% Process Blue cost/kg: % (expected 714.5773)',
    case when v = 714.5773 then 'PASS' else 'FAIL' end, v;

  select profit_total into v from sales order by created_at desc limit 1;
  raise notice '% Sale profit: % (expected 9416.91)',
    case when v = 9416.91 then 'PASS' else 'FAIL' end, v;

  select count(*) into v from v_stock_reconciliation;
  raise notice '% Ledger reconciliation: % item(s) out of balance (expected 0)',
    case when v = 0 then 'PASS' else 'FAIL' end, v;
end $$;
