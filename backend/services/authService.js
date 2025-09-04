const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');

class AuthService {
  // Register new user
  async registerUser(username, email, password) {
    return new Promise((resolve, reject) => {
      // Check if user already exists
      db.get("SELECT id FROM users WHERE username = ? OR email = ?", [username, email], (err, row) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (row) {
          return reject({ error: 'Username or email already exists', status: 400 });
        }

        // Hash password and create user
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
          [username, email, hashedPassword], function(err) {
          if (err) {
            return reject({ error: 'Error creating user', status: 500 });
          }

          // Generate JWT token
          const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
          resolve({ 
            message: 'User registered successfully',
            token,
            user: { id: this.lastID, username, email }
          });
        });
      });
    });
  }

  // Login user
  async loginUser(username, password) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!user) {
          return reject({ error: 'Invalid credentials', status: 401 });
        }

        const isValidPassword = bcrypt.compareSync(password, user.password);
        if (!isValidPassword) {
          return reject({ error: 'Invalid credentials', status: 401 });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        resolve({ 
          message: 'Login successful',
          token,
          user: { id: user.id, username: user.username, email: user.email }
        });
      });
    });
  }

  // Get user profile
  async getUserProfile(userId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT id, username, email, created_at FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!user) {
          return reject({ error: 'User not found', status: 404 });
        }
        resolve({ user });
      });
    });
  }
}

module.exports = new AuthService();
