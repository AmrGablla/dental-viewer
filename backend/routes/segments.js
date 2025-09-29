const express = require('express');
const router = express.Router();
const segmentController = require('../controllers/segmentController');
const { authenticateToken } = require('../middleware/auth');
const { segmentUpload } = require('../config/upload');

// All routes require authentication
router.use(authenticateToken);

// Segment management
router.post('/:id/segments', segmentUpload.single('file'), segmentController.uploadSegment);
router.get('/:id/segments', segmentController.getSegments);
router.get('/:id/segments/:segmentId', segmentController.getSegment);
router.put('/:id/segments/:segmentId', segmentController.updateSegment);
router.delete('/:id/segments/:segmentId', segmentController.deleteSegment);
router.post('/:id/segments/migrate', segmentController.migrateSegments);

module.exports = router;
