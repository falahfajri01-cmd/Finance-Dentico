-- ═══════════════════════════════════════════════════════════════════
-- Dentico Finance — Chart of Accounts schema
-- Run this in your Supabase project (SQL Editor) before seed.sql
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.coa_accounts (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                -- e.g. "1103"
  name         text not null,                       -- e.g. "Bank BSI Giro Utama"
  type_label   text not null default '',            -- e.g. "Aset Lancar (Bank)"
  group_code   text not null,                       -- top-level header: 1000..6600
  parent_code  text,                                -- parent account code (level 2 parents)
  parent_label text,                                -- denormalised "1100 - Kas & Setara Kas"
  normal       text not null default 'Debit' check (normal in ('Debit','Kredit')),
  is_header    boolean not null default false,      -- header accounts cannot be posted to
  can_post     boolean not null default true,       -- level-2 posting accounts
  is_active    boolean not null default true,
  is_locked    boolean not null default false,      -- has ledger history → protected
  tx_count     integer not null default 0,
  updated_at   timestamptz not null default now()
);

create index if not exists coa_accounts_group_idx  on public.coa_accounts (group_code);
create index if not exists coa_accounts_active_idx on public.coa_accounts (is_active);

-- Keep updated_at fresh on writes
create or replace function public.touch_coa_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_coa_touch on public.coa_accounts;
create trigger trg_coa_touch
  before update on public.coa_accounts
  for each row execute function public.touch_coa_updated_at();

-- Row Level Security: read for everyone, writes for authenticated roles.
alter table public.coa_accounts enable row level security;

drop policy if exists "coa read" on public.coa_accounts;
create policy "coa read" on public.coa_accounts for select using (true);

drop policy if exists "coa write" on public.coa_accounts;
create policy "coa write" on public.coa_accounts for all
  using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════
-- Executive Overview snapshots (read-only analytics, posted by ledger)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.finance_monthly (
  id             text primary key,             -- '2026-09'
  month_label    text not null,                -- 'Sep'
  month_label_long text not null default '',   -- 'September 2026'
  revenue        numeric not null default 0,
  hpp            numeric not null default 0,
  opex           numeric not null default 0,
  net_profit     numeric not null default 0
);

alter table public.finance_monthly enable row level security;
drop policy if exists "finance monthly read" on public.finance_monthly;
create policy "finance monthly read" on public.finance_monthly for select using (true);

create table if not exists public.finance_overview_meta (
  id      boolean primary key default true check (id),   -- singleton row
  payload jsonb not null
);

alter table public.finance_overview_meta enable row level security;
drop policy if exists "finance meta read" on public.finance_overview_meta;
create policy "finance meta read" on public.finance_overview_meta for select using (true);

-- ═══════════════════════════════════════════════════════════════════
-- Jurnal Umum & Entry (dual-entry engine)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.journals (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique,          -- 'JV/2026/09/0142'
  date              date not null,
  journal_type      text not null default 'JU',    -- JU/JP/JB/KM/KK/BK/ADJ
  brand             text not null,
  branch            text not null,
  reference         text not null default '',
  description       text not null default '',
  total             numeric not null default 0,
  status            text not null default 'DRAFT'
                    check (status in ('DRAFT','REVIEW','APPROVED','POSTED')),
  operator_name     text not null,
  operator_role     text not null default '',
  operator_initials text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists journals_status_idx on public.journals (status);
create index if not exists journals_date_idx   on public.journals (date);

create table if not exists public.journal_lines (
  id           uuid primary key default gen_random_uuid(),
  journal_id   uuid not null references public.journals(id) on delete cascade,
  line_no      integer not null,
  account_code text not null,
  account_name text not null,
  memo         text not null default '',
  debit        numeric not null default 0,
  credit       numeric not null default 0,
  -- Natural key so re-running install.sql replaces lines instead of
  -- duplicating them (the bare `id` uuid can never conflict).
  unique (journal_id, line_no)
);

create index if not exists journal_lines_journal_idx on public.journal_lines (journal_id);

-- `create table if not exists` above is a no-op when the table already exists,
-- so an older install would never pick up the (journal_id, line_no) unique
-- key. Add it separately when missing — without this, re-running install.sql
-- would duplicate every journal line.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'journal_lines_journal_id_line_no_key'
  ) then
    alter table public.journal_lines
      add constraint journal_lines_journal_id_line_no_key unique (journal_id, line_no);
  end if;
end $$;

alter table public.journals enable row level security;
drop policy if exists "journals rw" on public.journals;
create policy "journals rw" on public.journals for all using (true) with check (true);

alter table public.journal_lines enable row level security;
drop policy if exists "journal lines rw" on public.journal_lines;
create policy "journal lines rw" on public.journal_lines for all using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════
-- Buku Besar (General Ledger)
-- Live movements derive from posted journals (view), plus immutable
-- upstream supplement postings (POS batch, payroll, QRIS clearing).
-- ═══════════════════════════════════════════════════════════════════

create or replace view public.gl_account_movements as
select
  jl.account_code,
  j.number        as voucher,
  j.date,
  j.brand,
  j.branch,
  j.reference,
  j.description,
  jl.memo,
  jl.debit,
  jl.credit,
  j.id            as journal_id
from public.journal_lines jl
join public.journals j on j.id = jl.journal_id
where j.status = 'POSTED';

create table if not exists public.gl_supplements (
  id           uuid primary key default gen_random_uuid(),
  ref_id       text not null unique,             -- 's-1103-01'
  account_code text not null,
  date         date not null,
  time         text not null default '09:00',
  voucher      text not null,
  ref          text not null default '',
  branch       text not null,
  dot          text not null default 'primary',
  description  text not null,
  sub_desc     text,
  offset_label text not null,
  debit        numeric not null default 0,
  credit       numeric not null default 0,
  bukti        text not null default 'receipt',
  memo         text
);

create index if not exists gl_supplements_account_idx on public.gl_supplements (account_code);

alter table public.gl_supplements enable row level security;
drop policy if exists "gl supplements read" on public.gl_supplements;
create policy "gl supplements read" on public.gl_supplements for select using (true);

-- ═══════════════════════════════════════════════════════════════════
-- Laba Rugi — aggregated per-account periodic postings
-- (ditulis oleh ledger rollup engine; view-nya ada di laporan)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.pnl_account_postings (
  id     uuid primary key default gen_random_uuid(),
  seq    integer not null,
  code   text not null,
  period text not null,                -- '2026-09'
  amount numeric not null default 0,
  tag    text,
  unique (code, period)
);

create index if not exists pnl_postings_period_idx on public.pnl_account_postings (period);

alter table public.pnl_account_postings enable row level security;
drop policy if exists "pnl read" on public.pnl_account_postings;
create policy "pnl read" on public.pnl_account_postings for select using (true);
