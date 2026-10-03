# Deploy ke cPanel (shared hosting, tanpa Node.js)

Aplikasi ini **fully static**. Tidak ada Node.js, tidak ada `npm start`,
tidak ada `server.js`, tidak ada PHP. Yang dikirim ke server hanya dua file.

```
dist/
├── index.html   ← seluruh aplikasi (JS + CSS + ikon sudah di-inline)
└── .htaccess    ← opsional: HTTPS, cache, proteksi dotfile
```

> **Jangan unggah folder proyek.** Yang diunggah hanya **isi** folder `dist/`.
> `node_modules/`, `src/`, `package.json`, dan `.env` **tidak boleh** ikut ke
> `public_html`.

---

## Langkah 1 — Siapkan database di Supabase

Lihat `supabase/README.md`. Ringkasnya: jalankan `supabase/install.sql` di
Supabase SQL Editor, lalu pastikan `.env` lokal sudah berisi:

```dotenv
VITE_SUPABASE_URL=https://gmumwjdvnbcksfgykywk.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_BASE_PATH=/
```

> Nilai environment **di-inline saat build**. Kalau `.env` belum benar lalu
> kamu build, situsnya akan berjalan dalam mode demo dan mengubah `.env`
> belakangan tidak akan influential — kamu harus build ulang.

---

## Langkah 2 — Build di komputer lokal

Butuh Node.js **di komputermu** (bukan di server):

```bash
npm install
npm run typecheck     # opsional, memastikan tidak ada error TS
npm run build
```

Output sukses:

```
dist/index.html  941.20 kB
```

Verifikasi cepat:

```powershell
Get-ChildItem dist -Force
# harus berisi: .htaccess, index.html  (hanya 2 file)
```

---

## Langkah 3 — Unggah ke `public_html`

### Cara A — cPanel File Manager (paling mudah)

1. Login cPanel → **File Manager** → buka folder **`public_html`**.
2. Hapus file bawaan (`index.html`, `cgi-bin`) yang ada di sana.
3. **Upload** → unggah `index.html` dan `.htaccess` dari `dist/`.
   - File Manager gagal menampilkan file berawalan titik: tekan **Settings →
     Show Hidden Files (dotfiles)** di kanan atas.
   - Alternatif: upload `.htaccess` sebagai `htaccess.txt`, lalu rename via
     menu klik kanan → **Rename**.
4. Buka domain kamu di browser.

### Cara B — FTP (FileZilla)

| Field | Nilai |
| ----- | ----- |
| Host | `ftp.domainmu.com` |
| Username | username cPanel kamu |
| Password | password cPanel kamu |
| Port | `21` |

Directional lokal → `dist/`, remote → `/public_html/`. Pastikan
**Transfer mode = Binary** (FileZilla sudah default).

### Cara C — SSH + rsync

```bash
rsync -avz --delete dist/ user@server:/home/user/public_html/
```

---

## Langkah 4 — Setelan cPanel

| Setting | Lokasi | Nilai |
| ------- | ------ | ----- |
| Document Root | **Domains → dentico.domainmu.com** | `/public_html` |
| SSL | **SSL/TLS Status** | aktifkan **Let's Encrypt** |
| Force HTTPS | **Domains → Force HTTPS Redirect** | On (atau aktifkan baris di `.htaccess`) |
| Version PHP | — | tidak dipakai, biarkan |

Cache `.htaccess` Apache kadang perlu dibersihkan setelah edit: buka
cPanel → **Home**, atau lewat SSH `touch ~/.htaccess`.

---

## Deploy ulang

```bash
npm run build
rsync -avz --delete dist/ user@server:/home/user/public_html/
```

Atau lewat File Manager: hapus `index.html` lama, upload yang baru
(tidak bisa menimpa file yang sedang dibuka browser di beberapa host —
hapus dulu lalu unggah).

`.htaccess` sudah mengatur `Cache-Control: no-cache` untuk `.html`, jadi
browser tidak akan menyajikan build lama setelah diunggah ulang.

---

## Kalau diunggah ke subdirektori

Misalnya situs harus hidup di `https://domainmu.com/finance/` (file masuk ke
`public_html/finance/`), ubah `.env` **sebelum build**:

```dotenv
VITE_BASE_PATH=/finance/
```

Lalu build ulang. `vite.config.ts` menormalisasi nilai itu menjadi
`/finance/` (slash di depan dan belakang) supaya path aset benar.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
| ------ | ---------------- |
| Halaman putih / kosong | Buka console browser (F12). Kalau ada error import path, `VITE_BASE_PATH` tidak sesuai lokasi folder. |
| Sidebar masih "Demo lokal" | `.env` salah / belum di-build ulang. Cek console untuk pesan `[coa] Supabase read failed…`. |
| "Failed to fetch" / CORS di console | `supabase/install.sql` belum dijalankan, atau RLS memblokir karena policy belum ada. |
| Tampilan berantakan (CSS hilang) | File `.htaccess` tidak ikut terunggah. |
| 403 Forbidden | `Options -Indexes` / `AllowOverride` dibatasi host. Hapus blok yang bermasalah dari `.htaccess` — aplikasinya tetap jalan tanpanya. |
| Load lama, spinner tidak berhenti | Constraint `pnl_account_postings` / `journal_lines` belum ada. Jalankan ulang `supabase/install.sql`. |
| 404 saat refresh halaman | Rewrite di `.htaccess` tidak aktif. Pastikan `mod_rewrite` enabled; aplikasinya sendiri tetap jalan karena navigasi berbasis state, bukan URL. |

---

## Peringatan keamanan

- **Anon key aman untuk dikirim.** Nilainya memang publik dan akan terlihat
  di DevTools. Yang melindungi data adalah **Row Level Security** di Supabase.
- **Jangan pernah** menaruh `service_role` key di `.env`. Key itu melewati RLS
  dan memberi akses admin ke siapa pun yang membuka source halaman.
- **Jangan** mengunggah `.env` ke `public_html`.
- Saat ini policy RLS mengizinkan anon untuk menulis. Untuk produksi:
  ubah policy `coa write` agar mewajibkan login
  (`auth.uid() is not null`) dan aktifkan **Email/Password auth** di
  *Supabase → Authentication → Providers*.
