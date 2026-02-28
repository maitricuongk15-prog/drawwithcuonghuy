import { requestJson } from './apiClient';

export async function listProjects(username) {
  const safeUsername = encodeURIComponent(String(username || '').trim());
  return requestJson(`/api/projects?username=${safeUsername}`, {
    method: 'GET',
  });
}

export async function createProject(payload) {
  return requestJson('/api/projects', {
    method: 'POST',
    payload,
  });
}

export async function getProjectById(projectId, username) {
  const safeUsername = encodeURIComponent(String(username || '').trim());
  return requestJson(`/api/projects/${projectId}?username=${safeUsername}`, {
    method: 'GET',
  });
}

export async function joinProject(payload) {
  return requestJson('/api/projects/join', {
    method: 'POST',
    payload,
  });
}

export async function deleteProject(projectId, username) {
  const safeUsername = encodeURIComponent(String(username || '').trim());
  return requestJson(`/api/projects/${projectId}?username=${safeUsername}`, {
    method: 'DELETE',
  });
}
