# Menghubungkan Dentico Finance ke Supabase

Aplikasi berjalan dalam **mode demo** (dummy data lokal) sampai kredensial
Supabase diisi. Semua operasi CRUD (baca, tambah, edit, nonaktifkan) memakai
API yang sama — tinggal ganti sumber datanya.

## 1. Buat project

Buat project gratis di [supabase.com](https://supabase.com) → catat
**Project URL** dan **anon public key** (Project Settings → API).

## 2. Buat tabel & seed data

Buka **SQL Editor**, lalu jalankan berurutan:

1. `supabase/schema.sql` — tabel `public.coa_accounts` (index, trigger
   `updated_at`, policy RLS) **plus** tabel `public.finance_monthly` &
   `public.finance_overview_meta` untuk modul Executive Financial Overview.
2. `supabase/seed.sql` — 71 akun dummy Dentico (10 header + 61 akun posting).
   File ini digenerate dari `src/data/coa.seed.json` via
   `node scripts/generate-seed-sql.mjs`, jadi selalu sinkron dengan data demo.
3. `supabase/seed_finance.sql` — 9 bulan snapshot keuangan (Jan–Sep 2026) +
   meta JSON (brand split, top branch, top expenses, pipeline status).
   Digenerate dari `src/data/finance.seed.json` via
   `node scripts/generate-finance-seed-sql.mjs`.
4. `supabase/seed_journals.sql` — 8 jurnal dummy (POSTED/REVIEW/APPROVED/DRAFT)
   beserta baris debit/kredit. Digenerate dari `src/data/journal.seed.json` via
   `node scripts/generate-journal-seed-sql.mjs`.
5. `supabase/seed_ledger.sql` — 24 supplement GL terverifikasi (batch POS,
   payroll JM, clearing QRIS). Digenerate dari `src/data/ledger.seed.json` via
   `node scripts/generate-ledger-seed-sql.mjs`. Mutasi Buku Besar live
   tersedia lewat view `public.gl_account_movements` (join jurnal POSTED).

## 3. Isi environment

```bash
cp .env.example .env
# lalu isi:
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Restart `npm run dev`. Footer sidebar akan berubah dari
"Demo lokal" menjadi "Supabase Sinkron".

## Struktur tabel

| Kolom          | Tipe        | Keterangan                                   |
| -------------- | ----------- | -------------------------------------------- |
| `id`           | uuid (PK)   | default `gen_random_uuid()`                  |
| `code`         | text unique | kode akun 4 digit, cth `1103`                |
| `name`         | text        | nama resmi akun                              |
| `type_label`   | text        | sub-tipe, cth `Aset Lancar (Bank)`           |
| `group_code`   | text        | kelompok header: `1000`–`6600`               |
| `parent_code`  | text null   | kode parent (untuk hierarki)                 |
| `parent_label` | text null   | label parent ter-denormalisasi               |
| `normal`       | text        | `Debit` / `Kredit`                           |
| `is_header`    | bool        | akun induk — tidak bisa diposting            |
| `can_post`     | bool        | akun posting level 2                         |
| `is_active`    | bool        | gunakan ini, bukan DELETE (integritas GL)    |
| `is_locked`    | bool        | punya histori jurnal → proteksi penghapusan  |
| `tx_count`     | int         | jumlah transaksi ledger terhubung            |
| `updated_at`   | timestamptz | diperbarui otomatis oleh trigger             |
