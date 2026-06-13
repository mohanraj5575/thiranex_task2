# ⚡ TaskFlow Manager

TaskFlow Manager is a premium, full-stack task management web application designed for students and developers. It features robust user authentication, CRUD operations, dynamic analytics, browser-based reminders, and real-time updates via WebSockets.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-blue.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-v4.19.2-green.svg)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/socket.io-v4.7.5-orange.svg)](https://socket.io/)
[![JWT](https://img.shields.io/badge/jwt-authentication-purple.svg)](https://jwt.io/)
[![Database](https://img.shields.io/badge/database-SQLite%20%7C%20MySQL-lightgrey.svg)]()

---

## ✨ Key Features
* 🔒 **Secure Authentication**: User registration and login utilizing BCrypt password hashing and JSON Web Tokens (JWT) for session management.
* 📊 **Dashboard Statistics**: Dynamic metrics tracker showing total, pending, in-progress, completed, and high-priority tasks.
* ⚡ **Real-Time Synchronization**: Instantly syncs task modifications (creation, updates, deletions) across all connected browser tabs and sessions using Socket.IO scoped rooms.
* 🔍 **Debounced Search & Filtering**: Instant filter control by priority (Low, Medium, High) and status (To Do, In Progress, Completed).
* ⏰ **Due Date & Browser Reminders**: Local pollers detect tasks due within one hour and push native browser desktop notifications.
* 🎨 **Premium Glassmorphic Design**: Modern dark theme constructed with customizable HSL palettes, cards, checkmark micro-interactions, responsive flex-grid layouts, and Toast alerts.

---

## 🛠️ Technology Stack
* **Frontend**: HTML5, Vanilla CSS3 (Custom design system), JavaScript (ES6+), Socket.IO Client, Web Notifications API.
* **Backend**: Node.js, Express.js (REST API, JWT validation middleware).
* **Database**: SQLite (Default local setup, auto-generated `database.db` file) and MySQL (Academic script provided in `schema.sql`).
* **Real-time Engine**: Socket.IO (WebSockets connection).

---

## 📁 Repository Structure
```text
├── package.json              # NPM dependencies & scripts
├── server.js                 # Express server, SQLite setup, REST endpoints, WebSockets
├── schema.sql                # SQL schemas for SQLite and MySQL
├── README.md                 # Project README (this file)
└── public/                   # Client static web assets
    ├── index.html            # Dashboard Workspace (Protected)
    ├── auth.html             # User Auth Portal (Login / Register)
    ├── css/
    │   └── styles.css        # Premium Glassmorphic CSS Styling
    └── js/
        ├── app.js            # Core dashboard logic & WebSocket sync
        └── auth.js           # JWT Authorization handler# thiranex_task2
