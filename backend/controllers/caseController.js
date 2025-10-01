const caseService = require('../services/caseService');
const path = require('path');

class CaseController {
  // Get user cases
  async getUserCases(req, res) {
    try {
      const result = await caseService.getUserCases(req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Create new case
  async createCase(req, res) {
    try {
      const { case_name } = req.body;
      if (!case_name) {
        return res.status(400).json({ error: 'Case name is required' });
      }

      const result = await caseService.createCase(req.user.id, case_name);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Upload case with file (legacy)
  async uploadCase(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { case_name } = req.body;
      if (!case_name) {
        return res.status(400).json({ error: 'Case name is required' });
      }

      const result = await caseService.uploadCase(req.user.id, case_name, req.file);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Get specific case
  async getCase(req, res) {
    try {
      const caseId = req.params.id;
      const result = await caseService.getCase(caseId, req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Delete case
  async deleteCase(req, res) {
    try {
      const caseId = req.params.id;
      const result = await caseService.deleteCase(caseId, req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Upload raw file for existing case
  async uploadRawFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const caseId = req.params.id;
      const result = await caseService.updateCaseFile(caseId, req.user.id, req.file.path, req.file.originalname);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Get raw file for case
  async getRawFile(req, res) {
    try {
      const caseId = req.params.id;
      const result = await caseService.getCase(caseId, req.user.id);
      
      const filePath = result.case.file_path;
      if (!filePath) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.sendFile(path.resolve(__dirname, '..', filePath));
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }
}

module.exports = new CaseController();
