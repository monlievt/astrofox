import { app, BrowserWindow, dialog, ipcMain, shell, protocol, net } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';

// ─── Logger Setup ────────────────────────────────────────────────────────────
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Register standard scheme for app:// protocol
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// ─── Path helpers ────────────────────────────────────────────────────────────
const NEXT_OUT = path.join(__dirname, '../../out');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.ico': return 'image/x-icon';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.otf': return 'font/otf';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}

let mainWindow: BrowserWindow | null = null;
let hasUnsavedChanges = false;

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
    mainWindow.loadURL('app://-/index.html');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // ─── Before Quit Warning ──────────────────────────────────────────────
  mainWindow.on('close', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();

      dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'Perubahan Belum Disimpan',
        message: 'Ada perubahan yang belum disimpan. Yakin ingin keluar?',
        buttons: ['Keluar Tanpa Simpan', 'Batal'],
        defaultId: 1,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          hasUnsavedChanges = false;
          mainWindow?.destroy(); // Force close bypassing the 'close' listener
        }
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Register app:// protocol handler to serve Next.js static files correctly
  protocol.handle('app', async (request) => {
    const urlObj = new URL(request.url);
    let pathname = urlObj.pathname;
    
    // If it's a directory or has no extension, look for index.html inside it
    if (!path.extname(pathname)) {
      pathname = path.join(pathname, 'index.html');
    }
    
    const absolutePath = path.join(NEXT_OUT, pathname);
    
    try {
      const data = fs.readFileSync(absolutePath);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': getMimeType(absolutePath),
        },
      });
    } catch (error) {
      log.error('Failed to load asset from protocol:', absolutePath, error);
      return new Response('File not found', { status: 404 });
    }
  });

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
ipcMain.on('app:set-unsaved-changes', (_event, hasUnsaved) => {
  hasUnsavedChanges = hasUnsaved;
});

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
