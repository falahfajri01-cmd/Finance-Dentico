# Supabase — Dentico Finance

Supabase (managed PostgreSQL) adalah **satu-satunya** backend aplikasi.
Layer PostgreSQL self-hosted + ORM Drizzle yang sebelumnya ada sudah dihapus:
tidak ada lagi `drizzle.config.ts`, `DATABASE_URL`, atau driver `pg`/`postgres`.
Browser BERKORELASI langsung ke API Supabase (PostgREST) memakai **anon public
key**, dan **Row Level Security** pada setiap tabel yang melindungi data.

Aplikasi ini **tidak butuh Node.js di server**. Yang dikirim ke cPanel hanya
file statis hasil build.

---

## 1. Buat project

Buat project gratis di [supabase.com](https://supabase.com), lalu catat
**Project URL** dan **anon public key**
(*Project Settings → API → Project API keys*).

---

## 2. Jalankan schema

Buka **SQL Editor → New query**, salin **seluruh isi** file berikut, lalu **Run**:

```
supabase/install.sql
```

`install.sql` adalah satu-satunya file yang perlu dijalankan. Isinya sudah
dirangkai dari `schema.sql` + kelima file seed. Aman dijalankan berulang kali
(semua statement memakai `create … if not exists`, `drop … if exists`, atau
`on conflict`).

Kalau kamu ingin menjalankan bagiannya satu per satu, urutannya:

| # | File | Isi |
| - | ---- | --- |
| 1 | `schema.sql` | Tabel, index, trigger `updated_at`, policy RLS, view `gl_account_movements` |
| 2 | `seed.sql` | 115 akun COA (6 header + 109 akun posting) |
| 3 | `seed_finance.sql` | 9 snapshot bulanan + 1 baris meta overview |
| 4 | `seed_journals.sql` | 8 jurnal (DRAFT/REVIEW/APPROVED/POSTED) + 16 baris debit/kredit |
| 5 | `seed_ledger.sql` | 23 supplement GL (batch POS, payroll JM, clearing QRIS) |
| 6 | `seed_pnl.sql` | 174 posting P&L (58 akun × 3 periode) |

Seed bisa dibuat ulang dari data demo:

```bash
npm run db:seed      # menulis ulang 5 file seed_*.sql
npm run db:install   # seed + regenerate supabase/install.sql
```

### Verifikasi

Blok terakhir `install.sql` menjalankan query penghitung baris. Semua angka
harus **lebih dari nol**:

```
coa_accounts | 115
finance_monthly | 9
finance_overview_meta | 1
journals | 8
journal_lines | 16
gl_supplements | 23
pnl_account_postings | 174
gl_account_movements | <jumlah baris jurnal POSTED>
```

Kalau ada yang `0`, berarti ada file seed yang belum dijalankan.

---

## 3. Isi environment

```bash
cp .env.example .env
```

Isi dengan nilai punyamu:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_BASE_PATH=/
```

> **Penting:** prefixnya `VITE_`, bukan `NEXT_PUBLIC_`. Variabel `NEXT_PUBLIC_*`
> juga tetap dibaca sebagai fallback, jadi `.env` lama tidak langsung rusak —
> tapi tetap disarankan menamai ulang.
>
> `VITE_BASE_PATH` menentukan posisi site: `/` untuk root domain
> (`public_html`), `/finance/` bila diunggah ke subdirektori.

---

## 4. Jalankan

```bash
npm run dev
```

Footer sidebar berubah dari **"Demo lokal"** menjadi **"Supabase Sinkron"**
(lengkap dengan project ref). Kalau masih "Demo lokal", buka console browser —
repo akan mencatat `[coa] Supabase read failed…` beserta pesan errornya.

---

## Objek database

| Objek | Jenis | RLS | Dipakai oleh |
| ----- | ----- | --- | ------------ |
| `coa_accounts` | tabel | RLS | Halaman COA (baca + tulis) |
| `finance_monthly` | tabel | RLS | Overview Keuangan — seri bulanan |
| `finance_overview_meta` | tabel | RLS | Overview Keuangan — brand/cabang/expense/pipeline |
| `journals` | tabel | RLS | Jurnal Umum — header |
| `journal_lines` | tabel | RLS | Jurnal Umum — baris debit/kredit |
| `gl_account_movements` | **view** | RLS | Buku Besar — mutasi dari jurnal POSTED |
| `gl_supplements` | tabel | RLS | Buku Besar — posting upstream (POS/payroll/QRIS) |
| `pnl_account_postings` | tabel | RLS | Laba Rugi — posting per akun per periode |

### Struktur `coa_accounts`

| Kolom | Tipe | Keterangan |
| ----- | ---- | ---------- |
| `id` | uuid (PK) | default `gen_random_uuid()` |
| `code` | text unique | kode akun 4 digit, cth `1103` |
| `name` | text | nama resmi akun |
| `type_label` | text | sub-tipe, cth `Aset Lancar (Bank)` |
| `group_code` | text | kelompok header: `1000`–`6600` |
| `parent_code` | text null | kode parent (hierarki) |
| `parent_label` | text null | label parent ter-denormalisasi |
| `normal` | text | `Debit` / `Kredit` |
| `is_header` | bool | akun induk — tidak bisa diposting |
| `can_post` | bool | akun posting level 2 |
| `is_active` | bool | nonaktifkan lewat ini, bukan `DELETE` (integritas GL) |
| `is_locked` | bool | punya histori jurnal → proteksi hapus |
| `tx_count` | int | jumlah transaksi ledger terhubung |
| `updated_at` | timestamptz | diperbarui otomatis oleh trigger |

---

## Catatan keamanan

- **Anon key itu publik.** Nilainya ikut ter-*inline* ke dalam `index.html` yang
  diunggah ke `public_html` — itu memang desain Supabase, bukan kebocoran.
  Yang melindungi data adalah **RLS**, dan anon key tidak bisa melewati policy.
- **Jangan pernah** menaruh `service_role` key di `.env` — key itu melewati RLS
  dan akan memberi akses admin ke siapa pun yang membuka DevTools.
- Policy di `schema.sql` saat ini `using (true) with check (true)`, artinya
  anon bisa menulis. Untuk produksi, ubah policy `coa write` agar butuh JWT
  login (`auth.uid() is not null`) dan aktifkan **Email/Password auth** di
  *Supabase → Authentication → Providers*.
- Karena RLS aktif, tabel **tidak terlihat** dari anon sebelum policy dibuat —
  jalankan `schema.sql` sampai habis, jangan dilewati.
