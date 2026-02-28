const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { registerUser, loginUser, getUserByUsername, countUsers } = require('./database');
const {
  listProjects,
  getProjectForUser,
  createProject,
  joinProjectByInvite,
  deleteProjectAsOwner,
  updateProjectPaths,
  appendPathToProject,
  countProjects,
  toProjectSummary,
} = require('./projects');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// socketId -> { username, displayName, projectId }
const activeSessions = new Map();

function roomName(projectId) {
  return `project:${projectId}`;
}

function getOnlineUsersByProject(projectId) {
  const uniqueUsers = new Map();
  for (const session of activeSessions.values()) {
    if (session.projectId !== projectId) {
      continue;
    }
    if (!uniqueUsers.has(session.username)) {
      uniqueUsers.set(session.username, {
        username: session.username,
        displayName: session.displayName,
      });
    }
  }
  return Array.from(uniqueUsers.values());
}

function emitProjectUserList(projectId) {
  if (!projectId) {
    return;
  }
  const users = getOnlineUsersByProject(projectId);
  io.to(roomName(projectId)).emit('user-list', {
    count: users.length,
    users,
  });
}

app.post('/api/register', (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!username || !password || !displayName) {
    return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
  }
  if (String(username).trim().length < 3) {
    return res
      .status(400)
      .json({ success: false, message: 'Username must have at least 3 characters' });
  }
  if (String(password).length < 6) {
    return res
      .status(400)
      .json({ success: false, message: 'Password must have at least 6 characters' });
  }

  const result = registerUser(username, password, displayName);
  if (result.success) {
    return res.json({
      success: true,
      message: 'Register successful',
      user: result.user,
    });
  }
  return res.status(400).json(result);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
  }

  const result = loginUser(username, password);
  if (result.success) {
    return res.json(result);
  }
  return res.status(401).json(result);
});

app.get('/api/projects', (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ success: false, message: 'username is required' });
  }

  return res.json({
    success: true,
    projects: listProjects(username),
  });
});

app.post('/api/projects', (req, res) => {
  const { name, createdBy, password } = req.body || {};
  const result = createProject(name, createdBy, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.status(201).json({
    success: true,
    message: 'Project created',
    project: result.project,
  });
});

app.post('/api/projects/join', (req, res) => {
  const { invite, username, password } = req.body || {};
  const result = joinProjectByInvite(invite, username, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json({
    success: true,
    message: 'Joined project successfully',
    project: result.project,
  });
});

app.get('/api/projects/:projectId', (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ success: false, message: 'username is required' });
  }

  const result = getProjectForUser(req.params.projectId, username);
  if (!result.success) {
    return res.status(404).json({ success: false, message: result.message });
  }

  const project = result.project;
  return res.json({
    success: true,
    project: {
      ...toProjectSummary(project, username),
      paths: Array.isArray(project.paths) ? project.paths : [],
    },
  });
});

app.delete('/api/projects/:projectId', (req, res) => {
  const username = String(req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ success: false, message: 'username is required' });
  }

  const result = deleteProjectAsOwner(req.params.projectId, username);
  if (!result.success) {
    if (result.code === 'FORBIDDEN') {
      return res.status(403).json(result);
    }
    if (result.code === 'NOT_FOUND') {
      return res.status(404).json(result);
    }
    return res.status(400).json(result);
  }

  const deletedProjectId = String(req.params.projectId);
  const deletedRoom = roomName(deletedProjectId);

  io.to(deletedRoom).emit('project-deleted', {
    projectId: deletedProjectId,
    deletedBy: username,
  });
  io.in(deletedRoom).socketsLeave(deletedRoom);

  for (const [socketId, session] of activeSessions.entries()) {
    if (session.projectId === deletedProjectId) {
      activeSessions.set(socketId, { ...session, projectId: null });
    }
  }

  return res.json({
    success: true,
    message: 'Project deleted',
    project: result.project,
  });
});

io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  const displayName = socket.handshake.auth.displayName;
  if (!username || !displayName) {
    return next(new Error('Authentication error'));
  }

  const user = getUserByUsername(username);
  if (!user) {
    return next(new Error('User not found'));
  }

  socket.username = username;
  socket.displayName = displayName;
  return next();
});

io.on('connection', (socket) => {
  activeSessions.set(socket.id, {
    username: socket.username,
    displayName: socket.displayName,
    projectId: null,
  });

  socket.on('join-project', (payload = {}) => {
    const projectId = String(payload.projectId || '').trim();
    if (!projectId) {
      socket.emit('project-error', { action: 'join', message: 'projectId is required' });
      return;
    }

    const accessResult = getProjectForUser(projectId, socket.username);
    if (!accessResult.success) {
      socket.emit('project-error', { action: 'join', message: accessResult.message });
      return;
    }
    const project = accessResult.project;

    const previousSession = activeSessions.get(socket.id);
    const previousProjectId = previousSession?.projectId || null;

    if (previousProjectId && previousProjectId !== projectId) {
      socket.leave(roomName(previousProjectId));
    }

    socket.join(roomName(projectId));
    socket.projectId = projectId;

    activeSessions.set(socket.id, {
      username: socket.username,
      displayName: socket.displayName,
      projectId,
    });

    socket.emit('project-joined', {
      project: toProjectSummary(project, socket.username),
      paths: Array.isArray(project.paths) ? project.paths : [],
    });

    if (previousProjectId && previousProjectId !== projectId) {
      emitProjectUserList(previousProjectId);
    }
    emitProjectUserList(projectId);
  });

  socket.on('leave-project', () => {
    const session = activeSessions.get(socket.id);
    const projectId = session?.projectId;
    if (!projectId) {
      return;
    }

    socket.leave(roomName(projectId));
    socket.projectId = null;
    activeSessions.set(socket.id, {
      username: socket.username,
      displayName: socket.displayName,
      projectId: null,
    });

    emitProjectUserList(projectId);
    socket.emit('left-project', { projectId });
  });

  socket.on('draw', (data) => {
    const projectId = socket.projectId;
    if (!projectId) {
      return;
    }

    const drawData = {
      ...data,
      username: socket.username,
      displayName: socket.displayName,
      timestamp: Date.now(),
      projectId,
    };

    const result = appendPathToProject(projectId, drawData);
    if (!result.success) {
      socket.emit('project-error', { action: 'draw', message: result.message || 'Cannot save drawing' });
      return;
    }

    socket.to(roomName(projectId)).emit('draw', drawData);
  });

  socket.on('sync-drawing', (data) => {
    const projectId = socket.projectId;
    if (!projectId) {
      return;
    }

    const safePaths = Array.isArray(data) ? data : [];
    const result = updateProjectPaths(projectId, safePaths);
    if (!result.success) {
      socket.emit('project-error', { action: 'sync', message: result.message || 'Cannot sync drawing' });
      return;
    }

    socket.to(roomName(projectId)).emit('sync-drawing', safePaths);
  });

  socket.on('clear-canvas', () => {
    const projectId = socket.projectId;
    if (!projectId) {
      return;
    }

    const result = updateProjectPaths(projectId, []);
    if (!result.success) {
      socket.emit('project-error', { action: 'clear', message: result.message || 'Cannot clear project' });
      return;
    }

    io.to(roomName(projectId)).emit('clear-canvas', {
      clearedBy: socket.displayName,
      projectId,
    });
  });

  socket.on('disconnect', () => {
    const session = activeSessions.get(socket.id);
    activeSessions.delete(socket.id);
    if (session?.projectId) {
      emitProjectUserList(session.projectId);
    }
  });
});

app.get('/', (req, res) => {
  return res.json({
    message: 'Collaborative Drawing Server is running',
    activeSocketConnections: activeSessions.size,
    registeredUsers: countUsers(),
    totalProjects: countProjects(),
  });
});

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

server.listen(PORT, () => {
  console.log('==========================================');
  console.log(`Server is running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log('==========================================');
});
