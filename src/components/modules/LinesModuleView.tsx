import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { KTU_LINE_PRESETS, solveLineProblem } from '../../engine/lines';
import { useProjectStore } from '../../store/project-store';
import type { LineProblemInput } from '../../types/geometry';
import { NumericInput } from '../ui/NumericInput';

export function LinesModuleView() {
  const input = useProjectStore((s) => s.linesInput);
  const setLinesInput = useProjectStore((s) => s.setLinesInput);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sol = useMemo(() => solveLineProblem(input), [input]);
  const activePresetId =
    KTU_LINE_PRESETS.find((p) => JSON.stringify(p.input) === JSON.stringify(input))?.id ?? '';

  const setInput = (next: LineProblemInput) => setLinesInput(next);
  const setActivePresetId = (_id: string) => {};

  const update = (partial: Partial<LineProblemInput>) => {
    setLinesInput({ ...input, ...partial });
  };

  // Compute SVG viewport bounds for First-Angle Projection (Elevation Z > 0 above XY, Plan Y > 0 below XY)
  const { vbX, vbY, vbW, vbH, xyMinX, xyMaxX } = useMemo(() => {
    const xs = [sol.p0.x, sol.p1.x];
    const ys = [-sol.p0.z, -sol.p1.z, sol.p0.y, sol.p1.y];
    if (sol.ht) {
      xs.push(sol.ht.x);
      ys.push(sol.ht.y, 0);
    }
    if (sol.vt) {
      xs.push(sol.vt.x);
      ys.push(-sol.vt.z, 0);
    }
    // Include true-length locus swing endpoint
    const p0ElevX = sol.p0.x + (input.leanRight ? 1 : -1) * sol.trueLength;
    xs.push(p0ElevX);

    const minX = Math.min(...xs) - 22;
    const maxX = Math.max(...xs) + 28;
    const minY = Math.min(...ys, -25) - 20;
    const maxY = Math.max(...ys, 25) + 22;
    return {
      vbX: minX,
      vbY: minY,
      vbW: Math.max(120, maxX - minX),
      vbH: Math.max(100, maxY - minY),
      xyMinX: minX + 4,
      xyMaxX: maxX - 4,
    };
  }, [sol, input.leanRight]);

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `line_${input.startLabel}${input.endLabel}_projections.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sL = input.startLabel || 'a';
  const eL = input.endLabel || 'b';

  // True-length construction helper coordinates (from p0 to true-length rotated positions)
  const sx = input.leanRight ? 1 : -1;
  const sy = input.leanForward ? 1 : -1;
  const sz = input.leanUp ? 1 : -1;
  const radTheta = (sol.trueThetaHP * Math.PI) / 180;
  const radPhi = (sol.truePhiVP * Math.PI) / 180;
  const tlElevEnd = {
    x: sol.p0.x + sx * sol.trueLength * Math.cos(radTheta),
    y: -(sol.p0.z + sz * sol.trueLength * Math.sin(radTheta)),
  };
  const tlPlanEnd = {
    x: sol.p0.x + sx * sol.trueLength * Math.cos(radPhi),
    y: sol.p0.y + sy * sol.trueLength * Math.sin(radPhi),
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header & KTU Presets */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-blue-700 font-semibold">
              MODULE 1 · STRAIGHT LINES &amp; TRACES
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              Projections of Lines, Apparent Angles &amp; Traces (HT / VT)
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {KTU_LINE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setInput({ ...preset.input });
                  setActivePresetId(preset.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  activePresetId === preset.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-500'
                }`}
              >
                {preset.title.split('·')[0].trim()} · {preset.input.startLabel.toUpperCase()}
                {preset.input.endLabel.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {activePresetId && (
          <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
            {KTU_LINE_PRESETS.find((p) => p.id === activePresetId)?.statement}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Controls Sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="m1-start-lbl" className="block text-xs font-medium text-slate-700 mb-1">
                Start Point Label
              </label>
              <input
                id="m1-start-lbl"
                type="text"
                maxLength={2}
                value={input.startLabel}
                onChange={(e) => update({ startLabel: e.target.value.toLowerCase() || 'a' })}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="m1-end-lbl" className="block text-xs font-medium text-slate-700 mb-1">
                End Point Label
              </label>
              <input
                id="m1-end-lbl"
                type="text"
                maxLength={2}
                value={input.endLabel}
                onChange={(e) => update({ endLabel: e.target.value.toLowerCase() || 'b' })}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-800">Given Parameters</span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => update({ inputMode: 'angles' })}
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  input.inputMode === 'angles'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Angles (θ° &amp; φ°)
              </button>
              <button
                type="button"
                onClick={() => update({ inputMode: 'views' })}
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  input.inputMode === 'views'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                View Lengths (TV &amp; FV)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="m1-tl" className="block text-xs font-medium text-slate-700 mb-1">
              True Length (mm)
            </label>
            <NumericInput
              id="m1-tl"
              min={5}
              max={250}
              value={input.trueLength}
              onChange={(v) => update({ trueLength: v })}
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="m1-hp" className="block text-xs font-medium text-slate-700 mb-1">
                {sL.toUpperCase()} above HP (mm)
              </label>
              <NumericInput
                id="m1-hp"
                min={-100}
                max={150}
                value={input.startAboveHP}
                onChange={(v) => update({ startAboveHP: v })}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="m1-vp" className="block text-xs font-medium text-slate-700 mb-1">
                {sL.toUpperCase()} in front of VP (mm)
              </label>
              <NumericInput
                id="m1-vp"
                min={-100}
                max={150}
                value={input.startInFrontVP}
                onChange={(v) => update({ startInFrontVP: v })}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {input.inputMode === 'angles' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="m1-theta" className="block text-xs font-medium text-slate-700 mb-1">
                  True θ to HP (°)
                </label>
                <NumericInput
                  id="m1-theta"
                  min={0}
                  max={90}
                  value={input.thetaHP}
                  onChange={(v) => update({ thetaHP: v })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="m1-phi" className="block text-xs font-medium text-slate-700 mb-1">
                  True φ to VP (°)
                </label>
                <NumericInput
                  id="m1-phi"
                  min={0}
                  max={90}
                  value={input.phiVP}
                  onChange={(v) => update({ phiVP: v })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="m1-tv" className="block text-xs font-medium text-slate-700 mb-1">
                  Top View Length (mm)
                </label>
                <NumericInput
                  id="m1-tv"
                  min={1}
                  max={250}
                  value={input.planLength}
                  onChange={(v) => update({ planLength: v })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="m1-fv" className="block text-xs font-medium text-slate-700 mb-1">
                  Front View Length (mm)
                </label>
                <NumericInput
                  id="m1-fv"
                  min={1}
                  max={250}
                  value={input.elevLength}
                  onChange={(v) => update({ elevLength: v })}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                />
              </div>
            </div>
          )}

          {!sol.valid ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-red-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Invalid Line Constraints</span>
              </div>
              {sol.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Solved Projections &amp; Traces</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono tabular-nums text-[11px]">
                <div>
                  <span className="font-sans text-slate-500 block">Top View (Plan)</span>
                  <span className="font-semibold text-slate-900">{sol.planLength.toFixed(2)} mm</span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 block">Front View (Elev)</span>
                  <span className="font-semibold text-slate-900">{sol.elevLength.toFixed(2)} mm</span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 block">True θ (HP)</span>
                  <span className="font-semibold text-slate-900">{sol.trueThetaHP.toFixed(2)}°</span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 block">True φ (VP)</span>
                  <span className="font-semibold text-slate-900">{sol.truePhiVP.toFixed(2)}°</span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 block">Apparent α (Elev)</span>
                  <span className="font-semibold text-blue-700">{sol.apparentAlphaElev.toFixed(2)}°</span>
                </div>
                <div>
                  <span className="font-sans text-slate-500 block">Apparent β (Plan)</span>
                  <span className="font-semibold text-blue-700">{sol.apparentBetaPlan.toFixed(2)}°</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200">
                  <span className="font-sans text-slate-500">HT (in front of VP): </span>
                  <span className="font-semibold text-slate-900">
                    {sol.ht ? `${sol.ht.y.toFixed(1)} mm (x=${sol.ht.x.toFixed(1)})` : 'Parallel to HP (No HT)'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="font-sans text-slate-500">VT (above HP): </span>
                  <span className="font-semibold text-slate-900">
                    {sol.vt ? `${sol.vt.z.toFixed(1)} mm (x=${sol.vt.x.toFixed(1)})` : 'Parallel to VP (No VT)'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Orthographic SVG Canvas */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="font-display text-xs sm:text-sm font-semibold text-slate-800">
              First-Angle Orthographic Projections &amp; Traces ({sL.toUpperCase()}
              {eL.toUpperCase()})
            </span>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export SVG
            </button>
          </div>

          <div className="h-[460px] p-2">
            <svg
              ref={svgRef}
              viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
              className="w-full h-full select-none"
            >
              {/* XY Reference Line */}
              <line
                x1={xyMinX}
                y1={0}
                x2={xyMaxX}
                y2={0}
                stroke="#0f172a"
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
              <text x={xyMinX} y={-2} fontSize="4.2" fontWeight="700" fill="#0f172a">
                X
              </text>
              <text x={xyMaxX - 4} y={-2} fontSize="4.2" fontWeight="700" fill="#0f172a">
                Y
              </text>

              {/* Locus lines */}
              <line
                x1={sol.p0.x - 10}
                y1={-sol.p1.z}
                x2={xyMaxX - 8}
                y2={-sol.p1.z}
                stroke="#cbd5e1"
                strokeDasharray="2 1.5"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={sol.p0.x - 10}
                y1={sol.p1.y}
                x2={xyMaxX - 8}
                y2={sol.p1.y}
                stroke="#cbd5e1"
                strokeDasharray="2 1.5"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />

              {/* End Projectors */}
              <line
                x1={sol.p0.x}
                y1={-sol.p0.z}
                x2={sol.p0.x}
                y2={sol.p0.y}
                stroke="#94a3b8"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={sol.p1.x}
                y1={-sol.p1.z}
                x2={sol.p1.x}
                y2={sol.p1.y}
                stroke="#94a3b8"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />

              {/* True Length Construction Lines */}
              <line
                x1={sol.p0.x}
                y1={-sol.p0.z}
                x2={tlElevEnd.x}
                y2={tlElevEnd.y}
                stroke="#64748b"
                strokeDasharray="3 2"
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={sol.p0.x}
                y1={sol.p0.y}
                x2={tlPlanEnd.x}
                y2={tlPlanEnd.y}
                stroke="#64748b"
                strokeDasharray="3 2"
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
              />

              {/* Trace Extensions (HT and VT) */}
              {sol.ht && (
                <>
                  <line
                    x1={sol.p0.x}
                    y1={-sol.p0.z}
                    x2={sol.ht.x}
                    y2={0}
                    stroke="#dc2626"
                    strokeDasharray="2 1.5"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={sol.ht.x}
                    y1={0}
                    x2={sol.ht.x}
                    y2={sol.ht.y}
                    stroke="#dc2626"
                    strokeDasharray="2 1.5"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={sol.p0.x}
                    y1={sol.p0.y}
                    x2={sol.ht.x}
                    y2={sol.ht.y}
                    stroke="#dc2626"
                    strokeDasharray="2 1.5"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={sol.ht.x} cy={0} r={1.2} fill="#dc2626" />
                  <circle cx={sol.ht.x} cy={sol.ht.y} r={1.4} fill="#dc2626" />
                  <text x={sol.ht.x - 4} y={-2} fontSize="3.6" fontWeight="600" fill="#dc2626">
                    h&apos;
                  </text>
                  <text x={sol.ht.x - 6} y={sol.ht.y + 4.5} fontSize="3.8" fontWeight="700" fill="#dc2626">
                    HT
                  </text>
                </>
              )}

              {sol.vt && (
                <>
                  <line
                    x1={sol.p0.x}
                    y1={sol.p0.y}
                    x2={sol.vt.x}
                    y2={0}
                    stroke="#2563eb"
                    strokeDasharray="2 1.5"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={sol.vt.x}
                    y1={0}
                    x2={sol.vt.x}
                    y2={-sol.vt.z}
                    stroke="#2563eb"
                    strokeDasharray="2 1.5"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={sol.p0.x}
                    y1={-sol.p0.z}
                    x2={sol.vt.x}
                    y2={-sol.vt.z}
                    stroke="#2563eb"
                    strokeDasharray="2 1.5"
                    strokeWidth={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx={sol.vt.x} cy={0} r={1.2} fill="#2563eb" />
                  <circle cx={sol.vt.x} cy={-sol.vt.z} r={1.4} fill="#2563eb" />
                  <text x={sol.vt.x - 4} y={4.5} fontSize="3.6" fontWeight="600" fill="#2563eb">
                    v
                  </text>
                  <text x={sol.vt.x - 6} y={-sol.vt.z - 2.5} fontSize="3.8" fontWeight="700" fill="#2563eb">
                    VT
                  </text>
                </>
              )}

              {/* Final Front View (Elevation) */}
              <line
                x1={sol.p0.x}
                y1={-sol.p0.z}
                x2={sol.p1.x}
                y2={-sol.p1.z}
                stroke="#0f172a"
                strokeWidth={2.0}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Final Top View (Plan) */}
              <line
                x1={sol.p0.x}
                y1={sol.p0.y}
                x2={sol.p1.x}
                y2={sol.p1.y}
                stroke="#0f172a"
                strokeWidth={2.0}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Key Endpoints & Labels */}
              <circle cx={sol.p0.x} cy={-sol.p0.z} r={1.3} fill="#0f172a" />
              <circle cx={sol.p1.x} cy={-sol.p1.z} r={1.3} fill="#0f172a" />
              <circle cx={sol.p0.x} cy={sol.p0.y} r={1.3} fill="#0f172a" />
              <circle cx={sol.p1.x} cy={sol.p1.y} r={1.3} fill="#0f172a" />

              <text x={sol.p0.x - 4.5} y={-sol.p0.z - 2} fontSize="4.0" fontWeight="700" fill="#0f172a">
                {sL}&apos;
              </text>
              <text x={sol.p1.x + 2} y={-sol.p1.z - 2} fontSize="4.0" fontWeight="700" fill="#0f172a">
                {eL}&apos;
              </text>
              <text x={sol.p0.x - 4.5} y={sol.p0.y + 4.5} fontSize="4.0" fontWeight="700" fill="#0f172a">
                {sL}
              </text>
              <text x={sol.p1.x + 2} y={sol.p1.y + 4.5} fontSize="4.0" fontWeight="700" fill="#0f172a">
                {eL}
              </text>
              <text x={tlElevEnd.x + 1.5} y={tlElevEnd.y - 1.5} fontSize="3.4" fill="#64748b">
                {eL}1&apos; (TL)
              </text>
              <text x={tlPlanEnd.x + 1.5} y={tlPlanEnd.y + 3.5} fontSize="3.4" fill="#64748b">
                {eL}1 (TL)
              </text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
