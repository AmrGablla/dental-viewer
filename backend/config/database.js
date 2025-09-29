const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Cases table
    db.run(`CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      case_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Segments table
    db.run(`CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#00ff00',
      tooth_type TEXT DEFAULT 'incisor',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE
    )`);

    // Insert default admin user if not exists
    db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
      if (!row) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
          ['admin', 'admin@dental.com', hashedPassword]);
        console.log('Default admin user created');
      }
    });
  });
}

module.exports = db;
