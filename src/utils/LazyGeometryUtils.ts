/**
 * Lazy-loaded geometry utilities to reduce initial bundle size
 * Heavy computational functions are loaded only when needed
 */
export class LazyGeometryUtils {
  private static _heavyUtils: any = null

  /**
   * Lazy load heavy computational utilities
   */
  private static async loadHeavyUtils() {
    if (!this._heavyUtils) {
      // Dynamic import of the full GeometryUtils only when needed
      const { GeometryUtils } = await import('./GeometryUtils')
      this._heavyUtils = GeometryUtils
    }
    return this._heavyUtils
  }

  /**
   * Lazy-loaded DBSCAN clustering
   */
  static async dbscanClustering(
    vertices: any[],
    epsilon: number = 2.0,
    minPoints: number = 5
  ) {
    const utils = await this.loadHeavyUtils()
    return utils.dbscanClustering(vertices, epsilon, minPoints)
  }

  /**
   * Lazy-loaded curvature calculation
   */
  static async calculateGaussianCurvature(
    vertexIndex: number,
    position: any,
    normal: any
  ) {
    const utils = await this.loadHeavyUtils()
    return utils.calculateGaussianCurvature(vertexIndex, position, normal)
  }

  /**
   * Lazy-loaded mean curvature calculation
   */
  static async calculateMeanCurvature(
    vertexIndex: number,
    position: any,
    normal: any
  ) {
    const utils = await this.loadHeavyUtils()
    return utils.calculateMeanCurvature(vertexIndex, position, normal)
  }

  /**
   * Lazy-loaded Laplacian smoothing
   */
  static async laplacianSmoothing(
    geometry: any,
    iterations: number = 1,
    factor: number = 0.1
  ) {
    const utils = await this.loadHeavyUtils()
    return utils.laplacianSmoothing(geometry, iterations, factor)
  }
}
