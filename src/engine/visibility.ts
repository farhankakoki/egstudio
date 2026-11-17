import type { ProjectedLine2D, Vec2, Vec3, WorldSolid } from '../types/geometry';
import { add3, applyQuat, cross3, dist2, dot3, len3, normalize3, scale3, sub3 } from './math';

export type ViewKind = 'plan' | 'elevation';

interface Tri2D {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
}

function projectPoint(p: Vec3, view: ViewKind): { u: number; v: number; depth: number } {
  if (view === 'plan') {
    // Looking from +Z down toward HP (Z=0): (x, y, z) -> (x, y), depth = z
    return { u: p.x, v: p.y, depth: p.z };
  }
  // Elevation: looking from +Y toward VP (Y=0): (x, y, z) -> (x, z), depth = y
  return { u: p.x, v: p.z, depth: p.y };
}

function getViewVectors(view: ViewKind): { viewDir: Vec3; toViewer: Vec3 } {
  if (view === 'plan') {
    return { viewDir: { x: 0, y: 0, z: -1 }, toViewer: { x: 0, y: 0, z: 1 } };
  }
  return { viewDir: { x: 0, y: -1, z: 0 }, toViewer: { x: 0, y: 1, z: 0 } };
}

/**
 * Tests if point (px, py) with depth `pDepth` is strictly behind triangle `tri`.
 */
function isPointOccludedByTriangle(px: number, py: number, pDepth: number, tri: Tri2D): boolean {
  const v0x = tri.cx - tri.ax;
  const v0y = tri.cy - tri.ay;
  const v1x = tri.bx - tri.ax;
  const v1y = tri.by - tri.ay;
  const v2x = px - tri.ax;
  const v2y = py - tri.ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-8) return false;

  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  const w = 1 - u - v;

  // Strictly inside or on interior boundary (avoid false occlusion on shared silhouette edges)
  const margin = 1e-3;
  if (u > margin && v > margin && w > margin) {
    const triDepth = w * tri.az + v * tri.bz + u * tri.cz;
    return triDepth > pDepth + 1e-2;
  }
  return false;
}

function pointToSegmentDist2(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return dist2(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isSegmentCoincidentWithAnyVisible(
  a: Vec2,
  b: Vec2,
  visibleList: ProjectedLine2D[]
): boolean {
  const mid: Vec2 = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  for (const vis of visibleList) {
    const va: Vec2 = { x: vis.x1, y: vis.y1 };
    const vb: Vec2 = { x: vis.x2, y: vis.y2 };
    if (
      pointToSegmentDist2(a, va, vb) < 0.25 &&
      pointToSegmentDist2(mid, va, vb) < 0.25 &&
      pointToSegmentDist2(b, va, vb) < 0.25
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Computes exact visible and hidden 2D edges for polyhedral solids (Prisms & Pyramids)
 * using face normals + 2D triangle depth occlusion + visible-over-hidden deduplication.
 */
function computePolyhedronEdges(worldSolid: WorldSolid, view: ViewKind): ProjectedLine2D[] {
  const { toViewer } = getViewVectors(view);
  const verts = worldSolid.worldVertices;
  const frontTriangles: Tri2D[] = [];

  for (const face of worldSolid.worldFaces) {
    if (dot3(face.normal, toViewer) > 1e-5) {
      for (const [i0, i1, i2] of face.triangles) {
        const p0 = projectPoint(verts[i0].pos, view);
        const p1 = projectPoint(verts[i1].pos, view);
        const p2 = projectPoint(verts[i2].pos, view);
        frontTriangles.push({
          ax: p0.u, ay: p0.v, az: p0.depth,
          bx: p1.u, by: p1.v, bz: p1.depth,
          cx: p2.u, cy: p2.v, cz: p2.depth,
        });
      }
    }
  }

  const visibleLines: ProjectedLine2D[] = [];
  const hiddenCandidates: ProjectedLine2D[] = [];
  const sampleTs = [0.2, 0.5, 0.8];

  for (const edge of worldSolid.local.edges) {
    const p3a = verts[edge.v0].pos;
    const p3b = verts[edge.v1].pos;
    const p2a = projectPoint(p3a, view);
    const p2b = projectPoint(p3b, view);

    if (Math.hypot(p2b.u - p2a.u, p2b.v - p2a.v) < 0.05) {
      continue; // Edge projects to a single point (e.g. vertical edge in Plan)
    }

    let occludedCount = 0;
    for (const t of sampleTs) {
      const m3 = {
        x: p3a.x + (p3b.x - p3a.x) * t,
        y: p3a.y + (p3b.y - p3a.y) * t,
        z: p3a.z + (p3b.z - p3a.z) * t,
      };
      const m2 = projectPoint(m3, view);
      for (const tri of frontTriangles) {
        if (isPointOccludedByTriangle(m2.u, m2.v, m2.depth, tri)) {
          occludedCount++;
          break;
        }
      }
    }

    const line: ProjectedLine2D = {
      id: `${view}_${edge.id}`,
      x1: p2a.u,
      y1: p2a.v,
      x2: p2b.u,
      y2: p2b.v,
      style: occludedCount >= 2 ? 'hidden' : 'visible',
      label: edge.label,
    };

    if (line.style === 'visible') {
      visibleLines.push(line);
    } else {
      hiddenCandidates.push(line);
    }
  }

  // Visible lines take priority over coinciding hidden lines in Engineering Graphics
  const finalHidden: ProjectedLine2D[] = [];
  for (const h of hiddenCandidates) {
    if (!isSegmentCoincidentWithAnyVisible({ x: h.x1, y: h.y1 }, { x: h.x2, y: h.y2 }, visibleLines)) {
      finalHidden.push(h);
    }
  }

  // Draw hidden lines first, visible lines on top
  return [...finalHidden, ...visibleLines];
}

/**
 * Computes exact analytical orthographic silhouette generators and visible/hidden circular arcs
 * for Cylinder and Cone.
 */
function computeCurvedSolidEdges(worldSolid: WorldSolid, view: ViewKind): ProjectedLine2D[] {
  const { viewDir, toViewer } = getViewVectors(view);
  const { local, quaternion, worldAxisStart, worldAxisEnd, axisDirection } = worldSolid;
  const r = local.radius;
  const H = local.dimensions.axisLength;
  const q = quaternion;
  const segments = 72;

  const visibleLines: ProjectedLine2D[] = [];
  const hiddenLines: ProjectedLine2D[] = [];

  if (local.type === 'cylinder') {
    // 1. Silhouette generators perpendicular to both axisDirection and viewDir
    const w = cross3(axisDirection, viewDir);
    const wLen = len3(w);
    if (wLen > 1e-4) {
      const nSil = scale3(w, 1 / wLen);
      for (const sign of [1, -1]) {
        const offset = scale3(nSil, sign * r);
        const p0 = projectPoint(add3(worldAxisStart, offset), view);
        const p1 = projectPoint(add3(worldAxisEnd, offset), view);
        visibleLines.push({
          id: `${view}_cyl_sil_${sign > 0 ? 'p' : 'n'}`,
          x1: p0.u,
          y1: p0.v,
          x2: p1.u,
          y2: p1.v,
          style: 'visible',
        });
      }
    }

    // 2. Base and Top circular rims
    const circles: { center: Vec3; normal: Vec3; tag: string }[] = [
      { center: worldAxisStart, normal: scale3(axisDirection, -1), tag: 'base' },
      { center: worldAxisEnd, normal: axisDirection, tag: 'top' },
    ];

    for (const circle of circles) {
      const nDot = dot3(circle.normal, toViewer);
      const faceFacesViewer = nDot > 1e-5;
      const edgeOn = Math.abs(nDot) <= 1e-5;

      for (let i = 0; i < segments; i++) {
        const t0 = (i * 2 * Math.PI) / segments;
        const t1 = ((i + 1) * 2 * Math.PI) / segments;
        const tm = (t0 + t1) * 0.5;

        const r0 = applyQuat(q, { x: Math.cos(t0) * r, y: Math.sin(t0) * r, z: 0 });
        const r1 = applyQuat(q, { x: Math.cos(t1) * r, y: Math.sin(t1) * r, z: 0 });
        const radDir = normalize3(applyQuat(q, { x: Math.cos(tm), y: Math.sin(tm), z: 0 }));

        const p0 = projectPoint(add3(circle.center, r0), view);
        const p1 = projectPoint(add3(circle.center, r1), view);
        if (Math.hypot(p1.u - p0.u, p1.v - p0.v) < 0.01) continue;

        const wallVisible = dot3(radDir, toViewer) >= -1e-5;
        if (edgeOn) {
          if (wallVisible) {
            visibleLines.push({
              id: `${view}_cyl_${circle.tag}_${i}`,
              x1: p0.u,
              y1: p0.v,
              x2: p1.u,
              y2: p1.v,
              style: 'visible',
            });
          }
        } else {
          const isVis = faceFacesViewer || wallVisible;
          const line: ProjectedLine2D = {
            id: `${view}_cyl_${circle.tag}_${i}`,
            x1: p0.u,
            y1: p0.v,
            x2: p1.u,
            y2: p1.v,
            style: isVis ? 'visible' : 'hidden',
          };
          if (isVis) visibleLines.push(line);
          else hiddenLines.push(line);
        }
      }
    }
  } else if (local.type === 'hemisphere') {
    const C = worldAxisEnd; // Center of the sphere & top flat circular face
    const rimNormal = axisDirection;
    const nDot = dot3(rimNormal, toViewer);
    const faceFacesViewer = nDot > 1e-5;
    const edgeOn = Math.abs(nDot) <= 1e-5;

    // 1. Flat circular rim
    for (let i = 0; i < segments; i++) {
      const t0 = (i * 2 * Math.PI) / segments;
      const t1 = ((i + 1) * 2 * Math.PI) / segments;
      const tm = (t0 + t1) * 0.5;

      const r0 = applyQuat(q, { x: Math.cos(t0) * r, y: Math.sin(t0) * r, z: 0 });
      const r1 = applyQuat(q, { x: Math.cos(t1) * r, y: Math.sin(t1) * r, z: 0 });
      const radDir = normalize3(applyQuat(q, { x: Math.cos(tm), y: Math.sin(tm), z: 0 }));

      const p0 = projectPoint(add3(C, r0), view);
      const p1 = projectPoint(add3(C, r1), view);
      if (Math.hypot(p1.u - p0.u, p1.v - p0.v) < 0.01) continue;

      const isVis = faceFacesViewer || edgeOn || dot3(radDir, toViewer) >= -1e-5;
      const line: ProjectedLine2D = {
        id: `${view}_hemi_rim_${i}`,
        x1: p0.u,
        y1: p0.v,
        x2: p1.u,
        y2: p1.v,
        style: isVis ? 'visible' : 'hidden',
      };
      if (isVis) visibleLines.push(line);
      else hiddenLines.push(line);
    }

    // 2. Spherical great-circle silhouette arc on the -axisDirection half-sphere
    const upGuess = Math.abs(viewDir.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const uVec = normalize3(cross3(viewDir, upGuess));
    const vVec = normalize3(cross3(viewDir, uVec));
    for (let i = 0; i < segments; i++) {
      const t0 = (i * 2 * Math.PI) / segments;
      const t1 = ((i + 1) * 2 * Math.PI) / segments;
      const tm = (t0 + t1) * 0.5;

      const dirM = add3(scale3(uVec, Math.cos(tm)), scale3(vVec, Math.sin(tm)));
      if (dot3(dirM, axisDirection) > 1e-4) continue; // Only dome half (-axisDirection)

      const p0 = projectPoint(add3(C, scale3(add3(scale3(uVec, Math.cos(t0)), scale3(vVec, Math.sin(t0))), r)), view);
      const p1 = projectPoint(add3(C, scale3(add3(scale3(uVec, Math.cos(t1)), scale3(vVec, Math.sin(t1))), r)), view);
      if (Math.hypot(p1.u - p0.u, p1.v - p0.v) < 0.01) continue;

      visibleLines.push({
        id: `${view}_hemi_sil_${i}`,
        x1: p0.u,
        y1: p0.v,
        x2: p1.u,
        y2: p1.v,
        style: 'visible',
      });
    }
  } else {
    // CONE
    const vPerp = sub3(viewDir, scale3(axisDirection, dot3(viewDir, axisDirection)));
    const vpLen = len3(vPerp);
    let apexInsideBase = false;

    if (vpLen > 1e-5) {
      const e1 = scale3(vPerp, 1 / vpLen);
      const e2 = cross3(axisDirection, e1);
      const k = -(r / H) * (dot3(viewDir, axisDirection) / vpLen);

      if (Math.abs(k) < 1 - 1e-5) {
        const sinPhi = Math.sqrt(1 - k * k);
        const pApex = projectPoint(worldAxisEnd, view);
        for (const sign of [1, -1]) {
          const d = add3(scale3(e1, k), scale3(e2, sign * sinPhi));
          const pRim = projectPoint(add3(worldAxisStart, scale3(d, r)), view);
          visibleLines.push({
            id: `${view}_cone_sil_${sign > 0 ? 'p' : 'n'}`,
            x1: pRim.u,
            y1: pRim.v,
            x2: pApex.u,
            y2: pApex.v,
            style: 'visible',
          });
        }
      } else {
        apexInsideBase = true;
      }
    } else {
      apexInsideBase = true;
    }

    const baseNormal = scale3(axisDirection, -1);
    const nDot = dot3(baseNormal, toViewer);
    const baseFacesViewer = nDot > 1e-5;
    const edgeOn = Math.abs(nDot) <= 1e-5;

    for (let i = 0; i < segments; i++) {
      const t0 = (i * 2 * Math.PI) / segments;
      const t1 = ((i + 1) * 2 * Math.PI) / segments;
      const tm = (t0 + t1) * 0.5;

      const r0 = applyQuat(q, { x: Math.cos(t0) * r, y: Math.sin(t0) * r, z: 0 });
      const r1 = applyQuat(q, { x: Math.cos(t1) * r, y: Math.sin(t1) * r, z: 0 });
      const radDir = normalize3(applyQuat(q, { x: Math.cos(tm), y: Math.sin(tm), z: 0 }));

      const p0 = projectPoint(add3(worldAxisStart, r0), view);
      const p1 = projectPoint(add3(worldAxisStart, r1), view);
      if (Math.hypot(p1.u - p0.u, p1.v - p0.v) < 0.01) continue;

      // Cone lateral outward normal along this generator
      const coneOutward = normalize3(add3(scale3(radDir, H), scale3(axisDirection, r)));
      const frontRim = dot3(coneOutward, toViewer) >= -1e-5;

      if (edgeOn) {
        if (dot3(radDir, toViewer) >= -1e-5) {
          visibleLines.push({
            id: `${view}_cone_base_${i}`,
            x1: p0.u,
            y1: p0.v,
            x2: p1.u,
            y2: p1.v,
            style: 'visible',
          });
        }
      } else {
        const isVis = apexInsideBase || baseFacesViewer || frontRim;
        const line: ProjectedLine2D = {
          id: `${view}_cone_base_${i}`,
          x1: p0.u,
          y1: p0.v,
          x2: p1.u,
          y2: p1.v,
          style: isVis ? 'visible' : 'hidden',
        };
        if (isVis) visibleLines.push(line);
        else hiddenLines.push(line);
      }
    }
  }

  return [...hiddenLines, ...visibleLines];
}

export function computeViewProjectedLines(worldSolid: WorldSolid, view: ViewKind): ProjectedLine2D[] {
  if (worldSolid.local.isCurved) {
    return computeCurvedSolidEdges(worldSolid, view);
  }
  return computePolyhedronEdges(worldSolid, view);
}
