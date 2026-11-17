import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { KTU_QUESTION_BANK, generateConstructionSteps } from '../../engine/learning';
import { useProjectStore } from '../../store/project-store';
import type { KtuProblemSpec } from '../../types/geometry';
import { DrawingPanel2D } from '../projection-views/DrawingPanel2D';
import { Viewport3D } from '../viewport/Viewport3D';

export function LearnModeView() {
  const storeSolidType = useProjectStore((s) => s.solidType);
  const storeDimensions = useProjectStore((s) => s.dimensions);
  const storeOrientation = useProjectStore((s) => s.orientation);
  const storePosition = useProjectStore((s) => s.position);
  const drawingSettings = useProjectStore((s) => s.drawingSettings);
  const loadConfiguration = useProjectStore((s) => s.loadConfiguration);
  const sourceMode = useProjectStore((s) => s.learnSourceMode);
  const setSourceMode = useProjectStore((s) => s.setLearnSourceMode);

  const [selectedProblemId, setSelectedProblemId] = useState<string>(KTU_QUESTION_BANK[0].id);
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeProblem: KtuProblemSpec = useMemo(() => {
    if (sourceMode === 'workspace') {
      return {
        id: 'current_workspace',
        level: 4,
        title: 'Current Workspace Configuration',
        statement: `Custom problem from Workspace: ${storeSolidType.replace('_', ' ')} with α = ${storeOrientation.alphaHP.toFixed(1)}° to HP and β = ${storeOrientation.betaVP.toFixed(1)}° to VP.`,
        solidType: storeSolidType,
        dimensions: storeDimensions,
        orientation: storeOrientation,
        position: storePosition,
      };
    }
    return KTU_QUESTION_BANK.find((p) => p.id === selectedProblemId) ?? KTU_QUESTION_BANK[0];
  }, [
    sourceMode,
    selectedProblemId,
    storeSolidType,
    storeDimensions,
    storeOrientation,
    storePosition,
  ]);

  const stepResult = useMemo(() => {
    return generateConstructionSteps(
      activeProblem.solidType,
      activeProblem.dimensions,
      activeProblem.orientation,
      activeProblem.position,
      drawingSettings.convention
    );
  }, [activeProblem, drawingSettings.convention]);

  const steps = stepResult.steps;
  const clampedStepIdx = Math.min(stepIdx, Math.max(0, steps.length - 1));
  const currentStep = steps[clampedStepIdx];

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isPlaying, steps.length]);

  const handleSelectProblem = (id: string) => {
    setSourceMode('bank');
    setSelectedProblemId(id);
    setStepIdx(0);
    setIsPlaying(false);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Problem Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Step-by-Step KTU Construction Mode
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Follow the verified change-of-position construction sequence with synchronized 3D states and orthographic views.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSourceMode('workspace');
              setStepIdx(0);
              setIsPlaying(false);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
              sourceMode === 'workspace'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Use Workspace Problem
          </button>
          <button
            type="button"
            onClick={() =>
              loadConfiguration({
                solidType: activeProblem.solidType,
                dimensions: activeProblem.dimensions,
                orientation: activeProblem.orientation,
                position: activeProblem.position,
                title: activeProblem.title,
                openWorkspace: true,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
          >
            Open in 3D Workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KTU Question Bank Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KTU_QUESTION_BANK.map((prob) => {
          const active = sourceMode === 'bank' && selectedProblemId === prob.id;
          return (
            <button
              key={prob.id}
              type="button"
              onClick={() => handleSelectProblem(prob.id)}
              className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                active
                  ? 'bg-white border-blue-700 ring-2 ring-blue-100'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-mono text-slate-500">
                Level {prob.level} · {prob.solidType.replace('_', ' ')}
              </div>
              <div className="mt-1 font-display text-xs font-semibold text-slate-900 line-clamp-2">
                {prob.title}
              </div>
            </button>
          );
        })}
      </div>

      {/* Problem Statement & Conflict Alert if Workspace problem has invalid inclination */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Problem Statement
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Level {activeProblem.level} · {steps.length} Construction Steps
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{activeProblem.statement}</p>

        {!stepResult.feasible && stepResult.conflictReason && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
            <div>
              <span className="font-semibold">Constraint Conflict Detected: </span>
              {stepResult.conflictReason}
            </div>
          </div>
        )}
      </div>

      {/* Step Playback Bar & Step Content */}
      {currentStep && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left: Step Explanations + Controls */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* Step progress pills */}
              <div className="flex items-center gap-1.5">
                {steps.map((st, idx) => (
                  <button
                    key={st.stepNumber}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setStepIdx(idx);
                    }}
                    className={`h-2 flex-1 rounded-full transition-colors cursor-pointer ${
                      idx === clampedStepIdx
                        ? 'bg-blue-700'
                        : idx < clampedStepIdx
                          ? 'bg-blue-300'
                          : 'bg-slate-200'
                    }`}
                    title={`Step ${st.stepNumber}: ${st.title}`}
                  />
                ))}
              </div>

              <div>
                <div className="text-xs font-mono text-blue-700 font-semibold">
                  Step {currentStep.stepNumber} of {steps.length}
                </div>
                <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                  {currentStep.title}
                </h3>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <h4 className="font-display text-xs font-semibold text-slate-900 uppercase tracking-wide">
                    What to Draw
                  </h4>
                  <p className="mt-1 text-slate-700 leading-relaxed text-xs sm:text-sm">
                    {currentStep.whatToDraw}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <h4 className="font-display text-xs font-semibold text-slate-900 uppercase tracking-wide">
                    Why This Step Is Necessary
                  </h4>
                  <p className="mt-1 text-slate-600 leading-relaxed text-xs sm:text-sm">
                    {currentStep.whyNecessary}
                  </p>
                </div>

                {currentStep.formulaNote && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800">
                    {currentStep.formulaNote}
                  </div>
                )}
              </div>
            </div>

            {/* Playback Controls */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={clampedStepIdx === 0}
                onClick={() => {
                  setIsPlaying(false);
                  setStepIdx((i) => Math.max(0, i - 1));
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (clampedStepIdx >= steps.length - 1) setStepIdx(0);
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
                    setStepIdx(0);
                    setIsPlaying(true);
                  }}
                  className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  title="Replay animation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={clampedStepIdx >= steps.length - 1}
                onClick={() => {
                  setIsPlaying(false);
                  setStepIdx((i) => Math.min(steps.length - 1, i + 1));
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 rounded-lg cursor-pointer disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Synchronized 3D State & Intermediate 2D Construction */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-[360px] md:h-[460px] rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-display font-semibold text-slate-800">
                3D Stage State — {currentStep.stageLabel.replace('_', ' ')}
              </div>
              <div className="flex-1">
                <Viewport3D
                  worldSolid={currentStep.worldSolid}
                  cameraRequest={{ preset: 'isometric', nonce: 0 }}
                  interactive={false}
                  compact
                />
              </div>
            </div>

            <div className="h-[360px] md:h-[460px]">
              <DrawingPanel2D
                drawing={currentStep.drawing}
                settings={{
                  ...drawingSettings,
                  showConstruction: true,
                  showHidden: currentStep.stageLabel === 'finishing' || currentStep.stepNumber >= 2,
                  showLabels: true,
                }}
                mode="combined"
                highlightIds={currentStep.highlightIds}
                title="Intermediate Plan & Elevation (Highlighted)"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
