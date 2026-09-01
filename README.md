# TRACKKEEPING

Daily grinding & habit log — static site, Firestore sebagai database, siap deploy ke Vercel.

## Struktur

```
trackkeeping/
├── index.html
├── css/style.css
├── js/
│   ├── firebase-config.js   ← isi config Firebase kamu di sini
│   └── app.js
├── firestore.rules
├── vercel.json
└── README.md
```

Tidak ada build step. Semua file statis (HTML/CSS/JS module), jadi loading-nya minim dan cepat.

## 1. Setup Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → buat project baru (atau pakai yang sudah ada).
2. Aktifkan **Firestore Database** (mode production atau test, bebas — nanti kita override rules-nya sendiri).
3. Di **Project Settings → General → Your apps**, tambah "Web app", lalu copy objek `firebaseConfig`.
4. Paste ke `js/firebase-config.js`, ganti placeholder `YOUR_API_KEY` dst.
5. Di Firestore Console → **Rules**, paste isi `firestore.rules` yang sudah disediakan, lalu Publish.

> Catatan keamanan: API key Firebase untuk web app memang publik by design (aman, karena akses sebenarnya dikontrol oleh Firestore Rules, bukan API key). Rules contoh di atas cukup untuk personal tracker (siapapun yang tahu URL bisa baca, tapi write dibatasi format ID tanggal). Kalau kamu mau proteksi lebih (mirip passphrase gate di TRADR.), lihat bagian "Opsional: Passphrase Gate" di bawah.

## 2. Coba lokal

Karena pakai ES modules (`type="module"`), buka file `index.html` langsung dari `file://` tidak akan jalan (CORS). Jalankan local server sederhana:

```bash
cd trackkeeping
python3 -m http.server 8080
# atau
npx serve .
```

Buka `http://localhost:8080`.

## 3. Deploy ke Vercel (via GitHub — sama seperti workflow TRADR. kamu)

```bash
git init
git add .
git commit -m "init trackkeeping"
gh repo create trackkeeping --public --source=. --push
```

Lalu import repo itu di [vercel.com/new](https://vercel.com/new). Karena ini static site tanpa build step, Vercel akan auto-detect — **Framework Preset: Other**, Build Command kosong, Output Directory `.`. Deploy.

## 4. Struktur data Firestore

**Collection `trackkeeping_days`** — Document ID: `YYYY-MM-DD` (misal `2026-07-19`)

```json
{
  "sesi": [4.17, null, 0.67, null, 1.67, 0.91, null, null, null],
  "sesiColors": [null, null, "#D9534F", null, null, null, null, null, null],
  "brainrot": [1.5, 1.0],
  "intermittentFasting": { "success": false, "note": "NO IF; 14hr" },
  "insomnia": { "normal": false, "note": "1.30am" },
  "jogging": { "active": false, "note": "olahraga ringan" },
  "trisandhya": true,
  "acLog": {
    "start":  { "h": "1", "m": "00", "p": "PM" },
    "finish": { "h": "2", "m": "10", "p": "PM" },
    "value": 1.17,
    "unknown": false
  },
  "updatedAt": "2026-07-19T10:00:00.000Z"
}
```

`sesiColors` itu array sejajar dengan `sesi` (index yang sama = sesi yang sama) — isinya hex color atau `null` kalau sesi itu ga dikasih label. `TOTAL (jam)` tetap tidak disimpan, dihitung otomatis dari `sesi` tiap render.

**Collection `trackkeeping_notes`** — Document ID: auto-generated

```json
{
  "date": "2026-07-19",
  "text": "Server down 3 jam pas market lagi rame",
  "createdAt": "2026-07-19T10:00:00.000Z"
}
```

## 5. Cara pakai

- Navigasi bulan pakai tombol `‹ ›`, atau klik label bulan/tahun untuk buka picker cepat.
- Klik tombol **Hari ini** untuk lompat ke bulan berjalan.
- Klik salah satu baris tanggal (atau card, di mobile) untuk buka panel edit di kanan.
- Isi Sesi 1–9, total kejumlah otomatis live saat kamu ngetik.
- Tiap Sesi 1–9 punya titik kecil (dot) di pojok kanan atas — klik buat kasih label warna kalau ada aktivitas unik di sesi itu (8 pilihan warna + opsi hapus label). Warna itu muncul sebagai garis aksen tipis di bawah angka di tabel utama.
- Brainrot juga sesi-based: default 2 input, klik **+ Tambah sesi** untuk nambah sebanyak yang perlu. Nilai yang dipakai di grid & ticker adalah kumulatif harian (jumlah semua sesi brainrot hari itu). Sesi bisa dihapus lagi lewat tombol × kecil di pojoknya (minimal 1 sesi tersisa).
- IF / Insomnia / Jogging / Trisandhya kini punya 3 pilihan: dua state seperti biasa + **None** (default kalau belum diisi sama sekali — beda dari memilih salah satu opsi secara eksplisit). Field ini disimpan sebagai `null` di Firestore saat None dipilih.
- IF / Insomnia / Jogging pakai toggle 3 pilihan; kalau pilih opsi "negatif" (Gagal / Insomnia / Tidak jogging), field teks catatan otomatis muncul.
- Trisandhya cuma toggle Ya/Tidak.
- AC Log: isi jam **Mulai** dan **Selesai** pakai dropdown format 12 jam (jam/menit/AM-PM). Total jam pemakaian dihitung otomatis dari selisihnya (misal 01:00 PM → 02:10 PM = 70 menit = 1.17 jam), langsung kelihatan live di label "Total". Kalau rentang melewati tengah malam (mis. mulai 11 PM, selesai 01 AM), otomatis dihitung benar. Atau centang "Unknown/unrecorded" kalau kamu gak sempat catat (otomatis warna kuning di grid, dropdown waktu jadi disabled).
- Tombol **Hapus data hari ini** akan menghapus dokumen Firestore untuk tanggal itu.
- Toggle tema (☀️/🌙) di kanan atas, tersimpan di browser (localStorage) jadi persist antar sesi.
- Di layar <760px, tabel otomatis berubah jadi list card supaya tetap enak dibaca tanpa scroll horizontal.
- **Extra Notes** (di bawah tabel utama): mengikuti bulan yang lagi ditampilkan di tabel utama (label bulan kecil ada di sebelah judul "Extra Notes"). Default 5 baris kosong per bulan, klik **+ Tambah baris** untuk nambah lagi. Isi tanggal (date picker native) dan deskripsi singkat — otomatis tersimpan ~0.7 detik setelah kamu berhenti mengetik, tanpa perlu tombol simpan. Baris bisa dihapus lewat tombol × di ujung kanan. Catatan tanpa tanggal (belum sempat diisi Tgl-nya) tetap selalu muncul di bulan manapun, biar gak "hilang" begitu aja.

## 6. Performa (load & save terasa cepat)

Beberapa hal yang bikin app ini terasa instan meski Firestore-nya di server jauh:

- **Skeleton instan**: pindah bulan / buka halaman langsung nampilin struktur tabel (tanggal + "–") tanpa nunggu data dari server, baru keisi begitu data datang. Jadi ga ada layar kosong pas loading.
- **Optimistic save/delete**: klik Simpan/Hapus langsung update tampilan & nutup drawer seketika — gak nunggu konfirmasi server dulu. Kalau ternyata gagal (mis. koneksi putus), muncul toast merah dan datanya bakal balik sinkron begitu koneksi pulih.
- **IndexedDB persistence**: Firestore nyimpen cache lokal di browser, jadi kunjungan/kilas-balik bulan berikutnya jauh lebih cepat karena baca dari cache dulu sambil sinkron ke server di belakang layar.
- **Preconnect hints** ke domain Firestore & font, biar koneksi TLS-nya udah kebuka duluan sebelum benar-benar dibutuhkan.

**Penting**: perubahan IndexedDB persistence itu ada di `js/firebase-config.js`. Karena file itu isinya config Firebase kamu sendiri, **jangan ditimpa mentah-mentah** — cukup tambahin manual:

1. Ganti baris import Firestore dari:
   ```js
   import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
   ```
   jadi:
   ```js
   import {
     initializeFirestore,
     persistentLocalCache,
     persistentSingleTabManager,
   } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
   ```
2. Ganti baris:
   ```js
   export const db = getFirestore(app);
   ```
   jadi:
   ```js
   export const db = initializeFirestore(app, {
     localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
   });
   ```
3. Baris `firebaseConfig` (apiKey dst.) kamu **jangan diubah** — biarin tetap punya kamu.

## Opsional: Passphrase Gate

Kalau kamu mau tambahin proteksi tulis ala portfolio section TRADR. (passphrase-gated editing), pola paling gampang:

1. Simpan hash passphrase (SHA-256) di `firebase-config.js` atau di Firestore doc terpisah.
2. Sebelum `setDoc`/`deleteDoc` jalan di `app.js`, minta input passphrase sekali, hash, dan compare — kalau cocok, simpan flag di `sessionStorage` supaya gak nanya berulang selama sesi browser itu.
3. Ini murni client-side gate (UX friction), bukan pengganti Firestore Rules. Untuk proteksi write yang sungguhan, tambahkan Firebase Anonymous Auth + custom claim, atau Cloud Function yang validasi passphrase di server.

Bisa aku bikinin kalau kamu mau.
