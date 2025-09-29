const segmentService = require('../services/segmentService');
const path = require('path');

class SegmentController {
  // Upload segment file for case
  async uploadSegment(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const caseId = req.params.id;
      const metadata = {
        name: req.body.name,
        color: req.body.color,
        tooth_type: req.body.tooth_type
      };

      const result = await segmentService.uploadSegment(caseId, req.user.id, req.file, metadata);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Get segments list for case
  async getSegments(req, res) {
    try {
      const caseId = req.params.id;
      const result = await segmentService.getSegments(caseId, req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Get specific segment file
  async getSegment(req, res) {
    try {
      const caseId = req.params.id;
      const segmentId = req.params.segmentId;
      const result = await segmentService.getSegment(caseId, segmentId, req.user.id);
      res.sendFile(path.resolve(result.filePath));
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Update segment metadata
  async updateSegment(req, res) {
    try {
      const caseId = req.params.id;
      const segmentId = req.params.segmentId;
      const updates = req.body;

      const result = await segmentService.updateSegment(caseId, segmentId, req.user.id, updates);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Delete segment
  async deleteSegment(req, res) {
    try {
      const caseId = req.params.id;
      const segmentId = req.params.segmentId;
      const result = await segmentService.deleteSegment(caseId, segmentId, req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }

  // Migrate existing segments to database
  async migrateSegments(req, res) {
    try {
      const caseId = req.params.id;
      const result = await segmentService.migrateSegments(caseId, req.user.id);
      res.json(result);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.error || 'Server error' });
    }
  }
}

module.exports = new SegmentController();
