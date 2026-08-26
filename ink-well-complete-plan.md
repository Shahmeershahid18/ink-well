# Ink Manufacturing WELL — Complete Build Plan

**Project:** `ink-well`
**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres 15, Auth, Realtime) · Tailwind + shadcn/ui · TanStack Query v5 · Recharts
**Users:** 1 (you) — single-operator, but schema is multi-tenant-ready
**Currency:** PKR · **Weight:** kg (3 dp) · **Timezone:** Asia/Karachi
**Total estimate:** 16–20 working days

---

# Part A — Foundations

## A1. What the system actually does

```
SUPPLIER ──purchase──▶ RAW MATERIAL STOCK ──production──▶ INK STOCK ──sale──▶ CUSTOMER
   │                        │                    │              │
   └─ payable          WAC cost/kg        batch cost/kg    price/kg → profit
```

Four money events, each one atomic and each one writing to a single append-only ledger:

| Event | Stock effect | Cost effect |
|---|---|---|
| Purchase | raw material **+** | recalculates raw material weighted-average cost |
| Production | raw material **−**, ink **+** | material cost + labor + overhead + packaging ÷ actual yield = ink cost/kg |
| Sale | ink **−** | snapshots ink cost/kg → locks profit for that line |
| Adjustment | either ± | corrects stock, keeps average unchanged |

## A2. Locked design decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Costing method | Moving weighted average (WAC) | FIFO needs cost-layer tables + consumption matching; WAC is one column and is accurate enough for continuous-process manufacturing |
| 2 | Stock truth | Append-only `inventory_movements` + cached `current_stock_kg` | Ledger = audit trail; cached column = fast dashboards; both written in the same transaction |
| 3 | Manufacturing | Batch-based with planned vs actual yield | Only way to measure real wastage and real cost |
| 4 | Formula | Template, **copied** into each batch | Recipe changes must not rewrite historic batch costs |
| 5 | Profit | Snapshotted per sale line | Future price changes must never alter past profit |
| 6 | Mutations | Postgres RPC functions only | Multi-table writes must be atomic; browser can't guarantee that |
| 7 | Deletes | Never — cancel + reverse | Deleting a purchase corrupts every WAC calculated after it |
| 8 | Numbers | `numeric` only, never float | Rounding drift across thousands of rows is unfixable |

## A3. Repository structure

```
ink-well/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                 # sidebar + header + realtime provider
│   │   ├── dashboard/page.tsx
│   │   ├── suppliers/page.tsx
│   │   ├── suppliers/[id]/page.tsx
│   │   ├── raw-materials/page.tsx
│   │   ├── raw-materials/[id]/page.tsx
│   │   ├── purchases/page.tsx
│   │   ├── purchases/new/page.tsx
│   │   ├── inks/page.tsx
│   │   ├── inks/[id]/page.tsx
│   │   ├── production/page.tsx
│   │   ├── production/new/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── customers/[id]/page.tsx
│   │   ├── sales/page.tsx
│   │   ├── sales/new/page.tsx
│   │   ├── sales/[id]/print/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                            # shadcn primitives
│   ├── layout/{sidebar,header,alert-bell}.tsx
│   ├── shared/{data-table,page-header,stat-card,money,weight,empty-state,confirm-dialog}.tsx
│   ├── suppliers/{supplier-form,supplier-table}.tsx
│   ├── materials/{material-form,material-table,stock-badge,movement-ledger}.tsx
│   ├── purchases/{purchase-form,purchase-line-editor,purchase-table}.tsx
│   ├── inks/{ink-form,formula-builder,cost-breakdown-bar,ink-table}.tsx
│   ├── production/{batch-form,batch-complete-dialog,batch-table}.tsx
│   ├── customers/{customer-form,customer-table}.tsx
│   ├── sales/{sale-form,sale-line-editor,sale-table,invoice-view}.tsx
│   └── dashboard/{kpi-row,trend-chart,alerts-panel,top-inks,recent-activity}.tsx
├── lib/
│   ├── supabase/{client.ts,server.ts,middleware.ts}
│   ├── queries/                       # one file per entity, TanStack hooks
│   ├── schemas/                       # Zod schemas shared client+server
│   ├── calc/{costing.ts,formula.ts}   # pure functions, unit-tested
│   ├── format.ts                      # money, weight, percent, date
│   └── constants.ts
├── hooks/{use-realtime-sync.ts,use-period.ts}
├── types/database.ts                  # generated: supabase gen types
├── supabase/
│   ├── migrations/
│   │   ├── 001_core_schema.sql
│   │   ├── 002_functions.sql
│   │   ├── 003_views.sql
│   │   ├── 004_rls.sql
│   │   └── 005_realtime.sql
│   └── seed.sql
└── middleware.ts
```

## A4. Conventions

- **Money:** `numeric(14,2)` · **Cost per kg:** `numeric(14,4)` · **Weight:** `numeric(14,3)`
- **Rounding:** only at display (`Intl.NumberFormat('en-PK')`). Never round in SQL except final totals.
- **Business dates:** `date`, not `timestamptz`. Audit timestamps: `timestamptz default now()`.
- **Naming:** tables plural snake_case; views `v_*`; functions verb_noun; every FK `on delete restrict` except child lines (`cascade`).
- **Status enums as text + check constraint** (easier to extend than Postgres enums).

---

# Part B — The Phases

---

## Phase 0 — Project setup

**Goal:** running Next.js app connected to Supabase, nothing else.
**Duration:** 0.5 day

### Tasks
1. `npx create-next-app@latest ink-well --typescript --tailwind --app --eslint --src-dir=false`
2. Install dependencies:
   ```bash
   npm i @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-query-devtools \
         recharts react-hook-form @hookform/resolvers zod date-fns lucide-react sonner \
         nanoid clsx tailwind-merge
   npm i -D supabase vitest @types/node
   ```
3. `npx shadcn@latest init` then:
   ```bash
   npx shadcn@latest add button input textarea select checkbox switch label form \
     table card badge dialog sheet dropdown-menu popover calendar tabs separator \
     skeleton sonner alert tooltip scroll-area avatar command
   ```
4. Create Supabase project (region: Singapore — lowest latency from Karachi). `npx supabase init && npx supabase link --project-ref <ref>`
5. `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose service role key client-side.
6. Add `lib/supabase/client.ts`, `server.ts`, `middleware.ts` (standard `@supabase/ssr` boilerplate).
7. Git init, push to private repo, connect Vercel (preview deploys from day one).

### Acceptance
- [ ] `npm run dev` renders a page that successfully calls `supabase.auth.getSession()`
- [ ] `npx supabase db push` runs against the linked project

---

## Phase 1 — Database schema

**Goal:** every table, index and constraint in place.
**Duration:** 1.5 days

### `supabase/migrations/001_core_schema.sql`

```sql
create extension if not exists "pgcrypto";

-- ─────────────── MASTER DATA ───────────────

create table suppliers (
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

create table customers (
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

create table raw_materials (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid default auth.uid(),
  name              text not null,
  code              text unique,
  category          text,                       -- pigment | resin | solvent | additive
  unit              text not null default 'kg',
  current_stock_kg  numeric(14,3) not null default 0,
  avg_cost_per_kg   numeric(14,4) not null default 0,
  last_price_per_kg numeric(14,4),
  reorder_level_kg  numeric(14,3) not null default 0,
  default_supplier_id uuid references suppliers(id) on delete set null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint raw_stock_non_negative check (current_stock_kg >= 0)
);

create table inks (
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

create table ink_formula_items (
  id              uuid primary key default gen_random_uuid(),
  ink_id          uuid not null references inks(id) on delete cascade,
  raw_material_id uuid not null references raw_materials(id) on delete restrict,
  quantity_kg     numeric(14,3) not null check (quantity_kg > 0),
  note            text,
  sort_order      int not null default 0,
  unique (ink_id, raw_material_id)
);

-- ─────────────── PURCHASING ───────────────

create table purchases (
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
  created_at      timestamptz not null default now()
);

create table purchase_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_id        uuid not null references purchases(id) on delete cascade,
  raw_material_id    uuid not null references raw_materials(id) on delete restrict,
  quantity_kg        numeric(14,3) not null check (quantity_kg > 0),
  price_per_kg       numeric(14,4) not null check (price_per_kg >= 0),
  landed_cost_per_kg numeric(14,4) not null default 0,
  line_total         numeric(14,2) not null default 0
);

-- ─────────────── PRODUCTION ───────────────

create table production_batches (
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

create table production_consumption (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references production_batches(id) on delete cascade,
  raw_material_id uuid not null references raw_materials(id) on delete restrict,
  quantity_kg     numeric(14,3) not null check (quantity_kg > 0),
  cost_per_kg     numeric(14,4) not null default 0,
  line_cost       numeric(14,2) not null default 0
);

-- ─────────────── SALES ───────────────

create table sales (
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
  created_at      timestamptz not null default now()
);

create table sale_items (
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

create table customer_ink_prices (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  ink_id       uuid not null references inks(id) on delete cascade,
  price_per_kg numeric(14,4) not null,
  unique (customer_id, ink_id)
);

-- ─────────────── LEDGER · ALERTS · SETTINGS ───────────────

create table inventory_movements (
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

create table stock_alerts (
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

create table payments (
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

create table app_settings (
  id                 int primary key default 1 check (id = 1),
  company_name       text default 'My Ink Works',
  currency           text not null default 'PKR',
  low_stock_email    text,
  default_labor_rate numeric(14,2) default 0,
  invoice_prefix     text default 'INV-',
  batch_prefix       text default 'B-',
  updated_at         timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict do nothing;

-- ─────────────── INDEXES ───────────────

create index on inventory_movements (item_type, item_id, created_at desc);
create index on inventory_movements (created_at desc);
create index on purchases (purchase_date desc);
create index on purchases (supplier_id);
create index on sales (sale_date desc);
create index on sales (customer_id);
create index on sale_items (ink_id);
create index on production_batches (ink_id, production_date desc);
create index on stock_alerts (is_resolved, created_at desc);
create index on raw_materials (is_active) where is_active;
```

### Acceptance
- [ ] `supabase db push` applies cleanly and `supabase db reset` reproduces it
- [ ] `npx supabase gen types typescript --linked > types/database.ts` succeeds
- [ ] Constraints reject negative stock and zero quantities

---

## Phase 2 — Business logic: functions and triggers

**Goal:** all four money events work correctly from SQL alone, before any UI exists.
**Duration:** 2 days — **the most important phase in the project**

### `002_functions.sql`

```sql
-- Shared helper: apply a stock movement + recompute weighted average
create or replace function apply_stock_in(
  p_item_type text, p_item_id uuid, p_qty numeric, p_cost_per_kg numeric,
  p_movement_type text, p_ref_table text, p_ref_id uuid
) returns void language plpgsql as $$
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

-- Shared helper: consume stock (average unchanged on outflow)
create or replace function apply_stock_out(
  p_item_type text, p_item_id uuid, p_qty numeric,
  p_movement_type text, p_ref_table text, p_ref_id uuid
) returns numeric language plpgsql as $$
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

-- ─────────────── 1. PURCHASE ───────────────
create or replace function record_purchase(payload jsonb)
returns uuid language plpgsql as $$
declare
  v_id uuid; v_line jsonb;
  v_subtotal numeric(14,2) := 0; v_qty numeric; v_price numeric;
  v_line_total numeric(14,2); v_landed numeric(14,4);
  v_extra numeric(14,2) := coalesce((payload->>'freight_cost')::numeric,0)
                          + coalesce((payload->>'other_cost')::numeric,0);
  v_key text := payload->>'idempotency_key';
begin
  if v_key is not null then
    select id into v_id from purchases where idempotency_key = v_key;
    if v_id is not null then return v_id; end if;
  end if;

  for v_line in select * from jsonb_array_elements(payload->'items') loop
    v_subtotal := v_subtotal
      + ((v_line->>'quantity_kg')::numeric * (v_line->>'price_per_kg')::numeric);
  end loop;

  insert into purchases (supplier_id, invoice_no, purchase_date, subtotal, freight_cost,
                         other_cost, discount, total, paid_amount, notes, idempotency_key)
  values ((payload->>'supplier_id')::uuid,
          payload->>'invoice_no',
          coalesce((payload->>'purchase_date')::date, current_date),
          v_subtotal,
          coalesce((payload->>'freight_cost')::numeric,0),
          coalesce((payload->>'other_cost')::numeric,0),
          coalesce((payload->>'discount')::numeric,0),
          v_subtotal + v_extra - coalesce((payload->>'discount')::numeric,0),
          coalesce((payload->>'paid_amount')::numeric,0),
          payload->>'notes', v_key)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(payload->'items') loop
    v_qty   := (v_line->>'quantity_kg')::numeric;
    v_price := (v_line->>'price_per_kg')::numeric;
    v_line_total := v_qty * v_price;
    -- allocate freight/other by line value
    v_landed := v_price + case when v_subtotal > 0
                               then (v_extra * (v_line_total / v_subtotal)) / v_qty else 0 end;

    insert into purchase_items (purchase_id, raw_material_id, quantity_kg, price_per_kg,
                                landed_cost_per_kg, line_total)
    values (v_id, (v_line->>'raw_material_id')::uuid, v_qty, v_price, v_landed, v_line_total);

    perform apply_stock_in('raw', (v_line->>'raw_material_id')::uuid,
                           v_qty, v_landed, 'purchase', 'purchases', v_id);
  end loop;

  return v_id;
end $$;

-- ─────────────── 2. PRODUCTION ───────────────
create or replace function complete_production_batch(p_batch_id uuid, p_produced_qty numeric)
returns uuid language plpgsql as $$
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
  if v_batch.status <> 'draft' then
    raise exception 'Batch is already %', v_batch.status;
  end if;
  if p_produced_qty is null or p_produced_qty <= 0 then
    raise exception 'Produced quantity must be greater than zero';
  end if;

  select * into v_ink from inks where id = v_batch.ink_id;

  for v_row in select * from production_consumption where batch_id = p_batch_id loop
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

-- ─────────────── 3. SALE ───────────────
create or replace function record_sale(payload jsonb)
returns uuid language plpgsql as $$
declare
  v_id uuid; v_line jsonb;
  v_qty numeric; v_price numeric; v_cost numeric(14,4);
  v_subtotal numeric(14,2) := 0; v_cogs numeric(14,2) := 0;
  v_discount numeric(14,2) := coalesce((payload->>'discount')::numeric,0);
  v_key text := payload->>'idempotency_key';
begin
  if v_key is not null then
    select id into v_id from sales where idempotency_key = v_key;
    if v_id is not null then return v_id; end if;
  end if;

  insert into sales (customer_id, invoice_no, sale_date, discount, paid_amount, notes, idempotency_key)
  values ((payload->>'customer_id')::uuid, payload->>'invoice_no',
          coalesce((payload->>'sale_date')::date, current_date), v_discount,
          coalesce((payload->>'paid_amount')::numeric,0), payload->>'notes', v_key)
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
  return v_id;
end $$;

-- ─────────────── 4. ADJUSTMENT ───────────────
create or replace function adjust_stock(
  p_item_type text, p_item_id uuid, p_new_qty numeric, p_reason text
) returns void language plpgsql as $$
declare v_stock numeric(14,3); v_avg numeric(14,4); v_diff numeric(14,3);
begin
  if p_item_type = 'raw' then
    select current_stock_kg, avg_cost_per_kg into v_stock, v_avg
      from raw_materials where id = p_item_id for update;
    update raw_materials set current_stock_kg = p_new_qty, updated_at = now() where id = p_item_id;
  else
    select current_stock_kg, avg_cost_per_kg into v_stock, v_avg
      from inks where id = p_item_id for update;
    update inks set current_stock_kg = p_new_qty, updated_at = now() where id = p_item_id;
  end if;

  v_diff := p_new_qty - v_stock;
  insert into inventory_movements
    (item_type, item_id, movement_type, quantity_kg, cost_per_kg, balance_after, notes)
  values (p_item_type, p_item_id, 'adjustment', v_diff, v_avg, p_new_qty, p_reason);
end $$;

-- ─────────────── LOW-STOCK TRIGGER ───────────────
create or replace function check_stock_level() returns trigger language plpgsql as $$
declare v_type text := case tg_table_name when 'raw_materials' then 'raw' else 'ink' end;
begin
  if new.current_stock_kg <= 0 then
    if not exists (select 1 from stock_alerts
                   where item_id = new.id and level = 'critical' and not is_resolved) then
      insert into stock_alerts (item_type, item_id, item_name, level, message)
      values (v_type, new.id, new.name, 'critical', new.name || ' is out of stock');
    end if;
  elsif new.current_stock_kg <= new.reorder_level_kg and new.reorder_level_kg > 0 then
    if not exists (select 1 from stock_alerts
                   where item_id = new.id and not is_resolved) then
      insert into stock_alerts (item_type, item_id, item_name, level, message)
      values (v_type, new.id, new.name, 'warning',
              new.name || ' is low: ' || new.current_stock_kg || ' kg left (reorder at '
              || new.reorder_level_kg || ' kg)');
    end if;
  else
    update stock_alerts set is_resolved = true, resolved_at = now()
     where item_id = new.id and not is_resolved;
  end if;
  return new;
end $$;

create trigger trg_raw_stock_level after update of current_stock_kg on raw_materials
  for each row execute function check_stock_level();
create trigger trg_ink_stock_level after update of current_stock_kg on inks
  for each row execute function check_stock_level();

-- ─────────────── DOCUMENT NUMBERING ───────────────
create sequence if not exists seq_invoice_no;
create sequence if not exists seq_batch_no;
create sequence if not exists seq_purchase_no;
```

### Test script (run in SQL editor before touching the UI)
1. Insert 2 materials, 1 supplier. Call `record_purchase` twice at different prices.
   → assert WAC = weighted average, not last price.
2. Create ink + formula, create draft batch, call `complete_production_batch` with yield < planned.
   → assert raw stock down, ink stock up, `cost_per_kg` includes labor+overhead+packaging.
3. Call `record_sale`. → assert ink stock down, `profit_total` = revenue − snapshot cost.
4. Call `record_sale` for more kg than exist. → assert it raises and **nothing** is written.
5. Drop a material below reorder level. → assert one `stock_alerts` row, and only one.

### Acceptance
- [ ] All five tests pass
- [ ] `select sum(quantity_kg) from inventory_movements where item_id = X` equals `current_stock_kg` for every item

---

## Phase 3 — Views and RLS

**Goal:** dashboards read from SQL, not from JS math. Security enabled.
**Duration:** 1 day

### `003_views.sql`

```sql
create or replace view v_low_stock as
select 'raw' as item_type, id, name, code, current_stock_kg, reorder_level_kg,
       avg_cost_per_kg, current_stock_kg * avg_cost_per_kg as stock_value,
       case when current_stock_kg <= 0 then 'critical' else 'warning' end as level
  from raw_materials
 where is_active and current_stock_kg <= reorder_level_kg
union all
select 'ink', id, name, code, current_stock_kg, reorder_level_kg,
       avg_cost_per_kg, current_stock_kg * avg_cost_per_kg,
       case when current_stock_kg <= 0 then 'critical' else 'warning' end
  from inks
 where is_active and current_stock_kg <= reorder_level_kg;

create or replace view v_inventory_value as
select
  (select coalesce(sum(current_stock_kg * avg_cost_per_kg),0) from raw_materials) as raw_value,
  (select coalesce(sum(current_stock_kg * avg_cost_per_kg),0) from inks)          as ink_value,
  (select coalesce(sum(current_stock_kg),0) from raw_materials)                   as raw_kg,
  (select coalesce(sum(current_stock_kg),0) from inks)                            as ink_kg;

create or replace view v_ink_profitability as
select i.id, i.name, i.code, i.color_hex,
       i.current_stock_kg, i.avg_cost_per_kg,
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

create or replace view v_customer_summary as
select c.id, c.name, c.company, c.phone,
       count(distinct s.id) as orders,
       coalesce(sum(si.quantity_kg),0) as total_kg,
       coalesce(sum(s.total),0) as revenue,
       coalesce(sum(s.profit_total),0) as profit,
       coalesce(sum(s.total - s.paid_amount),0) as receivable,
       max(s.sale_date) as last_order_date
  from customers c
  left join sales s on s.customer_id = c.id and s.status='confirmed'
  left join sale_items si on si.sale_id = s.id
 group by c.id;

create or replace view v_supplier_summary as
select sup.id, sup.name, sup.company, sup.phone,
       count(distinct p.id) as purchase_count,
       coalesce(sum(p.total),0) as total_spend,
       coalesce(sum(p.total - p.paid_amount),0) as payable,
       max(p.purchase_date) as last_purchase_date
  from suppliers sup
  left join purchases p on p.supplier_id = sup.id and p.status='received'
 group by sup.id;

create or replace view v_material_usage as
select rm.id, rm.name, rm.code, rm.category, rm.unit,
       rm.current_stock_kg, rm.avg_cost_per_kg, rm.reorder_level_kg,
       rm.current_stock_kg * rm.avg_cost_per_kg as stock_value,
       coalesce(pi.purchased_kg,0) as purchased_kg,
       coalesce(pi.purchase_value,0) as purchase_value,
       coalesce(pc.consumed_kg,0) as consumed_kg
  from raw_materials rm
  left join (select raw_material_id, sum(quantity_kg) purchased_kg, sum(line_total) purchase_value
               from purchase_items group by 1) pi on pi.raw_material_id = rm.id
  left join (select pcx.raw_material_id, sum(pcx.quantity_kg) consumed_kg
               from production_consumption pcx
               join production_batches b on b.id = pcx.batch_id
              where b.status='completed' group by 1) pc on pc.raw_material_id = rm.id;

create or replace view v_monthly_trend as
select month, sum(purchases) purchases, sum(revenue) revenue, sum(cogs) cogs,
       sum(revenue) - sum(cogs) profit
from (
  select date_trunc('month', purchase_date)::date as month, sum(total) purchases, 0 revenue, 0 cogs
    from purchases where status='received' group by 1
  union all
  select date_trunc('month', sale_date)::date, 0, sum(total), sum(cogs_total)
    from sales where status='confirmed' group by 1
) t group by month order by month;

-- Parameterised dashboard summary
create or replace function get_dashboard_summary(p_from date, p_to date)
returns table (
  purchase_total numeric, purchase_count bigint,
  revenue numeric, cogs numeric, gross_profit numeric, margin_pct numeric, sale_count bigint,
  produced_kg numeric, production_cost numeric,
  raw_stock_value numeric, ink_stock_value numeric, inventory_value numeric,
  low_stock_count bigint, payable numeric, receivable numeric
) language sql stable as $$
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
    (select count(*) from v_low_stock),
    (select coalesce(sum(total - paid_amount),0) from purchases where status='received'),
    (select coalesce(sum(total - paid_amount),0) from sales where status='confirmed');
$$;
```

### `004_rls.sql`

```sql
do $$ declare t text;
begin
  foreach t in array array['suppliers','customers','raw_materials','inks','ink_formula_items',
    'purchases','purchase_items','production_batches','production_consumption',
    'sales','sale_items','customer_ink_prices','inventory_movements','stock_alerts',
    'payments','app_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format($f$create policy "authenticated_all" on %I
                     for all to authenticated using (true) with check (true)$f$, t);
  end loop;
end $$;
```

> When you later turn this into a product, swap `using (true)` for `using (owner_id = auth.uid())`. The columns are already there.

### `005_realtime.sql`

```sql
alter publication supabase_realtime add table
  raw_materials, inks, purchases, sales, production_batches, stock_alerts, inventory_movements;
```

### Acceptance
- [ ] `select * from get_dashboard_summary('2026-01-01','2026-12-31')` returns sane numbers on seed data
- [ ] Anonymous key cannot read any table; authenticated key can

---

## Phase 4 — Auth and app shell

**Goal:** login works, sidebar navigation, design tokens, shared components.
**Duration:** 1 day

### Tasks
1. Disable public signups in Supabase Auth settings. Create your user via dashboard.
2. `middleware.ts` — refresh session, redirect unauthenticated to `/login`, authenticated away from `/login`.
3. `app/(auth)/login/page.tsx` — email + password, Zod validated, error states in the interface's voice ("That email and password don't match an account").
4. `app/(app)/layout.tsx` — sidebar + header + `<Toaster />` + `<QueryProvider />` + `<RealtimeProvider />` (stub until Phase 10).
5. Design tokens in `globals.css`:
   - Neutral zinc chrome; semantic color only: `--ok` green (profit / in stock), `--warn` amber (below reorder), `--danger` red (out of stock / loss)
   - `font-variant-numeric: tabular-nums` on `.num` — apply to every numeric cell
   - Base 14px, 8px spacing grid, sidebar 240px, content max-width 1400px
6. Shared components: `<DataTable>` (sticky header, sortable, right-aligned numerics, row → drawer), `<StatCard>`, `<Money>`, `<Weight>`, `<PageHeader>`, `<EmptyState>`, `<ConfirmDialog>`.
7. `lib/format.ts` — `formatMoney` (PKR, no decimals in cards, 2 dp in tables), `formatKg` (3 dp, trims trailing zeros), `formatPct`, `formatDate` (`dd MMM yyyy`).

### Acceptance
- [ ] Logged-out user hitting `/dashboard` lands on `/login`; after login returns to `/dashboard`
- [ ] Sidebar highlights the active route; layout works at 1280px and on mobile

---

## Phase 5 — Suppliers and Raw Materials

**Goal:** master data you can manage.
**Duration:** 1.5 days

### Suppliers
- **List:** name, company, phone, purchases count, total spend, payable, last purchase. Search + active filter.
- **Form:** side sheet (not a page) — name*, company, phone, email, address, city, opening balance, notes.
- **Detail `/suppliers/[id]`:** header stats (spend, payable, orders) + purchase history table + payments tab.
- Deactivate instead of delete (FK restrict will block deletes anyway — catch `23503` and show "This supplier has purchases and can't be deleted. Deactivate it instead.").

### Raw Materials
- **List columns:** name, code, category, **stock (kg)**, avg cost/kg, **stock value**, reorder level, status badge.
- **Status badge:** red "Out of stock" · amber "Low" · zinc "OK". Sort so low-stock rows can be filtered to the top.
- **Form:** name*, code, category (select), unit, reorder level, default supplier, opening stock + opening cost (which writes an `adjustment` movement, not a direct column write).
- **Detail `/raw-materials/[id]`:** stat row (stock, WAC, value, purchased-to-date, consumed-to-date) + **movement ledger** table (date, type, ± qty, cost/kg, balance after, reference link) + price history mini-chart.
- **Stock adjustment dialog:** new counted quantity + reason → `adjust_stock` RPC.

### Acceptance
- [ ] Creating a material with opening stock produces exactly one `adjustment` movement and correct value
- [ ] Ledger balances match `current_stock_kg` for every material

---

## Phase 6 — Purchasing

**Goal:** money in the door → raw material stock and cost.
**Duration:** 2 days

### Purchase entry `/purchases/new`
- Header: supplier (combobox + "Add new" inline), invoice no (auto from `seq_purchase_no`, editable), date.
- **Line editor** (repeatable rows): material combobox → shows current stock and last price as helper text · quantity kg · price/kg · line total (computed, read-only).
- Footer: subtotal · freight · other cost · discount · **total** · paid amount · balance.
- **Live landed-cost preview** per line so you can see what freight does to your cost before saving.
- Submit → `record_purchase` RPC with `idempotency_key: nanoid()` generated on mount. Button disabled while pending.
- On success: toast "Purchase recorded — 3 materials updated", redirect to purchase detail.

### Purchase list `/purchases`
Date, invoice, supplier, items count, total, paid, balance, status. Filters: supplier, date range, unpaid only.

### Purchase detail
Full line table with landed cost, linked movements, "Record payment" action, "Cancel purchase" (reverses movements — Phase 12 if time-pressed, but design the button now).

### Acceptance
- [ ] Two purchases of the same material at different prices produce the correct weighted average, verified by hand
- [ ] Freight of 5,000 across two lines splits by line value, not by quantity
- [ ] Double-submitting creates one purchase

---

## Phase 7 — Inks and formula builder

**Goal:** define what an ink is made of and what it should cost.
**Duration:** 2 days

### Ink list `/inks`
Color swatch · name · code · type · batch size · **computed base cost/kg** · default price/kg · **margin %** · stock kg · stock value · status badge.

### Ink detail `/inks/[id]`
Three tabs:

**1. Formula**
- Repeatable rows: raw material combobox · quantity kg (per batch size) · % of batch (computed) · current cost/kg · line cost · stock availability indicator.
- Running totals: total formula weight vs `batch_size_kg` — **warn if they don't match** ("Formula totals 98 kg but batch size is 100 kg").
- **Signature element — cost breakdown bar:** one horizontal stacked bar under the editor showing material / labor / overhead / packaging / margin per kg, updating live on every keystroke. This is the screen you'll actually stare at when pricing.
- Cost formula (implement in `lib/calc/costing.ts` and unit test it):
  ```
  material_per_batch = Σ(qty × material.avg_cost_per_kg)
  effective_yield    = batch_size_kg × (1 − expected_wastage_pct/100)
  base_cost_per_kg   = (material_per_batch + labor + overhead) / effective_yield
                       + packaging_cost_per_kg
  margin_pct         = (default_price_per_kg − base_cost_per_kg) / default_price_per_kg × 100
  ```

**2. Batches** — every production run for this ink: date, batch no, planned vs produced, wastage kg, cost/kg, vs theoretical cost (variance column, colored). This is where you discover a formula is drifting.

**3. Stock & sales** — movement ledger, kg sold, revenue, profit, avg realised price, top customers for this ink.

### Acceptance
- [ ] Changing a material's WAC (via a new purchase) immediately changes the ink's base cost on reload
- [ ] Formula weight mismatch is warned but not blocked (you may legitimately have loss in formula)

---

## Phase 8 — Production

**Goal:** raw material → ink, with real cost.
**Duration:** 2 days

### New batch `/production/new`
1. Select ink → planned quantity kg (defaults to `batch_size_kg`).
2. Consumption lines **auto-scale from formula**: `qty = formula_qty × (planned / batch_size)`. Every line editable — real production deviates.
3. Each line shows available stock; **insufficient stock is flagged inline before you save** with the shortfall in kg and a "Purchase this" link.
4. Labor and overhead default from the ink, editable per batch.
5. Save as **draft** — creates `production_batches` + `production_consumption`, consumes nothing yet.

### Complete batch dialog
Enter **actual produced kg** (defaulted to planned, with expected wastage shown) → calls `complete_production_batch`.
Result panel: material cost, labor, overhead, packaging, **total cost, cost/kg**, wastage kg and %, and variance against theoretical cost.

### Batch list `/production`
Date, batch no, ink swatch + name, planned/produced, wastage %, cost/kg, total cost, status pill. Filter by ink, status, date range.

### Acceptance
- [ ] Completing a batch with insufficient stock fails cleanly and leaves stock untouched
- [ ] Yield of 96 kg on a planned 100 kg raises cost/kg by ~4%, visible in the result panel
- [ ] A completed batch cannot be completed twice

---

## Phase 9 — Customers and Sales

**Goal:** ink out, profit locked in.
**Duration:** 2 days

### Customers
List with orders, kg, revenue, profit, receivable, last order. Detail page: stats, order history, **per-ink agreed prices** editor (`customer_ink_prices`), payments.

### Sale entry `/sales/new`
- Customer combobox → loads that customer's agreed prices.
- Line editor: ink combobox (swatch + available kg) · quantity kg · price/kg (pre-filled: customer price → ink default) · line total.
- **Live per-line profit column**, colored: `(price − ink.avg_cost_per_kg) × qty`, with margin %. If price is below cost, the row turns red and the footer warns "Selling below cost".
- Stock guard: quantity above available kg blocks submit with the shortfall named.
- Footer: subtotal · discount · total · estimated COGS · **estimated profit + margin %** · paid amount · balance.
- Submit → `record_sale` with idempotency key.

### Sale list and invoice
List: date, invoice, customer, kg, total, profit, margin %, paid, status.
Invoice print view `/sales/[id]/print`: company header from `app_settings`, line table, totals, `@media print` styles. Profit is **never** shown on the printable invoice.

### Acceptance
- [ ] Profit on the saved sale equals the preview shown before saving
- [ ] A later purchase that changes ink cost does not change the saved sale's profit
- [ ] Selling more kg than in stock is rejected by the RPC even if the UI guard is bypassed

---

## Phase 10 — Summary dashboard and realtime

**Goal:** the screen you open every morning.
**Duration:** 2 days

### Layout `/dashboard`

**Period selector** (Today · 7 days · 30 days · This month · This year · Custom) drives everything via `get_dashboard_summary(from, to)`.

**Row 1 — four KPI cards**, each with value, sub-line, and % change vs previous equal-length period:
| Card | Value | Sub-line |
|---|---|---|
| Total Investment | purchases in period | *n* purchases · payable outstanding |
| Inventory Value | raw + ink | *x* kg raw · *y* kg ink |
| Revenue | sales in period | *n* orders · receivable outstanding |
| Gross Profit | revenue − COGS | margin % |

**Row 2 — trend chart** (Recharts composed): bars for purchases and revenue by month, line for profit. Toggle daily/monthly.

**Row 3 — two columns:**
- **Stock alerts panel** (left, 2/3): rows from `v_low_stock` sorted critical first — item, current kg, reorder kg, "Order from [default supplier]" button that opens a pre-filled purchase form. Empty state: "All stock levels are healthy."
- **Top inks by profit** (right, 1/3): from `v_ink_profitability`, swatch + name + profit + margin %.

**Row 4 — recent activity:** last 5 purchases and last 5 sales side by side, each row linking to its detail.

### Realtime wiring `hooks/use-realtime-sync.ts`
```ts
useEffect(() => {
  const ch = supabase.channel('erp-sync')
  const tables = ['raw_materials','inks','purchases','sales','production_batches','stock_alerts','inventory_movements']
  tables.forEach(table =>
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      queryClient.invalidateQueries({ queryKey: [table] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (table === 'stock_alerts' && payload.eventType === 'INSERT') {
        const a = payload.new as StockAlert
        toast[a.level === 'critical' ? 'error' : 'warning'](a.message)
      }
    }))
  ch.subscribe()
  return () => { supabase.removeChannel(ch) }
}, [])
```
- Alert bell in the header: unread count from `stock_alerts`, dropdown list, mark-read on open.
- Combine with **optimistic updates** on forms so entry feels instant; realtime acts as confirmation.

### Acceptance
- [ ] Recording a sale in one browser tab updates the dashboard KPI in a second tab within ~1s without reload
- [ ] A purchase that drops a material below reorder level pops a toast and increments the bell

---

## Phase 11 — Reports and export

**Goal:** answer questions the dashboard doesn't.
**Duration:** 1.5 days

Tabs on `/reports`, all with a shared date-range picker and a "Download CSV" button:

1. **Profit & Loss** — revenue, COGS, gross profit, margin; production cost, purchases, closing inventory value. Monthly breakdown table.
2. **Ink profitability** — `v_ink_profitability`, sortable by profit/margin/kg sold. Highlights inks sold below cost.
3. **Material usage** — `v_material_usage`: purchased kg, consumed kg, closing kg, value, avg consumption/month, **days of cover** (`current_stock / (consumed_kg_last_90 / 90)`) — this is your real reorder signal, better than a static level.
4. **Customer statement** — per customer: orders, kg, revenue, profit, payments, balance. Printable.
5. **Supplier statement** — mirror of the above.
6. **Stock valuation** — every raw material and ink with kg, WAC, value, and grand total. Your closing-stock number for accounting.
7. **Inventory ledger** — `/inventory`: all movements, filterable by item, type, date; the audit trail when a number looks wrong.

CSV export: generate client-side from the same query result (`papaparse` or a 20-line serializer). PDF: browser print with `@media print` — don't add a PDF library for this.

### Acceptance
- [ ] P&L gross profit for a period equals `sum(sales.profit_total)` for the same period
- [ ] Stock valuation total equals the dashboard's Inventory Value card

---

## Phase 12 — Hardening, polish, deploy

**Goal:** it's trustworthy enough to run the business on.
**Duration:** 2 days

### Correctness
- [ ] **Cancellation flows:** `cancel_purchase(id)` and `cancel_sale(id)` RPCs that write reversing movements and set status `cancelled`. Never a hard delete.
- [ ] **Reconciliation query** as a saved report: for every item, `sum(movements) = current_stock_kg`. Should always return zero rows.
- [ ] Unit tests (Vitest) on `lib/calc/costing.ts`: WAC, batch cost, margin, freight allocation. These are pure functions — test them properly, they're where money errors hide.
- [ ] Manual end-to-end run: buy → produce → sell → check dashboard math by hand against a spreadsheet.

### Experience
- [ ] Loading skeletons on every table and card (no layout shift)
- [ ] Empty states that say what to do next, per Phase 4
- [ ] Error boundaries + a readable message for Postgres exceptions (map `P0001` to the raised text, `23503` to the FK message)
- [ ] Keyboard: `⌘K` command palette to jump to any screen or record; Enter adds a new line in line editors
- [ ] Mobile pass — you'll check stock from your phone at a supplier's shop; make the dashboard and material list work at 380px
- [ ] Dark mode (you'll use this at night; tokens are already semantic)

### Operations
- [ ] Enable Supabase PITR backups — this is now your accounting record
- [ ] Vercel production deploy, env vars set, custom domain
- [ ] Optional: Edge Function + `pg_cron` daily 9am digest email of low-stock items via Resend
- [ ] Seed a `demo` flag or separate branch project so you can experiment without touching real data

---

# Part C — Reference

## C1. Worked example (use this to verify your math)

```
Purchase 1: Blue Pigment  100 kg @ 1,200/kg, freight 3,000 → landed 1,230/kg
            stock 100 kg, WAC 1,230.0000

Purchase 2: Blue Pigment   50 kg @ 1,350/kg, freight 0     → landed 1,350/kg
            WAC = (100×1230 + 50×1350) / 150 = 1,270.0000
            stock 150 kg

Ink "Process Blue", batch 100 kg:
  formula: Blue Pigment 30 kg, Resin 55 kg (WAC 400), Solvent 15 kg (WAC 250)
  labor 2,500 · overhead 1,800 · packaging 12/kg
  material = 30×1270 + 55×400 + 15×250 = 38,100 + 22,000 + 3,750 = 63,850

Batch produced 97 kg (3 kg wastage):
  packaging = 97 × 12 = 1,164
  total     = 63,850 + 2,500 + 1,800 + 1,164 = 69,314
  cost/kg   = 69,314 / 97 = 714.5773

Sale: 40 kg @ 950/kg to Customer A
  revenue 38,000 · COGS 40 × 714.5773 = 28,583.09
  profit 9,416.91 · margin 24.78%
```

If your app doesn't produce these numbers, stop and fix Phase 2 before continuing.

## C2. Ten things that will bite you

1. `numeric` only — never `float` for money or weight.
2. Round at display, not in storage. Keep 4 dp on cost/kg.
3. Never delete a transaction. Cancel and reverse.
4. Force actual yield entry — planned yield hides your real wastage.
5. Freight and duty belong in landed cost, or your margins are fiction.
6. Validate stock in the RPC, not just in React.
7. `date` for business dates, `timestamptz` for audit — never mix.
8. Idempotency keys on purchase and sale RPCs; users double-click.
9. `for update` locks in every RPC that reads-then-writes stock.
10. Turn on backups before you enter real data, not after.

## C3. Post-v1 roadmap

- Supplier and customer payment tracking with aging buckets
- Multi-warehouse / location stock
- Batch traceability: which sale came from which production batch (add `batch_id` to `sale_items`)
- Quality control parameters per batch (viscosity, tack, density, shade approval)
- Purchase orders (request → receive) separate from purchase invoices
- Unit conversion for liquids (kg ↔ litres via density per material)
- Barcode / QR labels on ink drums
- Multi-user with roles (production operator vs owner) — flip the RLS policy to `owner_id`, add an `org_id`
