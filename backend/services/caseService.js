const db = require('../config/database');
const fs = require('fs');
const path = require('path');

class CaseService {
  // Get user cases
  async getUserCases(userId) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM cases WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, cases) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        resolve({ cases });
      });
    });
  }

  // Create new case
  async createCase(userId, caseName) {
    return new Promise((resolve, reject) => {
      const caseData = {
        user_id: userId,
        case_name: caseName,
        file_name: '',
        file_path: '',
        status: 'pending'
      };

      db.run("INSERT INTO cases (user_id, case_name, file_name, file_path, status) VALUES (?, ?, ?, ?, ?)",
        [caseData.user_id, caseData.case_name, caseData.file_name, caseData.file_path, caseData.status],
        function(err) {
          if (err) {
            return reject({ error: 'Error saving case', status: 500 });
          }

          resolve({ 
            message: 'Case created successfully',
            case: { 
              id: this.lastID, 
              ...caseData 
            }
          });
        });
    });
  }

  // Upload case with file (legacy)
  async uploadCase(userId, caseName, file) {
    return new Promise((resolve, reject) => {
      const caseData = {
        user_id: userId,
        case_name: caseName,
        file_name: file.originalname,
        file_path: file.path,
        status: 'pending'
      };

      db.run("INSERT INTO cases (user_id, case_name, file_name, file_path, status) VALUES (?, ?, ?, ?, ?)",
        [caseData.user_id, caseData.case_name, caseData.file_name, caseData.file_path, caseData.status],
        function(err) {
          if (err) {
            return reject({ error: 'Error saving case', status: 500 });
          }

          resolve({ 
            message: 'Case uploaded successfully',
            case: { 
              id: this.lastID, 
              ...caseData 
            }
          });
        });
    });
  }

  // Get specific case
  async getCase(caseId, userId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }
        resolve({ case: caseData });
      });
    });
  }

  // Delete case
  async deleteCase(caseId, userId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT file_path FROM cases WHERE id = ? AND user_id = ?", [caseId, userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        // Delete file from filesystem
        if (fs.existsSync(caseData.file_path)) {
          fs.unlinkSync(caseData.file_path);
        }

        // Delete case directory if it exists
        const caseDir = `./uploads/${caseId}`;
        if (fs.existsSync(caseDir)) {
          fs.rmSync(caseDir, { recursive: true, force: true });
        }

        // Delete from database
        db.run("DELETE FROM cases WHERE id = ? AND user_id = ?", [caseId, userId], (err) => {
          if (err) {
            return reject({ error: 'Error deleting case', status: 500 });
          }
          resolve({ message: 'Case deleted successfully' });
        });
      });
    });
  }

  // Update case file
  async updateCaseFile(caseId, userId, filePath, fileName) {
    return new Promise((resolve, reject) => {
      db.run("UPDATE cases SET file_path = ?, file_name = ? WHERE id = ?", [filePath, fileName, caseId], (err) => {
        if (err) {
          return reject({ error: 'Error updating case', status: 500 });
        }
        resolve({ 
          message: 'Case file updated successfully',
          file_path: filePath,
          file_name: fileName
        });
      });
    });
  }
}

module.exports = new CaseService();
