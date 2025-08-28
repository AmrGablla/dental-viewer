<template>
  <div class="intersection-panel" v-if="intersectionResults.length > 0">
    <div class="panel-header">
      <h3>Segment Intersections</h3>
      <div class="intersection-count">
        <span class="count-badge">{{ intersectionResults.length }}</span>
        <span class="count-label">intersections detected</span>
      </div>
    </div>

    <div class="intersection-stats" v-if="statistics">
      <div class="stat-item">
        <span class="stat-label">Total Volume:</span>
        <span class="stat-value">{{ formatVolume(statistics.totalIntersectionVolume) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Avg Penetration:</span>
        <span class="stat-value">{{ formatDistance(statistics.averagePenetrationDepth) }}</span>
      </div>
    </div>

    <div class="severity-breakdown" v-if="statistics">
      <div class="severity-item low" v-if="statistics.bySeverity.low > 0">
        <span class="severity-dot"></span>
        <span class="severity-label">Low</span>
        <span class="severity-count">{{ statistics.bySeverity.low }}</span>
      </div>
      <div class="severity-item medium" v-if="statistics.bySeverity.medium > 0">
        <span class="severity-dot"></span>
        <span class="severity-label">Medium</span>
        <span class="severity-count">{{ statistics.bySeverity.medium }}</span>
      </div>
      <div class="severity-item high" v-if="statistics.bySeverity.high > 0">
        <span class="severity-dot"></span>
        <span class="severity-label">High</span>
        <span class="severity-count">{{ statistics.bySeverity.high }}</span>
      </div>
    </div>

    <div class="intersection-list">
      <div 
        v-for="intersection in intersectionResults" 
        :key="`${intersection.segment1.id}-${intersection.segment2.id}`"
        class="intersection-item"
        :class="[intersection.severity, intersection.intersectionType]"
        @click="highlightIntersection(intersection)"
      >
        <div class="intersection-header">
          <div class="segment-names">
            <span class="segment1">{{ intersection.segment1.name }}</span>
            <span class="intersection-symbol">↔</span>
            <span class="segment2">{{ intersection.segment2.name }}</span>
          </div>
          <div class="intersection-type-badge" :class="intersection.intersectionType">
            {{ intersection.intersectionType }}
          </div>
        </div>

        <div class="intersection-details">
          <div class="detail-row">
            <span class="detail-label">Volume:</span>
            <span class="detail-value">{{ formatVolume(intersection.intersectionVolume) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Penetration:</span>
            <span class="detail-value">{{ formatDistance(intersection.penetrationDepth) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Contact Area:</span>
            <span class="detail-value">{{ formatArea(intersection.contactArea) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Points:</span>
            <span class="detail-value">{{ intersection.intersectionPoints.length }}</span>
          </div>
        </div>

        <div class="intersection-actions">
          <button 
            class="action-btn highlight-btn"
            @click.stop="highlightIntersection(intersection)"
            :title="`Highlight intersection between ${intersection.segment1.name} and ${intersection.segment2.name}`"
          >
            <Icon name="eye" />
            Highlight
          </button>
          <button 
            class="action-btn isolate-btn"
            @click.stop="isolateSegments(intersection)"
            :title="`Show only ${intersection.segment1.name} and ${intersection.segment2.name}`"
          >
            <Icon name="focus" />
            Isolate
          </button>
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <button class="action-btn clear-btn" @click="clearVisualizations">
        <Icon name="x" />
        Clear Visualizations
      </button>
      <button class="action-btn export-btn" @click="exportIntersectionData">
        <Icon name="download" />
        Export Data
      </button>
    </div>
  </div>

  <div class="no-intersections" v-else-if="showNoIntersections">
    <div class="no-intersections-content">
      <Icon name="check-circle" class="success-icon" />
      <h3>No Intersections Detected</h3>
      <p>All segments are properly positioned with no overlaps or collisions.</p>
    </div>
  </div>
</template>

<script setup lang="ts">

import Icon from './Icon.vue';
import type { IntersectionResult, IntersectionStatistics } from '../types/dental';

interface Props {
  intersectionResults: IntersectionResult[];
  statistics: IntersectionStatistics | null;
  showNoIntersections?: boolean;
}

interface Emits {
  (e: 'highlight', intersection: IntersectionResult): void;
  (e: 'isolate', intersection: IntersectionResult): void;
  (e: 'clear-visualizations'): void;
  (e: 'export-data'): void;
}

withDefaults(defineProps<Props>(), {
  showNoIntersections: true
});

const emit = defineEmits<Emits>();

const formatVolume = (volume: number): string => {
  if (volume < 0.001) {
    return `${(volume * 1000000).toFixed(2)} mm³`;
  } else if (volume < 1) {
    return `${(volume * 1000).toFixed(2)} mm³`;
  } else {
    return `${volume.toFixed(2)} mm³`;
  }
};

const formatDistance = (distance: number): string => {
  if (distance < 0.1) {
    return `${(distance * 1000).toFixed(1)} μm`;
  } else if (distance < 1) {
    return `${(distance * 100).toFixed(1)} μm`;
  } else {
    return `${distance.toFixed(2)} mm`;
  }
};

const formatArea = (area: number): string => {
  if (area < 0.01) {
    return `${(area * 10000).toFixed(1)} mm²`;
  } else if (area < 1) {
    return `${(area * 100).toFixed(1)} mm²`;
  } else {
    return `${area.toFixed(2)} mm²`;
  }
};

const highlightIntersection = (intersection: IntersectionResult) => {
  emit('highlight', intersection);
};

const isolateSegments = (intersection: IntersectionResult) => {
  emit('isolate', intersection);
};

const clearVisualizations = () => {
  emit('clear-visualizations');
};

const exportIntersectionData = () => {
  emit('export-data');
};
</script>

<style scoped>
.intersection-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px;
  margin: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  max-height: 80vh;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.panel-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
}

.intersection-count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  background: #e74c3c;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.count-label {
  font-size: 12px;
  color: #7f8c8d;
}

.intersection-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(52, 152, 219, 0.1);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 12px;
  color: #7f8c8d;
  font-weight: 500;
}

.stat-value {
  font-size: 14px;
  color: #2c3e50;
  font-weight: 600;
}

.severity-breakdown {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}

.severity-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.severity-item.low {
  background: rgba(46, 204, 113, 0.2);
  color: #27ae60;
}

.severity-item.medium {
  background: rgba(241, 196, 15, 0.2);
  color: #f39c12;
}

.severity-item.high {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.severity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.intersection-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.intersection-item {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.intersection-item:hover {
  border-color: #3498db;
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.2);
  transform: translateY(-1px);
}

.intersection-item.low {
  border-left: 4px solid #27ae60;
}

.intersection-item.medium {
  border-left: 4px solid #f39c12;
}

.intersection-item.high {
  border-left: 4px solid #e74c3c;
}

.intersection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.segment-names {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #2c3e50;
}

.intersection-symbol {
  color: #7f8c8d;
  font-size: 14px;
}

.intersection-type-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.intersection-type-badge.contact {
  background: rgba(46, 204, 113, 0.2);
  color: #27ae60;
}

.intersection-type-badge.overlap {
  background: rgba(241, 196, 15, 0.2);
  color: #f39c12;
}

.intersection-type-badge.collision {
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.intersection-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 11px;
  color: #7f8c8d;
  font-weight: 500;
}

.detail-value {
  font-size: 12px;
  color: #2c3e50;
  font-weight: 600;
}

.intersection-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  background: white;
  color: #7f8c8d;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  border-color: #3498db;
  color: #3498db;
  background: rgba(52, 152, 219, 0.05);
}

.highlight-btn:hover {
  border-color: #f39c12;
  color: #f39c12;
  background: rgba(241, 196, 15, 0.05);
}

.isolate-btn:hover {
  border-color: #9b59b6;
  color: #9b59b6;
  background: rgba(155, 89, 182, 0.05);
}

.panel-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.clear-btn:hover {
  border-color: #e74c3c;
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.05);
}

.export-btn:hover {
  border-color: #27ae60;
  color: #27ae60;
  background: rgba(39, 174, 96, 0.05);
}

.no-intersections {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 32px;
  margin: 16px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.no-intersections-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.success-icon {
  width: 48px;
  height: 48px;
  color: #27ae60;
}

.no-intersections h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
}

.no-intersections p {
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
  line-height: 1.5;
}

/* Scrollbar styling */
.intersection-panel::-webkit-scrollbar {
  width: 6px;
}

.intersection-panel::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.intersection-panel::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.intersection-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>
