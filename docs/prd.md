# Product Requirements Document (PRD)
## Astrofox: Advanced Multimedia & Visualizer Engine Upgrade

**Status:** Draft / Review
**Tujuan Proyek:** Mengembangkan Astrofox dari visualizer audio tunggal yang sederhana menjadi *engine* multimedia *multi-layer* yang mampu menghasilkan karya standar industri (YouTube Music Channels).

---

## 📅 Fase 1: Modifikasi Inti (Core Engine Upgrades)
Fase ini berfokus pada perombakan arsitektur dasar Astrofox untuk mendukung struktur *timeline* dan komposisi yang kompleks.

### 1.1 Multi-Audio Support (Playlist & Mixing)
*   **Kebutuhan:** Aplikasi harus bisa menerima lebih dari satu file audio.
*   **Fungsionalitas:**
    *   Pengguna dapat menambahkan banyak *track* lagu (Playlist).
    *   Lagu dapat diputar secara berurutan atau secara bersamaan (misal: *track* vokal terpisah dari instrumen).
*   **Dampak Teknis:** Mengubah logika `AudioContext` yang tadinya *single-node* menjadi sistem *mixer* dengan beberapa *source node*.

### 1.2 Multi-Image & Dynamic Layering
*   **Kebutuhan:** Sistem layer tak terbatas untuk mengimpor banyak gambar (PNG/JPG).
*   **Fungsionalitas:**
    *   **Static Layer:** Gambar dasar (*background*) yang tidak terpengaruh oleh suara.
    *   **Audio Reactive Layer:** Gambar (misal: logo) yang diposisikan di atas *background* dan bereaksi terhadap *beat* musik (membesar/mengecil atau *Pulsing*).
    *   **Parallax Effect:** Gambar dapat digerakkan secara lambat untuk menciptakan ilusi kedalaman 3D (seperti gaya MrSuicideSheep).

### 1.3 Video Background Support
*   **Kebutuhan:** Dukungan impor file video (MP4/WebM) ke dalam *canvas*.
*   **Fungsionalitas:**
    *   Video dapat diatur sebagai *background* di belakang visualizer.
    *   **Auto-Looping:** Jika durasi video lebih pendek dari durasi musik, video akan otomatis diulang (*loop*) secara halus hingga lagu selesai.
    *   Opsi untuk meredupkan (Opacity/Brightness) video agar visualizer lebih menonjol.
*   **Dampak Teknis:** Mengintegrasikan elemen HTML5 `<video>` ke dalam *texture rendering* (PixiJS/WebGL).

---

## 🎨 Fase 2: Penambahan Gaya Visualizer Populer
Setelah Fase 1 selesai dan fondasi *engine* sudah kuat, kita akan membuat preset/komponen visualizer baru.

### 2.1 Starfield Particle Emitter (Bintang Menyebar)
*   **Deskripsi:** Partikel berbentuk bintang atau titik yang memancar dari titik tengah layar ke segala arah.
*   **Audio Reactivity:** 
    *   Kecepatan pancaran (Velocity) meningkat tajam saat *bass drop*.
    *   Jumlah emisi partikel berbanding lurus dengan intensitas volume/frekuensi.
*   **Kontrol Pengguna:** Base Speed, Warna Partikel, Ukuran, Gravitasi.

### 2.2 "Trap Nation" Style
*   **Deskripsi:** Kombinasi dari logo *pulsing* dengan spektrum yang melingkarinya, serta efek asap/partikel di latar belakang.
*   **Audio Reactivity:** Lingkaran logo bergetar sangat agresif pada frekuensi *kick drum* / *bass*.

### 2.3 "NCS" (NoCopyrightSounds) Style
*   **Deskripsi:** Spektrum lingkaran *clean* dengan efek kamera yang khas.
*   **Audio Reactivity:** 
    *   **Screen Shake:** Seluruh kanvas bergetar perlahan pada *bass drop*.
    *   **Color Morphing:** Warna visualizer perlahan berubah (misal: dari biru ke merah) secara dinamis tanpa perlu diatur manual.

### 2.4 "Monstercat" Style
*   **Deskripsi:** Bar *equalizer* vertikal lurus (bisa diletakkan di bawah atau tengah) dengan estetika minimalis.
*   **Tambahan Visual:** Dilengkapi dengan efek partikel jatuh pelan (*falling snow/dust*) yang independen dari *beat* musik untuk menambah estetika.

---

## 🛠️ Langkah Eksekusi Selanjutnya
1.  **Persetujuan PRD:** Memastikan seluruh kebutuhan di atas sesuai dengan visi Anda.
2.  **Environment Setup:** Menjalankan perintah `git clone` Astrofox ke dalam Workspace (`/Users/nanditomonlievpassa/Antigravity/puasaku`).
3.  **Analisis Kode:** Mulai membedah *state management* (Redux/React) dan *rendering engine* (PixiJS) Astrofox.
4.  **Mulai Koding (Fase 1):** Eksekusi modifikasi pada *Core Engine*.

> [!IMPORTANT]
> **Keputusan Anda:** Jika PRD ini sudah lengkap dan sesuai, silakan setujui dokumen ini. Setelah disetujui, Anda bisa beralih ke *Antigravity IDE*, dan saya akan langsung mulai melakukan proses `git clone` serta riset kode untuk tahap awal Fase 1!
