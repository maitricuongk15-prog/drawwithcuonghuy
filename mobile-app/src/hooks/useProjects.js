import { useCallback, useState } from 'react';
import {
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  joinProject as joinProjectApi,
  listProjects as listProjectsApi,
} from '../services/projectApi';

export function useProjects({ currentUser, notify }) {
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [joiningProject, setJoiningProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState('');

  const currentUsername = currentUser?.username || '';

  const loadProjects = useCallback(async () => {
    if (!currentUsername) {
      setProjects([]);
      return;
    }

    setLoadingProjects(true);
    try {
      const { response, data } = await listProjectsApi(currentUsername);
      if (response.ok && data.success) {
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      } else {
        notify?.({ type: 'error', message: data.message || 'Cannot load recent projects.' });
      }
    } catch (error) {
      notify?.({ type: 'error', message: error.message || 'Cannot load recent projects.' });
    } finally {
      setLoadingProjects(false);
    }
  }, [currentUsername, notify]);

  const createNewProject = useCallback(
    async (name, password) => {
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const normalizedPassword = typeof password === 'string' ? password.trim() : '';
      if (!normalizedName) {
        notify?.({ type: 'warning', message: 'Please enter a project name.' });
        return null;
      }
      if (!currentUsername) {
        notify?.({ type: 'error', message: 'You need to login before creating a project.' });
        return null;
      }

      setCreatingProject(true);
      try {
        const { response, data } = await createProjectApi({
          name: normalizedName,
          createdBy: currentUsername,
          password: normalizedPassword || undefined,
        });
        if (response.ok && data.success) {
          const createdProject = data.project;
          setProjects((prev) => [createdProject, ...prev.filter((item) => item.id !== createdProject.id)]);
          notify?.({
            type: 'success',
            message: `Project created. Invite code: ${createdProject.shareToken}`,
          });
          return createdProject;
        }
        notify?.({ type: 'error', message: data.message || 'Create project failed.' });
        return null;
      } catch (error) {
        notify?.({ type: 'error', message: error.message || 'Create project failed.' });
        return null;
      } finally {
        setCreatingProject(false);
      }
    },
    [currentUsername, notify]
  );

  const joinByInvite = useCallback(
    async (invite, password) => {
      const normalizedInvite = typeof invite === 'string' ? invite.trim() : '';
      const normalizedPassword = typeof password === 'string' ? password.trim() : '';
      if (!normalizedInvite) {
        notify?.({ type: 'warning', message: 'Please enter invite code.' });
        return null;
      }
      if (!currentUsername) {
        notify?.({ type: 'error', message: 'You need to login before joining a project.' });
        return null;
      }

      setJoiningProject(true);
      try {
        const { response, data } = await joinProjectApi({
          invite: normalizedInvite,
          username: currentUsername,
          password: normalizedPassword || undefined,
        });

        if (response.ok && data.success) {
          const joinedProject = data.project;
          setProjects((prev) => [joinedProject, ...prev.filter((item) => item.id !== joinedProject.id)]);
          notify?.({ type: 'success', message: `Joined project "${joinedProject.name}".` });
          return joinedProject;
        }

        notify?.({ type: 'error', message: data.message || 'Join project failed.' });
        return null;
      } catch (error) {
        notify?.({ type: 'error', message: error.message || 'Join project failed.' });
        return null;
      } finally {
        setJoiningProject(false);
      }
    },
    [currentUsername, notify]
  );

  const deleteProjectByOwner = useCallback(
    async (projectId) => {
      const normalizedId = String(projectId || '').trim();
      if (!normalizedId) {
        notify?.({ type: 'warning', message: 'Project id is invalid.' });
        return false;
      }
      if (!currentUsername) {
        notify?.({ type: 'error', message: 'You need to login before deleting a project.' });
        return false;
      }

      setDeletingProjectId(normalizedId);
      try {
        const { response, data } = await deleteProjectApi(normalizedId, currentUsername);
        if (response.ok && data.success) {
          setProjects((prev) => prev.filter((item) => String(item.id) !== normalizedId));
          notify?.({ type: 'success', message: 'Project deleted.' });
          return true;
        }
        notify?.({ type: 'error', message: data.message || 'Delete project failed.' });
        return false;
      } catch (error) {
        notify?.({ type: 'error', message: error.message || 'Delete project failed.' });
        return false;
      } finally {
        setDeletingProjectId('');
      }
    },
    [currentUsername, notify]
  );

  return {
    projects,
    loadingProjects,
    creatingProject,
    joiningProject,
    deletingProjectId,
    loadProjects,
    createNewProject,
    joinByInvite,
    deleteProjectByOwner,
    setProjects,
  };
}
