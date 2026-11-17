import { Download } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { getSolidCatalogItem } from '../../engine/geometry';
import {
  generateIsometricDrawing,
  KTU_ISOMETRIC_PRESETS,
  type IsometricProblemInput,
} from '../../engine/isometric';
import { useProjectStore } from '../../store/project-store';
import type { CameraPreset, SolidType } from '../../types/geometry';
import { NumericInput } from '../ui/NumericInput';
import { Viewport3D } from '../viewport/Viewport3D';

const BOTTOM_SOLIDS: { type: SolidType; label: string }[] = [
  { type: 'hemisphere', label: 'Hemisphere' },
  { type: 'square_prism', label: 'Square / Rect. Plate (Prism)' },
  { type: 'cube', label: 'Cube' },
  { type: 'cylinder', label: 'Cylinder' },
  { type: 'hexagonal_prism', label: 'Hexagonal Prism' },
  { type: 'pentagonal_prism', label: 'Pentagonal Prism' },
];

const TOP_SOLIDS: { type: SolidType; label: string }[] = [
  { type: 'square_pyramid', label: 'Square Pyramid' },
  { type: 'cylinder', label: 'Cylinder' },
  { type: 'cone', label: 'Cone' },
  { type: 'pentagonal_pyramid', label: 'Pentagonal Pyramid' },
  { type: 'hexagonal_pyramid', label: 'Hexagonal Pyramid' },
  { type: 'square_prism', label: 'Square Prism' },
  { type: 'cube', label: 'Cube' },
];

export function IsometricModuleView() {
  const input = useProjectStore((s) => s.isometricInput);
  const setIsometricInput = useProjectStore((s) => s.setIsometricInput);
  const [cameraRequest, setCameraRequest] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: 'isometric',
    nonce: 0,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const isoResult = useMemo(() => generateIsometricDrawing(input), [input]);
  const activePresetId =
    KTU_ISOMETRIC_PRESETS.find((p) => JSON.stringify(p.input) === JSON.stringify(input))?.id ?? '';

  const setInput = (next: IsometricProblemInput) => setIsometricInput(next);
  const setActivePresetId = (_id: string) => {};

  const update = (partial: Partial<IsometricProblemInput>) => {
    setIsometricInput({ ...input, ...partial });
  };

  const botIsCurved = input.bottom.type === 'hemisphere' || input.bottom.type === 'cylinder';
  const topIsCurved = input.top.type === 'cylinder' || input.top.type === 'cone';

  const pad = 16;
  const vbX = isoResult.bounds.minX - pad;
  const vbY = -isoResult.bounds.maxY - pad;
  const vbW = Math.max(60, isoResult.bounds.maxX - isoResult.bounds.minX + pad * 2);
  const vbH = Math.max(60, isoResult.bounds.maxY - isoResult.bounds.minY + pad * 2);

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isometric_combination.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header & KTU Presets */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-blue-700 font-semibold">
              MODULE 4 · ISOMETRIC VIEW &amp; COMBINATION OF SOLIDS
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              Isometric View of Combined Solids
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {KTU_ISOMETRIC_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setInput({
                    ...preset.input,
                    bottom: { ...preset.input.bottom },
                    top: { ...preset.input.top },
                  });
                  setActivePresetId(preset.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  activePresetId === preset.id
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-500'
                }`}
              >
                {preset.title.split('·')[0].trim()} · {getSolidCatalogItem(preset.input.top.type).name} on{' '}
                {getSolidCatalogItem(preset.input.bottom.type).name}
              </button>
            ))}
          </div>
        </div>
        {activePresetId && (
          <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
            {KTU_ISOMETRIC_PRESETS.find((p) => p.id === activePresetId)?.statement}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Controls Sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          {/* Scale Toggle */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-slate-800">Isometric Scale Mode</span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => update({ scaleMode: 'view' })}
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  input.scaleMode === 'view' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Isometric View (1:1)
              </button>
              <button
                type="button"
                onClick={() => update({ scaleMode: 'projection' })}
                className={`py-1.5 rounded-md font-medium cursor-pointer ${
                  input.scaleMode === 'projection'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Iso Projection (0.816×)
              </button>
            </div>
          </div>

          {/* Bottom Solid */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <span className="block text-xs font-semibold text-slate-900">1. Bottom Base Solid</span>
            <select
              aria-label="Bottom Solid Type"
              value={input.bottom.type}
              onChange={(e) => {
                const nextType = e.target.value as SolidType;
                const item = getSolidCatalogItem(nextType);
                const defR =
                  nextType === 'hemisphere' || nextType === 'cylinder'
                    ? item.defaultDimensions.baseRadius
                    : item.defaultDimensions.sideLength;
                update({
                  bottom: {
                    type: nextType,
                    sideOrRadius: defR,
                    secondaryWidth: defR,
                    height: nextType === 'hemisphere' ? defR : item.defaultDimensions.axisLength,
                  },
                });
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              {BOTTOM_SOLIDS.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {botIsCurved ? 'Radius (mm)' : 'Side / Length (mm)'}
                </label>
                <NumericInput
                  ariaLabel="Bottom Solid Size"
                  min={5}
                  max={120}
                  value={input.bottom.sideOrRadius}
                  onChange={(v) =>
                    update({
                      bottom: {
                        ...input.bottom,
                        sideOrRadius: v,
                        secondaryWidth:
                          input.bottom.type === 'square_prism' ? input.bottom.secondaryWidth : v,
                        height: input.bottom.type === 'hemisphere' ? v : input.bottom.height,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  {input.bottom.type === 'hemisphere' ? 'Height = R (Auto)' : 'Height / Thickness (mm)'}
                </label>
                <NumericInput
                  ariaLabel="Bottom Solid Height"
                  min={4}
                  max={150}
                  disabled={input.bottom.type === 'hemisphere' || input.bottom.type === 'cube'}
                  value={
                    input.bottom.type === 'hemisphere' || input.bottom.type === 'cube'
                      ? input.bottom.sideOrRadius
                      : input.bottom.height
                  }
                  onChange={(v) =>
                    update({ bottom: { ...input.bottom, height: v } })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
                />
              </div>
            </div>

            {input.bottom.type === 'square_prism' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Plate Width Y (mm)
                </label>
                <NumericInput
                  ariaLabel="Plate Width"
                  min={5}
                  max={120}
                  value={input.bottom.secondaryWidth}
                  onChange={(v) =>
                    update({ bottom: { ...input.bottom, secondaryWidth: v } })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                />
              </div>
            )}
          </div>

          {/* Top Solid */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-900 cursor-pointer">
              <span>2. Top Solid (Centered on Top Face)</span>
              <input
                type="checkbox"
                checked={input.hasTopSolid}
                onChange={(e) => update({ hasTopSolid: e.target.checked })}
                className="rounded border-slate-300 text-blue-700"
              />
            </label>

            {input.hasTopSolid && (
              <>
                <select
                  aria-label="Top Solid Type"
                  value={input.top.type}
                  onChange={(e) => {
                    const nextType = e.target.value as SolidType;
                    const item = getSolidCatalogItem(nextType);
                    const defR =
                      nextType === 'cylinder' || nextType === 'cone'
                        ? item.defaultDimensions.baseRadius
                        : item.defaultDimensions.sideLength;
                    update({
                      top: {
                        type: nextType,
                        sideOrRadius: defR,
                        secondaryWidth: defR,
                        height: item.defaultDimensions.axisLength,
                      },
                    });
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                >
                  {TOP_SOLIDS.map((s) => (
                    <option key={s.type} value={s.type}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {topIsCurved ? 'Radius (mm)' : 'Base Side (mm)'}
                    </label>
                    <NumericInput
                      ariaLabel="Top Solid Size"
                      min={4}
                      max={100}
                      value={input.top.sideOrRadius}
                      onChange={(v) =>
                        update({
                          top: {
                            ...input.top,
                            sideOrRadius: v,
                            secondaryWidth: v,
                            height: input.top.type === 'cube' ? v : input.top.height,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Height / Axis (mm)
                    </label>
                    <NumericInput
                      ariaLabel="Top Solid Height"
                      min={5}
                      max={150}
                      disabled={input.top.type === 'cube'}
                      value={input.top.type === 'cube' ? input.top.sideOrRadius : input.top.height}
                      onChange={(v) => update({ top: { ...input.top, height: v } })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="font-sans text-slate-600">Total Assembly Height:</span>
              <span className="font-semibold text-slate-900">{isoResult.totalHeightMm.toFixed(1)} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-slate-600">Scale Multiplier:</span>
              <span className="font-semibold text-blue-700">{isoResult.isoScaleFactor.toFixed(4)}×</span>
            </div>
          </div>
        </div>

        {/* Right Visualization: Analytical 2D Isometric SVG + Live 3D Assembly */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-[460px] bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-display font-semibold text-slate-800">
                Analytical Isometric {input.scaleMode === 'view' ? 'View (1:1)' : 'Projection (0.816×)'}
              </span>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                SVG
              </button>
            </div>
            <div className="flex-1 p-2">
              <svg
                ref={svgRef}
                viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                className="w-full h-full select-none"
              >
                {isoResult.lines.map((l) => (
                  <line
                    key={l.id}
                    x1={l.x1}
                    y1={-l.y1}
                    x2={l.x2}
                    y2={-l.y2}
                    stroke={
                      l.style === 'visible'
                        ? '#0f172a'
                        : l.style === 'axis'
                          ? '#2563eb'
                          : l.style === 'iso_axis'
                            ? '#cbd5e1'
                            : '#94a3b8'
                    }
                    strokeWidth={l.style === 'visible' ? 1.6 : l.style === 'axis' ? 0.9 : 0.8}
                    strokeDasharray={
                      l.style === 'hidden'
                        ? '3 2'
                        : l.style === 'axis'
                          ? '5 2 1 2'
                          : l.style === 'iso_axis'
                            ? '2 2'
                            : undefined
                    }
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </div>
          </div>

          <div className="h-[460px] bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50 text-xs font-display font-semibold text-slate-800">
              Interactive 3D Combined Solid
            </div>
            <div className="flex-1">
              <Viewport3D
                worldSolid={isoResult.combinedWorldSolid}
                cameraRequest={cameraRequest}
                onTriggerPreset={(preset) =>
                  setCameraRequest((p) => ({ preset, nonce: p.nonce + 1 }))
                }
                interactive
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
