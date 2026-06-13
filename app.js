// JWT Access Control
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
  handleLogout();
}

const user = JSON.parse(userStr);
let tasks = [];
let notifiedTasks = new Set();

// Socket Connection
let socket;

document.addEventListener('DOMContentLoaded', () => {
  setupUI();
  initSocket();
  fetchStats();
  fetchTasks();
  setupReminders();
});

function setupUI() {
  document.getElementById('display-username').innerText = user.username;
  document.getElementById('user-avatar').innerText = user.username.charAt(0).toUpperCase();

  // Request Notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function initSocket() {
  socket = io();

  const statusDot = document.querySelector('#socket-status .status-dot');
  const statusText = document.querySelector('#socket-status .status-text');

  socket.on('connect', () => {
    statusDot.className = 'status-dot connected';
    statusText.innerText = 'Connected';
    socket.emit('join', { token });
  });

  socket.on('disconnect', () => {
    statusDot.className = 'status-dot disconnected';
    statusText.innerText = 'Disconnected';
  });

  // Real-Time Event Handlers
  socket.on('task_created', (task) => {
    showToast(`🆕 Task created: "${task.title}"`);
    refreshData();
  });

  socket.on('task_updated', (task) => {
    showToast(`✏️ Task updated: "${task.title}"`);
    refreshData();
  });

  socket.on('task_deleted', (data) => {
    showToast(`🗑️ A task was deleted`);
    refreshData();
  });
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/auth.html';
}

// Fetch stats and populate cards
async function fetchStats() {
  try {
    const response = await fetch('/api/tasks/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      handleLogout();
      return;
    }

    const stats = await response.json();
    document.getElementById('stat-total').innerText = stats.total || 0;
    document.getElementById('stat-todo').innerText = stats.todo || 0;
    document.getElementById('stat-progress').innerText = stats.inProgress || 0;
    document.getElementById('stat-completed').innerText = stats.completed || 0;
    document.getElementById('stat-high').innerText = stats.highPriority || 0;
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

// Fetch tasks with filter params
async function fetchTasks() {
  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;

  let url = `/api/tasks?status=${encodeURIComponent(status)}&priority=${encodeURIComponent(priority)}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      handleLogout();
      return;
    }

    tasks = await response.json();
    renderTasks();
  } catch (error) {
    console.error('Error fetching tasks:', error);
  }
}

function renderTasks() {
  const grid = document.getElementById('tasks-grid');
  const emptyState = document.getElementById('empty-state');

  grid.innerHTML = '';

  if (tasks.length === 0) {
    grid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');
  emptyState.classList.add('hidden');

  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-card border-priority-${task.priority.toLowerCase()}`;
    if (task.status === 'Completed') {
      card.classList.add('completed');
    }

    // Parse status class helper
    const statusClass = task.status.replace(/\s+/g, '-').toLowerCase();

    // Format Date
    let dueDateHTML = '';
    if (task.due_date) {
      const d = new Date(task.due_date);
      const formatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isOverdue = new Date() > d && task.status !== 'Completed';
      dueDateHTML = `
        <div class="task-due ${isOverdue ? 'overdue' : ''}">
          <span>📅</span>
          <span>${formatted}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="task-card-header">
        <label class="checkbox-container">
          <input type="checkbox" ${task.status === 'Completed' ? 'checked' : ''} onchange="toggleTaskStatus(${task.id}, '${task.status}')">
          <span class="checkmark"></span>
        </label>
        <h3 class="task-title">${escapeHTML(task.title)}</h3>
      </div>
      <p class="task-description">${escapeHTML(task.description || 'No description provided.')}</p>
      <div class="task-card-footer">
        <div class="task-badges">
          <span class="badge badge-priority-${task.priority.toLowerCase()}">${task.priority}</span>
          <span class="badge badge-status-${statusClass}">${task.status}</span>
        </div>
        ${dueDateHTML}
        <div class="task-actions">
          <button class="btn-icon" onclick="editTask(${task.id})" title="Edit Task">✏️</button>
          <button class="btn-icon delete" onclick="deleteTask(${task.id})" title="Delete Task">🗑️</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Debounce filter search
let filterTimeout;
function handleFilterChange() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    fetchTasks();
  }, 300);
}

// Reload both tasks list & stats dashboard
function refreshData() {
  fetchTasks();
  fetchStats();
}

// Checkbox Status Quick Toggle
async function toggleTaskStatus(taskId, currentStatus) {
  const newStatus = currentStatus === 'Completed' ? 'To Do' : 'Completed';
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: newStatus,
        due_date: task.due_date
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update task status');
    }
  } catch (error) {
    showToast(`❌ Error updating task: ${error.message}`, 'error');
    fetchTasks(); // Revert ui checkbox change
  }
}

// Modal Controllers
function openTaskModal() {
  document.getElementById('task-id').value = '';
  document.getElementById('task-form').reset();
  document.getElementById('modal-title').innerText = 'Create New Task';
  document.getElementById('save-task-btn').innerText = 'Create Task';
  document.getElementById('task-modal').classList.remove('hidden');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.add('hidden');
}

function editTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('task-id').value = task.id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-desc').value = task.description || '';
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-status').value = task.status;

  if (task.due_date) {
    // Format to datetime-local string (YYYY-MM-DDTHH:MM)
    const localDate = new Date(task.due_date);
    const tzOffset = localDate.getTimezoneOffset() * 60000; // in ms
    const localISOTime = (new Date(localDate - tzOffset)).toISOString().slice(0, 16);
    document.getElementById('task-due').value = localISOTime;
  } else {
    document.getElementById('task-due').value = '';
  }

  document.getElementById('modal-title').innerText = 'Edit Task';
  document.getElementById('save-task-btn').innerText = 'Update Task';
  document.getElementById('task-modal').classList.remove('hidden');
}

async function handleTaskSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const priority = document.getElementById('task-priority').value;
  const status = document.getElementById('task-status').value;
  const due_date = document.getElementById('task-due').value;

  const payload = { title, description, priority, status, due_date };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/tasks/${id}` : '/api/tasks';

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save task.');
    }

    closeTaskModal();
  } catch (error) {
    showToast(`❌ Error: ${error.message}`);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;

  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete task.');
    }
  } catch (error) {
    showToast(`❌ Error: ${error.message}`);
  }
}

// Reminders & Web Notifications logic
function setupReminders() {
  // Check due tasks every 30 seconds
  setInterval(() => {
    if (tasks.length === 0) return;

    const now = new Date();
    tasks.forEach(task => {
      if (task.status === 'Completed' || !task.due_date) return;

      const dueDate = new Date(task.due_date);
      const timeDiff = dueDate - now;

      // Notify if task is due within 1 hour (3600000 ms) and not yet notified
      if (timeDiff > 0 && timeDiff <= 3600000) {
        if (!notifiedTasks.has(task.id)) {
          triggerBrowserNotification(task);
          notifiedTasks.add(task.id);
        }
      }
    });
  }, 30000);
}

function triggerBrowserNotification(task) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const options = {
      body: `Priority: ${task.priority}\nDue at: ${new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      icon: '/logo.png'
    };
    new Notification(`⏳ Task Due Soon: ${task.title}`, options);
  }
  showToast(`⏰ Task due soon: "${task.title}"`);
}

// Custom Notification Toast System
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;

  container.appendChild(toast);

  // Trigger Slide-in
  setTimeout(() => {
    toast.classList.add('show');
  }, 50);

  // Slide-out and remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3000);
}

// Helper to escape HTML characters
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
