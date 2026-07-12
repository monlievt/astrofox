import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';

// ─── Logger Setup ────────────────────────────────────────────────────────────
log.transports.file.level = 'info';
autoUpdater.logger = log;

// ─── Path helpers ────────────────────────────────────────────────────────────
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const NEXT_OUT = path.join(__dirname, '../out');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// ─── Window Creation ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    titleBarStyle: 'hiddenInset', // macOS traffic lights inside frame
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(NEXT_OUT, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // ─── Before Quit Warning ──────────────────────────────────────────────
  mainWindow.on('close', async (e) => {
    const hasUnsaved = await mainWindow?.webContents
      .executeJavaScript('window.__astrofox_has_unsaved_changes?.()')
      .catch(() => false);

    if (hasUnsaved) {
      e.preventDefault();

      const { response } = await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'Perubahan Belum Disimpan',
        message: 'Ada perubahan yang belum disimpan. Yakin ingin keluar?',
        buttons: ['Keluar Tanpa Simpan', 'Batal'],
        defaultId: 1,
        cancelId: 1,
      });

      if (response === 0) {
        mainWindow?.destroy(); // Force close bypassing the 'close' listener
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Start auto-updater check (only in production)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── IPC: Native File Dialogs ─────────────────────────────────────────────────
ipcMain.handle('dialog:showOpenDialog', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', ...(options.multiple ? ['multiSelections' as const] : [])],
    filters: (options.filters || []).map((f: { name: string; extensions: string[] }) => ({
      name: f.name || 'Files',
      extensions: f.extensions || ['*'],
    })),
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true, files: [] };
  }

  // Read files and return as base64 blobs with metadata so renderer can reconstruct File objects
  const files = await Promise.all(
    result.filePaths.map(async (filePath) => {
      const data = fs.readFileSync(filePath);
      return {
        name: path.basename(filePath),
        path: filePath,
        size: data.length,
        data: data.toString('base64'),
      };
    }),
  );

  return { canceled: false, files };
});

ipcMain.handle('dialog:showSaveDialog', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: options.defaultPath,
    filters: (options.filters || []).map((f: { name: string; extensions: string[] }) => ({
      name: f.name || 'Files',
      extensions: f.extensions || ['*'],
    })),
  });

  return { canceled: result.canceled, filePath: result.filePath };
});

ipcMain.handle('dialog:saveFile', async (_event, { filePath, data }) => {
  try {
    const buffer = Buffer.from(data as ArrayBuffer);
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ─── IPC: Shell Utilities ─────────────────────────────────────────────────────
ipcMain.handle('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// ─── Auto Updater Events ──────────────────────────────────────────────────────
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info.version);
  mainWindow?.webContents.send('updater:update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info.version);
  mainWindow?.webContents.send('updater:update-downloaded', info);

  dialog
    .showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Tersedia',
      message: `Versi baru Astrofox (${info.version}) sudah diunduh.\nRestart untuk menginstall update.`,
      buttons: ['Restart Sekarang', 'Nanti'],
      defaultId: 0,
    })
    .then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on('error', (err) => {
  log.error('Auto updater error:', err);
});
