-- 005_realtime.sql — tables the browser subscribes to for live invalidation.
-- Adding a table twice raises, so each add is guarded.

do $$
declare t text;
begin
  foreach t in array array['raw_materials','inks','purchases','sales',
    'production_batches','stock_alerts','inventory_movements']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
