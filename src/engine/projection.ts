import type {
  OrthographicDrawing,
  ProjectedDimension2D,
  ProjectedLine2D,
  ProjectedPoint2D,
  ProjectionConvention,
  WorldSolid,
} from '../types/geometry';
import { computeViewProjectedLines } from './visibility';

/**
 * Generates mathematically exact orthographic Plan (Top View) and Elevation (Front View)
 * from a transformed 3D WorldSolid in Engineering Graphics coordinates (X, Y, Z):
 * - Plan:      (x, y, z) -> (x, y)
 * - Elevation: (x, y, z) -> (x, z)
 * Note: Returns coordinates in EG space (X right, Plan Y positive below XY in 1st-angle, Elev Z positive above XY).
 */
export function generateOrthographicDrawing(
  worldSolid: WorldSolid,
  convention: ProjectionConvention = 'first_angle'
): OrthographicDrawing {
  const planLines = computeViewProjectedLines(worldSolid, 'plan');
  const elevationLines = computeViewProjectedLines(worldSolid, 'elevation');

  // Add axis centerline if axis projects to non-zero length
  const pAxisPlanLen = Math.hypot(
    worldSolid.worldAxisEnd.x - worldSolid.worldAxisStart.x,
    worldSolid.worldAxisEnd.y - worldSolid.worldAxisStart.y
  );
  if (pAxisPlanLen > 0.5) {
    planLines.unshift({
      id: 'plan_axis_centerline',
      x1: worldSolid.worldAxisStart.x,
      y1: worldSolid.worldAxisStart.y,
      x2: worldSolid.worldAxisEnd.x,
      y2: worldSolid.worldAxisEnd.y,
      style: 'axis',
      label: 'Axis',
    });
  }

  const pAxisElevLen = Math.hypot(
    worldSolid.worldAxisEnd.x - worldSolid.worldAxisStart.x,
    worldSolid.worldAxisEnd.z - worldSolid.worldAxisStart.z
  );
  if (pAxisElevLen > 0.5) {
    elevationLines.unshift({
      id: 'elev_axis_centerline',
      x1: worldSolid.worldAxisStart.x,
      y1: worldSolid.worldAxisStart.z,
      x2: worldSolid.worldAxisEnd.x,
      y2: worldSolid.worldAxisEnd.z,
      style: 'axis',
      label: 'Axis',
    });
  }

  const planPoints: ProjectedPoint2D[] = [];
  const elevationPoints: ProjectedPoint2D[] = [];
  const projectors: ProjectedLine2D[] = [];

  if (!worldSolid.local.isCurved) {
    for (const v of worldSolid.worldVertices) {
      planPoints.push({
        id: `plan_pt_${v.id}`,
        x: v.pos.x,
        y: v.pos.y,
        label: v.labelPlan,
        isApex: v.group === 'apex',
      });
      elevationPoints.push({
        id: `elev_pt_${v.id}`,
        x: v.pos.x,
        y: v.pos.z,
        label: v.labelElev,
        isApex: v.group === 'apex',
      });
      projectors.push({
        id: `proj_${v.id}`,
        x1: v.pos.x,
        y1: v.pos.z, // Elevation vertical coordinate
        x2: v.pos.x,
        y2: v.pos.y, // Plan vertical coordinate
        style: 'projector',
      });
    }
  } else {
    // For curved solids, project axis endpoints o1, o2 / o as key points & projectors
    planPoints.push({
      id: 'plan_pt_o1',
      x: worldSolid.worldAxisStart.x,
      y: worldSolid.worldAxisStart.y,
      label: 'o1',
    });
    planPoints.push({
      id: 'plan_pt_o2',
      x: worldSolid.worldAxisEnd.x,
      y: worldSolid.worldAxisEnd.y,
      label: worldSolid.local.type === 'cone' ? 'o' : 'o2',
      isApex: worldSolid.local.type === 'cone',
    });
    elevationPoints.push({
      id: 'elev_pt_o1',
      x: worldSolid.worldAxisStart.x,
      y: worldSolid.worldAxisStart.z,
      label: "o1'",
    });
    elevationPoints.push({
      id: 'elev_pt_o2',
      x: worldSolid.worldAxisEnd.x,
      y: worldSolid.worldAxisEnd.z,
      label: worldSolid.local.type === 'cone' ? "o'" : "o2'",
      isApex: worldSolid.local.type === 'cone',
    });
    projectors.push({
      id: 'proj_axis_start',
      x1: worldSolid.worldAxisStart.x,
      y1: worldSolid.worldAxisStart.z,
      x2: worldSolid.worldAxisStart.x,
      y2: worldSolid.worldAxisStart.y,
      style: 'projector',
    });
    projectors.push({
      id: 'proj_axis_end',
      x1: worldSolid.worldAxisEnd.x,
      y1: worldSolid.worldAxisEnd.z,
      x2: worldSolid.worldAxisEnd.x,
      y2: worldSolid.worldAxisEnd.y,
      style: 'projector',
    });
  }

  // Compute bounds
  const { min, max } = worldSolid.boundingBox;

  // Dimensions (overall width in X, depth/radius, true axis height)
  const dimensions: ProjectedDimension2D[] = [];
  const dims = worldSolid.local.dimensions;
  dimensions.push({
    id: 'dim_axis',
    x1: worldSolid.worldAxisStart.x,
    y1: worldSolid.worldAxisStart.z,
    x2: worldSolid.worldAxisEnd.x,
    y2: worldSolid.worldAxisEnd.z,
    offset: 14,
    text: `Axis ${dims.axisLength} mm`,
  });

  if (worldSolid.local.isCurved) {
    dimensions.push({
      id: 'dim_base',
      x1: min.x,
      y1: min.y,
      x2: max.x,
      y2: min.y,
      offset: 12,
      text: `Ø ${dims.baseRadius * 2} mm`,
    });
  } else {
    dimensions.push({
      id: 'dim_base',
      x1: min.x,
      y1: max.y,
      x2: max.x,
      y2: max.y,
      offset: 12,
      text: `Side ${dims.sideLength} mm`,
    });
  }

  return {
    convention,
    planLines,
    elevationLines,
    planPoints,
    elevationPoints,
    projectors,
    dimensions,
    bounds: {
      minX: min.x,
      maxX: max.x,
      minPlanY: min.y,
      maxPlanY: max.y,
      minElevZ: min.z,
      maxElevZ: max.z,
    },
  };
}
