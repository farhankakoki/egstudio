import type {
  OrthographicDrawing,
  SolidDimensions,
  SolidEdge,
  SolidFace,
  SolidGeometry,
  SolidType,
  SolidVertex,
  Vec2,
  Vec3,
  WorldSolid,
} from '../types/geometry';
import { buildLocalSolid } from './geometry';
import {
  add3,
  cross3,
  degToRad,
  dot3,
  lerp3,
  normalize3,
  quatFromAxisAngle,
  radToDeg,
  scale3,
  sub3,
} from './math';
import { createDefaultPosition, transformSolid } from './orientation';
import { generateOrthographicDrawing } from './projection';

export type SectionBaseOrientation = 'edge_perp_vp' | 'edge_parallel_vp' | 'edge_45_vp';

export interface SectionProblemInput {
  solidType: SolidType;
  dimensions: SolidDimensions;
  baseEdgeOrientation: SectionBaseOrientation;
  inFrontOfVP: number;
  planeMode: 'angle_height' | 'through_body_diagonal';
  sectionAngleDeg: number;
  sectionHeightAtAxis: number;
  keepPortion: 'bottom' | 'top';
}

export interface SectionPreset {
  id: string;
  title: string;
  statement: string;
  input: SectionProblemInput;
}

export const KTU_SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'ktu_m3_q5',
    title: 'Q5 · Pentagonal Pyramid — Section 40° HP at Midpoint & Development',
    statement:
      'A pentagonal pyramid with base edge 30 mm and height 60 mm rests on HP on its base with one base edge parallel to VP and 20 mm in front of it. Sectioned by a plane at 40° to HP, ⊥ VP, passing through axis midpoint (top removed). Draw development of remaining portion.',
    input: {
      solidType: 'pentagonal_pyramid',
      dimensions: {
        sideLength: 30,
        baseWidth: 30,
        rectangularBase: false,
        baseRadius: 25,
        axisLength: 60,
        numSides: 5,
      },
      baseEdgeOrientation: 'edge_parallel_vp',
      inFrontOfVP: 20,
      planeMode: 'angle_height',
      sectionAngleDeg: 40,
      sectionHeightAtAxis: 30,
      keepPortion: 'bottom',
    },
  },
  {
    id: 'ktu_m3_q6',
    title: 'Q6 · Square Prism — Section Through Body Diagonal, True Shape & XY Angle',
    statement:
      'A square prism of base side 35 mm and axis 65 mm rests on HP with one base edge at 45° to VP. Sectioned by a plane inclined to HP and ⊥ VP passing through a body diagonal. Draw front view, sectional top view, true shape, and find inclination with XY.',
    input: {
      solidType: 'square_prism',
      dimensions: {
        sideLength: 35,
        baseWidth: 35,
        rectangularBase: false,
        baseRadius: 25,
        axisLength: 65,
        numSides: 4,
      },
      baseEdgeOrientation: 'edge_45_vp',
      inFrontOfVP: 20,
      planeMode: 'through_body_diagonal',
      sectionAngleDeg: 52.7,
      sectionHeightAtAxis: 32.5,
      keepPortion: 'bottom',
    },
  },
];

export interface DevelopmentResult {
  kind: 'prism_or_cylinder' | 'pyramid_or_cone';
  outlineSegments: { x1: number; y1: number; x2: number; y2: number; style: 'visible' | 'fold' }[];
  cutPolyline: Vec2[];
  labels: { x: number; y: number; text: string }[];
  width: number;
  height: number;
  sectorAngleDeg?: number;
  trueSlantLength?: number;
}

export interface SectionSolution {
  originalWorldSolid: WorldSolid;
  sectionedWorldSolid: WorldSolid;
  drawing: OrthographicDrawing;
  sectionAngleDeg: number;
  sectionHeightAtAxis: number;
  planePoint: Vec3;
  planeNormal: Vec3;
  cutPolygon3D: Vec3[];
  trueShape2D: Vec2[];
  trueShapeAreaMm2: number;
  hatchPlanLines: { x1: number; y1: number; x2: number; y2: number }[];
  hatchTrueShapeLines: { x1: number; y1: number; x2: number; y2: number }[];
  sectionTraceElev: { x1: number; y1: number; x2: number; y2: number };
  development: DevelopmentResult;
}

function generateHatchLines(poly: Vec2[], spacing = 3.5): { x1: number; y1: number; x2: number; y2: number }[] {
  if (poly.length < 3) return [];
  let minU = Infinity;
  let maxU = -Infinity;
  for (const p of poly) {
    const u = p.y - p.x;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
  }

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let c = minU + spacing * 0.5; c < maxU; c += spacing) {
    // Intersect line y = x + c with polygon edges
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const fa = a.y - a.x - c;
      const fb = b.y - b.x - c;
      if ((fa >= 0 && fb < 0) || (fa < 0 && fb >= 0)) {
        const t = fa / (fa - fb);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x1 = xs[k];
      const x2 = xs[k + 1];
      if (Math.abs(x2 - x1) > 0.2) {
        lines.push({ x1, y1: x1 + c, x2, y2: x2 + c });
      }
    }
  }
  return lines;
}

function clipPolygonHalfSpace(
  pts: Vec3[],
  planePt: Vec3,
  planeNormal: Vec3,
  keepPositive: boolean
): Vec3[] {
  if (pts.length === 0) return [];
  const sign = keepPositive ? 1 : -1;
  const dist = (p: Vec3) => sign * dot3(sub3(p, planePt), planeNormal);
  const out: Vec3[] = [];
  const eps = 1e-5;

  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const nxt = pts[(i + 1) % pts.length];
    const dc = dist(cur);
    const dn = dist(nxt);
    const inCur = dc >= -eps;
    const inNxt = dn >= -eps;

    if (inCur && inNxt) {
      out.push(nxt);
    } else if (inCur && !inNxt) {
      const t = dc / (dc - dn);
      out.push(lerp3(cur, nxt, t));
    } else if (!inCur && inNxt) {
      const t = dc / (dc - dn);
      out.push(lerp3(cur, nxt, t));
      out.push(nxt);
    }
  }

  // Deduplicate very close consecutive points
  const cleaned: Vec3[] = [];
  for (const p of out) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) > 1e-4) {
      cleaned.push(p);
    }
  }
  if (
    cleaned.length > 2 &&
    Math.hypot(
      cleaned[0].x - cleaned[cleaned.length - 1].x,
      cleaned[0].y - cleaned[cleaned.length - 1].y,
      cleaned[0].z - cleaned[cleaned.length - 1].z
    ) < 1e-4
  ) {
    cleaned.pop();
  }
  return cleaned;
}

function buildSectionedWorldSolid(
  baseWorld: WorldSolid,
  planePt: Vec3,
  planeNormal: Vec3,
  keepPortion: 'bottom' | 'top'
): { world: WorldSolid; cutPolygon: Vec3[] } {
  // Keep side where dot(p - planePt, planeNormal) <= 0 if keepPortion === 'bottom' (planeNormal points up +Z)
  const keepPositive = keepPortion === 'top';
  const verts: SolidVertex[] = [];
  const edges: SolidEdge[] = [];
  const faces: SolidFace[] = [];

  const addVertex = (pos: Vec3, labelPlan: string, group: 'base' | 'top' | 'apex'): number => {
    for (let i = 0; i < verts.length; i++) {
      const p = verts[i].pos;
      if (Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z) < 1e-3) {
        return i;
      }
    }
    const idx = verts.length;
    verts.push({
      id: `sv_${idx}`,
      labelPlan,
      labelElev: `${labelPlan}'`,
      pos,
      group,
    });
    return idx;
  };

  // Seed original vertices if they survive so vertex labels stay meaningful
  for (const v of baseWorld.worldVertices) {
    const d = dot3(sub3(v.pos, planePt), planeNormal);
    if ((keepPositive && d >= -1e-4) || (!keepPositive && d <= 1e-4)) {
      addVertex(v.pos, v.labelPlan, v.group);
    }
  }

  let cutCounter = 1;
  const edgeSet = new Set<string>();
  const addEdge = (v0: number, v1: number, type: 'base' | 'top' | 'lateral') => {
    const key = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
    if (v0 === v1 || edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({
      id: `se_${edges.length}`,
      label: `Edge ${edges.length + 1}`,
      v0,
      v1,
      type,
    });
  };

  const cutCandidates: Vec3[] = [];

  for (const face of baseWorld.worldFaces) {
    const polyPts = face.vertexIndices.map((idx) => baseWorld.worldVertices[idx].pos);
    const clipped = clipPolygonHalfSpace(polyPts, planePt, planeNormal, keepPositive);
    if (clipped.length < 3) continue;

    const indices: number[] = [];
    for (const pt of clipped) {
      const onPlane = Math.abs(dot3(sub3(pt, planePt), planeNormal)) < 1e-3;
      if (onPlane) cutCandidates.push(pt);
      const idx = addVertex(pt, onPlane ? `s${cutCounter++}` : '', face.type === 'base' ? 'base' : 'top');
      indices.push(idx);
    }

    // Re-check winding against original face normal
    const p0 = verts[indices[0]].pos;
    const p1 = verts[indices[1]].pos;
    const p2 = verts[indices[2]].pos;
    const norm = normalize3(cross3(sub3(p1, p0), sub3(p2, p0)));
    const ordered = dot3(norm, face.normal) < 0 ? [...indices].reverse() : indices;

    const triangles: [number, number, number][] = [];
    for (let i = 1; i < ordered.length - 1; i++) {
      triangles.push([ordered[0], ordered[i], ordered[i + 1]]);
    }

    let center: Vec3 = { x: 0, y: 0, z: 0 };
    for (const idx of ordered) center = add3(center, verts[idx].pos);
    center = scale3(center, 1 / ordered.length);

    faces.push({
      id: face.id,
      label: face.label,
      vertexIndices: ordered,
      triangles,
      normal: face.normal,
      center,
      type: face.type,
    });

    if (!baseWorld.local.isCurved) {
      for (let i = 0; i < ordered.length; i++) {
        addEdge(ordered[i], ordered[(i + 1) % ordered.length], face.type === 'base' ? 'base' : 'lateral');
      }
    }
  }

  // Deduplicate cut polygon points and sort CCW on the cutting plane
  const uniqueCut: Vec3[] = [];
  for (const pt of cutCandidates) {
    if (!uniqueCut.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y, q.z - pt.z) < 1e-2)) {
      uniqueCut.push(pt);
    }
  }

  let cutPolygon: Vec3[] = [];
  if (uniqueCut.length >= 3) {
    let c: Vec3 = { x: 0, y: 0, z: 0 };
    for (const p of uniqueCut) c = add3(c, p);
    c = scale3(c, 1 / uniqueCut.length);

    const cutOutwardNormal = keepPositive ? scale3(planeNormal, -1) : planeNormal;
    const uVec = normalize3(cross3({ x: 0, y: 1, z: 0 }, cutOutwardNormal));
    const vVec = normalize3(cross3(cutOutwardNormal, uVec));

    cutPolygon = [...uniqueCut].sort((a, b) => {
      const angA = Math.atan2(dot3(sub3(a, c), vVec), dot3(sub3(a, c), uVec));
      const angB = Math.atan2(dot3(sub3(b, c), vVec), dot3(sub3(b, c), uVec));
      return angA - angB;
    });

    const capIndices = cutPolygon.map((pt, idx) => addVertex(pt, `${idx + 1}`, 'top'));
    const capTriangles: [number, number, number][] = [];
    for (let i = 1; i < capIndices.length - 1; i++) {
      capTriangles.push([capIndices[0], capIndices[i], capIndices[i + 1]]);
    }

    faces.push({
      id: 'face_section_cap',
      label: 'Sectional Cut Face',
      vertexIndices: capIndices,
      triangles: capTriangles,
      normal: cutOutwardNormal,
      center: c,
      type: 'top',
    });

    if (!baseWorld.local.isCurved) {
      for (let i = 0; i < capIndices.length; i++) {
        addEdge(capIndices[i], capIndices[(i + 1) % capIndices.length], 'top');
      }
    }
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const v of verts) {
    minX = Math.min(minX, v.pos.x);
    maxX = Math.max(maxX, v.pos.x);
    minY = Math.min(minY, v.pos.y);
    maxY = Math.max(maxY, v.pos.y);
    minZ = Math.min(minZ, v.pos.z);
    maxZ = Math.max(maxZ, v.pos.z);
  }

  const localCopy: SolidGeometry = {
    ...baseWorld.local,
    isCurved: false, // Sectioned faces are explicit polygons so polyhedron visibility renders exact cut & remaining edges
    vertices: verts,
    edges,
    faces,
  };

  // For curved solids, keep only the cut-face outline + base/top rim edges cleanly so 3D and 2D don't clutter with 48 longitudinal strip lines
  if (baseWorld.local.isCurved) {
    const cleanEdges: SolidEdge[] = [];
    const capFace = faces.find((f) => f.id === 'face_section_cap');
    if (capFace) {
      for (let i = 0; i < capFace.vertexIndices.length; i++) {
        cleanEdges.push({
          id: `cut_e_${i}`,
          label: `Section Rim ${i + 1}`,
          v0: capFace.vertexIndices[i],
          v1: capFace.vertexIndices[(i + 1) % capFace.vertexIndices.length],
          type: 'top',
        });
      }
    }
    const baseFace = faces.find((f) => f.id === 'face_base');
    if (baseFace) {
      for (let i = 0; i < baseFace.vertexIndices.length; i++) {
        cleanEdges.push({
          id: `base_e_${i}`,
          label: `Base Rim ${i + 1}`,
          v0: baseFace.vertexIndices[i],
          v1: baseFace.vertexIndices[(i + 1) % baseFace.vertexIndices.length],
          type: 'base',
        });
      }
    }
    localCopy.edges = cleanEdges;
  }

  return {
    world: {
      ...baseWorld,
      local: localCopy,
      worldVertices: verts,
      worldFaces: faces,
      boundingBox: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
      },
    },
    cutPolygon,
  };
}

function computeDevelopment(
  worldSolid: WorldSolid,
  planePt: Vec3,
  planeNormal: Vec3
): DevelopmentResult {
  const local = worldSolid.local;
  const H = local.dimensions.axisLength;
  const isPrismOrCyl = local.category === 'prism' || local.type === 'cylinder';
  const cutZAtXY = (x: number) =>
    Math.abs(planeNormal.z) > 1e-4
      ? planePt.z - ((x - planePt.x) * planeNormal.x) / planeNormal.z
      : H;

  const outlineSegments: DevelopmentResult['outlineSegments'] = [];
  const cutPolyline: Vec2[] = [];
  const labels: DevelopmentResult['labels'] = [];

  if (isPrismOrCyl) {
    const n = local.type === 'cylinder' ? 12 : local.numBaseSides;
    const perimeter =
      local.type === 'cylinder'
        ? 2 * Math.PI * local.radius
        : local.dimensions.sideLength * n;

    // Order base vertices around the base perimeter starting from index 0
    const pts: Vec3[] = [];
    if (local.type === 'cylinder') {
      const q = worldSolid.quaternion;
      const center = worldSolid.worldAxisStart;
      for (let i = 0; i < n; i++) {
        const ang = (i * 2 * Math.PI) / n;
        const offset = {
          x: Math.cos(ang) * local.radius,
          y: Math.sin(ang) * local.radius,
          z: 0,
        };
        // Rotate by same Z quat
        const rot = worldSolid.worldVertices[0].pos;
        void q;
        void rot;
        pts.push({
          x: center.x + offset.x,
          y: center.y + offset.y,
          z: 0,
        });
      }
    } else {
      for (let i = 0; i < n; i++) pts.push(worldSolid.worldVertices[i].pos);
    }

    let accX = 0;
    const xStations: number[] = [0];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      accX += Math.hypot(b.x - a.x, b.y - a.y);
      xStations.push(accX);
    }

    // Bottom stretch-out line
    outlineSegments.push({ x1: 0, y1: 0, x2: accX, y2: 0, style: 'visible' });

    for (let i = 0; i <= n; i++) {
      const p = pts[i % n];
      const zCut = Math.max(0, Math.min(H, cutZAtXY(p.x)));
      const x = xStations[i];
      const isEnd = i === 0 || i === n;
      outlineSegments.push({
        x1: x,
        y1: 0,
        x2: x,
        y2: zCut,
        style: isEnd ? 'visible' : 'fold',
      });
      cutPolyline.push({ x, y: zCut });
      labels.push({
        x,
        y: -5,
        text: local.type === 'cylinder' ? `${(i % n) + 1}` : worldSolid.worldVertices[i % n].labelPlan.toUpperCase(),
      });
    }

    for (let i = 0; i < cutPolyline.length - 1; i++) {
      outlineSegments.push({
        x1: cutPolyline[i].x,
        y1: cutPolyline[i].y,
        x2: cutPolyline[i + 1].x,
        y2: cutPolyline[i + 1].y,
        style: 'visible',
      });
    }

    return {
      kind: 'prism_or_cylinder',
      outlineSegments,
      cutPolyline,
      labels,
      width: perimeter,
      height: H,
    };
  }

  // PYRAMID OR CONE RADIAL-LINE DEVELOPMENT
  const n = local.type === 'cone' ? 12 : local.numBaseSides;
  const R = local.radius;
  const L = Math.hypot(R, H); // True slant edge / generator length
  const apex = worldSolid.worldAxisEnd;

  const baseVerts: Vec3[] = [];
  if (local.type === 'cone') {
    const c = worldSolid.worldAxisStart;
    for (let i = 0; i < n; i++) {
      const ang = (i * 2 * Math.PI) / n;
      baseVerts.push({ x: c.x + R * Math.cos(ang), y: c.y + R * Math.sin(ang), z: 0 });
    }
  } else {
    for (let i = 0; i < n; i++) baseVerts.push(worldSolid.worldVertices[i].pos);
  }

  const sideLen = local.type === 'cone' ? (2 * Math.PI * R) / n : local.dimensions.sideLength;
  const deltaAngle =
    local.type === 'cone'
      ? (2 * Math.PI * R) / (L * n)
      : 2 * Math.asin(Math.min(1, sideLen / (2 * L)));
  const totalSectorRad = deltaAngle * n;
  const startAngle = -Math.PI / 2 - totalSectorRad / 2;

  const cutDistances: number[] = [];
  const basePts2D: Vec2[] = [];

  for (let i = 0; i <= n; i++) {
    const theta = startAngle + i * deltaAngle;
    const bx = L * Math.cos(theta);
    const by = L * Math.sin(theta);
    basePts2D.push({ x: bx, y: by });

    const p3 = baseVerts[i % n];
    // Find parameter t along edge from apex (t=0) to base corner p3 (t=1) where plane intersects
    const edgeVec = sub3(p3, apex);
    const denom = dot3(edgeVec, planeNormal);
    let tCut = 1;
    if (Math.abs(denom) > 1e-5) {
      const t = dot3(sub3(planePt, apex), planeNormal) / denom;
      tCut = Math.max(0, Math.min(1, t));
    }
    const rCut = tCut * L;
    cutDistances.push(rCut);

    const cx = rCut * Math.cos(theta);
    const cy = rCut * Math.sin(theta);
    cutPolyline.push({ x: cx, y: cy });

    // Radial edge from cut point to base rim
    outlineSegments.push({
      x1: cx,
      y1: cy,
      x2: bx,
      y2: by,
      style: i === 0 || i === n ? 'visible' : 'fold',
    });

    // Faint construction ray from apex to cut point
    outlineSegments.push({
      x1: 0,
      y1: 0,
      x2: cx,
      y2: cy,
      style: 'fold',
    });

    labels.push({
      x: (L + 7) * Math.cos(theta),
      y: (L + 7) * Math.sin(theta),
      text: local.type === 'cone' ? `${(i % n) + 1}` : worldSolid.worldVertices[i % n].labelPlan.toUpperCase(),
    });
  }

  for (let i = 0; i < n; i++) {
    // Base edge / arc segment
    outlineSegments.push({
      x1: basePts2D[i].x,
      y1: basePts2D[i].y,
      x2: basePts2D[i + 1].x,
      y2: basePts2D[i + 1].y,
      style: 'visible',
    });
    // Cut edge segment
    outlineSegments.push({
      x1: cutPolyline[i].x,
      y1: cutPolyline[i].y,
      x2: cutPolyline[i + 1].x,
      y2: cutPolyline[i + 1].y,
      style: 'visible',
    });
  }

  labels.push({ x: 0, y: 6, text: 'O' });

  return {
    kind: 'pyramid_or_cone',
    outlineSegments,
    cutPolyline,
    labels,
    width: L * 2,
    height: L,
    sectorAngleDeg: radToDeg(totalSectorRad),
    trueSlantLength: L,
  };
}

export function solveSectionedSolid(input: SectionProblemInput): SectionSolution {
  const local = buildLocalSolid(input.solidType, input.dimensions);

  let rotDeg = 0;
  if (input.baseEdgeOrientation === 'edge_parallel_vp') {
    // Rotate -90° so edge 0 (at +X) sits at -Y (parallel to VP, closest to VP)
    rotDeg = -90;
  } else if (input.baseEdgeOrientation === 'edge_45_vp') {
    rotDeg = 45;
  }

  const q = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(rotDeg));
  const pos = {
    ...createDefaultPosition(),
    inFrontOfVP: input.inFrontOfVP,
    snapToHP: true,
    snapToVP: false,
  };
  const originalWorldSolid = transformSolid(local, q, pos);

  const axisX = originalWorldSolid.worldAxisStart.x;
  const axisY = originalWorldSolid.worldAxisStart.y;
  const { min, max } = originalWorldSolid.boundingBox;

  let sectionAngleDeg = input.sectionAngleDeg;
  let sectionHeightAtAxis = input.sectionHeightAtAxis;

  if (input.planeMode === 'through_body_diagonal') {
    const spanX = Math.max(1, max.x - min.x);
    const heightZ = Math.max(1, max.z - min.z);
    sectionAngleDeg = radToDeg(Math.atan2(heightZ, spanX));
    sectionHeightAtAxis = (min.z + max.z) / 2;
  }

  const thetaRad = degToRad(sectionAngleDeg);
  // Section plane perpendicular to VP (normal.y = 0), rising +Z with +X at angle thetaRad
  const planeNormal = normalize3({ x: -Math.sin(thetaRad), y: 0, z: Math.cos(thetaRad) });
  const planePoint: Vec3 = { x: axisX, y: axisY, z: sectionHeightAtAxis };

  const { world: sectionedWorldSolid, cutPolygon } = buildSectionedWorldSolid(
    originalWorldSolid,
    planePoint,
    planeNormal,
    input.keepPortion
  );

  const drawing = generateOrthographicDrawing(sectionedWorldSolid, 'first_angle');

  // Compute True Shape 2D polygon in (u along cut trace, v = depth Y)
  const uDir = normalize3({ x: Math.cos(thetaRad), y: 0, z: Math.sin(thetaRad) });
  const trueShape2D: Vec2[] = cutPolygon.map((pt) => {
    const rel = sub3(pt, planePoint);
    return {
      x: dot3(rel, uDir),
      y: pt.y - axisY,
    };
  });

  // Area by shoelace formula
  let area2 = 0;
  for (let i = 0; i < trueShape2D.length; i++) {
    const a = trueShape2D[i];
    const b = trueShape2D[(i + 1) % trueShape2D.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const trueShapeAreaMm2 = Math.abs(area2) * 0.5;

  // Plan 2D cut polygon for 45° hatching
  const cutPlan2D: Vec2[] = cutPolygon.map((pt) => ({ x: pt.x, y: pt.y }));
  const hatchPlanLines = generateHatchLines(cutPlan2D, 3.6);
  const hatchTrueShapeLines = generateHatchLines(trueShape2D, 3.6);

  // Section plane trace line in Elevation
  const traceHalf = (max.x - min.x) * 0.72 + 12;
  const x1 = axisX - traceHalf * Math.cos(thetaRad);
  const z1 = sectionHeightAtAxis - traceHalf * Math.sin(thetaRad);
  const x2 = axisX + traceHalf * Math.cos(thetaRad);
  const z2 = sectionHeightAtAxis + traceHalf * Math.sin(thetaRad);

  const development = computeDevelopment(originalWorldSolid, planePoint, planeNormal);

  return {
    originalWorldSolid,
    sectionedWorldSolid,
    drawing,
    sectionAngleDeg,
    sectionHeightAtAxis,
    planePoint,
    planeNormal,
    cutPolygon3D: cutPolygon,
    trueShape2D,
    trueShapeAreaMm2,
    hatchPlanLines,
    hatchTrueShapeLines,
    sectionTraceElev: { x1, y1: z1, x2, y2: z2 },
    development,
  };
}
