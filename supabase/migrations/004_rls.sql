-- 004_rls.sql — single-operator security: any authenticated user sees everything,
-- anonymous sees nothing. The owner_id columns are already in place, so turning this
-- into a multi-tenant product later is a one-line change per policy.

do $$
declare t text;
begin
  foreach t in array array['suppliers','customers','raw_materials','inks','ink_formula_items',
    'purchases','purchase_items','production_batches','production_consumption',
    'sales','sale_items','customer_ink_prices','inventory_movements','stock_alerts',
    'payments','app_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format($f$create policy "authenticated_all" on %I
                     for all to authenticated using (true) with check (true)$f$, t);
    -- belt and braces: the anon key gets no grants at all on business tables
    execute format('revoke all on table %I from anon', t);
  end loop;
end $$;

-- Views inherit RLS through security_invoker, but drop anon's grants anyway.
do $$
declare v text;
begin
  foreach v in array array['v_low_stock','v_inventory_value','v_ink_profitability',
    'v_customer_summary','v_supplier_summary','v_material_usage','v_monthly_trend',
    'v_stock_reconciliation']
  loop
    execute format('revoke all on table %I from anon', v);
    execute format('grant select on table %I to authenticated', v);
  end loop;
end $$;

-- RPCs are callable by signed-in users only.
do $$
declare f text;
begin
  foreach f in array array[
    'record_purchase(jsonb)','cancel_purchase(uuid,text)',
    'save_production_batch(jsonb)','complete_production_batch(uuid,numeric)',
    'cancel_production_batch(uuid,text)',
    'record_sale(jsonb)','cancel_sale(uuid,text)',
    'adjust_stock(text,uuid,numeric,text,numeric)',
    'save_ink_formula(uuid,jsonb)','record_payment(jsonb)','next_document_no(text)',
    'get_dashboard_summary(date,date)','get_trend_series(date,date,text)',
    'get_profit_loss(date,date)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Internal stock helpers: the RPCs above run as the caller, so `authenticated`
-- keeps execute; only anonymous callers are shut out.
revoke all on function apply_stock_in(text,uuid,numeric,numeric,text,text,uuid) from public, anon;
revoke all on function apply_stock_out(text,uuid,numeric,text,text,uuid) from public, anon;
revoke all on function reverse_stock_in(text,uuid,numeric,numeric,text,text,uuid,text) from public, anon;
grant execute on function apply_stock_in(text,uuid,numeric,numeric,text,text,uuid) to authenticated;
grant execute on function apply_stock_out(text,uuid,numeric,text,text,uuid) to authenticated;
grant execute on function reverse_stock_in(text,uuid,numeric,numeric,text,text,uuid,text) to authenticated;
