import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { DrawingSettings, OrthographicDrawing } from '../../types/geometry';

interface DrawingPanel2DProps {
  drawing: OrthographicDrawing;
  settings: DrawingSettings;
  mode: 'combined' | 'elevation' | 'plan';
  highlightIds?: string[];
  title?: string;
}

export function DrawingPanel2D({
  drawing,
  settings,
  mode,
  highlightIds = [],
  title,
}: DrawingPanel2DProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const patternId = useId();

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((z) => Math.max(0.4, Math.min(4, +(z * factor).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const highlightSet = new Set(highlightIds);
  const isFirstAngle = drawing.convention === 'first_angle';
  const { minX, maxX, minPlanY, maxPlanY, minElevZ, maxElevZ } = drawing.bounds;

  const pad = 28;
  const centerX = (minX + maxX) / 2;
  const spanX = Math.max(140, maxX - minX + pad * 2);

  // Compute vertical bounds depending on mode
  let vbMinY = -80;
  let vbHeight = 160;
  const xyY = 0;

  if (mode === 'combined') {
    const topExtent = Math.max(30, (isFirstAngle ? maxElevZ : maxPlanY) + pad);
    const botExtent = Math.max(30, (isFirstAngle ? maxPlanY : maxElevZ) + pad);
    vbMinY = -topExtent;
    vbHeight = topExtent + botExtent;
  } else if (mode === 'elevation') {
    const topZ = Math.max(25, maxElevZ + 18);
    const botZ = Math.min(-15, minElevZ - 16);
    vbMinY = isFirstAngle ? -topZ : botZ;
    vbHeight = Math.max(60, topZ - botZ);
  } else {
    const topY = Math.min(-15, minPlanY - 16);
    const botY = Math.max(25, maxPlanY + 18);
    vbMinY = isFirstAngle ? topY : -botY;
    vbHeight = Math.max(60, botY - topY);
  }

  const vbWidth = spanX / zoom;
  const scaledHeight = vbHeight / zoom;
  const vbX = centerX - vbWidth / 2 - pan.x;
  const vbY = vbMinY + (vbHeight - scaledHeight) / 2 - pan.y;

  const toElevSvgY = (z: number) => (isFirstAngle ? xyY - z : xyY + z);
  const toPlanSvgY = (y: number) => (isFirstAngle ? xyY + y : xyY - y);

  const xyLeft = centerX - spanX * 0.46;
  const xyRight = centerX + spanX * 0.46;

  const handleFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50/70">
        <span className="font-display text-xs font-semibold text-slate-800 truncate">
          {title ??
            (mode === 'elevation'
              ? 'Elevation — Front View'
              : mode === 'plan'
                ? 'Plan — Top View'
                : 'Orthographic Sheet (Elevation & Plan)')}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3.5, +(z * 1.2).toFixed(2)))}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.45, +(z / 1.2).toFixed(2)))}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFit}
            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded cursor-pointer"
            title="Fit drawing to screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Pan/Zoom SVG Canvas */}
      <div
        ref={canvasContainerRef}
        className="relative flex-1 bg-white cursor-grab active:cursor-grabbing select-none overflow-hidden"
        onMouseDown={(e) => {
          dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        }}
        onMouseMove={(e) => {
          if (!dragStart.current) return;
          const dx = (e.clientX - dragStart.current.x) * (vbWidth / 400);
          const dy = (e.clientY - dragStart.current.y) * (vbWidth / 400);
          setPan({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
        }}
        onMouseUp={() => {
          dragStart.current = null;
        }}
        onMouseLeave={() => {
          dragStart.current = null;
        }}
      >
        <svg
          className="w-full h-full"
          viewBox={`${vbX} ${vbY} ${vbWidth} ${scaledHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Subtle engineering paper grid */}
          <defs>
            <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x={vbX - 500} y={vbY - 500} width={vbWidth + 1000} height={scaledHeight + 1000} fill={`url(#${patternId})`} />

          {/* Construction Projectors (shown in combined mode) */}
          {mode === 'combined' &&
            settings.showConstruction &&
            drawing.projectors.map((p) => (
              <line
                key={p.id}
                x1={p.x1}
                y1={toElevSvgY(p.y1)}
                x2={p.x2}
                y2={toPlanSvgY(p.y2)}
                stroke="#94a3b8"
                strokeWidth={0.55}
              />
            ))}

          {/* XY Reference Line */}
          <line x1={xyLeft} y1={xyY} x2={xyRight} y2={xyY} stroke="#0f172a" strokeWidth={1.15} />
          <text x={xyLeft - 5} y={xyY + 3} fontSize="7" fontWeight="600" fill="#0f172a" textAnchor="end">
            X
          </text>
          <text x={xyRight + 5} y={xyY + 3} fontSize="7" fontWeight="600" fill="#0f172a" textAnchor="start">
            Y
          </text>

          {/* Elevation Lines */}
          {(mode === 'combined' || mode === 'elevation') &&
            drawing.elevationLines.map((l) => {
              if (l.style === 'hidden' && !settings.showHidden) return null;
              if (l.style === 'axis' && !settings.showConstruction) return null;
              const isHighlighted = highlightSet.has(l.id);
              const stroke = isHighlighted
                ? '#1d4ed8'
                : l.style === 'visible'
                  ? '#0f172a'
                  : l.style === 'hidden'
                    ? '#475569'
                    : '#2563eb';
              const strokeWidth = isHighlighted
                ? 2.2
                : l.style === 'visible'
                  ? 1.65
                  : l.style === 'hidden'
                    ? 1.05
                    : 0.75;
              const dash =
                l.style === 'hidden'
                  ? '3.5 2.2'
                  : l.style === 'axis'
                    ? '7 2 1.2 2'
                    : undefined;

              return (
                <line
                  key={l.id}
                  x1={l.x1}
                  y1={toElevSvgY(l.y1)}
                  x2={l.x2}
                  y2={toElevSvgY(l.y2)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                />
              );
            })}

          {/* Plan Lines */}
          {(mode === 'combined' || mode === 'plan') &&
            drawing.planLines.map((l) => {
              if (l.style === 'hidden' && !settings.showHidden) return null;
              if (l.style === 'axis' && !settings.showConstruction) return null;
              const isHighlighted = highlightSet.has(l.id);
              const stroke = isHighlighted
                ? '#1d4ed8'
                : l.style === 'visible'
                  ? '#0f172a'
                  : l.style === 'hidden'
                    ? '#475569'
                    : '#2563eb';
              const strokeWidth = isHighlighted
                ? 2.2
                : l.style === 'visible'
                  ? 1.65
                  : l.style === 'hidden'
                    ? 1.05
                    : 0.75;
              const dash =
                l.style === 'hidden'
                  ? '3.5 2.2'
                  : l.style === 'axis'
                    ? '7 2 1.2 2'
                    : undefined;

              return (
                <line
                  key={l.id}
                  x1={l.x1}
                  y1={toPlanSvgY(l.y1)}
                  x2={l.x2}
                  y2={toPlanSvgY(l.y2)}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                />
              );
            })}

          {/* Vertex Labels */}
          {settings.showLabels &&
            (mode === 'combined' || mode === 'elevation') &&
            (() => {
              const seen = new Set<string>();
              return drawing.elevationPoints.map((pt) => {
                const key = `${Math.round(pt.x * 2)}_${Math.round(pt.y * 2)}`;
                if (seen.has(key)) return null;
                seen.add(key);
                return (
                  <text
                    key={pt.id}
                    x={pt.x + 2.5}
                    y={toElevSvgY(pt.y) - 2.5}
                    fontSize="5.8"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#334155"
                  >
                    {pt.label}
                  </text>
                );
              });
            })()}

          {settings.showLabels &&
            (mode === 'combined' || mode === 'plan') &&
            (() => {
              const seen = new Set<string>();
              return drawing.planPoints.map((pt) => {
                const key = `${Math.round(pt.x * 2)}_${Math.round(pt.y * 2)}`;
                if (seen.has(key)) return null;
                seen.add(key);
                return (
                  <text
                    key={pt.id}
                    x={pt.x + 2.5}
                    y={toPlanSvgY(pt.y) + 6.5}
                    fontSize="5.8"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#334155"
                  >
                    {pt.label}
                  </text>
                );
              });
            })()}

          {/* Dimensions */}
          {settings.showDimensions && (
            <g>
              {(mode === 'combined' || mode === 'elevation') &&
                Math.abs(maxElevZ - minElevZ) > 2 && (
                  <>
                    <line
                      x1={maxX + 2}
                      y1={toElevSvgY(maxElevZ)}
                      x2={maxX + 14}
                      y2={toElevSvgY(maxElevZ)}
                      stroke="#64748b"
                      strokeWidth={0.5}
                    />
                    <line
                      x1={maxX + 2}
                      y1={toElevSvgY(minElevZ)}
                      x2={maxX + 14}
                      y2={toElevSvgY(minElevZ)}
                      stroke="#64748b"
                      strokeWidth={0.5}
                    />
                    <line
                      x1={maxX + 11}
                      y1={toElevSvgY(maxElevZ)}
                      x2={maxX + 11}
                      y2={toElevSvgY(minElevZ)}
                      stroke="#1d4ed8"
                      strokeWidth={0.7}
                    />
                    <text
                      x={maxX + 13.5}
                      y={(toElevSvgY(maxElevZ) + toElevSvgY(minElevZ)) / 2 + 2}
                      fontSize="5.8"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#1d4ed8"
                    >
                      {(maxElevZ - minElevZ).toFixed(1)}
                    </text>
                  </>
                )}

              {(mode === 'combined' || mode === 'plan') &&
                Math.abs(maxX - minX) > 2 && (
                  <>
                    <line
                      x1={minX}
                      y1={toPlanSvgY(maxPlanY) + (isFirstAngle ? 2 : -2)}
                      x2={minX}
                      y2={toPlanSvgY(maxPlanY) + (isFirstAngle ? 12 : -12)}
                      stroke="#64748b"
                      strokeWidth={0.5}
                    />
                    <line
                      x1={maxX}
                      y1={toPlanSvgY(maxPlanY) + (isFirstAngle ? 2 : -2)}
                      x2={maxX}
                      y2={toPlanSvgY(maxPlanY) + (isFirstAngle ? 12 : -12)}
                      stroke="#64748b"
                      strokeWidth={0.5}
                    />
                    <line
                      x1={minX}
                      y1={toPlanSvgY(maxPlanY) + (isFirstAngle ? 9.5 : -9.5)}
                      x2={maxX}
                      y2={toPlanSvgY(maxPlanY) + (isFirstAngle ? 9.5 : -9.5)}
                      stroke="#1d4ed8"
                      strokeWidth={0.7}
                    />
                    <text
                      x={(minX + maxX) / 2}
                      y={toPlanSvgY(maxPlanY) + (isFirstAngle ? 16 : -14)}
                      fontSize="5.8"
                      fontFamily="IBM Plex Mono, monospace"
                      fill="#1d4ed8"
                      textAnchor="middle"
                    >
                      {(maxX - minX).toFixed(1)} mm
                    </text>
                  </>
                )}
            </g>
          )}
        </svg>

        {/* Subtle projection convention caption */}
        <div className="absolute bottom-2 left-2.5 text-[10px] font-mono text-slate-400 pointer-events-none">
          {isFirstAngle ? '1st Angle' : '3rd Angle'} · {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
