import type { SavedProject } from '../types/geometry';
import { DEFAULT_DIMENSIONS } from '../engine/geometry';
import { createDefaultOrientation, createDefaultPosition } from '../engine/orientation';

const STORAGE_KEY = 'eg_studio_projects_v1';

/**
 * Storage adapter interface designed so localStorage can be swapped
 * cleanly for a Supabase client in a future iteration.
 */
export interface ProjectStorageAdapter {
  list(): SavedProject[];
  saveAll(projects: SavedProject[]): void;
}

const DEFAULT_SAMPLE_PROJECTS: SavedProject[] = [
  {
    id: 'sample_hex_prism_ktu',
    name: 'KTU Hexagonal Prism (30° HP, 45° VP)',
    createdAt: '2026-10-15T09:30:00.000Z',
    updatedAt: '2026-10-15T09:30:00.000Z',
    solidType: 'hexagonal_prism',
    dimensions: { ...DEFAULT_DIMENSIONS, sideLength: 30, axisLength: 60, numSides: 6 },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_edge_hp',
      alphaHP: 30,
      betaVP: 45,
      referenceEdgeId: 'edge_base_0',
    },
    position: createDefaultPosition(),
    drawingSettings: {
      convention: 'first_angle',
      showHidden: true,
      showConstruction: true,
      showDimensions: true,
      showLabels: true,
      drawingTitle: 'Hexagonal Prism — 30° HP / 45° VP',
      scaleLabel: '1:1 (mm)',
    },
  },
  {
    id: 'sample_sq_pyramid_simple',
    name: 'Square Pyramid — Simple Position on HP',
    createdAt: '2026-10-18T14:15:00.000Z',
    updatedAt: '2026-10-18T14:15:00.000Z',
    solidType: 'square_pyramid',
    dimensions: { ...DEFAULT_DIMENSIONS, sideLength: 35, axisLength: 60, numSides: 4 },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_hp',
      alphaHP: 90,
      betaVP: 0,
    },
    position: createDefaultPosition(),
    drawingSettings: {
      convention: 'first_angle',
      showHidden: true,
      showConstruction: true,
      showDimensions: true,
      showLabels: true,
      drawingTitle: 'Square Pyramid — Resting on HP',
      scaleLabel: '1:1 (mm)',
    },
  },
];

export const localProjectStorage: ProjectStorageAdapter = {
  list(): SavedProject[] {
    if (typeof window === 'undefined') return DEFAULT_SAMPLE_PROJECTS;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SAMPLE_PROJECTS));
        return DEFAULT_SAMPLE_PROJECTS;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_SAMPLE_PROJECTS;
    } catch {
      return DEFAULT_SAMPLE_PROJECTS;
    }
  },

  saveAll(projects: SavedProject[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors silently
    }
  },
};
