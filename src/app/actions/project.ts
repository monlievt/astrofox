import { create } from 'zustand';
import { raiseError } from '@/app/actions/error';
import { showModal } from '@/app/actions/modals';
import { loadReactors, resetReactors } from '@/app/actions/reactors';
import { loadScenes, resetScenes, updateElementProperty } from '@/app/actions/scenes';
import { setActiveElementId } from '@/app/actions/app';
import { updateCanvas, updateStage } from '@/app/actions/stage';
import {
  BLANK_IMAGE,
  DEFAULT_CANVAS_BGCOLOR,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
} from '@/app/constants';
import { api, env, library, logger, reactors, stage } from '@/app/global';
import { t } from '@/i18n/config';
import AudioReactor from '@/lib/audio/AudioReactor';
import Display from '@/lib/core/Display';
import Entity from '@/lib/core/Entity';
import Scene from '@/lib/core/Scene';
import Stage from '@/lib/core/Stage';
import { resetLabelCount } from '@/lib/utils/controls';

export const DEFAULT_PROJECT_NAME = 'Untitled Project';

type MediaKind = 'image' | 'video';

export interface MediaRef {
  displayId: string;
  kind: MediaKind;
  label: string;
  sourcePath: string;
}

interface ProjectState {
  projectId: string | null;
  projectName: string;
  opened: number;
  lastModified: number;
  unresolvedMediaRefs: MediaRef[];
}

interface FileLikeWithPath extends File {
  path?: string;
  filePath?: string;
  fullPath?: string;
}

interface ElementSnapshot extends Record<string, unknown> {
  id: string;
  name?: string;
  displayName?: string;
  properties?: Record<string, unknown>;
}

interface SceneSnapshot extends Record<string, unknown> {
  displays?: ElementSnapshot[];
  effects?: ElementSnapshot[];
}

interface ProjectSnapshot extends Record<string, unknown> {
  stage?: { properties?: Record<string, unknown> };
  scenes?: SceneSnapshot[];
  reactors?: Record<string, unknown>[];
}

interface ProjectFilePayload extends Record<string, unknown> {
  snapshot?: ProjectSnapshot;
  snapshotJson?: ProjectSnapshot;
  project?: {
    snapshot?: ProjectSnapshot;
    snapshotJson?: ProjectSnapshot;
    name?: string;
    mediaRefs?: MediaRef[];
  };
  projectName?: string;
  name?: string;
  mediaRefs?: MediaRef[];
}

type MediaRefInput = Partial<MediaRef> & {
  path?: string;
};

type LibraryConstructor = new (properties?: Record<string, unknown>) => Entity;

type SceneEntity = {
  id: string;
  scene: unknown;
  toJSON: () => Record<string, unknown>;
};

const PROJECT_FILE_EXTENSIONS = ['json'];
const PROJECT_FILE_MIME_TYPE = 'application/json';

function getProjectFileFilters() {
  return [
    {
      name: t('file-types.astrofox-project'),
      extensions: PROJECT_FILE_EXTENSIONS,
      mimeType: PROJECT_FILE_MIME_TYPE,
    },
  ];
}

const initialState: ProjectState = {
  projectId: null,
  projectName: DEFAULT_PROJECT_NAME,
  opened: 0,
  lastModified: 0,
  unresolvedMediaRefs: [],
};

const projectStore = create<ProjectState>(() => ({
  ...initialState,
}));

export function snapshotProject(): ProjectSnapshot {
  return {
    version: env.APP_VERSION,
    stage: stage.toJSON(),
    scenes: stage.scenes.toJSON(),
    reactors: reactors.toJSON(),
  };
}

function isEmbeddedMediaSource(src: string) {
  return /^data:(image|video)\//i.test(src);
}

function isRemoteMediaSource(src: string) {
  return /^(https?:)?\/\//i.test(src);
}

function isBlobMediaSource(src: string) {
  return /^blob:/i.test(src);
}

function isFileUrlSource(src: string) {
  return /^file:\/\//i.test(src);
}

function isWindowsPathSource(src: string) {
  return /^[a-zA-Z]:[\\/]/.test(src);
}

function isUncPathSource(src: string) {
  return /^\\\\/.test(src);
}

function normalizeMediaPath(path: unknown): string {
  if (typeof path !== 'string') {
    return '';
  }

  return path.trim();
}

function fileUrlToPath(src: string): string {
  if (!isFileUrlSource(src)) {
    return '';
  }

  try {
    const url = new URL(src);
    let path = decodeURIComponent(url.pathname || '');

    if (/^\/[a-zA-Z]:/.test(path)) {
      path = path.slice(1);
    }

    if (url.host) {
      return `\\\\${url.host}${path.replace(/\//g, '\\')}`;
    }

    if (/^[a-zA-Z]:/.test(path)) {
      return path.replace(/\//g, '\\');
    }

    return path;
  } catch {
    const rawPath = decodeURIComponent(src.replace(/^file:\/\//i, ''));
    return rawPath.replace(/^\/[a-zA-Z]:/, match => match.slice(1));
  }
}

function toFileUrl(path: string): string {
  const sourcePath = normalizeMediaPath(path);

  if (!sourcePath) {
    return '';
  }

  if (isFileUrlSource(sourcePath)) {
    return sourcePath;
  }

  const escaped = encodeURI(sourcePath).replace(/#/g, '%23').replace(/\?/g, '%3F');

  if (isWindowsPathSource(sourcePath)) {
    return `file:///${escaped.replace(/\\/g, '/')}`;
  }

  if (isUncPathSource(sourcePath)) {
    const unc = escaped.replace(/^\\\\/, '').replace(/\\/g, '/');
    return `file://${unc}`;
  }

  if (sourcePath.startsWith('/')) {
    return `file://${escaped}`;
  }

  return sourcePath;
}

function getMediaSourcePath(src: unknown): string {
  if (typeof src !== 'string') {
    return '';
  }

  if (isFileUrlSource(src)) {
    return normalizeMediaPath(fileUrlToPath(src));
  }

  if (isWindowsPathSource(src) || isUncPathSource(src)) {
    return normalizeMediaPath(src);
  }

  return '';
}

function getFilePath(file: FileLikeWithPath | null | undefined): string {
  if (!file || typeof file !== 'object') {
    return '';
  }

  const path =
    normalizeMediaPath(file.path) ||
    normalizeMediaPath(file.filePath) ||
    normalizeMediaPath(file.fullPath);

  return path;
}

function getMediaKind(element: Pick<ElementSnapshot, 'name'> | null | undefined): MediaKind {
  return element?.name === 'VideoDisplay' ? 'video' : 'image';
}

function getMediaLabel(
  element: Pick<ElementSnapshot, 'displayName' | 'name'> | null | undefined,
): string {
  return element?.displayName || element?.name || t('relink-media.media');
}

function buildMediaRef(
  element: Pick<ElementSnapshot, 'id' | 'name' | 'displayName'>,
  sourcePath = '',
): MediaRef {
  return {
    displayId: element.id,
    kind: getMediaKind(element),
    label: getMediaLabel(element),
    sourcePath,
  };
}

function normalizeMediaRef(mediaRef: MediaRefInput | null | undefined): MediaRef | null {
  if (!mediaRef || typeof mediaRef !== 'object' || !mediaRef.displayId) {
    return null;
  }

  return {
    displayId: mediaRef.displayId,
    kind: mediaRef.kind === 'video' ? 'video' : 'image',
    label: mediaRef.label || t('relink-media.media'),
    sourcePath: normalizeMediaPath(mediaRef.sourcePath) || normalizeMediaPath(mediaRef.path) || '',
  };
}

function mergeMediaRefs(...groups: Array<MediaRefInput[] | null | undefined>): MediaRef[] {
  const byDisplayId = new Map<string, MediaRef>();

  for (const group of groups) {
    for (const mediaRef of group || []) {
      const normalized = normalizeMediaRef(mediaRef);
      if (!normalized) {
        continue;
      }

      const previous = byDisplayId.get(normalized.displayId);

      byDisplayId.set(normalized.displayId, {
        ...(previous || {}),
        ...normalized,
        sourcePath: normalized.sourcePath || previous?.sourcePath || '',
      });
    }
  }

  return Array.from(byDisplayId.values());
}

async function canLoadMediaSource(src: string, kind: MediaKind): Promise<boolean> {
  if (!src) {
    return false;
  }

  return new Promise<boolean>(resolve => {
    let settled = false;

    function done(result: boolean) {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    }

    const timeoutId = window.setTimeout(() => done(false), 2000);

    if (kind === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        window.clearTimeout(timeoutId);
        video.removeAttribute('src');
        video.load();
        done(true);
      };

      video.onerror = () => {
        window.clearTimeout(timeoutId);
        video.removeAttribute('src');
        video.load();
        done(false);
      };

      video.src = src;
      return;
    }

    const image = new Image();

    image.onload = () => {
      window.clearTimeout(timeoutId);
      done(true);
    };

    image.onerror = () => {
      window.clearTimeout(timeoutId);
      done(false);
    };

    image.src = src;
  });
}

function prepareSnapshotMediaForSave(snapshot: ProjectSnapshot) {
  const mediaRefs: MediaRef[] = [];

  const scenes = (snapshot?.scenes || []).map((scene: SceneSnapshot) => {
    const mapMediaProps = (element: ElementSnapshot) => {
      const src = element?.properties?.src;
      const sourcePath = normalizeMediaPath(element?.properties?.sourcePath);

      if (sourcePath) {
        mediaRefs.push(buildMediaRef(element, sourcePath));

        if (!src || src === BLANK_IMAGE || typeof src !== 'string') {
          return {
            ...element,
            properties: {
              ...element.properties,
              sourcePath,
            },
          };
        }

        return {
          ...element,
          properties: {
            ...element.properties,
            src: toFileUrl(sourcePath),
            sourcePath,
          },
        };
      }

      if (!src || src === BLANK_IMAGE || typeof src !== 'string') {
        return element;
      }

      const inferredSourcePath = getMediaSourcePath(src);

      if (inferredSourcePath) {
        mediaRefs.push(buildMediaRef(element, inferredSourcePath));

        return {
          ...element,
          properties: {
            ...element.properties,
            src: toFileUrl(inferredSourcePath),
            sourcePath: inferredSourcePath,
          },
        };
      }

      if (isBlobMediaSource(src)) {
        mediaRefs.push(buildMediaRef(element));

        return {
          ...element,
          properties: {
            ...element.properties,
            src: BLANK_IMAGE,
            sourcePath: '',
          },
        };
      }

      if (isEmbeddedMediaSource(src) || isRemoteMediaSource(src)) {
        return element;
      }

      return element;
    };

    return {
      ...scene,
      displays: (scene.displays || []).map(mapMediaProps),
      effects: (scene.effects || []).map(mapMediaProps),
    };
  });

  return {
    snapshot: {
      ...snapshot,
      scenes,
    },
    mediaRefs,
  };
}

async function resolveSnapshotMediaOnLoad(
  snapshot: ProjectSnapshot,
  payloadMediaRefs: MediaRefInput[] = [],
): Promise<{
  snapshot: ProjectSnapshot;
  unresolvedMediaRefs: MediaRef[];
}> {
  const mediaRefMap = new Map<string, MediaRef>();

  for (const mediaRef of payloadMediaRefs || []) {
    const normalized = normalizeMediaRef(mediaRef);

    if (normalized) {
      mediaRefMap.set(normalized.displayId, normalized);
    }
  }

  const unresolvedMediaRefs: MediaRef[] = [];

  const scenes = await Promise.all(
    (snapshot?.scenes || []).map(async (scene: SceneSnapshot) => {
      const mapMediaProps = async (element: ElementSnapshot) => {
        const src = element?.properties?.src;

        const mediaRef = mediaRefMap.get(element.id);
        const sourcePath =
          normalizeMediaPath(element?.properties?.sourcePath) ||
          normalizeMediaPath(mediaRef?.sourcePath) ||
          getMediaSourcePath(src);

        if (sourcePath) {
          const sourceUrl = toFileUrl(sourcePath);
          const canLoad = await canLoadMediaSource(sourceUrl, getMediaKind(element));

          if (canLoad) {
            return {
              ...element,
              properties: {
                ...element.properties,
                src: sourceUrl,
                sourcePath,
              },
            };
          }

          if (typeof src === 'string' && (isEmbeddedMediaSource(src) || isRemoteMediaSource(src))) {
            return {
              ...element,
              properties: {
                ...element.properties,
                sourcePath: '',
              },
            };
          }

          unresolvedMediaRefs.push(buildMediaRef(element, sourcePath));

          return {
            ...element,
            properties: {
              ...element.properties,
              src: BLANK_IMAGE,
              sourcePath,
            },
          };
        }

        if (!src || src === BLANK_IMAGE || typeof src !== 'string') {
          return element;
        }

        if (isBlobMediaSource(src)) {
          unresolvedMediaRefs.push(buildMediaRef(element));

          return {
            ...element,
            properties: {
              ...element.properties,
              src: BLANK_IMAGE,
              sourcePath: '',
            },
          };
        }

        return element;
      };

      return {
        ...scene,
        displays: await Promise.all((scene.displays || []).map(mapMediaProps)),
        effects: await Promise.all((scene.effects || []).map(mapMediaProps)),
      };
    }),
  );

  return {
    snapshot: {
      ...snapshot,
      scenes,
    },
    unresolvedMediaRefs,
  };
}

function setUnresolvedMediaRefs(mediaRefs: MediaRef[] = []) {
  projectStore.setState({
    unresolvedMediaRefs: mediaRefs,
  });
}

function sanitizeFileName(name?: string) {
  return (name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function createProjectFileName(name?: string) {
  const safeName = sanitizeFileName(name) || DEFAULT_PROJECT_NAME;
  return `${safeName}.json`;
}

function parseProjectNameFromFile(fileName = '') {
  return fileName.replace(/\.json$/i, '').trim() || DEFAULT_PROJECT_NAME;
}

function parseProjectPayload(payload: unknown, fallbackName?: string) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(t('errors.invalid-project-file'));
  }

  const data = payload as ProjectFilePayload;

  const snapshot =
    data.snapshot ||
    data.snapshotJson ||
    data.project?.snapshot ||
    data.project?.snapshotJson ||
    data;

  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error(t('errors.invalid-project-snapshot'));
  }

  return {
    snapshot,
    projectName:
      data.projectName || data.name || data.project?.name || fallbackName || DEFAULT_PROJECT_NAME,
    mediaRefs: data.mediaRefs || data.project?.mediaRefs || [],
  };
}

async function loadProjectFromPayload(payload: unknown, fallbackName?: string) {
  const { snapshot, projectName, mediaRefs } = parseProjectPayload(payload, fallbackName);
  const { snapshot: resolvedSnapshot, unresolvedMediaRefs: detectedMissingMedia } =
    await resolveSnapshotMediaOnLoad(snapshot, mediaRefs);
  const unresolvedMediaRefs = mergeMediaRefs(detectedMissingMedia);

  loadProject(resolvedSnapshot);
  await loadScenes();
  loadReactors();

  projectStore.setState({
    projectId: null,
    projectName: projectName || DEFAULT_PROJECT_NAME,
    opened: Date.now(),
    lastModified: 0,
    unresolvedMediaRefs: unresolvedMediaRefs,
  });

  if (unresolvedMediaRefs.length > 0) {
    const count = unresolvedMediaRefs.length;
    openRelinkMediaDialog({
      titleKey: 'relink-media.missing-title',
      titleOptions: { count },
    });
  }
}

export function touchProject() {
  projectStore.setState({ lastModified: Date.now() });
}

export function updateProjectName(name: string) {
  const nextName = name.trim() || DEFAULT_PROJECT_NAME;
  const { projectName } = projectStore.getState();

  if (nextName === projectName) {
    return;
  }

  projectStore.setState({
    projectName: nextName,
    lastModified: Date.now(),
  });
}

export function resetProject() {
  projectStore.setState({ ...initialState });
}

export function loadProject(data: ProjectSnapshot) {
  logger.log('Loaded project:', data);

  const displays = library.get('displays') as Record<string, LibraryConstructor>;
  const effects = library.get('effects') as Record<string, LibraryConstructor>;

  const loadElement = (scene: Scene, config: Record<string, unknown> & { name?: string }) => {
    const { name = '' } = config;
    const module = displays[name] || effects[name];

    if (module) {
      const entity = Display.create(module, config);
      scene.addElement(entity as unknown as SceneEntity);
    } else {
      logger.warn('Component not found:', name);
    }
  };

  resetScenes(false);
  resetReactors();
  resetLabelCount();

  if (data.stage) {
    updateStage(data.stage.properties || {});
  } else {
    updateStage(Stage.defaultProperties);
  }

  if (data.reactors) {
    for (const config of data.reactors) {
      const reactor = Entity.create(AudioReactor, config);
      reactors.addReactor(reactor as unknown);
    }
  }

  if (data.scenes) {
    for (const config of data.scenes) {
      const scene = Display.create(Scene, config) as Scene;

      stage.addScene(scene);

      if (config.displays) {
        for (const display of config.displays) {
          loadElement(scene, display);
        }
      }

      if (config.effects) {
        for (const effect of config.effects) {
          loadElement(scene, effect);
        }
      }
    }
  }
}

export async function newProject() {
  resetLabelCount();
  await resetScenes();
  await resetReactors();
  await updateCanvas(DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_BGCOLOR);

  const scene = stage.addScene() as Scene;
  const displays = library.get('displays') as Record<string, LibraryConstructor>;

  scene.addElement(new displays.ImageDisplay() as unknown as SceneEntity);
  scene.addElement(new displays.BarSpectrumDisplay() as unknown as SceneEntity);
  scene.addElement(new displays.TextDisplay() as unknown as SceneEntity);

  await loadScenes();
  await loadReactors();

  projectStore.setState({
    projectId: null,
    projectName: DEFAULT_PROJECT_NAME,
    opened: Date.now(),
    lastModified: 0,
    unresolvedMediaRefs: [],
  });
}

export function checkUnsavedChanges(menuAction: string, action: () => unknown) {
  const { opened, lastModified } = projectStore.getState();

  if (lastModified > opened) {
    showModal('UnsavedChangesDialog', { showCloseButton: false }, { action: menuAction });
  } else {
    action();
  }
}

export async function openProjectFile() {
  try {
    const { files, canceled } = await api.showOpenDialog({
      filters: getProjectFileFilters(),
    });

    if (canceled || !files || !files.length) {
      return false;
    }

    const file = files[0];
    if (!/\.json$/i.test(file.name || '')) {
      throw new Error(t('errors.project-json-extension-required'));
    }
    const text = await file.text();
    const payload = JSON.parse(text);
    const fallbackName = parseProjectNameFromFile(file.name);

    await loadProjectFromPayload(payload, fallbackName);
    return true;
  } catch (error) {
    raiseError(t('errors.open-project-file-failed'), error);
    return false;
  }
}

export function openProjectBrowser() {
  return openProjectFile();
}

export function openRelinkMediaDialog(modalProps: Record<string, unknown> = {}) {
  showModal('RelinkMediaDialog', {
    titleKey: 'relink-media.title',
    ...modalProps,
  });
}

export async function listProjects() {
  return [];
}

export async function loadProjectById(_projectId: string) {
  raiseError(t('errors.cloud-projects-removed'), new Error(t('errors.use-open-project')));
}

export async function renameProjectById(_projectId: string, _name: string) {
  raiseError(
    t('errors.cloud-projects-removed'),
    new Error(t('errors.use-save-project-to-download')),
  );
  return null;
}

export async function deleteProjectById(_projectId: string) {
  raiseError(t('errors.cloud-projects-removed'), new Error(t('errors.use-file-system-to-delete')));
}

export async function saveProject(nameOverride?: string) {
  const state = projectStore.getState();
  const name = (nameOverride || state.projectName || DEFAULT_PROJECT_NAME).trim();

  try {
    const { snapshot, mediaRefs } = prepareSnapshotMediaForSave(snapshotProject());
    const payload = {
      name,
      projectName: name,
      version: env.APP_VERSION,
      savedAt: new Date().toISOString(),
      snapshot,
      mediaRefs,
    };
    const fileName = createProjectFileName(name);
    const { fileHandle, filePath, canceled } = await api.showSaveDialog({
      defaultPath: fileName,
      filters: getProjectFileFilters(),
    });

    if (canceled) {
      return false;
    }

    const target = fileHandle || filePath || fileName;
    await api.saveTextFile(target, JSON.stringify(payload, null, 2), {
      mimeType: 'application/json',
      fileName,
    });

    projectStore.setState({
      projectId: null,
      projectName: name,
      opened: Date.now(),
      lastModified: 0,
      unresolvedMediaRefs: [],
    });

    logger.log('Project saved locally:', fileName);
    return true;
  } catch (error) {
    raiseError(t('errors.save-project-file-failed'), error);
    return false;
  }
}

export async function relinkMediaRef(mediaRef: MediaRef) {
  try {
    const isVideo = mediaRef.kind === 'video';
    const filters = isVideo
      ? [{ name: t('file-types.video-files'), extensions: ['mp4', 'webm', 'ogv'] }]
      : [{ name: t('file-types.image-files'), extensions: ['jpg', 'jpeg', 'png', 'gif'] }];
    const { files, canceled } = await api.showOpenDialog({ filters });

    if (canceled || !files || !files.length) {
      return;
    }

    const file = files[0];
    const sourcePath = getFilePath(file);
    const src = sourcePath
      ? toFileUrl(sourcePath)
      : isVideo
        ? await api.readVideoFile(file)
        : await api.readImageFile(file);

    updateElementProperty(mediaRef.displayId, 'src', src);
    updateElementProperty(mediaRef.displayId, 'sourcePath', sourcePath || '');

    setUnresolvedMediaRefs(
      projectStore
        .getState()
        .unresolvedMediaRefs.filter(ref => ref.displayId !== mediaRef.displayId),
    );
  } catch (error) {
    raiseError(t('errors.relink-media-failed'), error);
  }
}

export function clearUnresolvedMedia() {
  setUnresolvedMediaRefs([]);
}

export async function applyPresetTemplate(templateId: string) {
  resetScenes(false);
  resetReactors();

  if (templateId.startsWith('custom-')) {
    const rawCustomPresets = localStorage.getItem('astrofox_custom_presets');
    if (rawCustomPresets) {
      const customPresets = JSON.parse(rawCustomPresets);
      const preset = customPresets.find((p: any) => p.id === templateId);
      if (preset && preset.snapshot) {
        const data = preset.snapshot;
        const displaysLib = library.get('displays') as Record<string, any>;
        const effectsLib = library.get('effects') as Record<string, any>;
        
        const loadElement = (scene: Scene, config: Record<string, unknown> & { name?: string }) => {
          const { name = '' } = config;
          const module = displaysLib[name] || effectsLib[name];
          if (module) {
            const entity = Display.create(module, config);
            scene.addElement(entity as unknown as SceneEntity);
          }
        };

        if (data.reactors) {
          for (const config of data.reactors) {
            const reactor = Entity.create(AudioReactor, config);
            reactors.addReactor(reactor as unknown);
          }
        }

        if (data.scenes) {
          for (const config of data.scenes) {
            const scene = Display.create(Scene, config) as Scene;
            stage.addScene(scene);

            if (config.displays) {
              for (const display of config.displays) {
                loadElement(scene, display);
              }
            }

            if (config.effects) {
              for (const effect of config.effects) {
                loadElement(scene, effect);
              }
            }
          }
        }
        
        await loadScenes();
        await loadReactors();
        
        const activeScene = stage.scenes.at(0);
        const firstDisplay = activeScene?.displays.at(0);
        if (firstDisplay) {
          setActiveElementId(firstDisplay.id);
        } else {
          setActiveElementId(null);
        }
        
        touchProject();
        return;
      }
    }
  }

  const scene = stage.addScene();
  const displays = library.get('displays') as Record<string, any>;

  if (templateId === 'trap-nation') {
    const starfield = new displays.StarfieldDisplay({
      baseSpeed: 1.5,
      musicSensitivity: 0.4,
      starColor: '#ffffff',
      starSize: 1.5,
      gravity: 0.05,
      particleCount: 180,
      opacity: 0.7,
    });
    scene.addElement(starfield);

    const tnDisplay = new displays.TrapNationDisplay({
      radius: 120,
      barWidth: 4,
      barCount: 96,
      color: ['#704dd8', '#ff007f'],
      bassPulsing: true,
      bassSensitivity: 1.5,
      mirrorMode: true,
      particleCount: 100,
      src: '',
    });
    scene.addElement(tnDisplay);

  } else if (templateId === 'ncs') {
    const waveBg = new displays.WaveSpectrumDisplay({
      opacity: 0.15,
      color: ['#00d2ff', '#3a7bd5'],
    });
    scene.addElement(waveBg);

    const ncsDisplay = new displays.NCSDisplay({
      radius: 130,
      barWidth: 3,
      barCount: 128,
      shakeEnabled: true,
      shakeSensitivity: 1.2,
      colorMorphing: true,
      morphSpeed: 1.5,
    });
    scene.addElement(ncsDisplay);

  } else if (templateId === 'monstercat') {
    const starfield = new displays.StarfieldDisplay({
      baseSpeed: 0.8,
      musicSensitivity: 0.3,
      starColor: '#aaaaff',
      starSize: 1.0,
      gravity: 0.0,
      particleCount: 120,
      opacity: 0.4,
    });
    scene.addElement(starfield);

    const monstercatDisplay = new displays.MonstercatDisplay({
      x: 0,
      y: 120,
      width: 800,
      height: 200,
      barWidth: 8,
      barSpacing: 4,
      color: ['#ffffff', '#cccccc'],
      particleCount: 80,
      particleSpeed: 1.0,
      align: 'bottom',
      opacity: 1.0,
    });
    scene.addElement(monstercatDisplay);

  } else if (templateId === 'chill-lofi') {
    // 🌊 Chill Lo-Fi Vibes
    const flowBg = new displays.FlowBackgroundDisplay({
      motion: 'Wave',
      speed: 0.4,
      opacity: 0.6,
    });
    scene.addElement(flowBg);

    const ring = new displays.WaveformRingDisplay({
      radius: 140,
      amplitude: 60,
      samples: 256,
      lineWidth: 2,
      smoothing: 0.85,
      stroke: true,
      strokeColor: '#b8a9f0',
      fill: true,
      fillColor: ['#6a52c8', '#b8a9f020'],
      smooth: true,
      opacity: 0.85,
    });
    scene.addElement(ring);

    const wave = new displays.SoundWaveDisplay({
      lineWidth: 2,
      wavelength: 1.0,
      smoothing: 0.9,
      stroke: true,
      strokeColor: '#d4c8ff',
      fill: true,
      fillColor: '#8b7fe820',
      taperEdges: true,
      width: 700,
      height: 80,
      x: 0,
      y: 180,
      opacity: 0.5,
    });
    scene.addElement(wave);

  } else if (templateId === 'edm-club') {
    // ⚡ EDM Club Drop — use correct TunnelDisplay property names
    const stars = new displays.StarfieldDisplay({
      baseSpeed: 4.0,
      musicSensitivity: 1.5,
      starColor: '#00ffff',
      starSize: 2.0,
      gravity: 0.1,
      particleCount: 300,
      opacity: 0.9,
    });
    scene.addElement(stars);

    const tunnel = new displays.TunnelDisplay({
      color: '#00ffff',
      backgroundColor: '#000000',
      transparentSurface: true,
      shader: false,
      radius: 180,
      depth: 3200,
      fogDistance: 2400,
      curvature: 32,
      turnRate: 2.6,
      travelSpeed: 8,
      turnSpeed: 0.8,
      bank: 8,
      gridColumns: 16,
      gridRows: 48,
      lineWidth: 0.05,
      radialSegments: 40,
      lengthSegments: 128,
      opacity: 0.9,
    });
    scene.addElement(tunnel);

    const bars = new displays.BarSpectrumDisplay({
      width: 854,
      height: 120,
      barColor: ['#00ffff', '#ff00ff'],
      shadowColor: ['#00ffff50', '#ff00ff50'],
      shadowHeight: 40,
      x: 0,
      y: 185,
      opacity: 0.9,
    });
    scene.addElement(bars);

  } else if (templateId === 'waveform-ring') {
    // 🌀 Waveform Ring Classic
    const flowBg = new displays.FlowBackgroundDisplay({
      motion: 'Pulse',
      speed: 0.6,
      opacity: 0.5,
    });
    scene.addElement(flowBg);

    const outerRing = new displays.WaveformRingDisplay({
      radius: 170,
      amplitude: 80,
      samples: 512,
      lineWidth: 1.5,
      smoothing: 0.8,
      stroke: true,
      strokeColor: '#ffffff',
      fill: false,
      smooth: true,
      opacity: 0.4,
    });
    scene.addElement(outerRing);

    const innerRing = new displays.WaveformRingDisplay({
      radius: 110,
      amplitude: 55,
      samples: 256,
      lineWidth: 3,
      smoothing: 0.85,
      stroke: true,
      strokeColor: '#a78bfa',
      fill: true,
      fillColor: ['#7c3aed', '#7c3aed10'],
      smooth: true,
      opacity: 0.9,
    });
    scene.addElement(innerRing);
  } else if (templateId === 'vissonance-sphere-preset') {
    const starfield = new displays.StarfieldDisplay({
      baseSpeed: 1.0,
      musicSensitivity: 0.3,
      starColor: '#ff007f',
      starSize: 1.0,
      particleCount: 150,
      opacity: 0.5,
    });
    scene.addElement(starfield);

    const sphere = new displays.VissonanceSphereDisplay({
      radius: 120,
      lineColor: '#00ffff',
      glowColor: '#00ffff',
      glowIntensity: 20,
      sensitivity: 1.2,
      detail: 24,
      rotationSpeedX: 0.2,
      rotationSpeedY: 0.6,
      displacementScale: 55,
    });
    scene.addElement(sphere);

  } else if (templateId === 'morphing-orb-preset') {
    const flowBg = new displays.FlowBackgroundDisplay({
      motion: 'Wave',
      speed: 0.5,
      opacity: 0.4,
    });
    scene.addElement(flowBg);

    const orb = new displays.MorphingSphereDisplay({
      radius: 110,
      colorA: '#8b5cf6',
      colorB: '#ec4899',
      colorC: '#00ffff',
      bassSensitivity: 1.6,
      midSensitivity: 1.0,
      trebleSensitivity: 0.8,
      wireframe: false,
      glowColor: '#8b5cf6',
      glowIntensity: 25,
      rotationSpeed: 0.4,
      detail: 32,
    });
    scene.addElement(orb);

  } else if (templateId === 'led-wall-preset') {
    const rings = new displays.RippleRingsDisplay({
      ringCount: 8,
      baseRadius: 40,
      ringSpacing: 25,
      color: '#10b981',
      colorEnd: '#f59e0b',
      strokeWidth: 2.0,
      sensitivity: 1.5,
      glowIntensity: 10,
      opacity: 0.6,
    });
    scene.addElement(rings);

    const burst = new displays.ParticleBurstDisplay({
      burstCount: 50,
      particleSize: 2.5,
      particleSpeed: 6.0,
      lifetime: 45,
      colorA: '#10b981',
      colorB: '#f59e0b',
      beatThreshold: 0.6,
      trailFade: 0.1,
      glowIntensity: 12,
      opacity: 0.8,
    });
    scene.addElement(burst);

     const led = new displays.LEDSpectrumDisplay({
      mode: 'LED',
      barCount: 48,
      barWidth: 12,
      barGap: 3,
      ledCount: 16,
      ledGap: 2,
      colorStart: '#10b981',
      colorMid: '#f59e0b',
      colorEnd: '#ef4444',
      showPeaks: true,
      peakColor: '#ffffff',
      smoothing: 0.72,
      sensitivity: 1.2,
      width: 750,
      height: 180,
      y: -120,
    });
    scene.addElement(led);
  } else if (templateId === 'particle-galaxy') {
    const stars = new displays.StarfieldDisplay({
      baseSpeed: 0.6,
      musicSensitivity: 0.25,
      starColor: '#ffffff',
      starSize: 1.0,
      gravity: 0.02,
      particleCount: 160,
      opacity: 0.45,
    });
    scene.addElement(stars);

    const galaxy = new displays.ParticleGalaxyDisplay({
      orbRadius: 100,
      orbDetail: 24,
      ringCount: 10,
      particleSize: 3.5,
      colorA: '#8b5cf6',
      colorB: '#06b6d4',
      glowIntensity: 22,
      sensitivity: 1.4,
      rotationSpeed: 0.4,
      opacity: 0.9,
    });
    scene.addElement(galaxy);
  } else if (templateId === 'particle-terrain-preset') {
    const terrain = new displays.ParticleFieldDisplay({
      gridSize: 32,
      spacing: 24,
      amplitude: 60,
      particleSize: 4.5,
      colorA: '#00ffcc',
      colorB: '#ff00ff',
      glowIntensity: 18,
      speed: 1.0,
      sensitivity: 1.2,
      x: 0,
      y: -100,
      z: -200,
      opacity: 1.0,
    });
    scene.addElement(terrain);
  } else if (templateId === 'spectrogram-terrain-preset') {
    const spectrogram = new displays.ParticleSpectrogramDisplay({
      columns: 60,
      rows: 32,
      spacingX: 12,
      spacingZ: 16,
      amplitude: 140,
      particleSize: 5.0,
      colorA: '#a855f7',
      colorB: '#00f0ff',
      glowIntensity: 25,
      scrollSpeed: 1.0,
      sensitivity: 1.4,
      x: 0,
      y: -140,
      z: -380,
      opacity: 0.95,
    });
    scene.addElement(spectrogram);
  } else if (templateId === 'sacred-mandala-preset') {
    const mandala = new displays.MandalaDisplay({
      symmetry: 8,
      scale: 180,
      complexity: 4,
      lineWidth: 1.8,
      color: ['#ff0055', '#7000ff'],
      glowColor: '#ff0055',
      glowIntensity: 20,
      rotationSpeed: 0.3,
      sensitivity: 1.4,
      pulseMode: 'Bass',
      opacity: 0.95,
    });
    scene.addElement(mandala);
  }

  await loadScenes();
  await loadReactors();

  // Automatically select the first display in the new scene to activate the properties panel
  const activeScene = stage.scenes.at(0);
  const firstDisplay = activeScene?.displays.at(0);
  if (firstDisplay) {
    setActiveElementId(firstDisplay.id);
  } else {
    setActiveElementId(null);
  }

  touchProject();
}

export function saveCustomPreset(presetName: string) {
  const snapshot = snapshotProject();
  const id = 'custom-' + Date.now();
  const newPreset = {
    id,
    name: presetName.trim(),
    description: 'Preset kustom buatan pengguna.',
    themeColor: 'from-[#8b5cf6] to-[#ec4899]',
    details: [
      `${snapshot.scenes?.length || 0} Scene(s)`,
      `${snapshot.scenes?.reduce((acc: number, s: any) => acc + (s.displays?.length || 0), 0) || 0} Display(s)`,
      `${snapshot.reactors?.length || 0} Audio Reactor(s)`
    ],
    snapshot,
  };
  const raw = localStorage.getItem('astrofox_custom_presets');
  const list = raw ? JSON.parse(raw) : [];
  list.push(newPreset);
  localStorage.setItem('astrofox_custom_presets', JSON.stringify(list));
  return newPreset;
}

export function deleteCustomPreset(presetId: string) {
  const raw = localStorage.getItem('astrofox_custom_presets');
  if (raw) {
    const list = JSON.parse(raw);
    const nextList = list.filter((p: any) => p.id !== presetId);
    localStorage.setItem('astrofox_custom_presets', JSON.stringify(nextList));
  }
}

export default projectStore;

