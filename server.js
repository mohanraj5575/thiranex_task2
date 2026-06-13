const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secret-key-12345';
const DB_PATH = path.join(__dirname, 'database.db');
// Ensure Database exists and tables are initialized
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});
function initializeDatabase() {
  db.serialize(() => {
    // Create Users Table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Create Tasks Table
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        priority VARCHAR(10) NOT NULL CHECK(priority IN ('Low', 'Medium', 'High')),
        status VARCHAR(20) NOT NULL CHECK(status IN ('To Do', 'In Progress', 'Completed')),
        due_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  });
}
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  });
};
// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================
// Register User
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  // Check if user exists
  db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error occurred.' });
    }
    if (row) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    // Hash Password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ error: 'Error encrypting password.' });
      }
      // Insert User
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error registering user.' });
        }
        res.status(201).json({ message: 'User registered successfully!' });
      });
    });
  });
});
// Login User
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error occurred.' });
    }
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    // Compare Password
    bcrypt.compare(password, user.password, (err, result) => {
      if (err || !result) {
        return res.status(400).json({ error: 'Invalid username or password.' });
      }
      // Generate JWT Token
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username
        }
      });
    });
  });
});
// ==========================================
// TASKS CRUD API (SECURED)
// ==========================================
// Get All Tasks (Supports Filtering & Searching)
app.get('/api/tasks', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { status, priority, search } = req.query;
  let query = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [userId];
  if (status && status !== 'All') {
    query += ' AND status = ?';
    params.push(status);
  }
  if (priority && priority !== 'All') {
    query += ' AND priority = ?';
    params.push(priority);
  }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY datetime(due_date) ASC, created_at DESC';
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error retrieving tasks.' });
    }
    res.json(rows);
  });
});
// Get Task Statistics
app.get('/api/tasks/stats', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const queries = {
    total: 'SELECT COUNT(*) as count FROM tasks WHERE user_id = ?',
    todo: "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'To Do'",
    inProgress: "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'In Progress'",
    completed: "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Completed'",
    highPriority: "SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND priority = 'High'"
  };
  const stats = {};
  let completedQueries = 0;
  const keys = Object.keys(queries);
  keys.forEach((key) => {
    db.get(queries[key], [userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error generating statistics.' });
      }
      stats[key] = row ? row.count : 0;
      completedQueries++;
      if (completedQueries === keys.length) {
        res.json(stats);
      }
    });
  });
});
// Create Task
app.post('/api/tasks', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { title, description, priority, status, due_date } = req.body;
  if (!title || !priority || !status) {
    return res.status(400).json({ error: 'Title, priority, and status are required.' });
  }
  db.run(
    'INSERT INTO tasks (user_id, title, description, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, title, description, priority, status, due_date || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating task.' });
      }
      
      const taskId = this.lastID;
      db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
        if (task) {
          // Broadcast to the user's specific room
          io.to(`user_${userId}`).emit('task_created', task);
          res.status(201).json(task);
        } else {
          res.status(500).json({ error: 'Error retrieving created task.' });
        }
      });
    }
  );
});
// Update Task
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const taskId = req.params.id;
  const { title, description, priority, status, due_date } = req.body;
  if (!title || !priority || !status) {
    return res.status(400).json({ error: 'Title, priority, and status are required.' });
  }
  // Ensure task belongs to user
  db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }
    db.run(
      'UPDATE tasks SET title = ?, description = ?, priority = ?, status = ?, due_date = ? WHERE id = ?',
      [title, description, priority, status, due_date || null, taskId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating task.' });
        }
        db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
          if (task) {
            io.to(`user_${userId}`).emit('task_updated', task);
            res.json(task);
          } else {
            res.status(500).json({ error: 'Error retrieving updated task.' });
          }
        });
      }
    );
  });
});
// Delete Task
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const taskId = req.params.id;
  db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Task not found or unauthorized.' });
    }
    db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting task.' });
      }
      io.to(`user_${userId}`).emit('task_deleted', { id: parseInt(taskId) });
      res.json({ message: 'Task deleted successfully.', id: parseInt(taskId) });
    });
  });
});
// Catch-all route to serve the front-end app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// ==========================================
// SOCKET.IO REAL-TIME HANDLING
// ==========================================
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);
  // Authenticate socket and place in private room
  socket.on('join', (data) => {
    if (data && data.token) {
      jwt.verify(data.token, JWT_SECRET, (err, decoded) => {
        if (!err && decoded) {
          const roomName = `user_${decoded.id}`;
          socket.join(roomName);
          console.log(`Socket ${socket.id} joined room ${roomName} for user ${decoded.username}`);
          socket.emit('joined', { status: 'success', room: roomName });
        } else {
          socket.emit('joined', { status: 'error', message: 'Auth token invalid' });
        }
      });
    }
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`TaskFlow Server is running on http://localhost:${PORT}`);
  console.log(`Database connected successfully: ${DB_PATH}`);
  console.log(`====================================================`);
});