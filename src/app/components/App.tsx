import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import useAppStore, { initApp } from '@/app/actions/app';
import projectStore, { loadProject, updateProjectName, snapshotProject } from '@/app/actions/project';
import LeftPanel from '@/app/components/panels/LeftPanel';
import ReactorPanel from '@/app/components/panels/ReactorPanel';
import RightPanel from '@/app/components/panels/RightPanel';
import Player from '@/app/components/player/Player';
import Stage from '@/app/components/stage/Stage';
import Modals from '@/app/components/window/Modals';
import Preload from '@/app/components/window/Preload';
import StatusBar from '@/app/components/window/StatusBar';
import TitleBar from '@/app/components/window/TitleBar';
import { ignoreEvents } from '@/lib/utils/react';

const PANEL_WIDTH = '22.5rem';
const PANEL_TRANSITION = 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';

function useCollapsibleHeight<T extends HTMLElement>(isOpen: boolean) {
  const ref = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const isInitialRender = useRef(true);
  const [height, setHeight] = useState<string | undefined>(isOpen ? undefined : '0px');

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    if (isInitialRender.current) {
      isInitialRender.current = false;
      setHeight(isOpen ? undefined : '0px');
      return;
    }

    const nextHeight = `${element.scrollHeight}px`;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (isOpen) {
      setHeight('0px');
      frameRef.current = window.requestAnimationFrame(() => {
        setHeight(nextHeight);
        frameRef.current = null;
      });
    } else {
      setHeight(nextHeight);
      frameRef.current = window.requestAnimationFrame(() => {
        setHeight('0px');
        frameRef.current = null;
      });
    }

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isOpen]);

  function onTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== 'height') {
      return;
    }

    if (isOpen) {
      setHeight(undefined);
    }
  }

  return { ref, height, onTransitionEnd };
}

function App() {
  const isLeftPanelVisible = useAppStore(state => state.isLeftPanelVisible);
  const isBottomPanelVisible = useAppStore(state => state.isBottomPanelVisible);
  const isRightPanelVisible = useAppStore(state => state.isRightPanelVisible);
  const isVideoRecording = useAppStore(state => state.isVideoRecording);
  const statusText = useAppStore(state => state.statusText);
  const bottomPanel = useCollapsibleHeight<HTMLDivElement>(isBottomPanelVisible);

  const [leftWidth, setLeftWidth] = useState(360);
  const [rightWidth, setRightWidth] = useState(360);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const startLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(260, Math.min(600, moveEvent.clientX));
      setLeftWidth(nextWidth);
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startRightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(260, Math.min(600, window.innerWidth - moveEvent.clientX));
      setRightWidth(nextWidth);
    };
    const handleMouseUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [hasRecovery, setHasRecovery] = useState(false);

  const handleRestoreProject = () => {
    const autosave = localStorage.getItem('astrofox_autosave_project');
    if (autosave) {
      try {
        const { name, snapshot } = JSON.parse(autosave);
        loadProject(snapshot);
        if (name) updateProjectName(name);
      } catch (err) {
        console.error('Failed to restore autosaved project:', err);
      }
    }
    localStorage.removeItem('astrofox_autosave_project');
    setHasRecovery(false);
  };

  const handleDismissRecovery = () => {
    localStorage.removeItem('astrofox_autosave_project');
    setHasRecovery(false);
  };

  useEffect(() => {
    initApp();
    if (typeof window !== 'undefined' && window.location.search.includes('test')) {
      window.confirm = () => true;
    }

    // Check for auto-saved recovery files on load
    const autosave = localStorage.getItem('astrofox_autosave_project');
    if (autosave) {
      setHasRecovery(true);
    }

    // Sync unsaved changes flag with Electron main process
    let unsubscribe: (() => void) | undefined;
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setUnsavedChanges) {
      unsubscribe = projectStore.subscribe((state) => {
        const isUnsaved = state.lastModified > state.opened;
        (window as any).electronAPI.setUnsavedChanges(isUnsaved);
      });
      const state = projectStore.getState();
      (window as any).electronAPI.setUnsavedChanges(state.lastModified > state.opened);
    }

    // Tab Close/Exit Warning Event Listener
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { opened, lastModified } = projectStore.getState();
      if (lastModified > opened) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Debounced Auto-Save on changes
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const unsubscribe = projectStore.subscribe((state) => {
      if (state.lastModified > 0) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          try {
            const snapshot = snapshotProject();
            const payload = {
              name: projectStore.getState().projectName,
              snapshot,
            };
            if (snapshot.scenes && snapshot.scenes.length > 0) {
              localStorage.setItem('astrofox_autosave_project', JSON.stringify(payload));
            }
          } catch (e) {
            console.warn('Auto-save failed:', e);
          }
        }, 3000);
      } else if (state.lastModified === 0) {
        localStorage.removeItem('astrofox_autosave_project');
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, []);

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden relative w-full h-full"
      onDrop={ignoreEvents}
      onDragOver={ignoreEvents}
    >
      <Preload />
      <TitleBar />
      {hasRecovery && (
        <div className="bg-violet-950/80 border-b border-violet-500/25 px-4 py-2 flex items-center justify-between text-xs text-neutral-200 backdrop-blur-sm z-[999]">
          <div className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
            Ditemukan pekerjaan yang belum disimpan dari sesi sebelumnya. Ingin memulihkannya?
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreProject}
              className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-semibold transition-colors"
            >
              Pulihkan
            </button>
            <button
              type="button"
              onClick={handleDismissRecovery}
              className="px-2.5 py-1 hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors"
            >
              Abaikan
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-row flex-1 overflow-hidden relative">
        <div
          aria-hidden={!isLeftPanelVisible}
          className={`flex shrink-0 overflow-hidden ${isResizingLeft ? '' : `transition-[width] ${PANEL_TRANSITION}`}`}
          style={{ width: isLeftPanelVisible ? `${leftWidth}px` : '0px' }}
        >
          <div
            className={`flex h-full w-full transition-[transform,opacity] ${PANEL_TRANSITION} ${
              isLeftPanelVisible
                ? 'translate-x-0 opacity-100'
                : '-translate-x-4 opacity-0 pointer-events-none'
            }`}
          >
            <LeftPanel />
          </div>
        </div>
        {isLeftPanelVisible && (
          <div
            onMouseDown={startLeftResize}
            className="w-1 hover:w-1.5 active:w-1.5 bg-neutral-800 hover:bg-violet-500 active:bg-violet-500 cursor-col-resize transition-all select-none shrink-0 z-50 h-full"
            title="Tarik untuk resize panel kiri"
          />
        )}
        <div id="viewport" className="flex flex-col flex-1 overflow-hidden relative">
          <Stage />
          <div
            aria-hidden={!isBottomPanelVisible}
            className={`overflow-hidden transition-[height] ${PANEL_TRANSITION}`}
            style={{ height: bottomPanel.height }}
            onTransitionEnd={bottomPanel.onTransitionEnd}
          >
            <div
              ref={bottomPanel.ref}
              className={`transition-[transform,opacity] ${PANEL_TRANSITION} ${
                isBottomPanelVisible
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-4 opacity-0 pointer-events-none'
              }`}
            >
              <ReactorPanel />
              <Player />
            </div>
          </div>
        </div>
        {isRightPanelVisible && (
          <div
            onMouseDown={startRightResize}
            className="w-1 hover:w-1.5 active:w-1.5 bg-neutral-800 hover:bg-violet-500 active:bg-violet-500 cursor-col-resize transition-all select-none shrink-0 z-50 h-full"
            title="Tarik untuk resize panel kanan"
          />
        )}
        <div
          aria-hidden={!isRightPanelVisible}
          className={`flex shrink-0 overflow-hidden ${isResizingRight ? '' : `transition-[width] ${PANEL_TRANSITION}`}`}
          style={{ width: isRightPanelVisible ? `${rightWidth}px` : '0px' }}
        >
          <div
            className={`flex h-full w-full transition-[transform,opacity] ${PANEL_TRANSITION} ${
              isRightPanelVisible
                ? 'translate-x-0 opacity-100'
                : 'translate-x-4 opacity-0 pointer-events-none'
            }`}
          >
            <RightPanel />
          </div>
        </div>
      </div>
      <StatusBar />
      <Modals />
      {isVideoRecording && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-8 rounded-2xl border border-violet-500/20 bg-neutral-950/80 shadow-[0_0_50px_rgba(124,58,237,0.25)] flex flex-col items-center text-center space-y-6">
            <div className="relative flex items-center justify-center h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-violet-500/10 border-t-violet-500 animate-spin" />
              <div className="text-violet-400 text-xs font-bold font-mono">
                {parseInt(statusText.match(/\d+/)?.[0] || '0', 10)}%
              </div>
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-neutral-100 tracking-wide uppercase">
                Sedang Mengekspor Video
              </h3>
              <p className="text-[11px] text-neutral-400">
                Harap jangan menutup tab browser atau mematikan perangkat Anda.
              </p>
            </div>

            <div className="w-full space-y-2.5">
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, parseInt(statusText.match(/\d+/)?.[0] || '0', 10)))}%` }}
                />
              </div>
              <div className="text-[11px] text-neutral-400 font-mono select-none">
                {statusText || 'Menyiapkan encoder...'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
