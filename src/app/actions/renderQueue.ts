import { create } from 'zustand';
import { loadProject, touchProject } from '@/app/actions/project';
import { loadScenes } from '@/app/actions/scenes';
import { loadReactors } from '@/app/actions/reactors';
import { startVideoRecording, startPlaylistVideoRecording } from '@/app/actions/app';
import appStore from '@/app/actions/app';
import { logger } from '@/app/global';
import { raiseError } from '@/app/actions/error';

export interface QueueItem {
  id: string;
  projectName: string;
  projectSnapshot: any;
  audioFileName: string;
  audioSource: File | null;
  startTime: number;
  endTime: number;
  videoBitrate: number;
  includeAudio: boolean;
  filePath: string;
  fileHandle: any;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
}

interface RenderQueueState {
  items: QueueItem[];
  isProcessing: boolean;
  currentItemIndex: number;
  addItem: (item: Omit<QueueItem, 'id' | 'status'>) => void;
  removeItem: (id: string) => void;
  clearQueue: () => void;
  startProcessing: () => Promise<void>;
  stopProcessing: () => void;
}

const renderQueueStore = create<RenderQueueState>((set, get) => {
  let isStopping = false;

  return {
    items: [],
    isProcessing: false,
    currentItemIndex: -1,

    addItem: (item) => {
      const newItem: QueueItem = {
        ...item,
        id: Math.random().toString(36).substring(7),
        status: 'queued',
      };
      set((state) => ({ items: [...state.items, newItem] }));
    },

    removeItem: (id) => {
      set((state) => ({ items: state.items.filter((t) => t.id !== id) }));
    },

    clearQueue: () => {
      set({ items: [], isProcessing: false, currentItemIndex: -1 });
    },

    stopProcessing: () => {
      isStopping = true;
      set({ isProcessing: false });
    },

    startProcessing: async () => {
      const { items, isProcessing } = get();
      if (isProcessing) return;

      set({ isProcessing: true, isStopping: false });
      isStopping = false;

      // Find the first queued item index
      let nextIndex = items.findIndex((item) => item.status === 'queued');
      
      while (nextIndex !== -1 && !isStopping) {
        set({ currentItemIndex: nextIndex });
        const currentItem = get().items[nextIndex];
        
        // Update item status to rendering
        set((state) => {
          const nextItems = [...state.items];
          nextItems[nextIndex] = { ...currentItem, status: 'rendering' };
          return { items: nextItems };
        });

        try {
          logger.log(`[RenderQueue] Starting item ${nextIndex + 1}: ${currentItem.projectName}`);

          // 1. Load project snapshot
          loadProject(currentItem.projectSnapshot);
          await loadScenes();
          loadReactors();
          touchProject();

          // Wait a brief moment for React components & Three.js canvas to initialize fully
          await new Promise((r) => setTimeout(r, 1000));

          // 2. Trigger video recording
          const started = await startVideoRecording({
            fileHandle: currentItem.fileHandle,
            filePath: currentItem.filePath,
            startTime: currentItem.startTime,
            endTime: currentItem.endTime,
            includeAudio: currentItem.includeAudio,
            audioSource: currentItem.audioSource,
            videoBitrate: currentItem.videoBitrate,
          });

          if (!started) {
            throw new Error('Failed to start recording stream');
          }

          // 3. Wait for the recording to finish (check when appStore's isVideoRecording goes from true to false)
          await new Promise<void>((resolve, reject) => {
            const getIsRecording = () => {
              return appStore.getState().isVideoRecording ?? false;
            };

            const interval = setInterval(() => {
              // Wait until isVideoRecording is false
              const isRecording = getIsRecording();
              if (!isRecording) {
                clearInterval(interval);
                resolve();
              }
            }, 1000);

            // Safety timeout (e.g. limit to 4 hours max per render)
            setTimeout(() => {
              clearInterval(interval);
              reject(new Error('Render timeout exceeded'));
            }, 4 * 60 * 60 * 1000);
          });

          // Mark item as completed
          set((state) => {
            const nextItems = [...state.items];
            nextItems[nextIndex] = { ...currentItem, status: 'completed' };
            return { items: nextItems };
          });

        } catch (error) {
          logger.error(`[RenderQueue] Failed item ${nextIndex + 1}:`, error);
          
          set((state) => {
            const nextItems = [...state.items];
            nextItems[nextIndex] = { ...currentItem, status: 'failed' };
            return { items: nextItems };
          });
        }

        // Find next queued item
        nextIndex = get().items.findIndex((item) => item.status === 'queued');
      }

      set({ isProcessing: false, currentItemIndex: -1 });
    },
  };
});

export default renderQueueStore;
