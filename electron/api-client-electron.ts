/**
 * Electron-specific API client implementation.
 *
 * This file replaces `src/app/api-client/index.ts` when running inside Electron.
 * It routes file dialog calls through IPC to the native main process handlers,
 * while keeping the same API shape so callers don't need to change.
 */

import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';
import { t } from '@/i18n/config';
import EventEmitter from '@/lib/core/EventEmitter';
import type { EventCallback } from '@/lib/types';

const events = new EventEmitter();

// TypeScript helper to access window.electronAPI injected by preload
declare global {
  interface Window {
    electronAPI?: {
      showOpenDialog: (options: object) => Promise<{
        canceled: boolean;
        files: Array<{ name: string; path: string; size: number; data: string }>;
      }>;
      showSaveDialog: (options: object) => Promise<{ canceled: boolean; filePath?: string }>;
      saveFile: (args: { filePath: string; data: ArrayBuffer }) => Promise<{ success: boolean }>;
      openExternal: (url: string) => void;
      getVersion: () => Promise<string>;
    };
    __astrofox_has_unsaved_changes?: () => boolean;
  }
}

const eAPI = window.electronAPI!;

interface FileFilter {
  name?: string;
  mimeType?: string;
  extensions?: string[];
}

interface OpenDialogProps {
  filters?: FileFilter[];
  multiple?: boolean;
}

interface SaveDialogProps {
  filters?: FileFilter[];
  defaultPath?: string;
}

interface SaveFileProps {
  mimeType?: string;
  fileName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64ToFile(name: string, base64: string, size: number): File {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new File([bytes], name, { lastModified: Date.now() });
}

// ─── Event emitter passthrough ────────────────────────────────────────────────
export function on(channel: string, callback: EventCallback) {
  events.on(channel, callback);
}

export function once(channel: string, callback: EventCallback) {
  events.once(channel, callback);
}

export function off(channel: string, callback: EventCallback) {
  events.off(channel, callback);
}

export function send(channel: string, data?: unknown) {
  events.emit(channel, data);
}

export async function invoke() {
  throw new Error(t('errors.ipc-invoke-unavailable'));
}

export function log(...args: unknown[]) {
  console.log(...args);
}

// ─── File Dialogs (native via IPC) ───────────────────────────────────────────
export async function showOpenDialog(props: OpenDialogProps = {}) {
  const result = await eAPI.showOpenDialog({
    filters: props.filters,
    multiple: props.multiple ?? false,
  });

  if (result.canceled) {
    return { canceled: true, files: [] as File[] };
  }

  const files = result.files.map(f => base64ToFile(f.name, f.data, f.size));
  return { canceled: false, files };
}

export async function showSaveDialog(props: SaveDialogProps = {}) {
  const result = await eAPI.showSaveDialog({
    filters: props.filters,
    defaultPath: props.defaultPath,
  });

  return { canceled: result.canceled, filePath: result.filePath };
}

// ─── File Read/Write ──────────────────────────────────────────────────────────
export async function readAudioFile(file: File) {
  let { type } = file;

  if (file.name?.endsWith('.opus')) {
    type = 'audio/opus';
  }

  if (!/^audio/.test(type)) {
    throw new Error(t('errors.unrecognized-audio-type', { type: type || t('common.unknown') }));
  }

  return file.arrayBuffer();
}

export async function loadAudioTags(file: File) {
  try {
    return await new Promise<Record<string, unknown> | null>(resolve => {
      jsmediatags.read(file, {
        onSuccess: (result: { tags: Record<string, unknown> | null }) =>
          resolve(result.tags || null),
        onError: (err: unknown) => {
          log(err);
          resolve(null);
        },
      });
    });
  } catch (error) {
    log(error);
    return null;
  }
}

export async function readImageFile(file: File) {
  return new Promise<string | ArrayBuffer | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('errors.read-image-file-failed')));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export async function readVideoFile(file: File) {
  if (file.type && !/^video/.test(file.type)) {
    throw new Error(t('errors.unrecognized-video-type', { type: file.type }));
  }

  return new Promise<string | ArrayBuffer | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('errors.read-video-file-failed')));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export async function saveImageFile(
  target: string | null,
  data: BlobPart,
  props: SaveFileProps = {},
) {
  const mimeType = props.mimeType || 'image/png';
  const blob = new Blob([data], { type: mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const filePath = target || props.fileName || 'image.png';
  await eAPI.saveFile({ filePath, data: arrayBuffer });
}

export async function saveVideoFile(
  target: string | null,
  data: BlobPart,
  props: SaveFileProps = {},
) {
  const mimeType = props.mimeType || 'video/webm';
  const blob = new Blob([data], { type: mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const filePath = target || props.fileName || 'video.webm';
  await eAPI.saveFile({ filePath, data: arrayBuffer });
}

export async function saveTextFile(
  target: string | null,
  data: BlobPart,
  props: SaveFileProps = {},
) {
  const blob = new Blob([data]);
  const arrayBuffer = await blob.arrayBuffer();
  const filePath = target || props.fileName || 'download.txt';
  await eAPI.saveFile({ filePath, data: arrayBuffer });
}

// ─── Misc ─────────────────────────────────────────────────────────────────────
export function getEnvironment() {
  return { platform: 'electron' };
}

export async function loadPlugins() {
  return {};
}

export function getPlugins() {
  return {};
}

export function spawnProcess() {
  throw new Error(t('errors.process-spawning-unavailable'));
}

export function openDevTools() {}

export async function getWindowState() {
  return { focused: document.hasFocus(), maximized: false, minimized: false };
}
