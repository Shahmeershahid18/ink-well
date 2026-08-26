# Ink ERP

Purchasing, production, stock and profit for an ink works. Single operator, multi-tenant-ready schema.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres, Auth, Realtime) · Tailwind v4 · TanStack Query v5 · Recharts
**Currency:** PKR · **Weight:** kg (3 dp) · **Timezone:** Asia/Karachi

---

## What it does

```
SUPPLIER ──purchase──▶ RAW MATERIAL STOCK ──production──▶ INK STOCK ──sale──▶ CUSTOMER
   │                        │                    │              │
   └─ payable          WAC cost/kg        batch cost/kg    price/kg → profit
```

Four money events, each atomic, each writing to one append-only ledger:

| Event | Stock effect | Cost effect |
|---|---|---|
| Purchase | raw material **+** | recalculates raw material weighted-average cost |
| Production | raw material **−**, ink **+** | material + labor + overhead + packaging ÷ actual yield = ink cost/kg |
| Sale | ink **−** | snapshots ink cost/kg → locks profit for that line |
| Adjustment | either ± | corrects stock, keeps the average unchanged |

Every stock mutation goes through a Postgres RPC. The browser never writes stock directly,
so a multi-table write can never half-succeed.

---

## Setup

### 1. Create the Supabase project

Do this in the Supabase dashboard — region **Singapore** is the lowest latency from Karachi.

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API**. The `service_role` key is never used by this app and must
never appear in `.env.local`.

### 3. Apply the schema

```bash
npm run db:push          # applies supabase/migrations in order
npm run db:types         # regenerates types/database.ts from the live schema
```

Migrations, in order:

| File | Contents |
|---|---|
| `001_core_schema.sql` | tables, constraints, indexes |
| `002_functions.sql` | the four money events, cancellations, low-stock trigger |
| `003_views.sql` | reporting views and the parameterised dashboard functions |
| `004_rls.sql` | row-level security, grants |
| `005_realtime.sql` | realtime publication |

### 4. Verify the maths before entering real data

Run `supabase/seed.sql` against the project (SQL editor, or `npm run db:reset` on a local
stack). It builds the worked example from the plan through the RPCs and prints four
assertions:

```
PASS Blue Pigment WAC: 1270.0000 (expected 1270.0000)
PASS Process Blue cost/kg: 714.5773 (expected 714.5773)
PASS Sale profit: 9416.91 (expected 9416.91)
PASS Ledger reconciliation: 0 item(s) out of balance (expected 0)
```

If any line says FAIL, stop and fix the SQL before going further — everything downstream
inherits the error.

### 5. Create your login

**Authentication → Providers → Email**: turn **off** public signups. Then
**Authentication → Users → Add user** to create your own account. There is no signup
screen in the app by design.

### 6. Run it

```bash
npm run dev
```

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm test` | unit tests on the costing maths |
| `npm run db:push` | apply migrations to the linked project |
| `npm run db:reset` | rebuild a local stack from migrations + seed (needs Docker) |
| `npm run db:types` | regenerate `types/database.ts` |
| `npx eslint .` | lint |

---

## Layout

```
app/(auth)/login          sign in
app/(app)/dashboard       KPIs, trend, alerts, top inks, recent activity
app/(app)/purchases       purchase entry, list, detail
app/(app)/production      batch planning, completion, list, detail
app/(app)/sales           sale entry, list, detail, printable invoice
app/(app)/raw-materials   catalogue, movement ledger, stock adjustment
app/(app)/inks            catalogue, formula builder, batches, stock & sales
app/(app)/suppliers       list, detail with purchases and payments
app/(app)/customers       list, detail with orders, agreed prices, payments
app/(app)/inventory       the full movement ledger and reconciliation check
app/(app)/reports         P&L, ink profitability, material usage, statements, valuation
app/(app)/settings        company details, numbering, integrity check

lib/calc/                 pure costing maths — unit tested, mirrors the SQL
lib/queries/              TanStack Query hooks, one file per domain
supabase/migrations/      the schema, in order
```

---

## Design decisions worth knowing

**Costing is moving weighted average.** One column per item, accurate enough for
continuous-process manufacturing, and no cost-layer tables to match consumption against.

**Stock is an append-only ledger plus a cached column.** `inventory_movements` is the
truth; `current_stock_kg` is the fast read. Both are written in the same transaction.
`v_stock_reconciliation` proves they agree and should always return zero rows — it is
surfaced on **Settings** and on **Inventory ledger**.

**Formulas are templates, copied into each batch.** Editing a recipe never rewrites the
cost of a batch you already made.

**Profit is snapshotted per sale line.** A later purchase that moves the ink's average
cost cannot change the profit on a sale that has already happened.

**Nothing is ever deleted.** Purchases, sales and batches are cancelled, which writes
reversing movements. Deleting a purchase would corrupt every weighted average calculated
after it.

**All money and weight columns are `numeric`, never float.** Rounding happens once, at
display. Costs per kg keep 4 decimal places all the way through.

**Freight is allocated by line value, not by weight.** A drum of pigment carries more of
the freight bill than a drum of solvent because it is worth more — which is what the
invoice actually reflects.

**Chart colours are categorical, not semantic.** The series palette is validated for
colour-vision separation and contrast in both light and dark mode; status colours
(`--ok`, `--warn`, `--danger`) are reserved for state and never reused as a series.

---

## Before you enter real data

- [ ] Run the seed verification above and confirm all four lines say PASS
- [ ] Turn on **Point-in-Time Recovery** in Supabase — this is now your accounting record
- [ ] Do one manual end-to-end run: buy → produce → sell → check the dashboard by hand
- [ ] Set your company details on **Settings** so invoices print correctly

---

## Deploying

Vercel: import the repo, set the same two environment variables, deploy. Add the
production URL to **Authentication → URL Configuration** in Supabase so login redirects
resolve.
