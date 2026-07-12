# README: Ikon dan GitHub Setup untuk Electron Build

## Yang Masih Perlu Disiapkan Sebelum Build Desktop

### 1. File Ikon Aplikasi

Buat folder `build/` di root project dan isi dengan:

| File | Ukuran | Platform |
|------|--------|----------|
| `build/icon.icns` | 1024x1024 | macOS |
| `build/icon.ico` | 256x256 | Windows |
| `build/icon.png` | 512x512 | Linux fallback |

**Cara buat dari satu gambar PNG 1024x1024:**
- macOS: gunakan tool `iconutil` atau https://cloudconvert.com/png-to-icns
- Windows: gunakan https://cloudconvert.com/png-to-ico

---

### 2. GitHub Repository (untuk Auto-Updater)

Auto-updater menggunakan GitHub Releases. Langkah-langkah:

1. Buat repository di GitHub (boleh private)
2. Edit `electron-builder.config.cjs`:
   ```js
   publish: [{
     provider: 'github',
     owner: 'USERNAME_GITHUB_ANDA',  // ← Ganti ini
     repo: 'astrofox',               // ← Ganti ini jika nama repo berbeda
   }]
   ```
3. Saat release, jalankan:
   ```bash
   GH_TOKEN=ghp_xxxxx npm run electron:dist-mac
   ```
   Token GitHub (dengan permission `repo` → `write`) diperlukan untuk upload release.

---

### 3. Perintah Build

| Perintah | Fungsi |
|----------|--------|
| `npm run electron:dev` | Jalankan dev mode (Next.js + Electron bersamaan) |
| `npm run electron:dist-mac` | Build distributable untuk macOS (DMG) |
| `npm run electron:dist-win` | Build distributable untuk Windows (NSIS installer) |
| `npm run electron:dist` | Build untuk semua platform sekaligus |

---

### 4. Catatan untuk Upload ke GitHub

Karena project belum di GitHub, inisialisasi terlebih dahulu:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/astrofox.git
git push -u origin main
```

Buat `.gitignore` terlebih dahulu agar file besar tidak ikut upload.
