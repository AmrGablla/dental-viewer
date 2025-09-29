const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const { authenticateToken } = require('../middleware/auth');
const { upload, rawUpload } = require('../config/upload');

// All routes require authentication
router.use(authenticateToken);

// Case management
router.get('/', caseController.getUserCases);
router.post('/', caseController.createCase);
router.post('/upload', upload.single('file'), caseController.uploadCase);
router.get('/:id', caseController.getCase);
router.delete('/:id', caseController.deleteCase);

// File management
router.post('/:id/raw', rawUpload.single('file'), caseController.uploadRawFile);
router.get('/:id/raw', caseController.getRawFile);

module.exports = router;
