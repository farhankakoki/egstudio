import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Eye,
  Layers,
  ListOrdered,
  Loader2,
  PenTool,
  Send,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_DIMENSIONS, getSideCount, SOLID_CATALOG } from '../../engine/geometry';
import { generateIsometricDrawing, type IsometricProblemInput } from '../../engine/isometric';
import { generateThreeStageSteps } from '../../engine/learning';
import { solveLineProblem } from '../../engine/lines';
import { createDefaultOrientation, createDefaultPosition } from '../../engine/orientation';
import { solveSectionedSolid, type SectionProblemInput } from '../../engine/section';
import { useProjectStore } from '../../store/project-store';
import type {
  AiQuestionAnswer,
  CameraPreset,
  LineProblemInput,
  OrientationState,
  PositionState,
  SolidDimensions,
  SolidType,
} from '../../types/geometry';
import { DrawingPanel2D } from '../projection-views/DrawingPanel2D';
import { Viewport3D } from '../viewport/Viewport3D';

const SAMPLE_QUESTIONS = [
  {
    label: 'Hexagonal Prism (40° VP Edge, 60° HP Axis)',
    text: 'A hexagonal prism side of base 20mm and axis 70mm is resting on an edge of base on the HP. Inclined at 40 degree to the VP, with its axis inclined at 60 degree to HP. Draw the projections.',
  },
  {
    label: 'Hexagonal Pyramid (Top View 45° VP)',
    text: 'A hexagonal pyramid of base side 30 mm and axis length 60 mm is resting on one of its base corners on HP. Its axis is inclined at 30° to HP and top view of the axis is inclined at 45° to VP. Apex is away from VP and towards right side.',
  },
  {
    label: 'Cube (Body Diagonal ⊥ VP)',
    text: 'A cube of 40 mm side is resting on one of its corners on HP. Draw its projections if the body diagonal of the cube is perpendicular to VP.',
  },
  {
    label: 'Straight Line CD (Traces & Apparent Angles)',
    text: 'The end C of a line CD is on HP and 25 mm in front of VP. Line is inclined at 30° to HP and 45° to VP. Draw its projections and find the apparent length and apparent inclinations. Assume length of CD is 80 mm. Also locate its traces.',
  },
  {
    label: 'Section & Development (Pentagonal Pyramid)',
    text: 'A pentagonal pyramid with base edge length 30 mm and height 60 mm is resting on HP on its base. One of its base edges is parallel to VP and 20 mm in front of it. Sectioned by a plane inclined at 40° to HP, perpendicular to VP and passing through the midpoint of the axis. Top portion is removed. Draw development of remaining portion.',
  },
  {
    label: 'Isometric Combination (Pyramid on Hemisphere)',
    text: 'Draw the isometric view of a square pyramid, side of base 24 mm and height 40 mm, resting with its base centrally on the circular face of a hemisphere of diameter 50 mm.',
  },
];

const VALID_SOLIDS = new Set<SolidType>(SOLID_CATALOG.map((s) => s.type));

function sanitizeSolidType(raw: string | undefined, fallback: SolidType): SolidType {
  if (raw && VALID_SOLIDS.has(raw as SolidType)) return raw as SolidType;
  return fallback;
}

interface AiQuestionSolverProps {
  onBack: () => void;
  onSwitchToManualSolid: () => void;
}

export function AiQuestionSolver({ onBack, onSwitchToManualSolid }: AiQuestionSolverProps) {
  const loadConfiguration = useProjectStore((s) => s.loadConfiguration);
  const setWizardStep = useProjectStore((s) => s.setWizardStep);
  const setLinesInput = useProjectStore((s) => s.setLinesInput);
  const setSectionInput = useProjectStore((s) => s.setSectionInput);
  const setIsometricInput = useProjectStore((s) => s.setIsometricInput);
  const setActiveSection = useProjectStore((s) => s.setActiveSection);
  const drawingSettings = useProjectStore((s) => s.drawingSettings);

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AiQuestionAnswer | null>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [answerViewFocus, setAnswerViewFocus] = useState<'all' | 'steps' | 'drawing' | '3d'>('all');
  const [drawing2DMode, setDrawing2DMode] = useState<'combined' | 'elevation' | 'plan'>('combined');
  const [cameraRequest, setCameraRequest] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: 'isometric',
    nonce: 0,
  });

  const handleSolve = async (customText?: string) => {
    const q = (customText ?? question).trim();
    if (!q) {
      setError('Please type or paste your Engineering Graphics question first.');
      return;
    }
    if (customText) setQuestion(customText);
    setLoading(true);
    setError(null);
    setStageIdx(0);
    setAnswerViewFocus('all');
    setDrawing2DMode('combined');

    try {
      const res = await fetch('/api/solve-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Request failed with status ${res.status}`);
        setAnswer(null);
      } else {
        setAnswer(data as AiQuestionAnswer);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Network error while contacting AI solver. Please try again.'
      );
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  };

  // Convert AI structured output into verified simulator configurations
  const parsedSolids = useMemo(() => {
    if (!answer || answer.module !== 'solids' || !answer.solidsConfig) return null;
    const cfg = answer.solidsConfig;
    const solidType = sanitizeSolidType(cfg.solidType, 'hexagonal_prism');
    const sideLength = Math.max(5, Math.min(200, Number(cfg.sideLength) || 25));
    const baseRadius = Math.max(5, Math.min(200, Number(cfg.baseRadius) || 25));
    const axisLength =
      solidType === 'cube'
        ? sideLength
        : solidType === 'hemisphere'
          ? baseRadius
          : Math.max(5, Math.min(300, Number(cfg.axisLength) || 60));
    const dimensions: SolidDimensions = {
      ...DEFAULT_DIMENSIONS,
      sideLength,
      baseWidth:
        solidType === 'cube'
          ? sideLength
          : Math.max(5, Math.min(200, Number(cfg.baseWidth) || sideLength)),
      rectangularBase: solidType === 'square_prism' ? Boolean(cfg.rectangularBase) : false,
      baseRadius,
      axisLength,
      numSides: Math.max(
        3,
        Math.min(12, Number(cfg.numSides) || getSideCount(solidType, DEFAULT_DIMENSIONS))
      ),
    };
    const orientation: OrientationState = {
      ...createDefaultOrientation(),
      mode: 'inclination',
      restingCondition: cfg.restingCondition || 'base_edge_hp',
      inclinedElement: cfg.inclinedElement || 'axis',
      vpAngleType: cfg.vpAngleType || 'true',
      alphaHP: Math.max(0, Math.min(90, Number(cfg.alphaHP ?? 30))),
      betaVP: Math.max(0, Math.min(90, Number(cfg.betaVP ?? 45))),
      leanDirectionX: cfg.leanDirectionX === 'negative' ? 'negative' : 'positive',
      leanDirectionY: cfg.leanDirectionY === 'negative' ? 'negative' : 'positive',
    };
    const position: PositionState = {
      ...createDefaultPosition(),
      inFrontOfVP: Math.max(0, Math.min(150, Number(cfg.inFrontOfVP) || 25)),
      snapToHP: orientation.restingCondition !== 'base_vp' && orientation.restingCondition !== 'free',
      snapToVP: orientation.restingCondition === 'base_vp',
    };
    const stageRes = generateThreeStageSteps(
      solidType,
      dimensions,
      orientation,
      position,
      drawingSettings.convention
    );
    return { solidType, dimensions, orientation, position, stageRes };
  }, [answer, drawingSettings.convention]);

  const parsedLines = useMemo(() => {
    if (!answer || answer.module !== 'lines' || !answer.linesConfig) return null;
    const cfg = answer.linesConfig;
    const input: LineProblemInput = {
      startLabel: (cfg.startLabel || 'a').slice(0, 2),
      endLabel: (cfg.endLabel || 'b').slice(0, 2),
      inputMode: cfg.inputMode === 'views' ? 'views' : 'angles',
      trueLength: Math.max(5, Number(cfg.trueLength) || 70),
      startAboveHP: Math.max(0, Number(cfg.startAboveHP) || 0),
      startInFrontVP: Math.max(0, Number(cfg.startInFrontVP) || 20),
      thetaHP: Math.max(0, Math.min(90, Number(cfg.thetaHP) || 30)),
      phiVP: Math.max(0, Math.min(90, Number(cfg.phiVP) || 45)),
      planLength: Math.max(1, Number(cfg.planLength) || 50),
      elevLength: Math.max(1, Number(cfg.elevLength) || 40),
      leanRight: cfg.leanRight !== false,
      leanForward: cfg.leanForward !== false,
      leanUp: cfg.leanUp !== false,
    };
    return { input, solution: solveLineProblem(input) };
  }, [answer]);

  const parsedSection = useMemo(() => {
    if (!answer || answer.module !== 'sections' || !answer.sectionsConfig) return null;
    const cfg = answer.sectionsConfig;
    const solidType = sanitizeSolidType(cfg.solidType, 'pentagonal_pyramid');
    const sideLength = Math.max(5, Math.min(200, Number(cfg.sideLength) || 30));
    const baseRadius = Math.max(5, Math.min(200, Number(cfg.baseRadius) || 25));
    const axisLength =
      solidType === 'cube' ? sideLength : Math.max(5, Math.min(300, Number(cfg.axisLength) || 60));
    const input: SectionProblemInput = {
      solidType,
      dimensions: {
        ...DEFAULT_DIMENSIONS,
        sideLength,
        baseWidth: sideLength,
        rectangularBase: false,
        baseRadius,
        axisLength,
        numSides: getSideCount(solidType, DEFAULT_DIMENSIONS),
      },
      baseEdgeOrientation: cfg.baseEdgeOrientation || 'edge_parallel_vp',
      inFrontOfVP: Math.max(5, Number(cfg.inFrontOfVP) || 20),
      planeMode:
        cfg.planeMode === 'through_body_diagonal' ? 'through_body_diagonal' : 'angle_height',
      sectionAngleDeg: Math.max(0, Math.min(85, Number(cfg.sectionAngleDeg) || 40)),
      sectionHeightAtAxis: Math.max(1, Math.min(axisLength - 1, Number(cfg.sectionHeightAtAxis) || axisLength / 2)),
      keepPortion: cfg.keepPortion === 'top' ? 'top' : 'bottom',
    };
    return { input, solution: solveSectionedSolid(input) };
  }, [answer]);

  const parsedIsometric = useMemo(() => {
    if (!answer || answer.module !== 'isometric' || !answer.isometricConfig) return null;
    const cfg = answer.isometricConfig;
    const bottomType = sanitizeSolidType(cfg.bottomType, 'hemisphere');
    const topType = sanitizeSolidType(cfg.topType, 'square_pyramid');
    const input: IsometricProblemInput = {
      scaleMode: cfg.scaleMode === 'projection' ? 'projection' : 'view',
      hasTopSolid: cfg.hasTopSolid !== false,
      bottom: {
        type: bottomType,
        sideOrRadius: Math.max(5, Number(cfg.bottomSideOrRadius) || 25),
        secondaryWidth: Math.max(5, Number(cfg.bottomSecondaryWidth) || 25),
        height:
          bottomType === 'hemisphere'
            ? Math.max(5, Number(cfg.bottomSideOrRadius) || 25)
            : Math.max(5, Number(cfg.bottomHeight) || 25),
      },
      top: {
        type: topType,
        sideOrRadius: Math.max(5, Number(cfg.topSideOrRadius) || 24),
        secondaryWidth: Math.max(5, Number(cfg.topSecondaryWidth) || 24),
        height: Math.max(5, Number(cfg.topHeight) || 40),
      },
    };
    return { input, drawing: generateIsometricDrawing(input) };
  }, [answer]);

  const activeStage = parsedSolids?.stageRes.stages[
    Math.min(stageIdx, Math.max(0, (parsedSolids?.stageRes.stages.length ?? 1) - 1))
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Options
        </button>

        <button
          type="button"
          onClick={onSwitchToManualSolid}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl cursor-pointer"
        >
          <Box className="w-4 h-4" />
          Switch to Select Solid Manually
        </button>
      </div>

      {/* Question Input Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-700">
            <Sparkles className="w-4 h-4" />
            AI Engineering Graphics Solver (Modules 1–4)
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            Type or Paste Your Question
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            AI answers your question directly with given data, formulas, step-by-step construction, and generates the live 2D &amp; 3D drawing.
          </p>
        </div>

        <textarea
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Example: A hexagonal prism side of base 20mm and axis 70mm is resting on an edge of base on the HP. Inclined at 40 degree to the VP, with its axis inclined at 60 degree to HP. Draw the projections."
          className="w-full px-4 py-3 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white resize-y"
        />

        <div className="space-y-2">
          <div className="text-[11px] font-medium text-slate-500">
            Try a sample KTU question:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUESTIONS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => handleSolve(sample.text)}
                disabled={loading}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-800 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {question.trim() && (
            <button
              type="button"
              onClick={() => {
                setQuestion('');
                setAnswer(null);
                setError(null);
              }}
              className="px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={loading || !question.trim()}
            onClick={() => handleSolve()}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Solving Question...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Answer Question by AI
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Direct AI Answer + Live Interactive Simulation */}
      {answer && (
        <div className="space-y-5">
          {/* Quick Buttons Bar for Steps & Views */}
          <div className="sticky top-16 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAnswerViewFocus('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  answerViewFocus === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                All
              </button>
              <button
                type="button"
                onClick={() => setAnswerViewFocus('steps')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  answerViewFocus === 'steps'
                    ? 'bg-blue-700 text-white'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                See Steps ({answer.steps.length})
              </button>
              {(parsedSolids || parsedLines || parsedSection || parsedIsometric) && (
                <button
                  type="button"
                  onClick={() => setAnswerViewFocus('drawing')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    answerViewFocus === 'drawing'
                      ? 'bg-blue-700 text-white'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  2D Drawing
                </button>
              )}
              {(parsedSolids || parsedSection || parsedIsometric) && (
                <button
                  type="button"
                  onClick={() => setAnswerViewFocus('3d')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    answerViewFocus === '3d'
                      ? 'bg-blue-700 text-white'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  3D View
                </button>
              )}
            </div>

            {parsedSolids && parsedSolids.stageRes.stages.length > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                {parsedSolids.stageRes.stages.map((st, idx) => (
                  <button
                    key={st.stageNumber}
                    type="button"
                    onClick={() => {
                      setStageIdx(idx);
                      if (answerViewFocus === 'steps') {
                        setAnswerViewFocus('all');
                      }
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      idx === stageIdx
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

          {/* Written Answer & Steps Card */}
          {(answerViewFocus === 'all' || answerViewFocus === 'steps') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-semibold text-blue-700 uppercase">
                    Direct AI Solution · {answer.module}
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                    {answer.title}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Solved Directly
                </span>
              </div>

              <p className="text-sm text-slate-800 leading-relaxed bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                {answer.summary}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {answer.givenData.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Given Data
                    </h3>
                    <dl className="space-y-1.5 text-xs">
                      {answer.givenData.map((g, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3">
                          <dt className="text-slate-600">{g.label}</dt>
                          <dd className="font-mono font-semibold text-slate-900 text-right">
                            {g.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {answer.keyResults.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Key Results &amp; Answers
                    </h3>
                    <dl className="space-y-1.5 text-xs">
                      {answer.keyResults.map((r, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3">
                          <dt className="text-slate-600">{r.label}</dt>
                          <dd className="font-mono font-semibold text-blue-800 text-right">
                            {r.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>

              {answer.steps.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Step-by-Step Construction Procedure
                    </h3>
                    {(parsedSolids || parsedLines || parsedSection || parsedIsometric) && (
                      <button
                        type="button"
                        onClick={() => setAnswerViewFocus('drawing')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        See 2D &amp; 3D Views →
                      </button>
                    )}
                  </div>
                  <ol className="space-y-2.5">
                    {answer.steps.map((st, idx) => (
                      <li
                        key={idx}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm space-y-1"
                      >
                        <div className="font-semibold text-slate-900">
                          Step {idx + 1}: {st.title}
                        </div>
                        <p className="text-slate-600 leading-relaxed">{st.instruction}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {parsedSolids && answerViewFocus === 'steps' && (
                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    3-Stage Orthographic Drawing Breakdown
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {parsedSolids.stageRes.stages.map((st, idx) => (
                      <div
                        key={st.stageNumber}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-mono font-semibold text-blue-700">
                            {st.badge}
                          </div>
                          <div className="font-display text-sm font-bold text-slate-900">
                            {st.title}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{st.whatToDraw}</p>
                          <div className="p-2 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700">
                            {st.formulaNote}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStageIdx(idx);
                            setAnswerViewFocus('drawing');
                          }}
                          className="w-full py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                        >
                          View Step {st.stageNumber} Drawing →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive 2D/3D Engine Rendering for Module 2: Solids */}
          {parsedSolids && activeStage && answerViewFocus !== 'steps' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
                    Generated 3-Stage Orthographic &amp; 3D Projections
                  </h3>
                  <p className="text-xs text-slate-500">
                    Computed mathematically from the AI-extracted geometry.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      loadConfiguration({
                        solidType: parsedSolids.solidType,
                        dimensions: parsedSolids.dimensions,
                        orientation: parsedSolids.orientation,
                        position: parsedSolids.position,
                        title: answer.title,
                        openWorkspace: false,
                      });
                      setWizardStep(6);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                  >
                    Open in Step-by-Step View
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      loadConfiguration({
                        solidType: parsedSolids.solidType,
                        dimensions: parsedSolids.dimensions,
                        orientation: parsedSolids.orientation,
                        position: parsedSolids.position,
                        title: answer.title,
                        openWorkspace: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                  >
                    Open Full CAD &amp; Export
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {parsedSolids.stageRes.stages.map((st, idx) => (
                  <button
                    key={st.stageNumber}
                    type="button"
                    onClick={() => setStageIdx(idx)}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      idx === stageIdx
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="font-display text-xs sm:text-sm font-semibold">{st.title}</div>
                    <div
                      className={`text-[11px] font-mono mt-0.5 ${
                        idx === stageIdx ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {st.badge}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {(answerViewFocus === 'all' || answerViewFocus === 'drawing') && (
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
                            onClick={() => setDrawing2DMode(m.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer ${
                              drawing2DMode === m.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-[380px] sm:h-[430px]">
                      <DrawingPanel2D
                        drawing={activeStage.drawing}
                        settings={{
                          ...drawingSettings,
                          showConstruction: true,
                          showHidden: true,
                          showLabels: true,
                        }}
                        mode={drawing2DMode}
                        highlightIds={activeStage.highlightIds}
                        title={`2D Drawing — ${activeStage.title}`}
                      />
                    </div>
                  </div>
                )}

                {(answerViewFocus === 'all' || answerViewFocus === '3d') && (
                  <div
                    className={`${
                      answerViewFocus === '3d' ? 'h-[400px] sm:h-[460px]' : 'h-[330px] sm:h-[380px]'
                    } rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col`}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        3D View — {activeStage.title}
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
                            onClick={() =>
                              setCameraRequest((prev) => ({ preset: cam.id, nonce: prev.nonce + 1 }))
                            }
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded cursor-pointer"
                          >
                            {cam.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Viewport3D
                        worldSolid={activeStage.worldSolid}
                        cameraRequest={cameraRequest}
                        onTriggerPreset={(preset) =>
                          setCameraRequest((prev) => ({ preset, nonce: prev.nonce + 1 }))
                        }
                        interactive
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lines 2D Preview & Action Bridge */}
          {parsedLines && answerViewFocus !== 'steps' && answerViewFocus !== '3d' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-display text-base font-bold text-slate-900">
                    2D Line Projections &amp; Traces
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    TV = {parsedLines.solution.planLength.toFixed(1)} mm · FV ={' '}
                    {parsedLines.solution.elevLength.toFixed(1)} mm · α ={' '}
                    {parsedLines.solution.apparentAlphaElev.toFixed(1)}° · β ={' '}
                    {parsedLines.solution.apparentBetaPlan.toFixed(1)}°
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLinesInput(parsedLines.input);
                    setActiveSection('lines');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  Open Interactive Drawing in Lines Module
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {parsedLines.solution.valid && (
                <div className="h-[300px] border border-slate-200 rounded-xl bg-white p-3">
                  <svg
                    viewBox={`${Math.min(parsedLines.solution.p0.x, parsedLines.solution.p1.x) - 24} ${-Math.max(parsedLines.solution.p0.z, parsedLines.solution.p1.z, 25) - 20} ${Math.max(120, Math.abs(parsedLines.solution.p1.x - parsedLines.solution.p0.x) + 60)} ${Math.max(100, Math.max(parsedLines.solution.p0.z, parsedLines.solution.p1.z, 25) + Math.max(parsedLines.solution.p0.y, parsedLines.solution.p1.y, 25) + 42)}`}
                    className="w-full h-full"
                    role="img"
                    aria-label="Straight line orthographic drawing"
                  >
                    <line
                      x1={Math.min(parsedLines.solution.p0.x, parsedLines.solution.p1.x) - 20}
                      y1={0}
                      x2={Math.max(parsedLines.solution.p0.x, parsedLines.solution.p1.x) + 30}
                      y2={0}
                      stroke="#1e293b"
                      strokeWidth={0.8}
                    />
                    <line
                      x1={parsedLines.solution.p0.x}
                      y1={-parsedLines.solution.p0.z}
                      x2={parsedLines.solution.p0.x}
                      y2={parsedLines.solution.p0.y}
                      stroke="#94a3b8"
                      strokeWidth={0.45}
                    />
                    <line
                      x1={parsedLines.solution.p1.x}
                      y1={-parsedLines.solution.p1.z}
                      x2={parsedLines.solution.p1.x}
                      y2={parsedLines.solution.p1.y}
                      stroke="#94a3b8"
                      strokeWidth={0.45}
                    />
                    <line
                      x1={parsedLines.solution.p0.x}
                      y1={-parsedLines.solution.p0.z}
                      x2={parsedLines.solution.p1.x}
                      y2={-parsedLines.solution.p1.z}
                      stroke="#0f172a"
                      strokeWidth={1.3}
                    />
                    <line
                      x1={parsedLines.solution.p0.x}
                      y1={parsedLines.solution.p0.y}
                      x2={parsedLines.solution.p1.x}
                      y2={parsedLines.solution.p1.y}
                      stroke="#1d4ed8"
                      strokeWidth={1.3}
                    />
                    <circle cx={parsedLines.solution.p0.x} cy={-parsedLines.solution.p0.z} r={1.8} fill="#0f172a" />
                    <circle cx={parsedLines.solution.p1.x} cy={-parsedLines.solution.p1.z} r={1.8} fill="#0f172a" />
                    <circle cx={parsedLines.solution.p0.x} cy={parsedLines.solution.p0.y} r={1.8} fill="#1d4ed8" />
                    <circle cx={parsedLines.solution.p1.x} cy={parsedLines.solution.p1.y} r={1.8} fill="#1d4ed8" />
                    <text x={parsedLines.solution.p0.x - 4} y={-parsedLines.solution.p0.z - 3} fontSize={4.5} fill="#0f172a">
                      {`${parsedLines.input.startLabel}'`}
                    </text>
                    <text x={parsedLines.solution.p1.x + 2} y={-parsedLines.solution.p1.z - 3} fontSize={4.5} fill="#0f172a">
                      {`${parsedLines.input.endLabel}'`}
                    </text>
                    <text x={parsedLines.solution.p0.x - 4} y={parsedLines.solution.p0.y + 6} fontSize={4.5} fill="#1d4ed8">
                      {parsedLines.input.startLabel}
                    </text>
                    <text x={parsedLines.solution.p1.x + 2} y={parsedLines.solution.p1.y + 6} fontSize={4.5} fill="#1d4ed8">
                      {parsedLines.input.endLabel}
                    </text>
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Sections: 2D Drawing Upside, 3D View Downside */}
          {parsedSection && answerViewFocus !== 'steps' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-display text-base font-bold text-slate-900">
                    Sectional Drawing &amp; 3D Cut Model
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    Section Angle = {parsedSection.solution.sectionAngleDeg.toFixed(1)}° · True Shape Area ={' '}
                    {parsedSection.solution.trueShapeAreaMm2.toFixed(1)} mm²
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSectionInput(parsedSection.input);
                    setActiveSection('sections');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  Open Sectional Views &amp; Development
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {(answerViewFocus === 'all' || answerViewFocus === 'drawing') && (
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
                            onClick={() => setDrawing2DMode(m.id)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer ${
                              drawing2DMode === m.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-[360px] sm:h-[400px]">
                      <DrawingPanel2D
                        drawing={parsedSection.solution.drawing}
                        settings={{
                          ...drawingSettings,
                          showConstruction: true,
                          showHidden: true,
                          showLabels: true,
                        }}
                        mode={drawing2DMode}
                        title="2D Drawing — Sectional Orthographic Views"
                      />
                    </div>
                  </div>
                )}

                {(answerViewFocus === 'all' || answerViewFocus === '3d') && (
                  <div
                    className={`${
                      answerViewFocus === '3d' ? 'h-[400px] sm:h-[460px]' : 'h-[320px] sm:h-[360px]'
                    } rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col`}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        3D View — Remaining Cut Solid
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
                            onClick={() =>
                              setCameraRequest((prev) => ({ preset: cam.id, nonce: prev.nonce + 1 }))
                            }
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded cursor-pointer"
                          >
                            {cam.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Viewport3D
                        worldSolid={parsedSection.solution.sectionedWorldSolid}
                        cameraRequest={cameraRequest}
                        onTriggerPreset={(preset) =>
                          setCameraRequest((prev) => ({ preset, nonce: prev.nonce + 1 }))
                        }
                        interactive
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Isometric: 2D Isometric Drawing Upside, 3D View Downside */}
          {parsedIsometric && answerViewFocus !== 'steps' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-display text-base font-bold text-slate-900">
                    2D Isometric Drawing &amp; 3D Assembly
                  </div>
                  <div className="text-xs font-mono text-slate-600">
                    Total Height = {parsedIsometric.drawing.totalHeightMm.toFixed(1)} mm · Scale ={' '}
                    {parsedIsometric.input.scaleMode === 'view'
                      ? 'Isometric View (1:1)'
                      : 'Isometric Projection (0.816×)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsometricInput(parsedIsometric.input);
                    setActiveSection('isometric');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  Open 2D Isometric SVG &amp; Controls
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                {(answerViewFocus === 'all' || answerViewFocus === 'drawing') && (
                  <div className="h-[340px] sm:h-[380px] rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
                    <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                      2D Drawing — Isometric View
                    </div>
                    <div className="flex-1 p-3">
                      <svg
                        viewBox={`${parsedIsometric.drawing.bounds.minX - 16} ${-parsedIsometric.drawing.bounds.maxY - 16} ${Math.max(60, parsedIsometric.drawing.bounds.maxX - parsedIsometric.drawing.bounds.minX + 32)} ${Math.max(60, parsedIsometric.drawing.bounds.maxY - parsedIsometric.drawing.bounds.minY + 32)}`}
                        className="w-full h-full"
                        role="img"
                        aria-label="2D Isometric Drawing"
                      >
                        {parsedIsometric.drawing.lines.map((ln) => (
                          <line
                            key={ln.id}
                            x1={ln.x1}
                            y1={-ln.y1}
                            x2={ln.x2}
                            y2={-ln.y2}
                            stroke={
                              ln.style === 'visible'
                                ? '#0f172a'
                                : ln.style === 'hidden'
                                  ? '#64748b'
                                  : ln.style === 'iso_axis'
                                    ? '#94a3b8'
                                    : '#2563eb'
                            }
                            strokeWidth={ln.style === 'visible' ? 1.05 : ln.style === 'iso_axis' ? 0.45 : 0.6}
                            strokeDasharray={
                              ln.style === 'hidden'
                                ? '2.2 1.6'
                                : ln.style === 'iso_axis'
                                  ? '2 1.5'
                                  : ln.style === 'axis'
                                    ? '5 1.5 1 1.5'
                                    : undefined
                            }
                            strokeLinecap="round"
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                )}

                {(answerViewFocus === 'all' || answerViewFocus === '3d') && (
                  <div
                    className={`${
                      answerViewFocus === '3d' ? 'h-[400px] sm:h-[460px]' : 'h-[320px] sm:h-[360px]'
                    } rounded-xl border border-slate-200 overflow-hidden bg-white flex flex-col`}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        3D View — Combined Solid Assembly
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
                            onClick={() =>
                              setCameraRequest((prev) => ({ preset: cam.id, nonce: prev.nonce + 1 }))
                            }
                            className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 rounded cursor-pointer"
                          >
                            {cam.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Viewport3D
                        worldSolid={parsedIsometric.drawing.combinedWorldSolid}
                        cameraRequest={cameraRequest}
                        onTriggerPreset={(preset) =>
                          setCameraRequest((prev) => ({ preset, nonce: prev.nonce + 1 }))
                        }
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
