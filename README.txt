AZKA TIKTOK LIVE AUCTION — TANPA EULER STREAM

PERSYARATAN
- Windows 10/11
- Node.js versi 22 atau lebih baru (wajib untuk tiklive)
- Koneksi internet
- Akun streamer harus sedang LIVE untuk langsung tersambung

CARA INSTALL
1. Extract ZIP ini ke folder biasa.
2. Buka folder AZKA_AUCTION_BARU.
3. Klik address bar File Explorer, ketik cmd, lalu Enter.
4. Ketik: node -v
   Pastikan versinya v22 atau lebih baru. Jika masih di bawah v22, perbarui Node.js terlebih dahulu.
5. Jalankan: npm install
6. Setelah selesai, jalankan: npm start
7. Buka: http://localhost:3000

CARA KONEKSI
1. Pastikan jendela CMD AZKA tetap terbuka.
2. Masukkan username streamer TikTok yang sedang LIVE.
3. Tekan CONNECT.
4. Status akan berubah menjadi CONNECTED saat sesi LIVE berhasil terhubung.

PENTING
- Sistem koneksi menggunakan tiklive yang berjalan lokal di komputer.
- Tidak memakai Euler Stream dan tidak memerlukan API key Euler.
- Tidak perlu memasukkan password, cookie, atau kode login TikTok.
- Layanan tiklive lokal memakai port 8080; AZKA memakai port 3000.
- Gift hanya dihitung saat timer berjalan. Gift sebelum mulai, saat jeda, atau setelah timer selesai diabaikan.
- Gift streak dihitung satu kali saat combo selesai.
- Extra time ditambahkan untuk setiap gift event yang berhasil dihitung.
- Reset menghapus leaderboard dan mengembalikan timer ke durasi awal.
- Overlay:
  Transparan: http://localhost:3000/overlay
  Panel OBS: http://localhost:3000/overlay-panel

CATATAN
TikTok LIVE menggunakan protokol web yang tidak resmi dan dapat berubah sewaktu-waktu. Koneksi dapat gagal jika TikTok mengubah protokol, akun tidak sedang LIVE, jaringan bermasalah, atau port 8080 sedang dipakai aplikasi lain.

DEPLOY RENDER
- ZIP ini menambahkan postinstall untuk memperbaiki import NodeWS yang sebelumnya perlu diedit manual.
- Node dipatok ke 22.19.0 agar memenuhi kebutuhan @effect/platform-node terbaru.
- Render menjalankan npm install lalu npm start sesuai render.yaml.
- Uji koneksi TikTok LIVE setelah deploy; keberhasilan lokal belum menjamin koneksi publik.
