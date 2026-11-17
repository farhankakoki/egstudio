import type {
  SolidDimensions,
  SolidEdge,
  SolidFace,
  SolidType,
  SolidVertex,
  Vec2,
  Vec3,
  WorldSolid,
} from '../types/geometry';
import { buildLocalSolid, DEFAULT_DIMENSIONS } from './geometry';
import { add3, dist2, dot3, quatIdentity } from './math';
import { transformSolid } from './orientation';

export interface IsometricSolidSpec {
  type: SolidType;
  sideOrRadius: number; // sideLength for prism/pyramid/cube, radius for cylinder/cone/hemisphere
  secondaryWidth: number; // used when bottom is square_prism with rectangular dimensions
  height: number;
}

export interface IsometricProblemInput {
  bottom: IsometricSolidSpec;
  hasTopSolid: boolean;
  top: IsometricSolidSpec;
  scaleMode: 'view' | 'projection'; // 'view' = true lengths (1.0), 'projection' = isometric scale (sqrt(2/3))
}

export interface IsometricPreset {
  id: string;
  title: string;
  statement: string;
  input: IsometricProblemInput;
}

export const KTU_ISOMETRIC_PRESETS: IsometricPreset[] = [
  {
    id: 'ktu_m4_q7',
    title: 'Q7 · Square Pyramid on Hemisphere (Ø 50 mm, Base 24 mm, Height 40 mm)',
    statement:
      'Draw the isometric view of a square pyramid, side of base 24 mm and height 40 mm, resting with its base centrally on the circular face of a hemisphere of diameter 50 mm.',
    input: {
      bottom: {
        type: 'hemisphere',
        sideOrRadius: 25,
        secondaryWidth: 50,
        height: 25,
      },
      hasTopSolid: true,
      top: {
        type: 'square_pyramid',
        sideOrRadius: 24,
        secondaryWidth: 24,
        height: 40,
      },
      scaleMode: 'view',
    },
  },
  {
    id: 'ktu_m4_q8',
    title: 'Q8 · Cylinder on Square Plate (Ø 40 × 55 mm on 55 × 55 × 18 mm Plate)',
    statement:
      'A cylinder of base diameter 40 mm and axis length 55 mm is placed centrally on the top surface of a square plate with side 55 mm × 55 mm and thickness 18 mm. Draw the isometric view of the combination.',
    input: {
      bottom: {
        type: 'square_prism',
        sideOrRadius: 55,
        secondaryWidth: 55,
        height: 18,
      },
      hasTopSolid: true,
      top: {
        type: 'cylinder',
        sideOrRadius: 20,
        secondaryWidth: 40,
        height: 55,
      },
      scaleMode: 'view',
    },
  },
];

export interface IsoLine2D {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: 'visible' | 'hidden' | 'axis' | 'iso_axis';
}

export interface IsometricDrawingResult {
  combinedWorldSolid: WorldSolid;
  lines: IsoLine2D[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  totalHeightMm: number;
  isoScaleFactor: number;
}

function makeDims(spec: IsometricSolidSpec): SolidDimensions {
  return {
    ...DEFAULT_DIMENSIONS,
    sideLength: spec.sideOrRadius,
    baseWidth: spec.secondaryWidth || spec.sideOrRadius,
    rectangularBase: spec.type === 'square_prism' && spec.secondaryWidth !== spec.sideOrRadius,
    baseRadius: spec.sideOrRadius,
    axisLength:
      spec.type === 'cube'
        ? spec.sideOrRadius
        : spec.type === 'hemisphere'
          ? spec.sideOrRadius
          : spec.height,
    numSides:
      spec.type === 'pentagonal_prism' || spec.type === 'pentagonal_pyramid'
        ? 5
        : spec.type === 'hexagonal_prism' || spec.type === 'hexagonal_pyramid'
          ? 6
          : spec.type === 'triangular_prism' || spec.type === 'triangular_pyramid'
            ? 3
            : 4,
  };
}

/**
 * Isometric projection transform from centered 3D (x, y, z) to 2D SVG-ready plane (+v up).
 * View direction from (+1, +1, +1)/sqrt(3) looking toward origin.
 */
function projectIso(p: Vec3, scaleFactor: number): { u: number; v: number; depth: number } {
  const cos30 = Math.sqrt(3) / 2;
  const sin30 = 0.5;
  const u = (p.x - p.y) * cos30 * scaleFactor;
  const v = (p.z - (p.x + p.y) * sin30) * scaleFactor;
  const depth = (p.x + p.y + p.z) / Math.sqrt(3);
  return { u, v, depth };
}

interface Tri2D {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
}

function isOccludedByFrontTriangles(px: number, py: number, pDepth: number, tris: Tri2D[]): boolean {
  for (const tri of tris) {
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
    if (Math.abs(denom) < 1e-8) continue;
    const inv = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    const w = 1 - u - v;
    if (u > 1e-3 && v > 1e-3 && w > 1e-3) {
      const triDepth = w * tri.az + v * tri.bz + u * tri.cz;
      if (triDepth > pDepth + 0.08) return true;
    }
  }
  return false;
}

function isNearVisible(a: Vec2, b: Vec2, visList: IsoLine2D[]): boolean {
  const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  for (const l of visList) {
    const p = { x: l.x1, y: l.y1 };
    const q = { x: l.x2, y: l.y2 };
    const dPt = (m: Vec2) => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-6) return dist2(m, p);
      const t = Math.max(0, Math.min(1, ((m.x - p.x) * dx + (m.y - p.y) * dy) / lenSq));
      return Math.hypot(m.x - (p.x + t * dx), m.y - (p.y + t * dy));
    };
    if (dPt(a) < 0.35 && dPt(mid) < 0.35 && dPt(b) < 0.35) return true;
  }
  return false;
}

function mergeWorldSolids(bottom: WorldSolid, top: WorldSolid | null): WorldSolid {
  if (!top) return bottom;
  const offset = bottom.worldVertices.length;
  const worldVertices: SolidVertex[] = [
    ...bottom.worldVertices,
    ...top.worldVertices.map((v) => ({ ...v, id: `top_${v.id}` })),
  ];
  const worldFaces: SolidFace[] = [
    ...bottom.worldFaces,
    ...top.worldFaces.map((f) => ({
      ...f,
      id: `top_${f.id}`,
      vertexIndices: f.vertexIndices.map((i) => i + offset),
      triangles: f.triangles.map(([a, b, c]) => [a + offset, b + offset, c + offset] as [number, number, number]),
    })),
  ];
  const combinedEdges: SolidEdge[] = [
    ...bottom.local.edges,
    ...top.local.edges.map((e) => ({
      ...e,
      id: `top_${e.id}`,
      v0: e.v0 + offset,
      v1: e.v1 + offset,
    })),
  ];

  const min: Vec3 = {
    x: Math.min(bottom.boundingBox.min.x, top.boundingBox.min.x),
    y: Math.min(bottom.boundingBox.min.y, top.boundingBox.min.y),
    z: Math.min(bottom.boundingBox.min.z, top.boundingBox.min.z),
  };
  const max: Vec3 = {
    x: Math.max(bottom.boundingBox.max.x, top.boundingBox.max.x),
    y: Math.max(bottom.boundingBox.max.y, top.boundingBox.max.y),
    z: Math.max(bottom.boundingBox.max.z, top.boundingBox.max.z),
  };

  return {
    local: {
      ...bottom.local,
      isCurved: false, // Render merged assembly edges directly in 3D viewport
      vertices: worldVertices,
      edges: combinedEdges,
      faces: worldFaces,
    },
    worldVertices,
    worldFaces,
    worldAxisStart: bottom.worldAxisStart,
    worldAxisEnd: top.worldAxisEnd,
    axisDirection: { x: 0, y: 0, z: 1 },
    quaternion: quatIdentity(),
    translation: { x: 0, y: 0, z: 0 },
    boundingBox: { min, max },
  };
}

export function generateIsometricDrawing(input: IsometricProblemInput): IsometricDrawingResult {
  const k = input.scaleMode === 'view' ? 1.0 : Math.sqrt(2 / 3);
  const bottomLocal = buildLocalSolid(input.bottom.type, makeDims(input.bottom));
  const bottomPos = {
    xOffset: 0,
    inFrontOfVP: 25,
    aboveHP: 0,
    snapToHP: true,
    snapToVP: false,
  };
  const bottomWorld = transformSolid(bottomLocal, quatIdentity(), bottomPos);
  const bottomTopZ = bottomWorld.boundingBox.max.z;

  let topWorld: WorldSolid | null = null;
  if (input.hasTopSolid) {
    const topLocal = buildLocalSolid(input.top.type, makeDims(input.top));
    topWorld = transformSolid(topLocal, quatIdentity(), {
      xOffset: 0,
      inFrontOfVP: 0,
      aboveHP: bottomTopZ,
      snapToHP: false,
      snapToVP: false,
    });
    // Center top solid over bottom solid's X/Y center
    const bx = (bottomWorld.boundingBox.min.x + bottomWorld.boundingBox.max.x) / 2;
    const by = (bottomWorld.boundingBox.min.y + bottomWorld.boundingBox.max.y) / 2;
    const tx = (topWorld.boundingBox.min.x + topWorld.boundingBox.max.x) / 2;
    const ty = (topWorld.boundingBox.min.y + topWorld.boundingBox.max.y) / 2;
    const shift: Vec3 = { x: bx - tx, y: by - ty, z: 0 };
    topWorld = {
      ...topWorld,
      worldVertices: topWorld.worldVertices.map((v) => ({ ...v, pos: add3(v.pos, shift) })),
      worldFaces: topWorld.worldFaces.map((f) => ({ ...f, center: add3(f.center, shift) })),
      worldAxisStart: add3(topWorld.worldAxisStart, shift),
      worldAxisEnd: add3(topWorld.worldAxisEnd, shift),
      boundingBox: {
        min: add3(topWorld.boundingBox.min, shift),
        max: add3(topWorld.boundingBox.max, shift),
      },
    };
  }

  const combinedWorldSolid = mergeWorldSolids(bottomWorld, topWorld);

  // Center around local (0, 0, 0) for crisp isometric SVG framing
  const centerXY: Vec3 = {
    x: (bottomWorld.boundingBox.min.x + bottomWorld.boundingBox.max.x) / 2,
    y: (bottomWorld.boundingBox.min.y + bottomWorld.boundingBox.max.y) / 2,
    z: 0,
  };
  const toIsoSpace = (p: Vec3): Vec3 => ({
    x: p.x - centerXY.x,
    y: p.y - centerXY.y,
    z: p.z,
  });

  const viewDir = { x: -1 / Math.sqrt(3), y: -1 / Math.sqrt(3), z: -1 / Math.sqrt(3) };
  const toViewer = { x: 1 / Math.sqrt(3), y: 1 / Math.sqrt(3), z: 1 / Math.sqrt(3) };

  // Build all front-facing triangles from both solids for accurate occlusion
  const frontTris: Tri2D[] = [];
  const collectTris = (ws: WorldSolid) => {
    for (const face of ws.worldFaces) {
      if (dot3(face.normal, toViewer) > 1e-4) {
        for (const [i0, i1, i2] of face.triangles) {
          const p0 = projectIso(toIsoSpace(ws.worldVertices[i0].pos), k);
          const p1 = projectIso(toIsoSpace(ws.worldVertices[i1].pos), k);
          const p2 = projectIso(toIsoSpace(ws.worldVertices[i2].pos), k);
          frontTris.push({
            ax: p0.u, ay: p0.v, az: p0.depth,
            bx: p1.u, by: p1.v, bz: p1.depth,
            cx: p2.u, cy: p2.v, cz: p2.depth,
          });
        }
      }
    }
  };
  collectTris(bottomWorld);
  if (topWorld) collectTris(topWorld);

  const visibleLines: IsoLine2D[] = [];
  const hiddenCandidates: IsoLine2D[] = [];

  const testSegment = (id: string, p3a: Vec3, p3b: Vec3, alwaysVisible = false) => {
    const a = projectIso(toIsoSpace(p3a), k);
    const b = projectIso(toIsoSpace(p3b), k);
    if (Math.hypot(b.u - a.u, b.v - a.v) < 0.04) return;
    if (alwaysVisible) {
      visibleLines.push({ id, x1: a.u, y1: a.v, x2: b.u, y2: b.v, style: 'visible' });
      return;
    }
    let occ = 0;
    for (const t of [0.22, 0.5, 0.78]) {
      const m3 = {
        x: p3a.x + (p3b.x - p3a.x) * t,
        y: p3a.y + (p3b.y - p3a.y) * t,
        z: p3a.z + (p3b.z - p3a.z) * t,
      };
      const m2 = projectIso(toIsoSpace(m3), k);
      if (isOccludedByFrontTriangles(m2.u, m2.v, m2.depth, frontTris)) occ++;
    }
    const line: IsoLine2D = {
      id,
      x1: a.u,
      y1: a.v,
      x2: b.u,
      y2: b.v,
      style: occ >= 2 ? 'hidden' : 'visible',
    };
    if (line.style === 'visible') visibleLines.push(line);
    else hiddenCandidates.push(line);
  };

  const addSolidAnalyticalEdges = (ws: WorldSolid, prefix: string) => {
    if (ws.local.type === 'hemisphere') {
      const C = ws.worldAxisEnd;
      const R = ws.local.radius;
      const segs = 72;
      for (let i = 0; i < segs; i++) {
        const t0 = (i * 2 * Math.PI) / segs;
        const t1 = ((i + 1) * 2 * Math.PI) / segs;
        const p0 = { x: C.x + R * Math.cos(t0), y: C.y + R * Math.sin(t0), z: C.z };
        const p1 = { x: C.x + R * Math.cos(t1), y: C.y + R * Math.sin(t1), z: C.z };
        testSegment(`${prefix}_rim_${i}`, p0, p1);
      }
      // Spherical lower dome great-circle silhouette in isometric plane
      const isoC = projectIso(toIsoSpace(C), k);
      const rSil = R * Math.sqrt(1.5) * k;
      for (let i = 0; i < 48; i++) {
        const a0 = Math.PI + (i * Math.PI) / 48;
        const a1 = Math.PI + ((i + 1) * Math.PI) / 48;
        visibleLines.push({
          id: `${prefix}_dome_${i}`,
          x1: isoC.u + rSil * Math.cos(a0),
          y1: isoC.v + rSil * Math.sin(a0),
          x2: isoC.u + rSil * Math.cos(a1),
          y2: isoC.v + rSil * Math.sin(a1),
          style: 'visible',
        });
      }
      return;
    }

    if (ws.local.type === 'cylinder') {
      const R = ws.local.radius;
      const c0 = ws.worldAxisStart;
      const c1 = ws.worldAxisEnd;
      const segs = 72;
      for (let i = 0; i < segs; i++) {
        const t0 = (i * 2 * Math.PI) / segs;
        const t1 = ((i + 1) * 2 * Math.PI) / segs;
        testSegment(
          `${prefix}_top_${i}`,
          { x: c1.x + R * Math.cos(t0), y: c1.y + R * Math.sin(t0), z: c1.z },
          { x: c1.x + R * Math.cos(t1), y: c1.y + R * Math.sin(t1), z: c1.z }
        );
        testSegment(
          `${prefix}_bot_${i}`,
          { x: c0.x + R * Math.cos(t0), y: c0.y + R * Math.sin(t0), z: c0.z },
          { x: c0.x + R * Math.cos(t1), y: c0.y + R * Math.sin(t1), z: c0.z }
        );
      }
      // Left & Right isometric silhouette generators perpendicular to viewDir=(1,1,1) & axis=(0,0,1)
      const nSil = { x: 1 / Math.SQRT2, y: -1 / Math.SQRT2, z: 0 };
      for (const s of [1, -1]) {
        testSegment(
          `${prefix}_sil_${s > 0 ? 'p' : 'n'}`,
          { x: c0.x + s * R * nSil.x, y: c0.y + s * R * nSil.y, z: c0.z },
          { x: c1.x + s * R * nSil.x, y: c1.y + s * R * nSil.y, z: c1.z }
        );
      }
      return;
    }

    if (ws.local.type === 'cone') {
      const R = ws.local.radius;
      const H = ws.local.dimensions.axisLength;
      const c0 = ws.worldAxisStart;
      const apex = ws.worldAxisEnd;
      const segs = 72;
      for (let i = 0; i < segs; i++) {
        const t0 = (i * 2 * Math.PI) / segs;
        const t1 = ((i + 1) * 2 * Math.PI) / segs;
        testSegment(
          `${prefix}_bot_${i}`,
          { x: c0.x + R * Math.cos(t0), y: c0.y + R * Math.sin(t0), z: c0.z },
          { x: c0.x + R * Math.cos(t1), y: c0.y + R * Math.sin(t1), z: c0.z }
        );
      }
      // Exact cone tangent generators
      const e1 = { x: -1 / Math.SQRT2, y: -1 / Math.SQRT2, z: 0 };
      const e2 = { x: 1 / Math.SQRT2, y: -1 / Math.SQRT2, z: 0 };
      const vpLen = Math.hypot(viewDir.x, viewDir.y);
      const kCone = Math.max(-0.98, Math.min(0.98, -(R / H) * (viewDir.z / vpLen)));
      const sinPhi = Math.sqrt(1 - kCone * kCone);
      for (const s of [1, -1]) {
        const rx = e1.x * kCone + e2.x * s * sinPhi;
        const ry = e1.y * kCone + e2.y * s * sinPhi;
        testSegment(`${prefix}_sil_${s > 0 ? 'p' : 'n'}`, { x: c0.x + R * rx, y: c0.y + R * ry, z: c0.z }, apex, true);
      }
      return;
    }

    // Polyhedron
    for (const e of ws.local.edges) {
      testSegment(`${prefix}_${e.id}`, ws.worldVertices[e.v0].pos, ws.worldVertices[e.v1].pos);
    }
  };

  addSolidAnalyticalEdges(bottomWorld, 'bot');
  if (topWorld) addSolidAnalyticalEdges(topWorld, 'top');

  // Vertical centerline axis
  const axStart = projectIso(toIsoSpace(bottomWorld.worldAxisStart), k);
  const axEnd = projectIso(toIsoSpace(topWorld ? topWorld.worldAxisEnd : bottomWorld.worldAxisEnd), k);

  // Deduplicate hidden lines coinciding with visible lines
  const finalHidden: IsoLine2D[] = [];
  for (const h of hiddenCandidates) {
    if (!isNearVisible({ x: h.x1, y: h.y1 }, { x: h.x2, y: h.y2 }, visibleLines)) {
      finalHidden.push(h);
    }
  }

  // Isometric 30° reference axes extending outward from bottom center
  const baseHalf = Math.max(
    (bottomWorld.boundingBox.max.x - bottomWorld.boundingBox.min.x) * 0.5,
    (bottomWorld.boundingBox.max.y - bottomWorld.boundingBox.min.y) * 0.5,
    25
  );
  const axisReach = baseHalf + 18;
  const oIso = projectIso({ x: 0, y: 0, z: 0 }, k);
  const xTip = projectIso({ x: axisReach, y: 0, z: 0 }, k);
  const yTip = projectIso({ x: 0, y: axisReach, z: 0 }, k);
  const isoAxes: IsoLine2D[] = [
    { id: 'iso_ax_x', x1: oIso.u, y1: oIso.v, x2: xTip.u, y2: xTip.v, style: 'iso_axis' },
    { id: 'iso_ax_y', x1: oIso.u, y1: oIso.v, x2: yTip.u, y2: yTip.v, style: 'iso_axis' },
  ];

  const allLines: IsoLine2D[] = [
    ...isoAxes,
    ...finalHidden,
    { id: 'iso_center_axis', x1: axStart.u, y1: axStart.v, x2: axEnd.u, y2: axEnd.v, style: 'axis' },
    ...visibleLines,
  ];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const l of allLines) {
    minX = Math.min(minX, l.x1, l.x2);
    maxX = Math.max(maxX, l.x1, l.x2);
    minY = Math.min(minY, l.y1, l.y2);
    maxY = Math.max(maxY, l.y1, l.y2);
  }

  return {
    combinedWorldSolid,
    lines: allLines,
    bounds: { minX, maxX, minY, maxY },
    totalHeightMm: combinedWorldSolid.boundingBox.max.z,
    isoScaleFactor: k,
  };
}
