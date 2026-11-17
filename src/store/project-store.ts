import { create } from 'zustand';
import type {
  AppSection,
  CameraPreset,
  DrawingSettings,
  OrientationState,
  PositionState,
  SavedProject,
  SelectedFeature,
  SolidDimensions,
  SolidType,
} from '../types/geometry';
import { DEFAULT_DIMENSIONS, getSolidCatalogItem } from '../engine/geometry';
import { KTU_ISOMETRIC_PRESETS, type IsometricProblemInput } from '../engine/isometric';
import { KTU_LINE_PRESETS } from '../engine/lines';
import { createDefaultOrientation, createDefaultPosition } from '../engine/orientation';
import { KTU_SECTION_PRESETS, type SectionProblemInput } from '../engine/section';
import { localProjectStorage } from '../lib/storage';
import type { LineProblemInput } from '../types/geometry';

export type WizardStep = 0 | 'ai' | 1 | 2 | 3 | 4 | 5 | 6;

interface EgStudioState {
  activeSection: AppSection;
  wizardStep: WizardStep;
  learnSourceMode: 'bank' | 'workspace';
  solidType: SolidType;
  dimensions: SolidDimensions;
  orientation: OrientationState;
  position: PositionState;
  linesInput: LineProblemInput;
  sectionInput: SectionProblemInput;
  isometricInput: IsometricProblemInput;
  selectedFeature: SelectedFeature;
  drawingSettings: DrawingSettings;
  cameraRequest: { preset: CameraPreset; nonce: number };
  projects: SavedProject[];
  activeProjectId: string | null;

  // Navigation & actions
  setActiveSection: (section: AppSection) => void;
  setWizardStep: (step: WizardStep) => void;
  startNewDrawing: () => void;
  openAiQuestionSolver: () => void;
  startManualSolid: () => void;
  setLinesInput: (input: LineProblemInput) => void;
  setSectionInput: (input: SectionProblemInput) => void;
  setIsometricInput: (input: IsometricProblemInput) => void;
  setLearnSourceMode: (mode: 'bank' | 'workspace') => void;
  selectSolidType: (type: SolidType, openWorkspace?: boolean) => void;
  setSolidTypeKeepConfig: (type: SolidType) => void;
  updateDimensions: (partial: Partial<SolidDimensions>) => void;
  updateOrientation: (partial: Partial<OrientationState>) => void;
  resetOrientation: () => void;
  updatePosition: (partial: Partial<PositionState>) => void;
  setSelectedFeature: (feature: SelectedFeature) => void;
  updateDrawingSettings: (partial: Partial<DrawingSettings>) => void;
  triggerCameraPreset: (preset: CameraPreset) => void;

  // Load a complete KTU problem or preset into Workspace
  loadConfiguration: (config: {
    solidType: SolidType;
    dimensions: SolidDimensions;
    orientation: OrientationState;
    position: PositionState;
    title?: string;
    openWorkspace?: boolean;
  }) => void;

  // Project CRUD
  saveCurrentProject: (name: string) => SavedProject;
  renameProject: (id: string, newName: string) => void;
  openProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
}

export const useProjectStore = create<EgStudioState>((set, get) => ({
  activeSection: 'home',
  wizardStep: 0,
  learnSourceMode: 'bank',
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
  linesInput: KTU_LINE_PRESETS[0].input,
  sectionInput: KTU_SECTION_PRESETS[0].input,
  isometricInput: KTU_ISOMETRIC_PRESETS[0].input,
  selectedFeature: { kind: 'axis' },
  drawingSettings: {
    convention: 'first_angle',
    showHidden: true,
    showConstruction: true,
    showDimensions: true,
    showLabels: true,
    drawingTitle: 'Hexagonal Prism — 30° HP / 45° VP',
    scaleLabel: '1:1 (mm)',
  },
  cameraRequest: { preset: 'isometric', nonce: 0 },
  projects: localProjectStorage.list(),
  activeProjectId: null,

  setActiveSection: (section) => set({ activeSection: section }),

  setWizardStep: (step) => set({ wizardStep: step }),

  startNewDrawing: () => set({ activeSection: 'solids', wizardStep: 0 }),

  openAiQuestionSolver: () => set({ activeSection: 'solids', wizardStep: 'ai' }),

  startManualSolid: () => set({ activeSection: 'solids', wizardStep: 1 }),

  setLinesInput: (linesInput) => set({ linesInput }),

  setSectionInput: (sectionInput) => set({ sectionInput }),

  setIsometricInput: (isometricInput) => set({ isometricInput }),

  setLearnSourceMode: (mode) => set({ learnSourceMode: mode }),

  selectSolidType: (type, openWorkspace = false) => {
    const item = getSolidCatalogItem(type);
    set((state) => ({
      solidType: type,
      dimensions: { ...item.defaultDimensions },
      selectedFeature: { kind: 'axis' },
      orientation: {
        ...createDefaultOrientation(),
        restingCondition: 'base_hp',
        alphaHP: 90,
        betaVP: 0,
      },
      drawingSettings: {
        ...state.drawingSettings,
        drawingTitle: `${item.name} — Orthographic Projection`,
      },
      activeSection: openWorkspace ? 'workspace' : state.activeSection,
      activeProjectId: null,
    }));
  },

  setSolidTypeKeepConfig: (type) => {
    const item = getSolidCatalogItem(type);
    set((state) => ({
      solidType: type,
      dimensions:
        type === 'cube'
          ? { ...state.dimensions, baseWidth: state.dimensions.sideLength, axisLength: state.dimensions.sideLength, rectangularBase: false }
          : type === 'hemisphere'
            ? { ...state.dimensions, axisLength: state.dimensions.baseRadius }
            : state.dimensions,
      selectedFeature: { kind: 'axis' },
      drawingSettings: {
        ...state.drawingSettings,
        drawingTitle: `${item.name} — Orthographic Projection`,
      },
    }));
  },

  updateDimensions: (partial) =>
    set((state) => {
      const next = { ...state.dimensions, ...partial };
      if (state.solidType === 'cube' && partial.sideLength !== undefined) {
        next.baseWidth = partial.sideLength;
        next.axisLength = partial.sideLength;
        next.rectangularBase = false;
      } else if (state.solidType === 'hemisphere' && partial.baseRadius !== undefined) {
        next.axisLength = partial.baseRadius;
      }
      return { dimensions: next };
    }),

  updateOrientation: (partial) =>
    set((state) => ({
      orientation: { ...state.orientation, ...partial },
    })),

  resetOrientation: () =>
    set({
      orientation: createDefaultOrientation(),
      position: createDefaultPosition(),
      selectedFeature: { kind: 'axis' },
    }),

  updatePosition: (partial) =>
    set((state) => ({
      position: { ...state.position, ...partial },
    })),

  setSelectedFeature: (feature) => set({ selectedFeature: feature }),

  updateDrawingSettings: (partial) =>
    set((state) => ({
      drawingSettings: { ...state.drawingSettings, ...partial },
    })),

  triggerCameraPreset: (preset) =>
    set((state) => ({
      cameraRequest: { preset, nonce: state.cameraRequest.nonce + 1 },
    })),

  loadConfiguration: ({ solidType, dimensions, orientation, position, title, openWorkspace }) =>
    set((state) => ({
      solidType,
      dimensions: { ...dimensions },
      orientation: { ...orientation },
      position: { ...position },
      selectedFeature: { kind: 'axis' },
      drawingSettings: {
        ...state.drawingSettings,
        drawingTitle: title ?? `${getSolidCatalogItem(solidType).name} — Orthographic Projection`,
      },
      activeSection: openWorkspace ? 'workspace' : state.activeSection,
    })),

  saveCurrentProject: (name) => {
    const state = get();
    const now = new Date().toISOString();
    const existing = state.activeProjectId
      ? state.projects.find((p) => p.id === state.activeProjectId)
      : undefined;

    let updatedProjects: SavedProject[];
    let saved: SavedProject;

    if (existing && existing.name === name.trim()) {
      saved = {
        ...existing,
        updatedAt: now,
        solidType: state.solidType,
        dimensions: { ...state.dimensions },
        orientation: { ...state.orientation },
        position: { ...state.position },
        drawingSettings: { ...state.drawingSettings },
      };
      updatedProjects = state.projects.map((p) => (p.id === saved.id ? saved : p));
    } else {
      saved = {
        id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim() || `${getSolidCatalogItem(state.solidType).name} Project`,
        createdAt: now,
        updatedAt: now,
        solidType: state.solidType,
        dimensions: { ...state.dimensions },
        orientation: { ...state.orientation },
        position: { ...state.position },
        drawingSettings: { ...state.drawingSettings },
      };
      updatedProjects = [saved, ...state.projects];
    }

    localProjectStorage.saveAll(updatedProjects);
    set({ projects: updatedProjects, activeProjectId: saved.id });
    return saved;
  },

  renameProject: (id, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const updated = get().projects.map((p) =>
      p.id === id ? { ...p, name: trimmed, updatedAt: new Date().toISOString() } : p
    );
    localProjectStorage.saveAll(updated);
    set({ projects: updated });
  },

  openProject: (id) => {
    const proj = get().projects.find((p) => p.id === id);
    if (!proj) return;
    set({
      activeProjectId: proj.id,
      solidType: proj.solidType,
      dimensions: { ...proj.dimensions },
      orientation: { ...proj.orientation },
      position: { ...proj.position },
      drawingSettings: { ...proj.drawingSettings },
      selectedFeature: { kind: 'axis' },
      activeSection: 'workspace',
    });
  },

  duplicateProject: (id) => {
    const proj = get().projects.find((p) => p.id === id);
    if (!proj) return;
    const now = new Date().toISOString();
    const copy: SavedProject = {
      ...proj,
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `${proj.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [copy, ...get().projects];
    localProjectStorage.saveAll(updated);
    set({ projects: updated });
  },

  deleteProject: (id) => {
    const updated = get().projects.filter((p) => p.id !== id);
    localProjectStorage.saveAll(updated);
    set((state) => ({
      projects: updated,
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    }));
  },
}));
