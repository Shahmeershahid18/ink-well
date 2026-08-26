-- 003_views.sql — dashboards and reports read from SQL, not from JS math.
-- security_invoker keeps RLS applied through the view.

-- Matches check_stock_level() exactly: out of stock is always critical, even with no
-- reorder level set; a reorder level only adds the "low" warning band above zero.
create or replace view v_low_stock with (security_invoker = on) as
select 'raw' as item_type, id, name, code, current_stock_kg, reorder_level_kg,
       avg_cost_per_kg, current_stock_kg * avg_cost_per_kg as stock_value,
       default_supplier_id,
       case when current_stock_kg <= 0 then 'critical' else 'warning' end as level
  from raw_materials
 where is_active
   and (current_stock_kg <= 0
        or (reorder_level_kg > 0 and current_stock_kg <= reorder_level_kg))
union all
select 'ink', id, name, code, current_stock_kg, reorder_level_kg,
       avg_cost_per_kg, current_stock_kg * avg_cost_per_kg, null::uuid,
       case when current_stock_kg <= 0 then 'critical' else 'warning' end
  from inks
 where is_active
   and (current_stock_kg <= 0
        or (reorder_level_kg > 0 and current_stock_kg <= reorder_level_kg));

create or replace view v_inventory_value with (security_invoker = on) as
select
  (select coalesce(sum(current_stock_kg * avg_cost_per_kg),0) from raw_materials) as raw_value,
  (select coalesce(sum(current_stock_kg * avg_cost_per_kg),0) from inks)          as ink_value,
  (select coalesce(sum(current_stock_kg),0) from raw_materials)                   as raw_kg,
  (select coalesce(sum(current_stock_kg),0) from inks)                            as ink_kg;

create or replace view v_ink_profitability with (security_invoker = on) as
select i.id, i.name, i.code, i.color_hex, i.ink_type,
       i.current_stock_kg, i.avg_cost_per_kg, i.default_price_per_kg,
       i.current_stock_kg * i.avg_cost_per_kg as stock_value,
       coalesce(p.produced_kg,0)  as produced_kg,
       coalesce(s.sold_kg,0)      as sold_kg,
       coalesce(s.revenue,0)      as revenue,
       coalesce(s.cost,0)         as cost,
       coalesce(s.profit,0)       as profit,
       case when coalesce(s.revenue,0) > 0
            then round(s.profit / s.revenue * 100, 2) else 0 end as margin_pct,
       case when coalesce(s.sold_kg,0) > 0
            then round(s.revenue / s.sold_kg, 2) else i.default_price_per_kg end as avg_price_per_kg
  from inks i
  left join (select ink_id, sum(produced_qty_kg) produced_kg
               from production_batches where status='completed' group by 1) p on p.ink_id = i.id
  left join (select si.ink_id, sum(si.quantity_kg) sold_kg, sum(si.line_total) revenue,
                    sum(si.line_cost) cost, sum(si.line_profit) profit
               from sale_items si join sales s on s.id = si.sale_id
              where s.status='confirmed' group by 1) s on s.ink_id = i.id;

/*
  Two things to be careful about here:
  1. Order totals and line quantities are aggregated separately — joining sales to
     sale_items and summing sales.total would multiply the order value by its line count.
  2. Cash received comes from the payments ledger, not from sales.paid_amount, so a
     payment recorded against the account rather than a specific invoice still counts.
     record_sale writes a payment row for anything paid up front, so nothing is missed.
*/
create or replace view v_customer_summary with (security_invoker = on) as
select c.id, c.name, c.company, c.phone, c.city, c.is_active,
       coalesce(o.orders,0)      as orders,
       coalesce(k.total_kg,0)    as total_kg,
       coalesce(o.revenue,0)     as revenue,
       coalesce(o.profit,0)      as profit,
       c.opening_balance + coalesce(o.revenue,0) - coalesce(pay.received,0) as receivable,
       o.last_order_date
  from customers c
  left join (select customer_id, count(*) orders, sum(total) revenue,
                    sum(profit_total) profit, max(sale_date) last_order_date
               from sales where status='confirmed' group by 1) o on o.customer_id = c.id
  left join (select s.customer_id, sum(si.quantity_kg) total_kg
               from sale_items si join sales s on s.id = si.sale_id
              where s.status='confirmed' group by 1) k on k.customer_id = c.id
  left join (select party_id, sum(amount) received from payments
              where party_type='customer' and direction='in' group by 1) pay
         on pay.party_id = c.id;

create or replace view v_supplier_summary with (security_invoker = on) as
select sup.id, sup.name, sup.company, sup.phone, sup.city, sup.is_active,
       coalesce(p.purchase_count,0) as purchase_count,
       coalesce(p.total_spend,0)    as total_spend,
       sup.opening_balance + coalesce(p.total_spend,0) - coalesce(pay.paid,0) as payable,
       p.last_purchase_date
  from suppliers sup
  left join (select supplier_id, count(*) purchase_count, sum(total) total_spend,
                    max(purchase_date) last_purchase_date
               from purchases where status='received' group by 1) p on p.supplier_id = sup.id
  left join (select party_id, sum(amount) paid from payments
              where party_type='supplier' and direction='out' group by 1) pay
         on pay.party_id = sup.id;

create or replace view v_material_usage with (security_invoker = on) as
select rm.id, rm.name, rm.code, rm.category, rm.unit, rm.is_active,
       rm.current_stock_kg, rm.avg_cost_per_kg, rm.reorder_level_kg, rm.default_supplier_id,
       rm.current_stock_kg * rm.avg_cost_per_kg as stock_value,
       coalesce(pi.purchased_kg,0)    as purchased_kg,
       coalesce(pi.purchase_value,0)  as purchase_value,
       coalesce(pc.consumed_kg,0)     as consumed_kg,
       coalesce(pc90.consumed_kg_90,0) as consumed_kg_90,
       case when coalesce(pc90.consumed_kg_90,0) > 0
            then round(rm.current_stock_kg / (pc90.consumed_kg_90 / 90.0), 1)
            else null end as days_of_cover
  from raw_materials rm
  left join (select pit.raw_material_id, sum(pit.quantity_kg) purchased_kg,
                    sum(pit.line_total) purchase_value
               from purchase_items pit
               join purchases p on p.id = pit.purchase_id
              where p.status='received' group by 1) pi on pi.raw_material_id = rm.id
  left join (select pcx.raw_material_id, sum(pcx.quantity_kg) consumed_kg
               from production_consumption pcx
               join production_batches b on b.id = pcx.batch_id
              where b.status='completed' group by 1) pc on pc.raw_material_id = rm.id
  left join (select pcx.raw_material_id, sum(pcx.quantity_kg) consumed_kg_90
               from production_consumption pcx
               join production_batches b on b.id = pcx.batch_id
              where b.status='completed'
                and b.production_date >= current_date - 90 group by 1) pc90
         on pc90.raw_material_id = rm.id;

create or replace view v_monthly_trend with (security_invoker = on) as
select month, sum(purchases) purchases, sum(revenue) revenue, sum(cogs) cogs,
       sum(revenue) - sum(cogs) profit
from (
  select date_trunc('month', purchase_date)::date as month, sum(total) purchases,
         0::numeric revenue, 0::numeric cogs
    from purchases where status='received' group by 1
  union all
  select date_trunc('month', sale_date)::date, 0::numeric, sum(total), sum(cogs_total)
    from sales where status='confirmed' group by 1
  union all
  select date_trunc('month', production_date)::date, 0::numeric, 0::numeric, 0::numeric
    from production_batches where status='completed' group by 1
) t group by month order by month;

-- The audit query: this must always return zero rows.
create or replace view v_stock_reconciliation with (security_invoker = on) as
select 'raw' as item_type, rm.id, rm.name, rm.current_stock_kg,
       coalesce(m.ledger_kg,0) as ledger_kg,
       rm.current_stock_kg - coalesce(m.ledger_kg,0) as difference_kg
  from raw_materials rm
  left join (select item_id, sum(quantity_kg) ledger_kg from inventory_movements
              where item_type='raw' group by 1) m on m.item_id = rm.id
 where abs(rm.current_stock_kg - coalesce(m.ledger_kg,0)) > 0.0005
union all
select 'ink', i.id, i.name, i.current_stock_kg,
       coalesce(m.ledger_kg,0), i.current_stock_kg - coalesce(m.ledger_kg,0)
  from inks i
  left join (select item_id, sum(quantity_kg) ledger_kg from inventory_movements
              where item_type='ink' group by 1) m on m.item_id = i.id
 where abs(i.current_stock_kg - coalesce(m.ledger_kg,0)) > 0.0005;

-- ─────────────── PARAMETERISED REPORTS ───────────────

create or replace function get_dashboard_summary(p_from date, p_to date)
returns table (
  purchase_total numeric, purchase_count bigint,
  revenue numeric, cogs numeric, gross_profit numeric, margin_pct numeric, sale_count bigint,
  produced_kg numeric, production_cost numeric,
  raw_stock_value numeric, ink_stock_value numeric, inventory_value numeric,
  raw_kg numeric, ink_kg numeric,
  low_stock_count bigint, payable numeric, receivable numeric
) language sql stable set search_path = public as $$
  select
    (select coalesce(sum(total),0) from purchases
      where status='received' and purchase_date between p_from and p_to),
    (select count(*) from purchases
      where status='received' and purchase_date between p_from and p_to),
    (select coalesce(sum(total),0) from sales
      where status='confirmed' and sale_date between p_from and p_to),
    (select coalesce(sum(cogs_total),0) from sales
      where status='confirmed' and sale_date between p_from and p_to),
    (select coalesce(sum(profit_total),0) from sales
      where status='confirmed' and sale_date between p_from and p_to),
    (select case when coalesce(sum(total),0) > 0
                 then round(sum(profit_total)/sum(total)*100,2) else 0 end
       from sales where status='confirmed' and sale_date between p_from and p_to),
    (select count(*) from sales
      where status='confirmed' and sale_date between p_from and p_to),
    (select coalesce(sum(produced_qty_kg),0) from production_batches
      where status='completed' and production_date between p_from and p_to),
    (select coalesce(sum(total_cost),0) from production_batches
      where status='completed' and production_date between p_from and p_to),
    (select raw_value from v_inventory_value),
    (select ink_value from v_inventory_value),
    (select raw_value + ink_value from v_inventory_value),
    (select raw_kg from v_inventory_value),
    (select ink_kg from v_inventory_value),
    (select count(*) from v_low_stock),
    -- payable and receivable read the same way as the party summaries: documents
    -- outstanding less everything the payments ledger says has actually moved
    (select coalesce(sum(payable),0) from v_supplier_summary),
    (select coalesce(sum(receivable),0) from v_customer_summary);
$$;

-- Daily or monthly series for the dashboard trend chart.
create or replace function get_trend_series(p_from date, p_to date, p_grain text default 'day')
returns table (bucket date, purchases numeric, revenue numeric, cogs numeric, profit numeric)
language sql stable set search_path = public as $$
  with buckets as (
    select generate_series(
      date_trunc(case when p_grain = 'month' then 'month' else 'day' end, p_from::timestamp),
      date_trunc(case when p_grain = 'month' then 'month' else 'day' end, p_to::timestamp),
      case when p_grain = 'month' then interval '1 month' else interval '1 day' end
    )::date as bucket
  ),
  pur as (
    select date_trunc(case when p_grain = 'month' then 'month' else 'day' end,
                      purchase_date::timestamp)::date as bucket, sum(total) amt
      from purchases where status='received' and purchase_date between p_from and p_to group by 1
  ),
  sal as (
    select date_trunc(case when p_grain = 'month' then 'month' else 'day' end,
                      sale_date::timestamp)::date as bucket,
           sum(total) rev, sum(cogs_total) cogs, sum(profit_total) prof
      from sales where status='confirmed' and sale_date between p_from and p_to group by 1
  )
  select b.bucket, coalesce(pur.amt,0), coalesce(sal.rev,0),
         coalesce(sal.cogs,0), coalesce(sal.prof,0)
    from buckets b
    left join pur on pur.bucket = b.bucket
    left join sal on sal.bucket = b.bucket
   order by b.bucket;
$$;

-- Profit & loss for a period, one row per month plus the shape the P&L tab needs.
create or replace function get_profit_loss(p_from date, p_to date)
returns table (
  month date, revenue numeric, cogs numeric, gross_profit numeric, margin_pct numeric,
  purchases numeric, production_cost numeric, produced_kg numeric
) language sql stable set search_path = public as $$
  with months as (
    select generate_series(date_trunc('month', p_from::timestamp),
                           date_trunc('month', p_to::timestamp), interval '1 month')::date as month
  ),
  s as (select date_trunc('month', sale_date)::date m, sum(total) rev,
               sum(cogs_total) cogs, sum(profit_total) prof
          from sales where status='confirmed' and sale_date between p_from and p_to group by 1),
  p as (select date_trunc('month', purchase_date)::date m, sum(total) amt
          from purchases where status='received' and purchase_date between p_from and p_to group by 1),
  b as (select date_trunc('month', production_date)::date m, sum(total_cost) cost,
               sum(produced_qty_kg) kg
          from production_batches where status='completed'
           and production_date between p_from and p_to group by 1)
  select m.month, coalesce(s.rev,0), coalesce(s.cogs,0), coalesce(s.prof,0),
         case when coalesce(s.rev,0) > 0 then round(s.prof/s.rev*100,2) else 0 end,
         coalesce(p.amt,0), coalesce(b.cost,0), coalesce(b.kg,0)
    from months m
    left join s on s.m = m.month
    left join p on p.m = m.month
    left join b on b.m = m.month
   order by m.month;
$$;
