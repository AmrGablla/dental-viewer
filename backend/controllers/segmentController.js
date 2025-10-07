const segmentService = require('../services/segmentService');
const path = require('path');
const fs = require('fs');

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
      
      const absolutePath = path.resolve(result.filePath);
      
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'Segment file not found on disk' });
      }

      // Get file stats for proper headers
      const stats = fs.statSync(absolutePath);
      
      // Set optimized headers for file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`);
      
      // Handle range requests for large files (enables resume/streaming)
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        
        res.status(206); // Partial Content
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Content-Length', chunksize);
        
        const stream = fs.createReadStream(absolutePath, { start, end });
        stream.pipe(res);
      } else {
        // Send full file with streaming
        const stream = fs.createReadStream(absolutePath);
        stream.pipe(res);
      }
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
