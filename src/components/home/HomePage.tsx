import { ArrowRight, BookOpen, Box, Compass, FolderKanban, HelpCircle, Layers, Scissors, Sparkles, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { buildLocalSolid } from '../../engine/geometry';
import { KTU_QUESTION_BANK } from '../../engine/learning';
import { createDefaultOrientation, createDefaultPosition, solveOrientation, transformSolid } from '../../engine/orientation';
import { generateOrthographicDrawing } from '../../engine/projection';
import { useProjectStore } from '../../store/project-store';
import { DrawingPanel2D } from '../projection-views/DrawingPanel2D';

export function HomePage() {
  const setActiveSection = useProjectStore((s) => s.setActiveSection);
  const setLearnSourceMode = useProjectStore((s) => s.setLearnSourceMode);
  const startNewDrawing = useProjectStore((s) => s.startNewDrawing);
  const openAiQuestionSolver = useProjectStore((s) => s.openAiQuestionSolver);
  const startManualSolid = useProjectStore((s) => s.startManualSolid);
  const loadConfiguration = useProjectStore((s) => s.loadConfiguration);
  const drawingSettings = useProjectStore((s) => s.drawingSettings);

  // Live mathematical preview on Home screen (Hexagonal Prism 30° HP, 45° VP)
  const heroDrawing = useMemo(() => {
    const local = buildLocalSolid('hexagonal_prism', {
      sideLength: 26,
      baseWidth: 26,
      rectangularBase: false,
      baseRadius: 22,
      axisLength: 55,
      numSides: 6,
    });
    const ori = {
      ...createDefaultOrientation(),
      restingCondition: 'base_edge_hp' as const,
      alphaHP: 30,
      betaVP: 45,
      referenceEdgeId: 'edge_base_0',
    };
    const pos = createDefaultPosition();
    const solved = solveOrientation(local, ori, pos, { kind: 'axis' });
    const world = transformSolid(local, solved.quaternion, pos);
    return generateOrthographicDrawing(world, 'first_angle');
  }, []);

  const featuredSolidsProblems = useMemo(() => {
    const q3 = KTU_QUESTION_BANK.find((p) => p.id === 'ktu_hex_pyramid_corner_apparent_45');
    const q4 = KTU_QUESTION_BANK.find((p) => p.id === 'ktu_cube_corner_body_diag_vp');
    const q1 = KTU_QUESTION_BANK[0];
    return [q3, q4, q1].filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, []);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
          <div className="text-xs font-mono text-blue-700 font-medium">
            B.Tech Engineering Graphics · Complete KTU Modules 1–4
          </div>

          <h1
            className="font-display text-3xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.12]"
            style={{ textWrap: 'balance' }}
          >
            Interactive Lines, Solids, Sections &amp; Isometric Views
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-xl">
            Solve KTU Modules 1 to 4 interactively: straight lines and traces, step-by-step projections of solids &amp; cubes, sections with true shape and surface development, and isometric combinations.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={openAiQuestionSolver}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Type Question (AI Answer)
            </button>

            <button
              type="button"
              onClick={startManualSolid}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Box className="w-4 h-4 text-blue-700" />
              Select Solid Step-by-Step
            </button>

            <button
              type="button"
              onClick={() => {
                setLearnSourceMode('bank');
                setActiveSection('learn');
              }}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-blue-700" />
              Learn Mode
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={() => setActiveSection('projects')}
              className="inline-flex items-center gap-1.5 hover:text-blue-700 font-medium cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              Saved Projects
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('guide')}
              className="inline-flex items-center gap-1.5 hover:text-blue-700 font-medium cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Engineering Graphics Guide
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-500">SVG / PNG / A4 PDF Export</span>
          </div>
        </div>

        {/* Live Calculated Drawing Preview */}
        <div className="lg:col-span-6 h-[380px] lg:h-[430px]">
          <DrawingPanel2D
            drawing={heroDrawing}
            settings={{
              ...drawingSettings,
              showConstruction: true,
              showHidden: true,
              showDimensions: true,
              showLabels: true,
            }}
            mode="combined"
            title="Live Engine Output — Hexagonal Prism (α = 30° HP, β = 45° VP)"
          />
        </div>
      </section>

      {/* KTU Modules 1-4 Launch Grid */}
      <section className="space-y-4 pt-6 border-t border-slate-200">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            KTU Syllabus Modules
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Pick a module directly or load its textbook presets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveSection('lines')}
            className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-5 space-y-2.5 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-mono text-blue-700 font-semibold">MODULE 1</div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Straight Lines &amp; Traces
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Solve true/apparent inclinations, TV/FV lengths, locus lines, HT and VT (Q1 &amp; Q2).
            </p>
          </button>

          <button
            type="button"
            onClick={() => startNewDrawing()}
            className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-5 space-y-2.5 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-mono text-blue-700 font-semibold">MODULE 2</div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Projections of Solids
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Guided 3-stage solver with slant edge, body diagonal &amp; top-view apparent angles (Q3 &amp; Q4).
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('sections')}
            className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-5 space-y-2.5 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-mono text-blue-700 font-semibold">MODULE 3</div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Sections &amp; Development
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Section planes, hatched top view, true shape area, XY angle &amp; lateral development (Q5 &amp; Q6).
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('isometric')}
            className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-5 space-y-2.5 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Box className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-mono text-blue-700 font-semibold">MODULE 4</div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Isometric Combinations
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Stack solids centrally on hemispheres or square plates with exact 2D isometric curves (Q7 &amp; Q8).
            </p>
          </button>
        </div>
      </section>

      {/* Quick Launch KTU Problems */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Quick-Launch Module 2 KTU Problems
          </h2>
          <button
            type="button"
            onClick={() => {
              setLearnSourceMode('bank');
              setActiveSection('learn');
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            View all {KTU_QUESTION_BANK.length} solid problems →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featuredSolidsProblems.map((prob) => (
            <button
              key={prob.id}
              type="button"
              onClick={() =>
                loadConfiguration({
                  solidType: prob.solidType,
                  dimensions: prob.dimensions,
                  orientation: prob.orientation,
                  position: prob.position,
                  title: prob.title,
                  openWorkspace: true,
                })
              }
              className="text-left bg-white border border-slate-200 hover:border-blue-600 rounded-xl p-4 space-y-2 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-mono text-slate-500">
                Level {prob.level} · {prob.solidType.replace('_', ' ')}
              </div>
              <div className="font-display text-sm font-semibold text-slate-900">
                {prob.title}
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {prob.statement}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
