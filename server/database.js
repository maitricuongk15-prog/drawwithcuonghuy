const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'users.json');

console.log(`[DB] Database path: ${dbPath}`);

function initDatabase() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      users: [],
      lastId: 0,
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    console.log('[DB] Created new database file');
  } else {
    console.log('[DB] Database file exists');
  }
}

function readDatabase() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[DB] Error reading database:', error);
    return { users: [], lastId: 0 };
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('[DB] Error writing database:', error);
    return false;
  }
}

initDatabase();
console.log('[DB] Database initialized successfully');

function registerUser(username, password, displayName) {
  try {
    const db = readDatabase();

    const existingUser = db.users.find((u) => u.username === username);
    if (existingUser) {
      return { success: false, message: 'Username already exists.' };
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.lastId += 1;
    const newUser = {
      id: db.lastId,
      username,
      password: hashedPassword,
      displayName,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    if (writeDatabase(db)) {
      console.log(`[DB] User registered: ${username} (ID: ${db.lastId})`);
      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          displayName: newUser.displayName,
        },
      };
    }

    return { success: false, message: 'Failed to save user data.' };
  } catch (error) {
    console.error('[DB] Error registering user:', error);
    return {
      success: false,
      message: `Failed to create account: ${error.message}`,
    };
  }
}

function loginUser(username, password) {
  try {
    const db = readDatabase();

    const user = db.users.find((u) => u.username === username);
    if (!user) {
      return { success: false, message: 'Username does not exist.' };
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return { success: false, message: 'Incorrect password.' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  } catch (error) {
    console.error('[DB] Error logging in user:', error);
    return {
      success: false,
      message: `Login error: ${error.message}`,
    };
  }
}

function getUserByUsername(username) {
  try {
    const db = readDatabase();
    const user = db.users.find((u) => u.username === username);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  } catch (error) {
    console.error('[DB] Error getting user:', error);
    return null;
  }
}

function getAllUsers() {
  try {
    const db = readDatabase();
    return db.users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
    }));
  } catch (error) {
    console.error('[DB] Error getting all users:', error);
    return [];
  }
}

function countUsers() {
  try {
    const db = readDatabase();
    return db.users.length;
  } catch (error) {
    console.error('[DB] Error counting users:', error);
    return 0;
  }
}

module.exports = {
  registerUser,
  loginUser,
  getUserByUsername,
  getAllUsers,
  countUsers,
};
