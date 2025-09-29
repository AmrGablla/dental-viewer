const db = require('../config/database');
const fs = require('fs');
const path = require('path');

class SegmentService {
  // Upload segment file
  async uploadSegment(caseId, userId, file, metadata) {
    return new Promise((resolve, reject) => {
      // Verify case exists and belongs to user
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        // Extract segment name from filename or use default
        const segmentName = metadata.name || file.filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, '');
        
        // Save segment metadata to database
        db.run(
          "INSERT INTO segments (case_id, filename, name, color, tooth_type) VALUES (?, ?, ?, ?, ?)",
          [parseInt(caseId), file.filename, segmentName, metadata.color || '#00ff00', metadata.tooth_type || 'incisor'],
          function(err) {
            if (err) {
              console.error('Error saving segment metadata:', err);
              return reject({ error: 'Failed to save segment metadata', status: 500 });
            }

            resolve({ 
              message: 'Segment file uploaded successfully',
              file_path: file.path,
              filename: file.filename,
              segment_id: this.lastID,
              name: segmentName
            });
          }
        );
      });
    });
  }

  // Get segments list for case
  async getSegments(caseId, userId) {
    return new Promise((resolve, reject) => {
      // Verify case exists and belongs to user
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        // Get segments from database
        db.all("SELECT * FROM segments WHERE case_id = ? ORDER BY created_at ASC", [parseInt(caseId)], (err, segments) => {
          if (err) {
            return reject({ error: 'Error reading segments from database', status: 500 });
          }

          // Check if files still exist and add file info
          const segmentsWithFileInfo = segments.map(segment => {
            const filePath = `./uploads/${caseId}/segments/${segment.filename}`;
            const fileExists = fs.existsSync(filePath);
            
            return {
              id: segment.id,
              name: segment.name,
              filename: segment.filename,
              color: segment.color,
              tooth_type: segment.tooth_type,
              created_at: segment.created_at,
              updated_at: segment.updated_at,
              file_exists: fileExists
            };
          });

          // If no segments in database, check filesystem for backward compatibility
          if (segmentsWithFileInfo.length === 0) {
            const segmentsDir = `./uploads/${caseId}/segments`;
            if (fs.existsSync(segmentsDir)) {
              fs.readdir(segmentsDir, (err, files) => {
                if (err) {
                  return resolve({ segments: [] });
                }

                const legacySegments = files.map(filename => ({
                  id: filename,
                  name: filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, ''),
                  filename: filename,
                  color: '#00ff00',
                  tooth_type: 'incisor',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  file_exists: true
                }));

                resolve({ segments: legacySegments });
              });
            } else {
              resolve({ segments: [] });
            }
          } else {
            resolve({ segments: segmentsWithFileInfo });
          }
        });
      });
    });
  }

  // Get specific segment
  async getSegment(caseId, segmentId, userId) {
    return new Promise((resolve, reject) => {
      // Verify case exists and belongs to user
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        // Get segment info from database
        db.get("SELECT * FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], (err, segment) => {
          if (err) {
            return reject({ error: 'Database error', status: 500 });
          }
          if (!segment) {
            return reject({ error: 'Segment not found', status: 404 });
          }

          const filePath = `./uploads/${caseId}/segments/${segment.filename}`;
          
          if (!fs.existsSync(filePath)) {
            return reject({ error: 'Segment file not found', status: 404 });
          }

          resolve({ segment, filePath });
        });
      });
    });
  }

  // Update segment metadata
  async updateSegment(caseId, segmentId, userId, updates) {
    return new Promise((resolve, reject) => {
      // Verify case exists and belongs to user
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        // Verify segment exists and belongs to this case
        db.get("SELECT * FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], (err, segment) => {
          if (err) {
            return reject({ error: 'Database error', status: 500 });
          }
          if (!segment) {
            return reject({ error: 'Segment not found', status: 404 });
          }

          // Update segment metadata
          const { name, color, tooth_type } = updates;
          const updateFields = [];
          const values = [];
          
          if (name !== undefined) {
            updateFields.push('name = ?');
            values.push(name);
          }
          if (color !== undefined) {
            updateFields.push('color = ?');
            values.push(color);
          }
          if (tooth_type !== undefined) {
            updateFields.push('tooth_type = ?');
            values.push(tooth_type);
          }
          
          if (updateFields.length === 0) {
            return reject({ error: 'No fields to update', status: 400 });
          }
          
          updateFields.push('updated_at = CURRENT_TIMESTAMP');
          values.push(parseInt(segmentId), parseInt(caseId));
          
          const query = `UPDATE segments SET ${updateFields.join(', ')} WHERE id = ? AND case_id = ?`;
          
          db.run(query, values, function(err) {
            if (err) {
              return reject({ error: 'Failed to update segment', status: 500 });
            }
            
            resolve({ 
              message: 'Segment updated successfully',
              segment_id: segmentId
            });
          });
        });
      });
    });
  }

  // Delete segment
  async deleteSegment(caseId, segmentId, userId) {
    return new Promise((resolve, reject) => {
      // Verify case exists and belongs to user
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [parseInt(caseId), userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        // Get segment info before deletion
        db.get("SELECT * FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], (err, segment) => {
          if (err) {
            return reject({ error: 'Database error', status: 500 });
          }
          if (!segment) {
            return reject({ error: 'Segment not found', status: 404 });
          }

          // Delete segment file
          const filePath = `./uploads/${caseId}/segments/${segment.filename}`;
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          // Delete segment from database
          db.run("DELETE FROM segments WHERE id = ? AND case_id = ?", [parseInt(segmentId), parseInt(caseId)], function(err) {
            if (err) {
              return reject({ error: 'Failed to delete segment', status: 500 });
            }
            
            resolve({ 
              message: 'Segment deleted successfully',
              segment_id: segmentId
            });
          });
        });
      });
    });
  }

  // Migrate existing segments to database
  async migrateSegments(caseId, userId) {
    return new Promise((resolve, reject) => {
      // Verify case exists and belongs to user
      db.get("SELECT * FROM cases WHERE id = ? AND user_id = ?", [caseId, userId], (err, caseData) => {
        if (err) {
          return reject({ error: 'Database error', status: 500 });
        }
        if (!caseData) {
          return reject({ error: 'Case not found', status: 404 });
        }

        const segmentsDir = `./uploads/${caseId}/segments`;
        if (!fs.existsSync(segmentsDir)) {
          return resolve({ message: 'No segments directory found', migrated: 0 });
        }

        fs.readdir(segmentsDir, (err, files) => {
          if (err) {
            return reject({ error: 'Error reading segments directory', status: 500 });
          }

          let migratedCount = 0;
          const stlFiles = files.filter(file => file.endsWith('.stl'));

          if (stlFiles.length === 0) {
            return resolve({ message: 'No STL files found', migrated: 0 });
          }

          // Check which files are already in database
          db.all("SELECT filename FROM segments WHERE case_id = ?", [parseInt(caseId)], (err, existingSegments) => {
            if (err) {
              return reject({ error: 'Database error', status: 500 });
            }

            const existingFilenames = existingSegments.map(s => s.filename);
            const newFiles = stlFiles.filter(file => !existingFilenames.includes(file));

            if (newFiles.length === 0) {
              return resolve({ message: 'All segments already migrated', migrated: 0 });
            }

            // Insert new segments into database
            let completed = 0;
            newFiles.forEach(filename => {
              const segmentName = filename.replace(/^segment-/, '').replace(/\.[^/.]+$/, '');
              
              db.run(
                "INSERT INTO segments (case_id, filename, name, color, tooth_type) VALUES (?, ?, ?, ?, ?)",
                [parseInt(caseId), filename, segmentName, '#00ff00', 'incisor'],
                function(err) {
                  if (err) {
                    console.error('Error migrating segment:', err);
                  } else {
                    migratedCount++;
                  }
                  
                  completed++;
                  if (completed === newFiles.length) {
                    resolve({ 
                      message: `Migrated ${migratedCount} segments to database`,
                      migrated: migratedCount
                    });
                  }
                }
              );
            });
          });
        });
      });
    });
  }
}

module.exports = new SegmentService();
