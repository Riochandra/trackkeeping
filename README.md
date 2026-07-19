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

Collection: `trackkeeping_days`
Document ID: `YYYY-MM-DD` (misal `2026-07-19`)

```json
{
  "sesi": [4.17, null, 0.67, null, 1.67, 0.91, null, null, null],
  "brainrot": 2.5,
  "intermittentFasting": { "success": false, "note": "NO IF; 14hr" },
  "insomnia": { "normal": false, "note": "1.30am" },
  "jogging": { "active": false, "note": "olahraga ringan" },
  "trisandhya": true,
  "acLog": { "value": 3, "unknown": false },
  "updatedAt": "2026-07-19T10:00:00.000Z"
}
```

`TOTAL (jam)` **tidak disimpan** — dihitung otomatis di client dari array `sesi` tiap kali data di-render. Ini supaya tidak ada risiko total jadi "basi" kalau ada yang lupa update.

## 5. Cara pakai

- Navigasi bulan pakai tombol `‹ ›`, atau klik label bulan/tahun untuk buka picker cepat.
- Klik tombol **Hari ini** untuk lompat ke bulan berjalan.
- Klik salah satu baris tanggal (atau card, di mobile) untuk buka panel edit di kanan.
- Isi Sesi 1–9, total kejumlah otomatis live saat kamu ngetik.
- IF / Insomnia / Jogging pakai toggle 2 pilihan; kalau pilih opsi "negatif" (Gagal / Insomnia / Tidak jogging), field teks catatan otomatis muncul.
- Trisandhya cuma toggle Ya/Tidak.
- AC Log: isi jam, atau centang "Unknown/unrecorded" kalau kamu gak sempat catat (otomatis warna kuning di grid).
- Tombol **Hapus data hari ini** akan menghapus dokumen Firestore untuk tanggal itu.
- Toggle tema (☀️/🌙) di kanan atas, tersimpan di browser (localStorage) jadi persist antar sesi.
- Di layar <760px, tabel otomatis berubah jadi list card supaya tetap enak dibaca tanpa scroll horizontal.

## Opsional: Passphrase Gate

Kalau kamu mau tambahin proteksi tulis ala portfolio section TRADR. (passphrase-gated editing), pola paling gampang:

1. Simpan hash passphrase (SHA-256) di `firebase-config.js` atau di Firestore doc terpisah.
2. Sebelum `setDoc`/`deleteDoc` jalan di `app.js`, minta input passphrase sekali, hash, dan compare — kalau cocok, simpan flag di `sessionStorage` supaya gak nanya berulang selama sesi browser itu.
3. Ini murni client-side gate (UX friction), bukan pengganti Firestore Rules. Untuk proteksi write yang sungguhan, tambahkan Firebase Anonymous Auth + custom claim, atau Cloud Function yang validasi passphrase di server.

Bisa aku bikinin kalau kamu mau.
