import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useProject, {
  DEFAULT_PROJECT_NAME,
  deleteProjectById,
  listProjects,
  loadProjectById,
  newProject,
  renameProjectById,
  saveProject,
} from '@/app/actions/project';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';

interface Project {
  id: string;
  name: string;
}

interface ProjectBrowserProps {
  onClose?: () => void;
}

export default function ProjectBrowser({ onClose }: ProjectBrowserProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'project-browser' });
  const { t: tc } = useTranslation(undefined, { keyPrefix: 'common' });
  const { t: tt } = useTranslation(undefined, { keyPrefix: 'title-bar' });
  const currentProjectId = useProject(state => state.projectId);
  const defaultProjectName = tt('default-project-name');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createName, setCreateName] = useState(defaultProjectName);
  const [renameName, setRenameName] = useState('');
  const [error, setError] = useState('');

  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedId) || null,
    [projects, selectedId],
  );

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const items = (await listProjects()) as Project[];
      setProjects(items);
      setSelectedId(
        (current: string | null) => current || currentProjectId || items[0]?.id || null,
      );
    } catch (requestError: unknown) {
      setError((requestError as Error)?.message || t('failed-to-load'));
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, t]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    setRenameName(selectedProject?.name || '');
  }, [selectedProject?.name]);

  async function handleOpenProject() {
    if (!selectedId) {
      return;
    }

    await loadProjectById(selectedId);
    onClose?.();
  }

  async function handleCreateProject() {
    const draftName = createName.trim();
    const name = !draftName || draftName === defaultProjectName ? DEFAULT_PROJECT_NAME : draftName;

    await newProject();
    const saved = await saveProject(name);

    if (saved) {
      onClose?.();
    }
  }

  async function handleRenameProject() {
    if (!selectedId || !renameName.trim()) {
      return;
    }

    await renameProjectById(selectedId, renameName.trim());
    await refreshProjects();
  }

  async function handleDeleteProject() {
    if (!selectedId || !selectedProject) {
      return;
    }

    const confirmed = window.confirm(t('confirm-delete', { name: selectedProject.name }));

    if (!confirmed) {
      return;
    }

    await deleteProjectById(selectedId);
    await refreshProjects();
  }

  return (
    <div className="flex min-h-[24rem] min-w-[40rem] max-w-full flex-1 flex-col">
      <div className="flex min-h-0 flex-1 gap-3 overflow-auto p-4">
        <div className={'list-column flex-1 flex flex-col gap-2'}>
          <div className={'text-sm font-bold uppercase opacity-[0.8]'}>{t('projects')}</div>
          <div
            className={
              'flex flex-col gap-1 min-h-56 max-h-56 overflow-y-auto border border-[#444] p-1'
            }
          >
            {projects.map(project => (
              <Button
                variant="ghost"
                key={project.id}
                className={`w-full justify-start h-auto py-1.5 px-2 rounded-none border border-transparent cursor-pointer hover:border-[#666] hover:bg-transparent ${
                  project.id === selectedId
                    ? 'border-[#0ec5ff] bg-[rgba(14,_197,_255,_0.12)] hover:bg-[rgba(14,_197,_255,_0.12)]'
                    : ''
                }`}
                onClick={() => setSelectedId(project.id)}
              >
                <div className={'text-sm'}>{project.name}</div>
              </Button>
            ))}
            {!loading && projects.length === 0 && (
              <div className={'opacity-[0.7] text-sm p-2'}>{t('no-projects')}</div>
            )}
          </div>
          <div className={'flex gap-1.5'}>
            <Button variant="default" size="sm" onClick={refreshProjects}>
              {tc('refresh')}
            </Button>
            <Button variant="default" size="sm" disabled={!selectedId} onClick={handleOpenProject}>
              {tc('open')}
            </Button>
          </div>
        </div>

        <div className={'flex-1 flex flex-col gap-2'}>
          <div className={'text-sm font-bold uppercase opacity-[0.8]'}>{t('create-new')}</div>
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={'bg-[#181818] text-[#fff] border border-[#555] py-2 px-2 text-sm'}
            value={createName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCreateName(e.currentTarget.value)
            }
          />
          <div className={'flex gap-1.5'}>
            <Button variant="default" size="sm" onClick={handleCreateProject}>
              {tc('create')}
            </Button>
          </div>

          <div className={'text-sm font-bold uppercase opacity-[0.8]'}>{t('rename-selected')}</div>
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={'bg-[#181818] text-[#fff] border border-[#555] py-2 px-2 text-sm'}
            value={renameName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setRenameName(e.currentTarget.value)
            }
            disabled={!selectedId}
          />
          <div className={'flex gap-1.5'}>
            <Button
              variant="default"
              size="sm"
              disabled={!selectedId || !renameName.trim()}
              onClick={handleRenameProject}
            >
              {tc('rename')}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!selectedId}
              onClick={handleDeleteProject}
            >
              {tc('delete')}
            </Button>
          </div>
        </div>
      </div>
      <div className="shrink-0 bg-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {error ? <div className="text-sm text-[#ff7d7d]">{error}</div> : <div />}
          <DialogFooter className="sm:justify-end">
            <Button variant="default" size="sm" onClick={onClose}>
              {tc('close')}
            </Button>
          </DialogFooter>
        </div>
      </div>
    </div>
  );
}
