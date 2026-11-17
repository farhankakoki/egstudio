import { Download } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { getSolidCatalogItem } from '../../engine/geometry';
import { KTU_SECTION_PRESETS, solveSectionedSolid, type SectionBaseOrientation, type SectionProblemInput } from '../../engine/section';
import { useProjectStore } from '../../store/project-store';
import type { CameraPreset, SolidType } from '../../types/geometry';
import { NumericInput } from '../ui/NumericInput';
import { Viewport3D } from '../viewport/Viewport3D';

const SECTION_SOLID_TYPES: SolidType[] = [
  'pentagonal_pyramid',
  'square_prism',
  'square_pyramid',
  'hexagonal_pyramid',
  'hexagonal_prism',
  'cube',
  'cylinder',
  'cone',
];

export function SectionsModuleView() {
  const input = useProjectStore((s) => s.sectionInput);
  const setSectionInput = useProjectStore((s) => s.setSectionInput);
  const [activeTab, setActiveTab] = useState<'orthographic' | 'true_shape_dev'>('true_shape_dev');
  const [cameraRequest, setCameraRequest] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: 'isometric',
    nonce: 0,
  });
  const orthoSvgRef = useRef<SVGSVGElement | null>(null);
  const devSvgRef = useRef<SVGSVGElement | null>(null);

  const sol = useMemo(() => solveSectionedSolid(input), [input]);
  const isCurved = input.solidType === 'cylinder' || input.solidType === 'cone';
  const activePresetId =
    KTU_SECTION_PRESETS.find((p) => JSON.stringify(p.input) === JSON.stringify(input))?.id ?? '';

  const setInput = (next: SectionProblemInput) => setSectionInput(next);
  const setActivePresetId = (_id: string) => {};

  const update = (partial: Partial<SectionProblemInput>) => {
    setSectionInput({ ...input, ...partial });
  };

  const downloadSvg = (ref: React.RefObject<SVGSVGElement | null>, filename: string) => {
    if (!ref.current) return;
    const xml = new XMLSerializer().serializeToString(ref.current);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Orthographic SVG bounds
  const orthoBounds = useMemo(() => {
    const b = sol.drawing.bounds;
    const minX = Math.min(b.minX, sol.sectionTraceElev.x1, sol.sectionTraceElev.x2) - 18;
    const maxX = Math.max(b.maxX, sol.sectionTraceElev.x1, sol.sectionTraceElev.x2) + 18;
    const minY = -Math.max(b.maxElevZ, sol.sectionTraceElev.y2, 20) - 18;
    const maxY = Math.max(b.maxPlanY, 20) + 18;
    return { x: minX, y: minY, w: Math.max(100, maxX - minX), h: Math.max(100, maxY - minY) };
  }, [sol]);

  // True Shape SVG bounds
  const tsBounds = useMemo(() => {
    if (sol.trueShape2D.length === 0) return { x: -40, y: -40, w: 80, h: 80 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of sol.trueShape2D) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, -p.y);
      maxY = Math.max(maxY, -p.y);
    }
    const pad = 14;
    return { x: minX - pad, y: minY - pad, w: Math.max(40, maxX - minX + pad * 2), h: Math.max(40, maxY - minY + pad * 2) };
  }, [sol.trueShape2D]);

  // Development SVG bounds
  const devBounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const seg of sol.development.outlineSegments) {
      minX = Math.min(minX, seg.x1, seg.x2);
      maxX = Math.max(maxX, seg.x1, seg.x2);
      minY = Math.min(minY, -seg.y1, -seg.y2);
      maxY = Math.max(maxY, -seg.y1, -seg.y2);
    }
    for (const lbl of sol.development.labels) {
      minX = Math.min(minX, lbl.x);
      maxX = Math.max(maxX, lbl.x);
      minY = Math.min(minY, -lbl.y);
      maxY = Math.max(maxY, -lbl.y);
    }
    const pad = 16;
    return { x: minX - pad, y: minY - pad, w: Math.max(60, maxX - minX + pad * 2), h: Math.max(60, maxY - minY + pad * 2) };
  }, [sol.development]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header & KTU Presets */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-blue-700 font-semibold">
              MODULE 3 · SECTIONS OF SOLIDS &amp; DEVELOPMENT
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              Sectional Views, True Shape &amp; Lateral Surface Development
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {KTU_SECTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setInput({ ...preset.input, dimensions: { ...preset.input.dimensions } });
                  setActivePresetId(preset.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  activePresetId === preset.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-500'
                }`}
              >
                {preset.title.split('·')[0].trim()} · {getSolidCatalogItem(preset.input.solidType).name}
              </button>
            ))}
          </div>
        </div>
        {activePresetId && (
          <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
            {KTU_SECTION_PRESETS.find((p) => p.id === activePresetId)?.statement}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Controls */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <label htmlFor="m3-solid" className="block text-xs font-semibold text-slate-800 mb-1">
              Solid Resting on HP on Base
            </label>
            <select
              id="m3-solid"
              value={input.solidType}
              onChange={(e) => {
                const nextType = e.target.value as SolidType;
                const item = getSolidCatalogItem(nextType);
                update({ solidType: nextType, dimensions: { ...item.defaultDimensions } });
              }}
              className="w-full px-2.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg"
            >
              {SECTION_SOLID_TYPES.map((t) => (
                <option key={t} value={t}>
                  {getSolidCatalogItem(t).name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="m3-primary" className="block text-xs font-medium text-slate-700 mb-1">
                {isCurved ? 'Base Radius (mm)' : 'Base Side (mm)'}
              </label>
              <NumericInput
                id="m3-primary"
                min={5}
                max={120}
                value={isCurved ? input.dimensions.baseRadius : input.dimensions.sideLength}
                onChange={(v) =>
                  update({
                    dimensions: isCurved
                      ? { ...input.dimensions, baseRadius: v }
                      : {
                          ...input.dimensions,
                          sideLength: v,
                          baseWidth: v,
                          axisLength: input.solidType === 'cube' ? v : input.dimensions.axisLength,
                        },
                  })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="m3-axis" className="block text-xs font-medium text-slate-700 mb-1">
                Axis Height (mm)
              </label>
              <NumericInput
                id="m3-axis"
                min={10}
                max={180}
                disabled={input.solidType === 'cube'}
                value={input.solidType === 'cube' ? input.dimensions.sideLength : input.dimensions.axisLength}
                onChange={(v) =>
                  update({ dimensions: { ...input.dimensions, axisLength: v } })
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="m3-base-ori" className="block text-xs font-medium text-slate-700 mb-1">
                Base Edge vs VP
              </label>
              <select
                id="m3-base-ori"
                value={input.baseEdgeOrientation}
                onChange={(e) =>
                  update({ baseEdgeOrientation: e.target.value as SectionBaseOrientation })
                }
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="edge_parallel_vp">Edge ∥ to VP</option>
                <option value="edge_perp_vp">Edge ⊥ to VP</option>
                <option value="edge_45_vp">Edge 45° to VP</option>
              </select>
            </div>
            <div>
              <label htmlFor="m3-vp-dist" className="block text-xs font-medium text-slate-700 mb-1">
                In front of VP (mm)
              </label>
              <NumericInput
                id="m3-vp-dist"
                min={5}
                max={100}
                value={input.inFrontOfVP}
                onChange={(v) => update({ inFrontOfVP: v })}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <span className="block text-xs font-semibold text-slate-800">
              Section Plane (⊥ VP, Inclined to HP)
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => update({ planeMode: 'angle_height' })}
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  input.planeMode === 'angle_height'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Angle &amp; Height
              </button>
              <button
                type="button"
                onClick={() => update({ planeMode: 'through_body_diagonal' })}
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  input.planeMode === 'through_body_diagonal'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Body Diagonal
              </button>
            </div>

            {input.planeMode === 'angle_height' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="m3-sec-ang" className="block text-xs font-medium text-slate-700 mb-1">
                    Plane Angle to HP (°)
                  </label>
                  <NumericInput
                    id="m3-sec-ang"
                    min={0}
                    max={80}
                    value={input.sectionAngleDeg}
                    onChange={(v) => update({ sectionAngleDeg: v })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="m3-sec-z" className="block text-xs font-medium text-slate-700 mb-1">
                    Cut Z on Axis (mm)
                  </label>
                  <NumericInput
                    id="m3-sec-z"
                    min={1}
                    max={input.dimensions.axisLength - 1}
                    value={input.sectionHeightAtAxis}
                    onChange={(v) => update({ sectionHeightAtAxis: v })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                <div className="font-semibold">Plane passes through body diagonal</div>
                <div className="font-mono text-[11px]">
                  Inclination with XY = {sol.sectionAngleDeg.toFixed(2)}° · Midpoint Z ={' '}
                  {sol.sectionHeightAtAxis.toFixed(1)} mm
                </div>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 font-mono tabular-nums text-xs">
            <div className="flex justify-between">
              <span className="font-sans text-slate-600">Section Plane Inclination to XY:</span>
              <span className="font-semibold text-blue-700">{sol.sectionAngleDeg.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-slate-600">True Shape Area:</span>
              <span className="font-semibold text-slate-900">{sol.trueShapeAreaMm2.toFixed(1)} mm²</span>
            </div>
            {sol.development.sectorAngleDeg && (
              <div className="flex justify-between">
                <span className="font-sans text-slate-600">Development Sector Angle:</span>
                <span className="font-semibold text-slate-900">
                  {sol.development.sectorAngleDeg.toFixed(1)}° (R={sol.development.trueSlantLength?.toFixed(1)} mm)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Visualization Grid */}
        <div className="lg:col-span-8 space-y-4">
          {/* 3D + Orthographic Sectional View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-[360px] bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 text-xs font-display font-semibold text-slate-800">
                3D Remaining Cut Solid
              </div>
              <div className="flex-1">
                <Viewport3D
                  worldSolid={sol.sectionedWorldSolid}
                  cameraRequest={cameraRequest}
                  onTriggerPreset={(preset) =>
                    setCameraRequest((p) => ({ preset, nonce: p.nonce + 1 }))
                  }
                  interactive
                />
              </div>
            </div>

            <div className="h-[360px] bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-slate-800">
                  Front View &amp; Sectional Top View
                </span>
                <button
                  type="button"
                  onClick={() => downloadSvg(orthoSvgRef, `${input.solidType}_sectional_views.svg`)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  SVG
                </button>
              </div>
              <div className="flex-1 p-2">
                <svg
                  ref={orthoSvgRef}
                  viewBox={`${orthoBounds.x} ${orthoBounds.y} ${orthoBounds.w} ${orthoBounds.h}`}
                  className="w-full h-full select-none"
                >
                  <line
                    x1={orthoBounds.x + 4}
                    y1={0}
                    x2={orthoBounds.x + orthoBounds.w - 4}
                    y2={0}
                    stroke="#0f172a"
                    strokeWidth={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Hatching inside cut polygon in Plan */}
                  {sol.hatchPlanLines.map((h, i) => (
                    <line
                      key={`hp_${i}`}
                      x1={h.x1}
                      y1={h.y1}
                      x2={h.x2}
                      y2={h.y2}
                      stroke="#64748b"
                      strokeWidth={0.55}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {sol.drawing.planLines.map((l) => (
                    <line
                      key={l.id}
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      stroke={l.style === 'visible' ? '#0f172a' : '#94a3b8'}
                      strokeWidth={l.style === 'visible' ? 1.5 : 0.8}
                      strokeDasharray={l.style === 'hidden' ? '3 2' : l.style === 'axis' ? '5 2 1 2' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {sol.drawing.elevationLines.map((l) => (
                    <line
                      key={l.id}
                      x1={l.x1}
                      y1={-l.y1}
                      x2={l.x2}
                      y2={-l.y2}
                      stroke={l.style === 'visible' ? '#0f172a' : '#94a3b8'}
                      strokeWidth={l.style === 'visible' ? 1.5 : 0.8}
                      strokeDasharray={l.style === 'hidden' ? '3 2' : l.style === 'axis' ? '5 2 1 2' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {/* Section Plane Trace S-S in Front View */}
                  <line
                    x1={sol.sectionTraceElev.x1}
                    y1={-sol.sectionTraceElev.y1}
                    x2={sol.sectionTraceElev.x2}
                    y2={-sol.sectionTraceElev.y2}
                    stroke="#dc2626"
                    strokeWidth={1.6}
                    strokeDasharray="6 2 1.5 2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={sol.sectionTraceElev.x2 + 2}
                    y={-sol.sectionTraceElev.y2}
                    fontSize="4"
                    fontWeight="700"
                    fill="#dc2626"
                  >
                    VT ({sol.sectionAngleDeg.toFixed(1)}°)
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* True Shape & Development */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-md text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('true_shape_dev')}
                  className={`px-3 py-1 rounded font-medium cursor-pointer ${
                    activeTab === 'true_shape_dev' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  True Shape &amp; Development Side-by-Side
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('orthographic')}
                  className={`px-3 py-1 rounded font-medium cursor-pointer ${
                    activeTab === 'orthographic' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Focus Development Only
                </button>
              </div>
              <button
                type="button"
                onClick={() => downloadSvg(devSvgRef, `${input.solidType}_development.svg`)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Development SVG
              </button>
            </div>

            <div
              className={`grid gap-4 p-4 ${
                activeTab === 'true_shape_dev' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {activeTab === 'true_shape_dev' && (
                <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span>True Shape of Section</span>
                    <span className="font-mono text-slate-500">
                      Area = {sol.trueShapeAreaMm2.toFixed(1)} mm²
                    </span>
                  </div>
                  <div className="h-[250px]">
                    <svg
                      viewBox={`${tsBounds.x} ${tsBounds.y} ${tsBounds.w} ${tsBounds.h}`}
                      className="w-full h-full select-none"
                    >
                      {sol.hatchTrueShapeLines.map((h, i) => (
                        <line
                          key={`hts_${i}`}
                          x1={h.x1}
                          y1={-h.y1}
                          x2={h.x2}
                          y2={-h.y2}
                          stroke="#64748b"
                          strokeWidth={0.65}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      {sol.trueShape2D.length >= 3 && (
                        <polygon
                          points={sol.trueShape2D.map((p) => `${p.x},${-p.y}`).join(' ')}
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth={1.8}
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>Development of Remaining Lateral Surface</span>
                  <span className="font-mono text-slate-500">
                    {sol.development.kind === 'pyramid_or_cone'
                      ? `Slant L = ${sol.development.trueSlantLength?.toFixed(1)} mm`
                      : `Stretch = ${sol.development.width.toFixed(1)} mm`}
                  </span>
                </div>
                <div className="h-[250px]">
                  <svg
                    ref={devSvgRef}
                    viewBox={`${devBounds.x} ${devBounds.y} ${devBounds.w} ${devBounds.h}`}
                    className="w-full h-full select-none"
                  >
                    {sol.development.outlineSegments.map((s, i) => (
                      <line
                        key={`dev_${i}`}
                        x1={s.x1}
                        y1={-s.y1}
                        x2={s.x2}
                        y2={-s.y2}
                        stroke={s.style === 'visible' ? '#0f172a' : '#64748b'}
                        strokeWidth={s.style === 'visible' ? 1.8 : 0.7}
                        strokeDasharray={s.style === 'fold' ? '2 2' : undefined}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {sol.development.labels.map((lbl, i) => (
                      <text
                        key={`dlbl_${i}`}
                        x={lbl.x}
                        y={-lbl.y}
                        textAnchor="middle"
                        fontSize="3.8"
                        fontWeight="600"
                        fill="#0f172a"
                      >
                        {lbl.text}
                      </text>
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
