import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Layers,
  ListOrdered,
  Pause,
  PenTool,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SOLID_CATALOG, buildLocalSolid, getSolidCatalogItem } from '../../engine/geometry';
import { generateThreeStageSteps } from '../../engine/learning';
import { getNaturalFaceRestingAlpha, solveOrientation } from '../../engine/orientation';
import { validateDimensions } from '../../lib/validation';
import { useProjectStore } from '../../store/project-store';
import type { BaseEdgeReference, CameraPreset, RestingCondition, SolidCategory } from '../../types/geometry';
import { DrawingPanel2D } from '../projection-views/DrawingPanel2D';
import { NumericInput } from '../ui/NumericInput';
import { Viewport3D } from '../viewport/Viewport3D';
import { AiQuestionSolver } from './AiQuestionSolver';
import { SolidIsoPreview } from './SolidIsoPreview';

type FilterCategory = 'all' | SolidCategory;

export function SolidLibraryView() {
  const wizardStep = useProjectStore((s) => s.wizardStep);
  const setWizardStep = useProjectStore((s) => s.setWizardStep);
  const startNewDrawing = useProjectStore((s) => s.startNewDrawing);
  const solidType = useProjectStore((s) => s.solidType);
  const dimensions = useProjectStore((s) => s.dimensions);
  const orientation = useProjectStore((s) => s.orientation);
  const position = useProjectStore((s) => s.position);
  const drawingSettings = useProjectStore((s) => s.drawingSettings);
  const selectSolidType = useProjectStore((s) => s.selectSolidType);
  const updateDimensions = useProjectStore((s) => s.updateDimensions);
  const updateOrientation = useProjectStore((s) => s.updateOrientation);
  const updatePosition = useProjectStore((s) => s.updatePosition);
  const setActiveSection = useProjectStore((s) => s.setActiveSection);

  const [filter, setFilter] = useState<FilterCategory>('all');
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [compareAll, setCompareAll] = useState(false);
  const [step6ViewFocus, setStep6ViewFocus] = useState<'all' | 'steps' | '2d' | '3d'>('all');
  const [step6DrawingMode, setStep6DrawingMode] = useState<'combined' | 'elevation' | 'plan'>('combined');
  const [stageCameraRequest, setStageCameraRequest] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: 'isometric',
    nonce: 0,
  });

  const triggerStageCamera = (preset: CameraPreset) => {
    setStageCameraRequest((prev) => ({ preset, nonce: prev.nonce + 1 }));
  };

  const selectedItem = getSolidCatalogItem(solidType);
  const dimValidation = validateDimensions(solidType, dimensions);
  const localSolid = useMemo(() => buildLocalSolid(solidType, dimensions), [solidType, dimensions]);

  const oriValidation = useMemo(
    () => solveOrientation(localSolid, orientation, position, { kind: 'axis' }).validation,
    [localSolid, orientation, position]
  );

  const stageResult = useMemo(
    () =>
      generateThreeStageSteps(
        solidType,
        dimensions,
        orientation,
        position,
        drawingSettings.convention
      ),
    [solidType, dimensions, orientation, position, drawingSettings.convention]
  );

  const stages = stageResult.stages;
  const clampedStageIdx = Math.min(activeStageIdx, Math.max(0, stages.length - 1));
  const currentStage = stages[clampedStageIdx];

  useEffect(() => {
    if (!isPlaying || wizardStep !== 6) return;
    const timer = window.setInterval(() => {
      setActiveStageIdx((prev) => {
        if (prev >= stages.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isPlaying, wizardStep, stages.length]);

  const filteredSolids =
    filter === 'all'
      ? SOLID_CATALOG
      : SOLID_CATALOG.filter((item) => item.category === filter);

  const isCurved = selectedItem.category === 'curved';
  const isCustom = solidType === 'custom_prism' || solidType === 'custom_pyramid';
  const isPyramidOrCone = selectedItem.category === 'pyramid' || solidType === 'cone';
  const lateralFaces = localSolid.faces.filter((f) => f.type === 'lateral');
  const baseEdges = localSolid.edges.filter((e) => e.type === 'base');

  const openStep6 = () => {
    setActiveStageIdx(0);
    setIsPlaying(false);
    setCompareAll(false);
    setStep6ViewFocus('all');
    setStep6DrawingMode('combined');
    setWizardStep(6);
  };

  const handleRestingChange = (cond: RestingCondition) => {
    const nextVpType =
      cond !== 'base_edge_hp' && orientation.vpAngleType === 'resting_edge'
        ? 'true'
        : orientation.vpAngleType;
    if (cond === 'face_hp') {
      const face =
        lateralFaces.find((f) => f.id === orientation.referenceFaceId) ?? lateralFaces[0];
      const naturalAlpha = face ? +getNaturalFaceRestingAlpha(localSolid, face).toFixed(1) : 0;
      updateOrientation({
        mode: 'inclination',
        restingCondition: cond,
        vpAngleType: nextVpType,
        alphaHP: naturalAlpha,
        referenceFaceId: face?.id ?? null,
      });
      updatePosition({ snapToHP: true, snapToVP: false });
    } else if (cond === 'generator_hp') {
      const naturalAlpha =
        localSolid.type === 'cone'
          ? +((Math.atan2(localSolid.radius, localSolid.axisEnd.z) * 180) / Math.PI).toFixed(1)
          : 0;
      updateOrientation({
        mode: 'inclination',
        restingCondition: cond,
        vpAngleType: nextVpType,
        alphaHP: naturalAlpha,
      });
      updatePosition({ snapToHP: true, snapToVP: false });
    } else {
      const nextAlpha = orientation.alphaHP === 90 ? 45 : orientation.alphaHP;
      updateOrientation({
        mode: 'inclination',
        restingCondition: cond,
        vpAngleType: nextVpType,
        alphaHP: nextAlpha,
      });
      updatePosition({ snapToHP: cond !== 'free', snapToVP: false });
    }
  };

  const totalQuestionPages = 5;
  const numericWizardStep = typeof wizardStep === 'number' ? wizardStep : null;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* PAGE 0: FIRST OPTION — SELECT SOLID OR TYPE QUESTION */}
      {wizardStep === 0 && (
        <div className="max-w-3xl mx-auto py-4 sm:py-8 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              How would you like to start?
            </h1>
            <p className="text-sm text-slate-600">
              Type your full Engineering Graphics question for an instant AI solution, or select a solid manually step by step.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setWizardStep('ai')}
              className="group text-left bg-white border-2 border-blue-200 hover:border-blue-700 rounded-2xl p-6 space-y-4 transition-all cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Type Question (Answered by AI)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Paste or type any KTU question (Lines, Solids, Sections, or Isometric). AI answers it directly and builds the live 2D &amp; 3D projections.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                Type Question &amp; Solve
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className="group text-left bg-white border border-slate-200 hover:border-blue-600 rounded-2xl p-6 space-y-4 transition-all cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                <Box className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Select Solid (Step-by-Step)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Pick your 3D solid, enter dimensions, resting edge or corner, and angles one simple page at a time.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-blue-700">
                Choose a Solid
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* AI QUESTION SOLVER */}
      {wizardStep === 'ai' && (
        <AiQuestionSolver
          onBack={() => setWizardStep(0)}
          onSwitchToManualSolid={() => setWizardStep(1)}
        />
      )}

      {/* Simple Top Progress Strip for Question Pages 1-5 */}
      {numericWizardStep !== null && numericWizardStep >= 1 && numericWizardStep <= 5 && (
        <div className="max-w-3xl mx-auto mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Question {numericWizardStep} of {totalQuestionPages}
            </span>
            {numericWizardStep > 1 && (
              <span className="font-mono text-slate-700">{selectedItem.name}</span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {([1, 2, 3, 4, 5] as const).map((n) => {
              const canJump = n < numericWizardStep;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setWizardStep(n)}
                  title={canJump ? `Go back to Question ${n}` : `Question ${n}`}
                  className={`h-2 rounded-full transition-colors ${
                    n <= numericWizardStep
                      ? canJump
                        ? 'bg-blue-700 hover:bg-blue-800 cursor-pointer'
                        : 'bg-blue-700'
                      : 'bg-slate-200'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* PAGE 1: SELECT ANY SOLID */}
      {wizardStep === 1 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setWizardStep(0)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setWizardStep('ai')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Type Question Instead (AI)
            </button>
          </div>

          <div className="text-center max-w-xl mx-auto space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Which solid do you want to draw?
            </h1>
            <p className="text-sm text-slate-600">
              Tap one solid below to continue to its dimensions.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All Solids' },
                  { id: 'prism', label: 'Prisms' },
                  { id: 'pyramid', label: 'Pyramids' },
                  { id: 'curved', label: 'Curved Solids' },
                ] as { id: FilterCategory; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSolids.map((item) => {
              const isSelected = item.type === solidType;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    selectSolidType(item.type, false);
                    setWizardStep(2);
                  }}
                  className={`group text-left bg-white rounded-xl p-4 border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-700 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {item.name}
                    </h2>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 shrink-0" />
                  </div>

                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.shortDesc}</p>

                  <div className="mt-3 h-32 w-full bg-slate-50 rounded-lg border border-slate-100 p-2 flex items-center justify-center">
                    <SolidIsoPreview
                      solidType={item.type}
                      dimensions={isSelected ? dimensions : item.defaultDimensions}
                      size={120}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PAGE 2: DIMENSIONS */}
      {wizardStep === 2 && (
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Enter dimensions for {selectedItem.name}
            </h1>
            <p className="text-sm text-slate-500">
              Type the size given in your question (in millimetres).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-56 bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-center">
              <SolidIsoPreview solidType={solidType} dimensions={dimensions} size={190} />
            </div>

            <div className="space-y-4">
              {isCustom && (
                <div>
                  <label htmlFor="baby-sides" className="block text-sm font-medium text-slate-800 mb-1.5">
                    Number of Base Sides
                  </label>
                  <NumericInput
                    id="baby-sides"
                    min={3}
                    max={12}
                    step={1}
                    value={dimensions.numSides}
                    onChange={(val) => updateDimensions({ numSides: Math.round(val) })}
                    className="w-full px-4 py-3 text-base font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {dimValidation.errors.numSides && (
                    <p className="mt-1 text-xs text-red-600">{dimValidation.errors.numSides}</p>
                  )}
                </div>
              )}

              {isCurved ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="baby-radius" className="text-sm font-medium text-slate-800">
                      Base Radius (mm)
                    </label>
                    <span className="text-xs font-mono text-slate-500">
                      Diameter Ø {(dimensions.baseRadius * 2).toFixed(0)} mm
                    </span>
                  </div>
                  <NumericInput
                    id="baby-radius"
                    min={1}
                    max={200}
                    step={1}
                    value={dimensions.baseRadius}
                    onChange={(val) => updateDimensions({ baseRadius: val })}
                    className="w-full px-4 py-3 text-base font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {dimValidation.errors.baseRadius && (
                    <p className="mt-1 text-xs text-red-600">{dimValidation.errors.baseRadius}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="baby-side" className="block text-sm font-medium text-slate-800 mb-1.5">
                    {solidType === 'square_prism' && dimensions.rectangularBase
                      ? 'Base Length (mm)'
                      : 'Base Side Length (mm)'}
                  </label>
                  <NumericInput
                    id="baby-side"
                    min={1}
                    max={200}
                    step={1}
                    value={dimensions.sideLength}
                    onChange={(val) =>
                      updateDimensions(
                        dimensions.rectangularBase
                          ? { sideLength: val }
                          : { sideLength: val, baseWidth: val }
                      )
                    }
                    className="w-full px-4 py-3 text-base font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {dimValidation.errors.sideLength && (
                    <p className="mt-1 text-xs text-red-600">{dimValidation.errors.sideLength}</p>
                  )}
                </div>
              )}

              {solidType === 'square_prism' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dimensions.rectangularBase}
                      onChange={(e) =>
                        updateDimensions({
                          rectangularBase: e.target.checked,
                          baseWidth: e.target.checked ? dimensions.baseWidth : dimensions.sideLength,
                        })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    Different Base Width (Rectangular Prism)
                  </label>
                  {dimensions.rectangularBase && (
                    <NumericInput
                      ariaLabel="Base Width in mm"
                      min={1}
                      max={200}
                      step={1}
                      value={dimensions.baseWidth}
                      onChange={(val) => updateDimensions({ baseWidth: val })}
                      className="w-full px-4 py-2.5 text-base font-mono tabular-nums border border-slate-300 rounded-xl"
                    />
                  )}
                </div>
              )}

              {solidType !== 'cube' && solidType !== 'hemisphere' && (
                <div>
                  <label htmlFor="baby-axis" className="block text-sm font-medium text-slate-800 mb-1.5">
                    {isPyramidOrCone ? 'Axis Height (mm)' : 'Axis Length (mm)'}
                  </label>
                  <NumericInput
                    id="baby-axis"
                    min={1}
                    max={300}
                    step={1}
                    value={dimensions.axisLength}
                    onChange={(val) => updateDimensions({ axisLength: val })}
                    className="w-full px-4 py-3 text-base font-mono tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {dimValidation.errors.axisLength && (
                    <p className="mt-1 text-xs text-red-600">{dimValidation.errors.axisLength}</p>
                  )}
                </div>
              )}
              {(solidType === 'cube' || solidType === 'hemisphere') && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {solidType === 'cube'
                    ? `All 12 cube edges equal ${dimensions.sideLength} mm automatically.`
                    : `Hemisphere height automatically equals radius ${dimensions.baseRadius} mm.`}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              type="button"
              disabled={!dimValidation.valid}
              onClick={() => setWizardStep(3)}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-xl whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PAGE 3: IS IT INCLINED TO HP OR VP? */}
      {wizardStep === 3 && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Is the {selectedItem.name} inclined to HP or VP?
            </h1>
            <p className="text-sm text-slate-500">
              Pick one simple option below.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                updateOrientation({
                  mode: 'inclination',
                  restingCondition: 'base_hp',
                  alphaHP: 90,
                  betaVP: 0,
                  baseReference: 'edge_perp_vp',
                });
                updatePosition({ snapToHP: true, snapToVP: false });
                openStep6();
              }}
              className="w-full text-left p-5 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-4 cursor-pointer"
            >
              <div>
                <div className="font-display text-base font-semibold text-slate-900">
                  No — Standing upright on HP (Simple Position)
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">
                  The base rests flat on the ground (HP) and the axis goes straight up.
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-700 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                updateOrientation({
                  mode: 'inclination',
                  restingCondition: 'base_vp',
                  alphaHP: 0,
                  betaVP: 90,
                  baseReference: 'edge_perp_vp',
                });
                updatePosition({ snapToHP: false, snapToVP: true });
                openStep6();
              }}
              className="w-full text-left p-5 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-4 cursor-pointer"
            >
              <div>
                <div className="font-display text-base font-semibold text-slate-900">
                  No — Resting flat on VP (Simple Position)
                </div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">
                  The base rests flat against the vertical wall (VP) with axis horizontal.
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-700 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                const nextCond =
                  orientation.restingCondition === 'base_hp' ||
                  orientation.restingCondition === 'base_vp'
                    ? 'base_edge_hp'
                    : orientation.restingCondition;
                const nextAlpha = orientation.alphaHP === 90 ? 45 : orientation.alphaHP;
                updateOrientation({
                  mode: 'inclination',
                  restingCondition: nextCond,
                  alphaHP: nextAlpha,
                });
                updatePosition({ snapToHP: nextCond !== 'free', snapToVP: false });
                setWizardStep(4);
              }}
              className="w-full text-left p-5 rounded-xl border-2 border-blue-200 bg-blue-50/40 hover:border-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
            >
              <div>
                <div className="font-display text-base font-semibold text-blue-900">
                  Yes — Inclined (tilted) to HP and/or VP
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  The solid rests on a base edge, corner, or face and tilts at an angle.
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-700 shrink-0" />
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>
      )}

      {/* PAGE 4: WHICH PART TOUCHES HP & WHICH LINE IS INCLINED? */}
      {wizardStep === 4 && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              How is it resting on HP?
            </h1>
            <p className="text-sm text-slate-500">
              Select the part that touches the Horizontal Plane (HP).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  id: 'base_edge_hp' as RestingCondition,
                  title: 'Resting on a Base Edge',
                  desc: 'One straight edge of the base sits on HP.',
                },
                {
                  id: 'base_corner_hp' as RestingCondition,
                  title: 'Resting on a Base Corner',
                  desc: 'Only one corner point of the base touches HP.',
                },
                ...(!localSolid.isCurved
                  ? [
                      {
                        id: 'face_hp' as RestingCondition,
                        title:
                          localSolid.category === 'prism'
                            ? 'Resting on a Rectangular Face'
                            : 'Resting on a Slant Face',
                        desc: 'Lies flat on one side face on HP.',
                      },
                    ]
                  : [
                      {
                        id: 'generator_hp' as RestingCondition,
                        title: 'Resting on a Generator',
                        desc: 'Lies along one curved side line on HP.',
                      },
                    ]),
                {
                  id: 'free' as RestingCondition,
                  title: 'Freely Suspended',
                  desc: 'Not resting on HP; axis inclined freely.',
                },
              ]
            ).map((opt) => {
              const selected = orientation.restingCondition === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRestingChange(opt.id)}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-blue-50 border-blue-700 ring-1 ring-blue-700'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-slate-900">
                      {opt.title}
                    </span>
                    {selected && <Check className="w-4 h-4 text-blue-700 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Sub-question only when Base Corner on HP is chosen */}
          {orientation.restingCondition === 'base_corner_hp' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="text-xs font-semibold text-slate-800">
                In your question, which line is inclined to HP &amp; VP?
              </div>
              <div
                className={`grid gap-2 ${
                  localSolid.category === 'prism' ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => updateOrientation({ inclinedElement: 'axis' })}
                  className={`py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg border cursor-pointer ${
                    (orientation.inclinedElement ?? 'axis') === 'axis'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  The Axis
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ inclinedElement: 'slant_edge' })}
                  className={`py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg border cursor-pointer ${
                    orientation.inclinedElement === 'slant_edge'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Slant / Longer Edge
                </button>
                {localSolid.category === 'prism' && (
                  <button
                    type="button"
                    onClick={() =>
                      updateOrientation({ inclinedElement: 'body_diagonal', alphaHP: 0, betaVP: 90 })
                    }
                    className={`py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg border cursor-pointer ${
                      orientation.inclinedElement === 'body_diagonal'
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Body Diagonal
                  </button>
                )}
              </div>
            </div>
          )}

          {orientation.restingCondition === 'base_edge_hp' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  In your question, what is inclined to VP?
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => updateOrientation({ vpAngleType: 'true' })}
                    className={`py-2 px-3 text-left rounded-lg border cursor-pointer ${
                      (orientation.vpAngleType ?? 'true') === 'true'
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">The Axis (True β)</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        (orientation.vpAngleType ?? 'true') === 'true'
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}
                    >
                      Axis at β° to VP
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOrientation({ vpAngleType: 'resting_edge' })}
                    className={`py-2 px-3 text-left rounded-lg border cursor-pointer ${
                      orientation.vpAngleType === 'resting_edge'
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">Resting Base Edge</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        orientation.vpAngleType === 'resting_edge'
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}
                    >
                      e.g. edge at 40° to VP
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOrientation({ vpAngleType: 'apparent' })}
                    className={`py-2 px-3 text-left rounded-lg border cursor-pointer ${
                      orientation.vpAngleType === 'apparent'
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">Top View of Axis (β&apos;)</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        orientation.vpAngleType === 'apparent'
                          ? 'text-blue-100'
                          : 'text-slate-500'
                      }`}
                    >
                      Plan axis angle to XY
                    </div>
                  </button>
                </div>
              </div>

              {baseEdges.length > 0 && (
                <div>
                  <label htmlFor="baby-edge-pick" className="block text-xs font-medium text-slate-700 mb-1">
                    Which base edge? (Default works for most problems)
                  </label>
                  <select
                    id="baby-edge-pick"
                    value={orientation.referenceEdgeId ?? baseEdges[0].id}
                    onChange={(e) => updateOrientation({ referenceEdgeId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    {baseEdges.map((edge) => (
                      <option key={edge.id} value={edge.id}>
                        {edge.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {orientation.restingCondition === 'free' && (
            <div>
              <label htmlFor="baby-base-ref" className="block text-xs font-medium text-slate-700 mb-1">
                Initial base edge alignment
              </label>
              <select
                id="baby-base-ref"
                value={orientation.baseReference}
                onChange={(e) =>
                  updateOrientation({ baseReference: e.target.value as BaseEdgeReference })
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="edge_perp_vp">Reference base edge ⊥ to VP</option>
                <option value="edge_parallel_vp">Reference base edge ∥ to VP</option>
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              type="button"
              onClick={() => setWizardStep(5)}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              Next: Enter Angles
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PAGE 5: ENTER ANGLES TO HP & VP */}
      {wizardStep === 5 && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Enter Angles to HP and VP
            </h1>
            <p className="text-sm text-slate-500">
              Type the angle in degrees (enter 0° if parallel to a plane).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Alpha HP */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <label htmlFor="baby-alpha" className="block text-sm font-semibold text-slate-900">
                Angle to HP (α°)
              </label>
              {orientation.restingCondition === 'face_hp' ||
              orientation.restingCondition === 'generator_hp' ? (
                <div className="space-y-2">
                  <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg font-mono text-lg font-semibold text-slate-900">
                    {orientation.alphaHP.toFixed(1)}°
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Fixed automatically because the solid lies flat on its{' '}
                    {orientation.restingCondition === 'face_hp' ? 'face' : 'generator'} on HP.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      updateOrientation({
                        restingCondition: 'base_edge_hp',
                        alphaHP: 30,
                      })
                    }
                    className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Want a custom α°? Switch to Base Edge on HP
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      id="baby-alpha"
                      min={0}
                      max={90}
                      step={1}
                      value={orientation.alphaHP}
                      onChange={(val) => updateOrientation({ alphaHP: val })}
                      className="w-full px-3.5 py-2.5 text-lg font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="text-base font-mono text-slate-500">°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={1}
                    value={orientation.alphaHP}
                    onChange={(e) => updateOrientation({ alphaHP: parseFloat(e.target.value) })}
                    className="w-full touch-pan-y accent-blue-700"
                  />
                  <div className="flex items-center gap-1">
                    {[0, 30, 45, 60, 90].map((deg) => (
                      <button
                        key={`ba_${deg}`}
                        type="button"
                        onClick={() => updateOrientation({ alphaHP: deg })}
                        className={`flex-1 py-1 text-xs font-mono rounded border cursor-pointer ${
                          Math.abs(orientation.alphaHP - deg) < 0.5
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Beta VP */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label htmlFor="baby-beta" className="text-sm font-semibold text-slate-900">
                  {orientation.vpAngleType === 'resting_edge' &&
                  orientation.restingCondition === 'base_edge_hp'
                    ? 'Resting Edge to VP (ψ°)'
                    : orientation.vpAngleType === 'apparent'
                      ? 'Top View Angle to VP (β\'°)'
                      : 'Angle to VP (β°)'}
                </label>
                <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-md p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => updateOrientation({ vpAngleType: 'true' })}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      (orientation.vpAngleType ?? 'true') === 'true'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    True β
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOrientation({ vpAngleType: 'apparent' })}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      orientation.vpAngleType === 'apparent'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    Top View β&apos;
                  </button>
                  {orientation.restingCondition === 'base_edge_hp' && (
                    <button
                      type="button"
                      onClick={() => updateOrientation({ vpAngleType: 'resting_edge' })}
                      className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                        orientation.vpAngleType === 'resting_edge'
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      Resting Edge
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NumericInput
                  id="baby-beta"
                  min={0}
                  max={90}
                  step={1}
                  value={orientation.betaVP}
                  onChange={(val) => updateOrientation({ betaVP: val })}
                  className="w-full px-3.5 py-2.5 text-lg font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-base font-mono text-slate-500">°</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={orientation.betaVP}
                onChange={(e) => updateOrientation({ betaVP: parseFloat(e.target.value) })}
                className="w-full touch-pan-y accent-blue-700"
              />
              <div className="flex items-center gap-1">
                {[0, 30, 45, 60, 90].map((deg) => (
                  <button
                    key={`bb_${deg}`}
                    type="button"
                    onClick={() => updateOrientation({ betaVP: deg })}
                    className={`flex-1 py-1 text-xs font-mono rounded border cursor-pointer ${
                      Math.abs(orientation.betaVP - deg) < 0.5
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Apex / Tilt Position Relative to VP and Left/Right */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                Apex / Top Side (Left or Right)
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionX: 'positive' })}
                  className={`py-1.5 rounded-lg border font-medium cursor-pointer ${
                    orientation.leanDirectionX === 'positive'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Towards Right (+X)
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionX: 'negative' })}
                  className={`py-1.5 rounded-lg border font-medium cursor-pointer ${
                    orientation.leanDirectionX === 'negative'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Towards Left (-X)
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                Apex / Top Position vs VP
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionY: 'positive' })}
                  className={`py-1.5 rounded-lg border font-medium cursor-pointer ${
                    orientation.leanDirectionY === 'positive'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Away from VP (+Y)
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionY: 'negative' })}
                  className={`py-1.5 rounded-lg border font-medium cursor-pointer ${
                    orientation.leanDirectionY === 'negative'
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  Towards VP (-Y)
                </button>
              </div>
            </div>
          </div>

          {!oriValidation.valid ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-red-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Invalid Angle Combination</span>
              </div>
              {oriValidation.errors.map((err, i) => (
                <p key={i} className="leading-relaxed">
                  {err}
                </p>
              ))}
              <p className="text-red-900 leading-relaxed">
                Tip: If your question has α + β &gt; 90° (like axis 60° to HP and resting edge 40° to VP), the VP angle applies to the{' '}
                {orientation.restingCondition === 'base_edge_hp'
                  ? 'Resting Base Edge or Top View (β\')'
                  : 'Top View (β\')'}
                , not True β of the axis.
              </p>
              <div className="flex flex-wrap gap-2">
                {orientation.restingCondition === 'base_edge_hp' && (
                  <button
                    type="button"
                    onClick={() => updateOrientation({ vpAngleType: 'resting_edge' })}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg cursor-pointer"
                  >
                    Use {orientation.betaVP}° as Resting Base Edge to VP
                  </button>
                )}
                {orientation.restingCondition === 'base_edge_hp' &&
                  orientation.alphaHP < orientation.betaVP && (
                    <button
                      type="button"
                      onClick={() =>
                        updateOrientation({
                          alphaHP: orientation.betaVP,
                          betaVP: orientation.alphaHP,
                          vpAngleType: 'resting_edge',
                        })
                      }
                      className="px-3 py-1.5 bg-white border border-blue-300 text-blue-800 hover:bg-blue-50 font-medium rounded-lg cursor-pointer"
                    >
                      Swap: Axis {orientation.betaVP}° HP &amp; Resting Edge {orientation.alphaHP}° VP
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => updateOrientation({ vpAngleType: 'apparent' })}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 font-medium rounded-lg cursor-pointer"
                >
                  Use {orientation.betaVP}° as Top View Angle (β&apos;)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateOrientation({
                      betaVP: Math.floor(oriValidation.maxAllowedBeta),
                    })
                  }
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white font-medium rounded-lg cursor-pointer"
                >
                  Adjust True β to max valid ({Math.floor(oriValidation.maxAllowedBeta)}°)
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Angles look good! Ready to generate your 3-step drawing.
              </span>
              <span className="font-mono tabular-nums">
                {orientation.vpAngleType === 'resting_edge' &&
                orientation.restingCondition === 'base_edge_hp'
                  ? `Edge ${orientation.betaVP}° VP · Axis β = ${oriValidation.actualBetaVP.toFixed(1)}°`
                  : `sin²α + sin²β = ${oriValidation.sinSqSum.toFixed(2)}`}
              </span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setWizardStep(4)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              type="button"
              disabled={!oriValidation.valid}
              onClick={openStep6}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-xl whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              Show Step-by-Step Drawing
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PAGE 6: STEP-BY-STEP RESULT (1. SIMPLE POSITION -> 2. INCLINED TO HP ONLY -> 3. INCLINED TO VP) */}
      {wizardStep === 6 && currentStage && (
        <div className="space-y-5">
          {/* Header & Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                {selectedItem.name} — Step-by-Step Solution
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-mono tabular-nums">
                {isCurved ? `Radius ${dimensions.baseRadius} mm` : `Side ${dimensions.sideLength} mm`}
                {` · Axis ${dimensions.axisLength} mm · α = ${orientation.alphaHP}° HP · ${
                  orientation.vpAngleType === 'resting_edge' &&
                  orientation.restingCondition === 'base_edge_hp'
                    ? `Resting Edge = ${orientation.betaVP}° VP`
                    : orientation.vpAngleType === 'apparent'
                      ? `Top View β' = ${orientation.betaVP}° VP`
                      : `β = ${orientation.betaVP}° VP`
                }`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareAll((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
                  compareAll
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                {compareAll ? 'Focus One Step' : 'Show All Steps Side-by-Side'}
              </button>

              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Edit Dimensions
              </button>

              <button
                type="button"
                onClick={() =>
                  setWizardStep(
                    orientation.restingCondition === 'base_hp' ||
                      orientation.restingCondition === 'base_vp'
                      ? 3
                      : 5
                  )
                }
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Edit Angles
              </button>

              <button
                type="button"
                onClick={startNewDrawing}
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                New Solid
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('workspace')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Full CAD &amp; Export
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!stageResult.feasible && stageResult.conflictReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
              <span>{stageResult.conflictReason}</span>
            </div>
          )}

          {/* Quick Buttons Bar for Steps & Views */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCompareAll(false);
                  setStep6ViewFocus('all');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  !compareAll && step6ViewFocus === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareAll(false);
                  setStep6ViewFocus('steps');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  !compareAll && step6ViewFocus === 'steps'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                See Steps ({stages.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareAll(false);
                  setStep6ViewFocus('2d');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  !compareAll && step6ViewFocus === '2d'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                2D Drawing
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompareAll(false);
                  setStep6ViewFocus('3d');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  !compareAll && step6ViewFocus === '3d'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                3D View
              </button>
            </div>

            {stages.length > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                {stages.map((st, idx) => (
                  <button
                    key={st.stageNumber}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCompareAll(false);
                      setActiveStageIdx(idx);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      !compareAll && idx === clampedStageIdx
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    Step {st.stageNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stage Selector Pills (Step 1: Simple Position | Step 2: Inclined to HP Only | Step 3: Inclined to VP) */}
          {!compareAll && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {stages.map((st, idx) => {
                const active = idx === clampedStageIdx;
                return (
                  <button
                    key={st.stageNumber}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveStageIdx(idx);
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="font-display text-sm font-semibold">{st.title}</div>
                    <div
                      className={`text-xs font-mono mt-0.5 ${
                        active ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {st.badge}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {compareAll ? (
            /* ALL STEPS SIDE BY SIDE */
            <div
              className={`grid grid-cols-1 gap-4 ${
                stages.length === 1
                  ? 'lg:grid-cols-1 max-w-2xl mx-auto'
                  : stages.length === 2
                    ? 'lg:grid-cols-2'
                    : 'lg:grid-cols-3'
              }`}
            >
              {stages.map((st) => (
                <div
                  key={st.stageNumber}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="font-display text-sm font-bold text-slate-900">{st.title}</div>
                    <div className="text-xs font-mono text-blue-700 mt-0.5">{st.badge}</div>
                  </div>
                  <div className="h-[340px]">
                    <DrawingPanel2D
                      drawing={st.drawing}
                      settings={{
                        ...drawingSettings,
                        showConstruction: true,
                        showHidden: true,
                        showLabels: true,
                      }}
                      mode={step6DrawingMode}
                      highlightIds={st.highlightIds}
                      title={st.title}
                    />
                  </div>
                  <div className="p-3.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                    {st.whatToDraw}
                  </div>
                </div>
              ))}
            </div>
          ) : step6ViewFocus === 'steps' ? (
            /* FOCUSED STEPS BREAKDOWN */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stages.map((st, idx) => (
                <div
                  key={st.stageNumber}
                  className={`bg-white border rounded-xl p-5 flex flex-col justify-between space-y-4 ${
                    idx === clampedStageIdx ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="text-xs font-mono font-semibold text-blue-700">{st.badge}</div>
                    <h2 className="font-display text-base font-bold text-slate-900">{st.title}</h2>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {st.whatToDraw}
                    </p>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800">
                      {st.formulaNote}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStageIdx(idx);
                        setStep6ViewFocus('2d');
                      }}
                      className="flex-1 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                    >
                      2D Drawing →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStageIdx(idx);
                        setStep6ViewFocus('3d');
                      }}
                      className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      3D View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ONE STEP AT A TIME: EXPLANATION + 2D ORTHOGRAPHIC FIGURE (UPSIDE) + 3D MODEL (DOWNSIDE) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {step6ViewFocus === 'all' && (
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono font-semibold text-blue-700">
                        {currentStage.badge}
                      </div>
                      <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
                        {currentStage.title}
                      </h2>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">
                      {currentStage.whatToDraw}
                    </p>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800">
                      {currentStage.formulaNote}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={clampedStageIdx === 0}
                      onClick={() => {
                        setIsPlaying(false);
                        setActiveStageIdx((i) => Math.max(0, i - 1));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    {stages.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (clampedStageIdx >= stages.length - 1) setActiveStageIdx(0);
                            setIsPlaying((p) => !p);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-lg cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {isPlaying ? 'Pause' : 'Play'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveStageIdx(0);
                            setIsPlaying(true);
                          }}
                          className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          title="Replay steps"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={clampedStageIdx >= stages.length - 1}
                      onClick={() => {
                        setIsPlaying(false);
                        setActiveStageIdx((i) => Math.min(stages.length - 1, i + 1));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className={`${step6ViewFocus === 'all' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
                {(step6ViewFocus === 'all' || step6ViewFocus === '2d') && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        2D Projection View:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: 'combined', label: 'Both (FV + TV)' },
                            { id: 'elevation', label: 'Front View (VP)' },
                            { id: 'plan', label: 'Top View (HP)' },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setStep6DrawingMode(m.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer ${
                              step6DrawingMode === m.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={step6ViewFocus === '2d' ? 'h-[420px] sm:h-[480px]' : 'h-[360px] sm:h-[420px]'}>
                      <DrawingPanel2D
                        drawing={currentStage.drawing}
                        settings={{
                          ...drawingSettings,
                          showConstruction: true,
                          showHidden: true,
                          showLabels: true,
                        }}
                        mode={step6DrawingMode}
                        highlightIds={currentStage.highlightIds}
                        title={`2D Drawing — ${currentStage.title}`}
                      />
                    </div>
                  </div>
                )}

                {(step6ViewFocus === 'all' || step6ViewFocus === '3d') && (
                  <div
                    className={`${
                      step6ViewFocus === '3d' ? 'h-[420px] sm:h-[480px]' : 'h-[320px] sm:h-[380px]'
                    } rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col`}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-display font-semibold text-slate-800">
                        3D Model — {currentStage.title}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            { id: 'isometric', label: 'Iso' },
                            { id: 'front', label: 'Front' },
                            { id: 'top', label: 'Top' },
                            { id: 'side', label: 'Side' },
                          ] as { id: CameraPreset; label: string }[]
                        ).map((cam) => (
                          <button
                            key={cam.id}
                            type="button"
                            onClick={() => triggerStageCamera(cam.id)}
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded cursor-pointer"
                          >
                            {cam.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Viewport3D
                        worldSolid={currentStage.worldSolid}
                        cameraRequest={stageCameraRequest}
                        onTriggerPreset={triggerStageCamera}
                        interactive
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
