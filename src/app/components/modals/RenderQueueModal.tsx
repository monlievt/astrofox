import React from 'react';
import renderQueueStore from '@/app/actions/renderQueue';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, Play, Square, Trash2, X } from 'lucide-react';

interface RenderQueueModalProps {
  onClose: () => void;
}

export default function RenderQueueModal({ onClose }: RenderQueueModalProps) {
  const { items, isProcessing, currentItemIndex, startProcessing, stopProcessing, removeItem, clearQueue } =
    renderQueueStore();

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'rendering':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Merekam...
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
            ✓ Selesai
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
            ✕ Gagal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-600 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-400">
            Mengantri
          </span>
        );
    }
  }

  return (
    <div className="flex w-[680px] max-w-full flex-col text-neutral-200">
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-100">Antrian Render Video</h3>
            <p className="text-xs text-neutral-500">
              Tambahkan proyek Anda ke antrian lalu klik render untuk membiarkan Astrofox memproses semua video secara otomatis.
            </p>
          </div>
          {items.length > 0 && !isProcessing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearQueue}
              className="text-neutral-500 hover:text-red-400 hover:bg-neutral-800/40 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Bersihkan
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-800 rounded-xl bg-neutral-900/20">
            <Play className="h-8 w-8 text-neutral-600 mb-2 opacity-50" />
            <p className="text-sm font-medium text-neutral-400">Antrian Masih Kosong</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-[280px]">
              Buka dialog **Save Video** di proyek Anda lalu klik **Masukkan Antrian Render** untuk menambahkan antrian.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => {
              const isActive = idx === currentItemIndex;
              return (
                <div
                  key={item.id}
                  className={[
                    'flex items-center gap-3 rounded-xl border p-3.5 transition-all',
                    isActive
                      ? 'border-violet-500 bg-violet-950/20 ring-1 ring-violet-500/30'
                      : 'border-neutral-800 bg-neutral-900/60',
                  ].join(' ')}
                >
                  <span className="w-5 text-center text-xs font-semibold text-neutral-500 shrink-0">
                    {idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-200" title={item.projectName}>
                      {item.projectName}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                      Output: {item.filePath}
                      {' · '}
                      Rentang: {formatDuration(item.startTime)} – {formatDuration(item.endTime)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(item.status)}

                    {!isProcessing && item.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-neutral-800/80 border-t border-neutral-800 px-4 py-3">
        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div className="text-xs text-neutral-500">
            {isProcessing && `Memproses video ${currentItemIndex + 1} dari ${items.length}...`}
          </div>

          <div className="flex gap-2">
            {isProcessing ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopProcessing}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Hentikan Render
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                disabled={items.filter(i => i.status === 'queued').length === 0}
                onClick={startProcessing}
                className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Mulai Render Antrian
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isProcessing}
            >
              Tutup
            </Button>
          </div>
        </DialogFooter>
      </div>
    </div>
  );
}
