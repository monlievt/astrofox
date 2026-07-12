import { contextBridge, ipcRenderer } from 'electron';

// ─── Expose safe IPC API to renderer ─────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  showOpenDialog: (options: object) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  showSaveDialog: (options: object) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  saveFile: (args: { filePath: string; data: ArrayBuffer }) =>
    ipcRenderer.invoke('dialog:saveFile', args),

  // Shell utilities
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Auto-updater events (renderer can listen to these)
  onUpdateAvailable: (callback: (info: object) => void) =>
    ipcRenderer.on('updater:update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback: (info: object) => void) =>
    ipcRenderer.on('updater:update-downloaded', (_event, info) => callback(info)),

  // Sync unsaved changes flag
  setUnsavedChanges: (hasUnsaved: boolean) =>
    ipcRenderer.send('app:set-unsaved-changes', hasUnsaved),
});

// ─── Expose unsaved changes state bridge ─────────────────────────────────────
// The renderer sets this so the main process can query it during window close
contextBridge.exposeInMainWorld('__astrofox_set_unsaved', (fn: () => boolean) => {
  (window as unknown as Record<string, unknown>).__astrofox_has_unsaved_changes = fn;
});
