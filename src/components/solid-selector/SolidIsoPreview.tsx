import { useMemo } from 'react';
import type { SolidDimensions, SolidType } from '../../types/geometry';
import { buildLocalSolid } from '../../engine/geometry';
import { quatFromEulerDeg } from '../../engine/math';
import { transformSolid } from '../../engine/orientation';
import { computeViewProjectedLines } from '../../engine/visibility';

interface SolidIsoPreviewProps {
  solidType: SolidType;
  dimensions: SolidDimensions;
  size?: number;
}

/**
 * Renders a crisp, mathematically computed isometric projection (visible + dashed hidden lines)
 * of any solid directly from the EG Studio geometry & visibility engine.
 */
export function SolidIsoPreview({ solidType, dimensions, size = 140 }: SolidIsoPreviewProps) {
  const { lines, bounds } = useMemo(() => {
    const local = buildLocalSolid(solidType, dimensions);
    // Classic isometric viewing rotation: rotate around Z by 35°, then tilt toward viewer
    const q = quatFromEulerDeg(-58, 0, 32);
    const world = transformSolid(local, q, {
      xOffset: 0,
      inFrontOfVP: 0,
      aboveHP: 0,
      snapToHP: false,
      snapToVP: false,
    });
    const projected = computeViewProjectedLines(world, 'elevation');

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const l of projected) {
      minX = Math.min(minX, l.x1, l.x2);
      maxX = Math.max(maxX, l.x1, l.x2);
      minY = Math.min(minY, -l.y1, -l.y2);
      maxY = Math.max(maxY, -l.y1, -l.y2);
    }
    const pad = 12;
    return {
      lines: projected,
      bounds: {
        x: minX - pad,
        y: minY - pad,
        w: Math.max(20, maxX - minX + pad * 2),
        h: Math.max(20, maxY - minY + pad * 2),
      },
    };
  }, [solidType, dimensions]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
      className="w-full h-full select-none"
      aria-hidden="true"
    >
      {lines.map((l) => (
        <line
          key={l.id}
          x1={l.x1}
          y1={-l.y1}
          x2={l.x2}
          y2={-l.y2}
          stroke={l.style === 'visible' ? '#0f172a' : '#94a3b8'}
          strokeWidth={l.style === 'visible' ? 1.7 : 1.0}
          strokeDasharray={l.style === 'hidden' ? '3.5 2.5' : undefined}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
