import {
  BookOpen,
  Download,
  Eye,
  EyeOff,
  Layers,
  Ruler,
  Save,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildLocalSolid, getSolidCatalogItem } from '../../engine/geometry';
import { KTU_QUESTION_BANK } from '../../engine/learning';
import { solveOrientation, transformSolid } from '../../engine/orientation';
import { generateOrthographicDrawing } from '../../engine/projection';
import {
  exportDrawingPDF,
  exportDrawingPNG,
  exportDrawingSVG,
  type ExportMode,
} from '../../lib/export';
import { useProjectStore } from '../../store/project-store';
import { OrientationPanel } from '../controls/OrientationPanel';
import { DrawingPanel2D } from '../projection-views/DrawingPanel2D';
import { Viewport3D } from '../viewport/Viewport3D';

export function WorkspaceView() {
  const solidType = useProjectStore((s) => s.solidType);
  const dimensions = useProjectStore((s) => s.dimensions);
  const orientation = useProjectStore((s) => s.orientation);
  const position = useProjectStore((s) => s.position);
  const selectedFeature = useProjectStore((s) => s.selectedFeature);
  const drawingSettings = useProjectStore((s) => s.drawingSettings);
  const cameraRequest = useProjectStore((s) => s.cameraRequest);

  const setSelectedFeature = useProjectStore((s) => s.setSelectedFeature);
  const updateDrawingSettings = useProjectStore((s) => s.updateDrawingSettings);
  const triggerCameraPreset = useProjectStore((s) => s.triggerCameraPreset);
  const setActiveSection = useProjectStore((s) => s.setActiveSection);
  const startNewDrawing = useProjectStore((s) => s.startNewDrawing);
  const setLearnSourceMode = useProjectStore((s) => s.setLearnSourceMode);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const loadConfiguration = useProjectStore((s) => s.loadConfiguration);

  const [viewLayout, setViewLayout] = useState<'split_views' | 'combined_sheet'>('split_views');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('with_construction');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showExportMenu]);

  const solidItem = getSolidCatalogItem(solidType);

  const { localSolid, worldSolid, validation, drawing } = useMemo(() => {
    const local = buildLocalSolid(solidType, dimensions);
    const solved = solveOrientation(local, orientation, position, selectedFeature);
    const world = transformSolid(local, solved.quaternion, position);
    const ortho = generateOrthographicDrawing(world, drawingSettings.convention);
    return {
      localSolid: local,
      worldSolid: world,
      validation: solved.validation,
      drawing: ortho,
    };
  }, [solidType, dimensions, orientation, position, selectedFeature, drawingSettings.convention]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveCurrentProject(projectNameInput || drawingSettings.drawingTitle);
    setShowSaveDialog(false);
    setSaveNotice(`Saved "${saved.name}"`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const slugName = solidItem.name.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-slate-50">
      {/* Workspace Action & Drawing Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-display font-semibold text-slate-900 truncate">
              <span>{solidItem.name}</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-mono text-xs font-normal text-slate-500 tabular-nums">
                {localSolid.isCurved
                  ? `R ${dimensions.baseRadius} mm · Axis ${dimensions.axisLength} mm`
                  : `Side ${dimensions.sideLength} mm · Axis ${dimensions.axisLength} mm`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={startNewDrawing}
            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            Change Solid
          </button>

          <select
            aria-label="Load KTU Example Problem"
            defaultValue=""
            onChange={(e) => {
              const prob = KTU_QUESTION_BANK.find((p) => p.id === e.target.value);
              if (prob) {
                loadConfiguration({
                  solidType: prob.solidType,
                  dimensions: prob.dimensions,
                  orientation: prob.orientation,
                  position: prob.position,
                  title: prob.title,
                });
              }
              e.target.value = '';
            }}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer max-w-[220px] truncate"
          >
            <option value="" disabled>
              Load KTU Example...
            </option>
            {KTU_QUESTION_BANK.map((prob) => (
              <option key={prob.id} value={prob.id}>
                {prob.title}
              </option>
            ))}
          </select>
        </div>

        {/* Drawing & Export Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Drawing Toggles */}
          <button
            type="button"
            onClick={() => updateDrawingSettings({ showHidden: !drawingSettings.showHidden })}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawingSettings.showHidden
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle dashed hidden edges"
          >
            {drawingSettings.showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            Hidden Lines
          </button>

          <button
            type="button"
            onClick={() =>
              updateDrawingSettings({ showConstruction: !drawingSettings.showConstruction })
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawingSettings.showConstruction
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle projectors & axis centerline"
          >
            <Layers className="w-3.5 h-3.5" />
            Construction
          </button>

          <button
            type="button"
            onClick={() =>
              updateDrawingSettings({ showDimensions: !drawingSettings.showDimensions })
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawingSettings.showDimensions
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle drawing dimensions"
          >
            <Ruler className="w-3.5 h-3.5" />
            Dimensions
          </button>

          <button
            type="button"
            onClick={() => updateDrawingSettings({ showLabels: !drawingSettings.showLabels })}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawingSettings.showLabels
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle vertex labels (a, b, a', b')"
          >
            <Tag className="w-3.5 h-3.5" />
            Labels
          </button>

          <select
            value={drawingSettings.convention}
            onChange={(e) =>
              updateDrawingSettings({
                convention: e.target.value as 'first_angle' | 'third_angle',
              })
            }
            aria-label="Projection convention"
            className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 cursor-pointer"
          >
            <option value="first_angle">First-Angle (KTU)</option>
            <option value="third_angle">Third-Angle</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setLearnSourceMode('workspace');
              setActiveSection('learn');
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Step-by-Step Guide
          </button>

          <button
            type="button"
            onClick={() => {
              setProjectNameInput(drawingSettings.drawingTitle);
              setShowSaveDialog(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                    Drawing Export Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-md text-xs">
                    <button
                      type="button"
                      onClick={() => setExportMode('clean')}
                      className={`py-1 rounded font-medium cursor-pointer ${
                        exportMode === 'clean' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Clean Final
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportMode('with_construction')}
                      className={`py-1 rounded font-medium cursor-pointer ${
                        exportMode === 'with_construction'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Construction
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      exportDrawingSVG(
                        { drawing, settings: drawingSettings, mode: exportMode, solidName: solidItem.name },
                        `${slugName}-drawing.svg`
                      );
                      setShowExportMenu(false);
                      setSaveNotice('Exported SVG vector sheet');
                      setTimeout(() => setSaveNotice(null), 3000);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Download SVG Vector Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportDrawingPDF(
                        { drawing, settings: drawingSettings, mode: exportMode, solidName: solidItem.name },
                        `${slugName}-a4.pdf`
                      );
                      setShowExportMenu(false);
                      setSaveNotice('Exported A4 PDF drawing');
                      setTimeout(() => setSaveNotice(null), 3000);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Download Printable A4 PDF
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await exportDrawingPNG(
                          { drawing, settings: drawingSettings, mode: exportMode, solidName: solidItem.name },
                          `${slugName}-drawing.png`
                        );
                        setSaveNotice('Exported high-resolution PNG');
                      } catch {
                        setSaveNotice('PNG export failed — try SVG or PDF');
                      }
                      setShowExportMenu(false);
                      setTimeout(() => setSaveNotice(null), 3000);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Download High-Res PNG
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !mobileInspectorOpen;
              setMobileInspectorOpen(next);
              if (next) {
                setTimeout(() => {
                  inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }
            }}
            className="xl:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Controls
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs font-medium text-emerald-800">
          {saveNotice}
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left/Center Stage: 3D Viewport + Automatic Plan & Elevation */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          {/* 3D Viewport */}
          <div className="h-[360px] sm:h-[420px] rounded-xl border border-slate-200 overflow-hidden bg-white">
            <Viewport3D
              worldSolid={worldSolid}
              selectedFeature={selectedFeature}
              onSelectFeature={setSelectedFeature}
              cameraRequest={cameraRequest}
              onTriggerPreset={triggerCameraPreset}
              interactive
            />
          </div>

          {/* 2D Orthographic Projection Header + Layout Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Orthographic Projections (Calculated Live)
              </h2>
              <p className="text-xs text-slate-500">
                Plan: (x, y, z) → (x, y) · Elevation: (x, y, z) → (x, z)
              </p>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewLayout('split_views')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  viewLayout === 'split_views'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Plan & Elevation Split
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('combined_sheet')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  viewLayout === 'combined_sheet'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Combined XY Sheet
              </button>
            </div>
          </div>

          {viewLayout === 'split_views' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[360px] md:h-[320px]">
              <DrawingPanel2D
                drawing={drawing}
                settings={drawingSettings}
                mode="elevation"
                title="ELEVATION — FRONT VIEW (VP)"
              />
              <DrawingPanel2D
                drawing={drawing}
                settings={drawingSettings}
                mode="plan"
                title="PLAN — TOP VIEW (HP)"
              />
            </div>
          ) : (
            <div className="h-[380px]">
              <DrawingPanel2D
                drawing={drawing}
                settings={drawingSettings}
                mode="combined"
                title="ALIGNED ORTHOGRAPHIC SHEET (ELEVATION / XY / PLAN)"
              />
            </div>
          )}
        </div>

        {/* Right Inspector: Orientation, Constraints & Educational Readout */}
        <aside
          ref={inspectorRef}
          className={`xl:col-span-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 overflow-y-auto ${
            mobileInspectorOpen ? 'block' : 'hidden xl:block'
          }`}
        >
          <OrientationPanel localSolid={localSolid} validation={validation} />
        </aside>
      </div>

      {/* Save Project Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-md space-y-4 shadow-xl"
          >
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Save Engineering Drawing Project
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Saves solid dimensions, orientation constraints, position, and projection settings to your browser.
              </p>
            </div>

            <div>
              <label htmlFor="proj-name" className="block text-xs font-medium text-slate-700 mb-1">
                Project Name
              </label>
              <input
                id="proj-name"
                type="text"
                required
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="e.g. Hexagonal Prism 30 HP 45 VP"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
              >
                Save Project
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
