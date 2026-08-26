-- 001_core_schema.sql — tables, constraints, indexes

create extension if not exists "pgcrypto";

-- ─────────────── MASTER DATA ───────────────

create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default auth.uid(),
  name        text not null,
  company     text,
  phone       text,
  email       text,
  address     text,
  city        text,
  notes       text,
  opening_balance numeric(14,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default auth.uid(),
  name        text not null,
  company     text,
  phone       text,
  email       text,
  address     text,
  city        text,
  notes       text,
  opening_balance numeric(14,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists raw_materials (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid default auth.uid(),
  name                text not null,
  code                text unique,
  category            text,                       -- pigment | resin | solvent | additive
  unit                text not null default 'kg',
  current_stock_kg    numeric(14,3) not null default 0,
  avg_cost_per_kg     numeric(14,4) not null default 0,
  last_price_per_kg   numeric(14,4),
  reorder_level_kg    numeric(14,3) not null default 0,
  default_supplier_id uuid references suppliers(id) on delete set null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint raw_stock_non_negative check (current_stock_kg >= 0)
);

create table if not exists inks (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid default auth.uid(),
  name                    text not null,
  code                    text unique,
  color_hex               text,
  ink_type                text,                 -- offset | flexo | gravure | screen
  batch_size_kg           numeric(14,3) not null check (batch_size_kg > 0),
  labor_cost_per_batch    numeric(14,2) not null default 0,
  overhead_cost_per_batch numeric(14,2) not null default 0,
  packaging_cost_per_kg   numeric(14,4) not null default 0,
  expected_wastage_pct    numeric(5,2) not null default 0 check (expected_wastage_pct between 0 and 99),
  default_price_per_kg    numeric(14,4),
  current_stock_kg        numeric(14,3) not null default 0,
  avg_cost_per_kg         numeric(14,4) not null default 0,
  reorder_level_kg        numeric(14,3) not null default 0,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint ink_stock_non_negative check (current_stock_kg >= 0)
);

create table if not exists ink_formula_items (
  id              uuid primary key default gen_random_uuid(),
  ink_id          uuid not null references inks(id) on delete cascade,
  raw_material_id uuid not null references raw_materials(id) on delete restrict,
  quantity_kg     numeric(14,3) not null check (quantity_kg > 0),
  note            text,
  sort_order      int not null default 0,
  unique (ink_id, raw_material_id)
);

-- ─────────────── PURCHASING ───────────────

create table if not exists purchases (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid default auth.uid(),
  supplier_id     uuid not null references suppliers(id) on delete restrict,
  invoice_no      text,
  purchase_date   date not null default current_date,
  subtotal        numeric(14,2) not null default 0,
  freight_cost    numeric(14,2) not null default 0,
  other_cost      numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  paid_amount     numeric(14,2) not null default 0,
  status          text not null default 'received'
                  check (status in ('draft','received','cancelled')),
  notes           text,
  idempotency_key text unique,
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz
);

create table if not exists purchase_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_id        uuid not null references purchases(id) on delete cascade,
  raw_material_id    uuid not null references raw_materials(id) on delete restrict,
  quantity_kg        numeric(14,3) not null check (quantity_kg > 0),
  price_per_kg       numeric(14,4) not null check (price_per_kg >= 0),
  landed_cost_per_kg numeric(14,4) not null default 0,
  line_total         numeric(14,2) not null default 0
);

-- ─────────────── PRODUCTION ───────────────

create table if not exists production_batches (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid default auth.uid(),
  ink_id          uuid not null references inks(id) on delete restrict,
  batch_no        text unique,
  production_date date not null default current_date,
  planned_qty_kg  numeric(14,3) not null check (planned_qty_kg > 0),
  produced_qty_kg numeric(14,3) check (produced_qty_kg > 0),
  material_cost   numeric(14,2) not null default 0,
  labor_cost      numeric(14,2) not null default 0,
  overhead_cost   numeric(14,2) not null default 0,
  packaging_cost  numeric(14,2) not null default 0,
  total_cost      numeric(14,2) not null default 0,
  cost_per_kg     numeric(14,4),
  status          text not null default 'draft'
                  check (status in ('draft','completed','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create table if not exists production_consumption (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references production_batches(id) on delete cascade,
  raw_material_id uuid not null references raw_materials(id) on delete restrict,
  quantity_kg     numeric(14,3) not null check (quantity_kg > 0),
  cost_per_kg     numeric(14,4) not null default 0,
  line_cost       numeric(14,2) not null default 0
);

-- ─────────────── SALES ───────────────

create table if not exists sales (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid default auth.uid(),
  customer_id     uuid not null references customers(id) on delete restrict,
  invoice_no      text,
  sale_date       date not null default current_date,
  subtotal        numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  cogs_total      numeric(14,2) not null default 0,
  profit_total    numeric(14,2) not null default 0,
  paid_amount     numeric(14,2) not null default 0,
  status          text not null default 'confirmed'
                  check (status in ('draft','confirmed','cancelled')),
  notes           text,
  idempotency_key text unique,
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz
);

create table if not exists sale_items (
  id                   uuid primary key default gen_random_uuid(),
  sale_id              uuid not null references sales(id) on delete cascade,
  ink_id               uuid not null references inks(id) on delete restrict,
  quantity_kg          numeric(14,3) not null check (quantity_kg > 0),
  price_per_kg         numeric(14,4) not null check (price_per_kg >= 0),
  cost_per_kg_snapshot numeric(14,4) not null default 0,
  line_total           numeric(14,2) not null default 0,
  line_cost            numeric(14,2) not null default 0,
  line_profit          numeric(14,2) not null default 0
);

create table if not exists customer_ink_prices (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  ink_id       uuid not null references inks(id) on delete cascade,
  price_per_kg numeric(14,4) not null,
  unique (customer_id, ink_id)
);

-- ─────────────── LEDGER · ALERTS · SETTINGS ───────────────

create table if not exists inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid default auth.uid(),
  item_type     text not null check (item_type in ('raw','ink')),
  item_id       uuid not null,
  movement_type text not null check (movement_type in
                ('purchase','production_in','production_out','sale','adjustment','return')),
  quantity_kg   numeric(14,3) not null,          -- signed
  cost_per_kg   numeric(14,4),
  balance_after numeric(14,3) not null,
  ref_table     text,
  ref_id        uuid,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid default auth.uid(),
  item_type   text not null check (item_type in ('raw','ink')),
  item_id     uuid not null,
  item_name   text not null,
  level       text not null check (level in ('warning','critical')),
  message     text not null,
  is_read     boolean not null default false,
  is_resolved boolean not null default false,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists payments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid default auth.uid(),
  party_type text not null check (party_type in ('supplier','customer')),
  party_id   uuid not null,
  direction  text not null check (direction in ('in','out')),
  amount     numeric(14,2) not null check (amount > 0),
  method     text,                               -- cash | bank | cheque
  reference  text,
  paid_on    date not null default current_date,
  ref_table  text,
  ref_id     uuid,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id                 int primary key default 1 check (id = 1),
  company_name       text default 'My Ink Works',
  company_address    text,
  company_phone      text,
  currency           text not null default 'PKR',
  low_stock_email    text,
  default_labor_rate numeric(14,2) default 0,
  invoice_prefix     text default 'INV-',
  batch_prefix       text default 'B-',
  purchase_prefix    text default 'PUR-',
  updated_at         timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict do nothing;

-- ─────────────── INDEXES ───────────────

create index if not exists idx_movements_item      on inventory_movements (item_type, item_id, created_at desc);
create index if not exists idx_movements_created   on inventory_movements (created_at desc);
create index if not exists idx_movements_ref       on inventory_movements (ref_table, ref_id);
create index if not exists idx_purchases_date      on purchases (purchase_date desc);
create index if not exists idx_purchases_supplier  on purchases (supplier_id);
create index if not exists idx_pitems_purchase     on purchase_items (purchase_id);
create index if not exists idx_pitems_material     on purchase_items (raw_material_id);
create index if not exists idx_sales_date          on sales (sale_date desc);
create index if not exists idx_sales_customer      on sales (customer_id);
create index if not exists idx_sitems_sale         on sale_items (sale_id);
create index if not exists idx_sitems_ink          on sale_items (ink_id);
create index if not exists idx_batches_ink         on production_batches (ink_id, production_date desc);
create index if not exists idx_consumption_batch   on production_consumption (batch_id);
create index if not exists idx_consumption_mat     on production_consumption (raw_material_id);
create index if not exists idx_alerts_open         on stock_alerts (is_resolved, created_at desc);
create index if not exists idx_raw_active          on raw_materials (is_active) where is_active;
create index if not exists idx_inks_active         on inks (is_active) where is_active;
create index if not exists idx_formula_ink         on ink_formula_items (ink_id);
create index if not exists idx_payments_party      on payments (party_type, party_id, paid_on desc);
