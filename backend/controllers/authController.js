const authService = require('../services/authService');

class AuthController {
  // Register user
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const result = await authService.registerUser(username, email, password);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const result = await authService.loginUser(username, password);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Get user profile
  async getProfile(req, res) {
    try {
      const result = await authService.getUserProfile(req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }
}

module.exports = new AuthController();
