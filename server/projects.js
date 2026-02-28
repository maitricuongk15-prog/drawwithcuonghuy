const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const projectsPath = path.join(__dirname, 'projects.json');
const MAX_PROJECT_NAME = 80;
const MAX_PATHS_PER_PROJECT = 10000;
const JOIN_CODE_LENGTH = 8;

function initProjectsDatabase() {
  if (!fs.existsSync(projectsPath)) {
    const initialData = {
      projects: [],
      lastId: 0,
    };
    fs.writeFileSync(projectsPath, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function normalizeMembers(project) {
  if (Array.isArray(project.members) && project.members.length > 0) {
    return Array.from(
      new Set(
        project.members
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    );
  }

  if (project.createdBy) {
    return [String(project.createdBy).trim()];
  }

  return [];
}

function normalizeProjectRecord(project) {
  const members = normalizeMembers(project);
  const normalizedId = String(project.id);
  const fallbackJoinCode = crypto
    .createHash('sha1')
    .update(normalizedId)
    .digest('hex')
    .toUpperCase()
    .slice(0, JOIN_CODE_LENGTH);

  return {
    ...project,
    id: normalizedId,
    createdBy: String(project.createdBy || '').trim() || 'unknown',
    members,
    paths: Array.isArray(project.paths) ? project.paths : [],
    joinCode: String(project.joinCode || '').trim().toUpperCase() || fallbackJoinCode,
    passwordHash: project.passwordHash || null,
  };
}

function readProjectsDatabase() {
  try {
    const raw = fs.readFileSync(projectsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.projects) || typeof parsed.lastId !== 'number') {
      return { projects: [], lastId: 0 };
    }

    return {
      lastId: parsed.lastId,
      projects: parsed.projects.map(normalizeProjectRecord),
    };
  } catch (error) {
    return { projects: [], lastId: 0 };
  }
}

function writeProjectsDatabase(data) {
  try {
    fs.writeFileSync(projectsPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function normalizeProjectName(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  return value.replace(/\s+/g, ' ');
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function canAccessProject(project, username) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return false;
  }

  return (
    normalizeUsername(project.createdBy) === normalizedUsername ||
    (Array.isArray(project.members) && project.members.includes(normalizedUsername))
  );
}

function buildShareToken(project) {
  return `${project.id}:${project.joinCode}`;
}

function toProjectSummary(project, username) {
  const normalizedUsername = normalizeUsername(username);
  const isOwner = normalizedUsername && normalizeUsername(project.createdBy) === normalizedUsername;
  const shareToken = buildShareToken(project);

  return {
    id: project.id,
    name: project.name,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    pathCount: Array.isArray(project.paths) ? project.paths.length : 0,
    requiresPassword: Boolean(project.passwordHash),
    isOwner: Boolean(isOwner),
    shareToken,
    shareLink: `paintapp://join?token=${encodeURIComponent(shareToken)}`,
  };
}

function generateJoinCode() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  while (code.length < JOIN_CODE_LENGTH) {
    const byte = crypto.randomBytes(1)[0];
    code += charset[byte % charset.length];
  }
  return code;
}

function generateUniqueJoinCode(projects) {
  let attempts = 0;
  while (attempts < 20) {
    const code = generateJoinCode();
    const exists = projects.some((item) => item.joinCode === code);
    if (!exists) {
      return code;
    }
    attempts += 1;
  }
  return `${generateJoinCode()}${Date.now().toString().slice(-2)}`.slice(0, JOIN_CODE_LENGTH);
}

function parseInviteInput(inviteInput) {
  const raw = String(inviteInput || '').trim();
  if (!raw) {
    return { projectId: '', joinCode: '' };
  }

  let value = raw;
  if (value.includes('://')) {
    try {
      const parsed = new URL(value);
      value =
        parsed.searchParams.get('token') ||
        parsed.searchParams.get('invite') ||
        parsed.searchParams.get('code') ||
        parsed.pathname.replace(/\//g, '') ||
        value;
    } catch (error) {
      value = raw;
    }
  }

  if (value.includes('=')) {
    const match = value.match(/(?:token|invite|code)=([^&\s]+)/i);
    if (match?.[1]) {
      value = decodeURIComponent(match[1]);
    }
  }

  if (value.includes(':')) {
    const [first, second] = value.split(':');
    const projectId = String(first || '').trim();
    const joinCode = String(second || '').trim().toUpperCase();
    return { projectId, joinCode };
  }

  return {
    projectId: '',
    joinCode: String(value).trim().toUpperCase(),
  };
}

initProjectsDatabase();

function listProjects(username) {
  const db = readProjectsDatabase();
  const normalizedUsername = normalizeUsername(username);
  return db.projects
    .filter((project) => canAccessProject(project, normalizedUsername))
    .map((project) => toProjectSummary(project, normalizedUsername))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function getProjectById(projectId) {
  const db = readProjectsDatabase();
  const id = String(projectId);
  return db.projects.find((item) => String(item.id) === id) || null;
}

function getProjectForUser(projectId, username) {
  const project = getProjectById(projectId);
  if (!project) {
    return { success: false, message: 'Project not found' };
  }
  if (!canAccessProject(project, username)) {
    return { success: false, message: 'You do not have access to this project' };
  }
  return { success: true, project };
}

function createProject(name, createdBy, password) {
  const normalizedName = normalizeProjectName(name);
  const owner = normalizeUsername(createdBy);
  const normalizedPassword = String(password || '').trim();

  if (!normalizedName) {
    return { success: false, message: 'Project name is required' };
  }
  if (!owner) {
    return { success: false, message: 'createdBy is required' };
  }
  if (normalizedName.length > MAX_PROJECT_NAME) {
    return { success: false, message: `Project name must be <= ${MAX_PROJECT_NAME} characters` };
  }

  const db = readProjectsDatabase();
  db.lastId += 1;
  const now = new Date().toISOString();
  const joinCode = generateUniqueJoinCode(db.projects);

  const project = {
    id: String(db.lastId),
    name: normalizedName,
    createdBy: owner,
    createdAt: now,
    updatedAt: now,
    members: [owner],
    joinCode,
    passwordHash: normalizedPassword ? bcrypt.hashSync(normalizedPassword, 10) : null,
    paths: [],
  };

  db.projects.push(project);
  if (!writeProjectsDatabase(db)) {
    return { success: false, message: 'Failed to save project' };
  }

  return { success: true, project: toProjectSummary(project, owner) };
}

function joinProjectByInvite(inviteInput, username, password) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return { success: false, message: 'username is required' };
  }

  const parsed = parseInviteInput(inviteInput);
  if (!parsed.joinCode) {
    return { success: false, message: 'Invite code or link is invalid' };
  }

  const db = readProjectsDatabase();
  const projectIndex = db.projects.findIndex((project) => {
    if (parsed.projectId && String(project.id) !== parsed.projectId) {
      return false;
    }
    return String(project.joinCode || '').toUpperCase() === parsed.joinCode;
  });

  if (projectIndex === -1) {
    return { success: false, message: 'Project not found by invite' };
  }

  const project = db.projects[projectIndex];
  if (project.passwordHash) {
    const providedPassword = String(password || '');
    const validPassword = bcrypt.compareSync(providedPassword, project.passwordHash);
    if (!validPassword) {
      return { success: false, message: 'Invalid project password' };
    }
  }

  if (!Array.isArray(project.members)) {
    project.members = [];
  }
  if (!project.members.includes(normalizedUsername)) {
    project.members.push(normalizedUsername);
  }

  project.updatedAt = new Date().toISOString();
  db.projects[projectIndex] = project;

  if (!writeProjectsDatabase(db)) {
    return { success: false, message: 'Failed to join project' };
  }

  return {
    success: true,
    project: toProjectSummary(project, normalizedUsername),
  };
}

function deleteProjectAsOwner(projectId, username) {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return { success: false, message: 'username is required', code: 'INVALID_USER' };
  }

  const db = readProjectsDatabase();
  const id = String(projectId || '').trim();
  const index = db.projects.findIndex((item) => String(item.id) === id);
  if (index === -1) {
    return { success: false, message: 'Project not found', code: 'NOT_FOUND' };
  }

  const project = db.projects[index];
  if (normalizeUsername(project.createdBy) !== normalizedUsername) {
    return { success: false, message: 'Only owner can delete this project', code: 'FORBIDDEN' };
  }

  const [deletedProject] = db.projects.splice(index, 1);
  if (!writeProjectsDatabase(db)) {
    return { success: false, message: 'Failed to delete project', code: 'WRITE_FAILED' };
  }

  return {
    success: true,
    project: toProjectSummary(deletedProject, normalizedUsername),
  };
}

function updateProjectPaths(projectId, paths) {
  const db = readProjectsDatabase();
  const id = String(projectId);
  const index = db.projects.findIndex((item) => String(item.id) === id);
  if (index === -1) {
    return { success: false, message: 'Project not found' };
  }

  const safePaths = Array.isArray(paths) ? paths.slice(-MAX_PATHS_PER_PROJECT) : [];
  db.projects[index].paths = safePaths;
  db.projects[index].updatedAt = new Date().toISOString();

  if (!writeProjectsDatabase(db)) {
    return { success: false, message: 'Failed to save project paths' };
  }

  return { success: true, project: db.projects[index] };
}

function appendPathToProject(projectId, drawData) {
  const db = readProjectsDatabase();
  const id = String(projectId);
  const index = db.projects.findIndex((item) => String(item.id) === id);
  if (index === -1) {
    return { success: false, message: 'Project not found' };
  }

  const paths = Array.isArray(db.projects[index].paths) ? db.projects[index].paths : [];
  paths.push(drawData);
  if (paths.length > MAX_PATHS_PER_PROJECT) {
    paths.shift();
  }

  db.projects[index].paths = paths;
  db.projects[index].updatedAt = new Date().toISOString();
  if (!writeProjectsDatabase(db)) {
    return { success: false, message: 'Failed to append drawing path' };
  }

  return { success: true, project: db.projects[index] };
}

function countProjects() {
  const db = readProjectsDatabase();
  return db.projects.length;
}

module.exports = {
  listProjects,
  getProjectById,
  getProjectForUser,
  createProject,
  joinProjectByInvite,
  deleteProjectAsOwner,
  updateProjectPaths,
  appendPathToProject,
  countProjects,
  toProjectSummary,
  canAccessProject,
};
