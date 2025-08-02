import { Mesh, MeshLambertMaterial, DoubleSide } from 'three'
import { STLLoader } from 'three-stdlib'
import type { SegmentationResult } from '../types/dental'

export class SegmentationService {
  private readonly API_BASE_URL = 'http://localhost:8000'
  private activeSessions: Map<string, SegmentationResult> = new Map()

  /**
   * Segment a dental STL file using the backend API
   * @param file - The STL file to segment
   * @returns Promise with segmentation results
   */
  async segmentSTLFile(file: File): Promise<SegmentationResult> {
    return this.segmentSTLFileWithConfig(file, {})
  }

  /**
   * Segment a dental STL file with user configuration
   * @param file - The STL file to segment
   * @param config - User segmentation configuration
   * @returns Promise with segmentation results
   */
  async segmentSTLFileWithConfig(file: File, config: any = {}): Promise<SegmentationResult> {
    try {
      console.log('Starting STL segmentation for:', file.name, 'with config:', config)
      
      // Validate file
      if (!file.name.toLowerCase().endsWith('.stl')) {
        throw new Error('Only STL files are supported for segmentation')
      }

      // Create form data for upload
      const formData = new FormData()
      formData.append('file', file)
      
      // Add configuration as JSON
      if (Object.keys(config).length > 0) {
        formData.append('config', JSON.stringify(config))
      }

      // Send to backend API
      const response = await fetch(`${this.API_BASE_URL}/segment`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(`Segmentation failed: ${errorData.detail || response.statusText}`)
      }

      const result = await response.json()
      
      // Transform backend response to our frontend types
      const segmentationResult: SegmentationResult = {
        sessionId: result.session_id,
        originalFile: file.name,
        segments: result.segments.map((segment: any) => ({
          id: segment.id,
          name: `Tooth ${segment.id + 1}`,
          filename: segment.filename,
          pointCount: segment.point_count || segment.vertex_count,
          center: segment.center,
          volume: segment.volume || 0,
          boundingBox: segment.bounding_box,
          downloadUrl: segment.download_url,
          visible: true,
          selected: false,
          color: this.generateSegmentColor(segment.id)
        })),
        timestamp: new Date(),
        status: 'completed'
      }

      // Store in active sessions
      this.activeSessions.set(result.session_id, segmentationResult)

      console.log(`Segmentation completed: ${result.segments_count} teeth found`)
      return segmentationResult

    } catch (error) {
      console.error('Segmentation error:', error)
      throw error
    }
  }

  /**
   * Download a specific tooth segment as PLY file
   * @param sessionId - The segmentation session ID
   * @param filename - The segment filename to download
   * @returns Promise with blob data
   */
  async downloadSegment(sessionId: string, filename: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/download/${sessionId}/${filename}`)
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Download error:', error)
      throw error
    }
  }

  /**
   * Load a segmented STL file from the backend and create a Three.js mesh
   * @param sessionId - The segmentation session ID
   * @param filename - The segment filename
   * @returns Promise resolving to a Three.js Mesh
   */
  async loadSegmentAsMesh(sessionId: string, filename: string): Promise<Mesh> {
    try {
      // Fetch the segment as a blob and convert to ArrayBuffer
      const blob = await this.downloadSegment(sessionId, filename)
      const arrayBuffer = await blob.arrayBuffer()

      // Parse STL geometry
      const loader = new STLLoader()
      const geometry = loader.parse(arrayBuffer)

      // Create a basic material for the segment
      const material = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide })
      const mesh = new Mesh(geometry, material)

      // Prevent Vue from making the mesh reactive
      Object.defineProperty(mesh, '__v_skip', { value: true })

      return mesh
    } catch (error) {
      console.error('Error loading segment as mesh:', error)
      throw error
    }
  }

  /**
   * Get information about a segmentation session
   * @param sessionId - The session ID to query
   * @returns Promise with session information
   */
  async getSessionInfo(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/sessions/${sessionId}`)
      
      if (!response.ok) {
        throw new Error(`Session not found: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting session info:', error)
      throw error
    }
  }

  /**
   * Clean up a segmentation session
   * @param sessionId - The session ID to clean up
   * @returns Promise indicating success
   */
  async cleanupSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/sessions/${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        this.activeSessions.delete(sessionId)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error cleaning up session:', error)
      return false
    }
  }

  /**
   * Check if the backend API is available
   * @returns Promise with health status
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/health`)
      const data = await response.json()
      return response.ok && data.status === 'healthy'
    } catch (error) {
      console.error('Backend health check failed:', error)
      return false
    }
  }

  /**
   * Get all active segmentation sessions
   * @returns Map of active sessions
   */
  getActiveSessions(): Map<string, SegmentationResult> {
    return this.activeSessions
  }

  /**
   * Generate a color for a segment based on its ID
   * @param segmentId - The segment ID
   * @returns Color as hex string
   */
  private generateSegmentColor(segmentId: number): string {
    // Generate distinct colors for different segments
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#A29BFE', '#FD79A8', '#E17055', '#74B9FF',
      '#00B894', '#FDCB6E', '#E84393', '#6C5CE7', '#FD79A8'
    ]
    
    return colors[segmentId % colors.length]
  }
}