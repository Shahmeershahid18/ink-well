-- verify.sql — paste into the Supabase SQL editor any time you want to prove the
-- books still add up. Safe to run repeatedly: it reads, it never writes.

-- 1. Is the seed's worked example present and correct?
do $$
declare v numeric; v_n bigint;
begin
  raise notice '--- worked example (only meaningful if seed.sql was run) ---';

  select avg_cost_per_kg into v from raw_materials where code = 'PIG-BLU';
  if v is null then
    raise notice 'SKIP  Blue Pigment not found — seed.sql was not run on this project';
  else
    raise notice '% Blue Pigment WAC: % (expected 1270.0000)',
      case when v = 1270.0000 then 'PASS' else 'FAIL' end, v;
  end if;

  select cost_per_kg into v from production_batches
   where status = 'completed' order by created_at desc limit 1;
  if v is null then
    raise notice 'SKIP  no completed batches yet';
  else
    raise notice '% latest batch cost/kg: % (seed expects 714.5773)',
      case when v = 714.5773 then 'PASS' else 'INFO' end, v;
  end if;

  select profit_total into v from sales
   where status = 'confirmed' order by created_at desc limit 1;
  if v is null then
    raise notice 'SKIP  no confirmed sales yet';
  else
    raise notice '% latest sale profit: % (seed expects 9416.91)',
      case when v = 9416.91 then 'PASS' else 'INFO' end, v;
  end if;

  raise notice '--- integrity (must pass whatever your data is) ---';

  select count(*) into v_n from v_stock_reconciliation;
  raise notice '% ledger vs stock: % item(s) out of balance (expected 0)',
    case when v_n = 0 then 'PASS' else 'FAIL' end, v_n;

  select count(*) into v_n from raw_materials where current_stock_kg < 0;
  raise notice '% raw materials with negative stock: % (expected 0)',
    case when v_n = 0 then 'PASS' else 'FAIL' end, v_n;

  select count(*) into v_n from inks where current_stock_kg < 0;
  raise notice '% inks with negative stock: % (expected 0)',
    case when v_n = 0 then 'PASS' else 'FAIL' end, v_n;

  -- A confirmed sale's profit must equal revenue minus its own snapshotted cost.
  select count(*) into v_n from sales s
   where s.status = 'confirmed'
     and abs(s.profit_total - ((s.total) - s.cogs_total)) > 0.01;
  raise notice '% sales whose profit does not match revenue - COGS: % (expected 0)',
    case when v_n = 0 then 'PASS' else 'FAIL' end, v_n;

  -- Sale line totals must add up to the header.
  select count(*) into v_n from (
    select s.id from sales s join sale_items si on si.sale_id = s.id
     where s.status = 'confirmed'
     group by s.id, s.subtotal
    having abs(sum(si.line_total) - s.subtotal) > 0.01
  ) t;
  raise notice '% sales whose lines do not sum to the subtotal: % (expected 0)',
    case when v_n = 0 then 'PASS' else 'FAIL' end, v_n;

  -- Completed batches must have a cost per kg.
  select count(*) into v_n from production_batches
   where status = 'completed' and (cost_per_kg is null or produced_qty_kg is null);
  raise notice '% completed batches missing a cost/kg: % (expected 0)',
    case when v_n = 0 then 'PASS' else 'FAIL' end, v_n;
end $$;

-- 2. Where the money is right now.
select
  (select count(*) from raw_materials where is_active)              as active_materials,
  (select count(*) from inks where is_active)                       as active_inks,
  (select count(*) from purchases where status = 'received')        as purchases,
  (select count(*) from production_batches where status='completed') as batches,
  (select count(*) from sales where status = 'confirmed')           as sales,
  (select count(*) from inventory_movements)                        as ledger_rows,
  (select round(raw_value, 2) from v_inventory_value)               as raw_stock_value,
  (select round(ink_value, 2) from v_inventory_value)               as ink_stock_value;

-- 3. Anything that should be ordered.
select item_type, name, current_stock_kg, reorder_level_kg, level from v_low_stock
 order by level, current_stock_kg;
