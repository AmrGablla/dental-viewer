const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

// Debug routes (development only)
router.get('/segments/:caseId', authenticateToken, (req, res) => {
  const caseId = req.params.caseId;
  
  db.all("SELECT * FROM segments WHERE case_id = ?", [parseInt(caseId)], (err, segments) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    res.json({ 
      caseId: caseId,
      segments: segments,
      count: segments.length
    });
  });
});

module.exports = router;
