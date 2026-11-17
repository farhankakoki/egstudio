import type {
  SolidCategory,
  SolidDimensions,
  SolidEdge,
  SolidFace,
  SolidGeometry,
  SolidType,
  SolidVertex,
  Vec3,
} from '../types/geometry';
import { add3, cross3, normalize3, scale3, sub3 } from './math';

export interface SolidCatalogItem {
  type: SolidType;
  category: SolidCategory;
  name: string;
  shortDesc: string;
  defaultDimensions: SolidDimensions;
}

export const DEFAULT_DIMENSIONS: SolidDimensions = {
  sideLength: 30,
  baseWidth: 30,
  rectangularBase: false,
  baseRadius: 25,
  axisLength: 60,
  numSides: 6,
};

export const SOLID_CATALOG: SolidCatalogItem[] = [
  {
    type: 'triangular_prism',
    category: 'prism',
    name: 'Triangular Prism',
    shortDesc: '3 rectangular lateral faces · 2 equilateral triangular bases',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 35, axisLength: 60, numSides: 3 },
  },
  {
    type: 'square_prism',
    category: 'prism',
    name: 'Square Prism',
    shortDesc: '4 rectangular lateral faces · 2 square or rectangular bases',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 35, baseWidth: 35, axisLength: 60, numSides: 4 },
  },
  {
    type: 'cube',
    category: 'prism',
    name: 'Cube',
    shortDesc: '6 equal square faces · 4 body diagonals · regular hexahedron',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 40, baseWidth: 40, axisLength: 40, numSides: 4 },
  },
  {
    type: 'pentagonal_prism',
    category: 'prism',
    name: 'Pentagonal Prism',
    shortDesc: '5 rectangular lateral faces · 2 regular pentagonal bases',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 30, axisLength: 60, numSides: 5 },
  },
  {
    type: 'hexagonal_prism',
    category: 'prism',
    name: 'Hexagonal Prism',
    shortDesc: '6 rectangular lateral faces · 2 regular hexagonal bases',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 30, axisLength: 60, numSides: 6 },
  },
  {
    type: 'custom_prism',
    category: 'prism',
    name: 'Custom Polygon Prism',
    shortDesc: 'N-sided regular prism (3 to 12 sides) · customizable dimensions',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 22, axisLength: 60, numSides: 8 },
  },
  {
    type: 'triangular_pyramid',
    category: 'pyramid',
    name: 'Triangular Pyramid',
    shortDesc: '3 slant triangular faces meeting at apex O · triangular base',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 40, axisLength: 60, numSides: 3 },
  },
  {
    type: 'square_pyramid',
    category: 'pyramid',
    name: 'Square Pyramid',
    shortDesc: '4 slant triangular faces meeting at apex O · square base',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 35, axisLength: 60, numSides: 4 },
  },
  {
    type: 'pentagonal_pyramid',
    category: 'pyramid',
    name: 'Pentagonal Pyramid',
    shortDesc: '5 slant triangular faces meeting at apex O · pentagonal base',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 30, axisLength: 65, numSides: 5 },
  },
  {
    type: 'hexagonal_pyramid',
    category: 'pyramid',
    name: 'Hexagonal Pyramid',
    shortDesc: '6 slant triangular faces meeting at apex O · hexagonal base',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 30, axisLength: 65, numSides: 6 },
  },
  {
    type: 'custom_pyramid',
    category: 'pyramid',
    name: 'Custom Polygon Pyramid',
    shortDesc: 'N-sided regular pyramid (3 to 12 sides) · customizable height',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, sideLength: 24, axisLength: 65, numSides: 8 },
  },
  {
    type: 'cylinder',
    category: 'curved',
    name: 'Cylinder',
    shortDesc: 'Circular top & base discs · smooth curved lateral surface',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, baseRadius: 22, axisLength: 60 },
  },
  {
    type: 'cone',
    category: 'curved',
    name: 'Cone',
    shortDesc: 'Circular base tapering smoothly to apex O · generators',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, baseRadius: 25, axisLength: 65 },
  },
  {
    type: 'hemisphere',
    category: 'curved',
    name: 'Hemisphere',
    shortDesc: 'Spherical dome with flat circular top face (diameter 2R)',
    defaultDimensions: { ...DEFAULT_DIMENSIONS, baseRadius: 25, axisLength: 25 },
  },
];

export function getSolidCatalogItem(type: SolidType): SolidCatalogItem {
  return SOLID_CATALOG.find((item) => item.type === type) ?? SOLID_CATALOG[3];
}

export function getSideCount(type: SolidType, dims: SolidDimensions): number {
  switch (type) {
    case 'triangular_prism':
    case 'triangular_pyramid':
      return 3;
    case 'square_prism':
    case 'cube':
    case 'square_pyramid':
      return 4;
    case 'pentagonal_prism':
    case 'pentagonal_pyramid':
      return 5;
    case 'hexagonal_prism':
    case 'hexagonal_pyramid':
      return 6;
    case 'custom_prism':
    case 'custom_pyramid':
      return Math.max(3, Math.min(12, Math.round(dims.numSides || 6)));
    case 'cylinder':
    case 'cone':
    case 'hemisphere':
      return 48; // Smooth tessellation for 3D rendering; exact analytical projections used in 2D
  }
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function vertexLetter(idx: number): string {
  if (idx < LETTERS.length) return LETTERS[idx].toLowerCase();
  return `v${idx + 1}`;
}

function computePolygonFace(
  id: string,
  label: string,
  indices: number[],
  vertices: SolidVertex[],
  type: 'base' | 'top' | 'lateral'
): SolidFace {
  const pts = indices.map((i) => vertices[i].pos);
  let center: Vec3 = { x: 0, y: 0, z: 0 };
  for (const p of pts) {
    center = add3(center, p);
  }
  center = scale3(center, 1 / pts.length);

  const p0 = pts[0];
  const p1 = pts[1];
  const p2 = pts[2];
  const normal = normalize3(cross3(sub3(p1, p0), sub3(p2, p0)));

  // Fan triangulation for convex polygon face
  const triangles: [number, number, number][] = [];
  for (let i = 1; i < indices.length - 1; i++) {
    triangles.push([indices[0], indices[i], indices[i + 1]]);
  }

  return {
    id,
    label,
    vertexIndices: indices,
    triangles,
    normal,
    center,
    type,
  };
}

function buildHemisphereSolid(item: SolidCatalogItem, dims: SolidDimensions): SolidGeometry {
  const R = Math.max(1, dims.baseRadius);
  const slices = 36;
  const rings = 9;
  const vertices: SolidVertex[] = [];
  const edges: SolidEdge[] = [];
  const faces: SolidFace[] = [];

  // Vertex 0: bottom pole at (0, 0, 0)
  vertices.push({
    id: 'pole_bottom',
    labelPlan: 'p0',
    labelElev: "p0'",
    pos: { x: 0, y: 0, z: 0 },
    group: 'base',
  });

  // Latitude rings r = 1 .. rings, top ring (r = rings) sits at Z = R with radius R
  for (let r = 1; r <= rings; r++) {
    const phi = (r / rings) * (Math.PI / 2);
    const ringRadius = R * Math.sin(phi);
    const z = R * (1 - Math.cos(phi));
    const isTop = r === rings;
    for (let i = 0; i < slices; i++) {
      const theta = (i * 2 * Math.PI) / slices;
      vertices.push({
        id: isTop ? `t_${i}` : `r${r}_${i}`,
        labelPlan: isTop ? `q${i + 1}` : `r${r}_${i + 1}`,
        labelElev: isTop ? `q${i + 1}'` : `r${r}_${i + 1}'`,
        pos: { x: ringRadius * Math.cos(theta), y: ringRadius * Math.sin(theta), z },
        group: isTop ? 'top' : 'base',
      });
    }
  }

  const topStart = 1 + (rings - 1) * slices;
  for (let i = 0; i < slices; i++) {
    const next = (i + 1) % slices;
    edges.push({
      id: `edge_top_${i}`,
      label: `Circular Rim ${i + 1}`,
      v0: topStart + i,
      v1: topStart + next,
      type: 'top',
    });
  }

  // Bottom spherical cap triangles (outward normal pointing downward-outward)
  for (let i = 0; i < slices; i++) {
    const next = (i + 1) % slices;
    const v1 = 1 + i;
    const v2 = 1 + next;
    faces.push({
      id: `face_cap_${i}`,
      label: `Dome Cap ${i + 1}`,
      vertexIndices: [0, v2, v1],
      triangles: [[0, v2, v1]],
      normal: normalize3(sub3(vertices[v1].pos, { x: 0, y: 0, z: R })),
      center: scale3(add3(vertices[0].pos, add3(vertices[v1].pos, vertices[v2].pos)), 1 / 3),
      type: 'lateral',
    });
  }

  // Latitude quad strips
  for (let r = 1; r < rings; r++) {
    const row0 = 1 + (r - 1) * slices;
    const row1 = 1 + r * slices;
    for (let i = 0; i < slices; i++) {
      const next = (i + 1) % slices;
      const a = row0 + i;
      const b = row0 + next;
      const c = row1 + next;
      const d = row1 + i;
      faces.push(
        computePolygonFace(`face_lat_${r}_${i}`, `Dome Patch ${r}-${i + 1}`, [a, b, c, d], vertices, 'lateral')
      );
    }
  }

  // Top flat circular face (normal = (0, 0, +1))
  const topIndices = Array.from({ length: slices }, (_, k) => topStart + k);
  faces.push(computePolygonFace('face_top', 'Flat Circular Face', topIndices, vertices, 'top'));

  return {
    type: 'hemisphere',
    category: 'curved',
    name: item.name,
    dimensions: { ...dims, axisLength: R },
    isCurved: true,
    vertices,
    edges,
    faces,
    axisStart: { x: 0, y: 0, z: 0 },
    axisEnd: { x: 0, y: 0, z: R },
    radius: R,
    numBaseSides: slices,
  };
}

/**
 * Generates local solid geometry in pure Engineering Graphics coordinates:
 * - Local axis along +Z from (0, 0, 0) to (0, 0, H)
 * - Base lies in Z = 0
 * - Edge 0 (v0 -> v1) lies on the +X side perpendicular to VP (parallel to Y axis)
 */
export function buildLocalSolid(type: SolidType, dims: SolidDimensions): SolidGeometry {
  const item = getSolidCatalogItem(type);
  if (type === 'hemisphere') {
    return buildHemisphereSolid(item, dims);
  }
  const category = item.category;
  const isCurved = category === 'curved';
  const n = getSideCount(type, dims);
  const H = type === 'cube' ? Math.max(1, dims.sideLength) : Math.max(1, dims.axisLength);

  let radius = 0;
  const basePoints: Vec3[] = [];

  if (isCurved) {
    radius = Math.max(1, dims.baseRadius);
    for (let i = 0; i < n; i++) {
      const theta = -Math.PI / n + (i * 2 * Math.PI) / n;
      basePoints.push({
        x: radius * Math.cos(theta),
        y: radius * Math.sin(theta),
        z: 0,
      });
    }
  } else if (type === 'square_prism' && dims.rectangularBase) {
    const halfX = Math.max(1, dims.sideLength) / 2;
    const halfY = Math.max(1, dims.baseWidth) / 2;
    radius = Math.hypot(halfX, halfY);
    // Ordered CCW around +Z so Edge 0 (v0 -> v1) is at +X perpendicular to VP
    basePoints.push(
      { x: halfX, y: -halfY, z: 0 },
      { x: halfX, y: halfY, z: 0 },
      { x: -halfX, y: halfY, z: 0 },
      { x: -halfX, y: -halfY, z: 0 }
    );
  } else {
    const side = Math.max(1, dims.sideLength);
    radius = side / (2 * Math.sin(Math.PI / n));
    for (let i = 0; i < n; i++) {
      // Start at -pi/n so edge (0 -> 1) is vertical in Plan (+X side, perpendicular to VP)
      const theta = -Math.PI / n + (i * 2 * Math.PI) / n;
      basePoints.push({
        x: radius * Math.cos(theta),
        y: radius * Math.sin(theta),
        z: 0,
      });
    }
  }

  const vertices: SolidVertex[] = [];
  const edges: SolidEdge[] = [];
  const faces: SolidFace[] = [];

  // Base vertices: 0 .. n-1
  for (let i = 0; i < n; i++) {
    const l = isCurved ? `p${i + 1}` : vertexLetter(i);
    vertices.push({
      id: `b_${i}`,
      labelPlan: l,
      labelElev: `${l}'`,
      pos: basePoints[i],
      group: 'base',
    });
  }

  if (category === 'prism' || type === 'cylinder') {
    // Top vertices: n .. 2n-1
    for (let i = 0; i < n; i++) {
      const l = isCurved ? `q${i + 1}` : `${i + 1}`;
      vertices.push({
        id: `t_${i}`,
        labelPlan: l,
        labelElev: `${l}'`,
        pos: { x: basePoints[i].x, y: basePoints[i].y, z: H },
        group: 'top',
      });
    }

    // Base edges
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      edges.push({
        id: `edge_base_${i}`,
        label: isCurved
          ? `Base Arc ${i + 1}`
          : `Base Edge ${vertices[i].labelPlan.toUpperCase()}-${vertices[next].labelPlan.toUpperCase()}`,
        v0: i,
        v1: next,
        type: isCurved ? 'base' : 'base',
      });
    }

    // Top edges
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      edges.push({
        id: `edge_top_${i}`,
        label: isCurved
          ? `Top Arc ${i + 1}`
          : `Top Edge ${vertices[n + i].labelPlan}-${vertices[n + next].labelPlan}`,
        v0: n + i,
        v1: n + next,
        type: 'top',
      });
    }

    // Lateral edges / generators
    for (let i = 0; i < n; i++) {
      edges.push({
        id: `edge_lat_${i}`,
        label: isCurved
          ? `Generator ${i + 1}`
          : `Longer Edge ${vertices[i].labelPlan.toUpperCase()}-${vertices[n + i].labelPlan}`,
        v0: i,
        v1: n + i,
        type: isCurved ? 'generator' : 'lateral',
      });
    }

    // Base face (reversed winding so normal = (0, 0, -1))
    const baseIndices = Array.from({ length: n }, (_, k) => n - 1 - k);
    faces.push(computePolygonFace('face_base', 'Base Face', baseIndices, vertices, 'base'));

    // Top face (CCW winding so normal = (0, 0, +1))
    const topIndices = Array.from({ length: n }, (_, k) => n + k);
    faces.push(computePolygonFace('face_top', 'Top Face', topIndices, vertices, 'top'));

    // Lateral rectangular faces
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      faces.push(
        computePolygonFace(
          `face_lat_${i}`,
          isCurved
            ? `Curved Patch ${i + 1}`
            : `Rect. Face ${vertices[i].labelPlan.toUpperCase()}${vertices[next].labelPlan.toUpperCase()}${vertices[n + next].labelPlan}${vertices[n + i].labelPlan}`,
          [i, next, n + next, n + i],
          vertices,
          'lateral'
        )
      );
    }
  } else {
    // Pyramid or Cone: Apex at index n
    const apexIdx = n;
    vertices.push({
      id: 'apex',
      labelPlan: 'o',
      labelElev: "o'",
      pos: { x: 0, y: 0, z: H },
      group: 'apex',
    });

    // Base edges
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      edges.push({
        id: `edge_base_${i}`,
        label: isCurved
          ? `Base Arc ${i + 1}`
          : `Base Edge ${vertices[i].labelPlan.toUpperCase()}-${vertices[next].labelPlan.toUpperCase()}`,
        v0: i,
        v1: next,
        type: 'base',
      });
    }

    // Slant edges / generators
    for (let i = 0; i < n; i++) {
      edges.push({
        id: `edge_lat_${i}`,
        label: isCurved
          ? `Generator ${i + 1}`
          : `Slant Edge O-${vertices[i].labelPlan.toUpperCase()}`,
        v0: i,
        v1: apexIdx,
        type: isCurved ? 'generator' : 'lateral',
      });
    }

    // Base face
    const baseIndices = Array.from({ length: n }, (_, k) => n - 1 - k);
    faces.push(computePolygonFace('face_base', 'Base Face', baseIndices, vertices, 'base'));

    // Slant triangular faces
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      faces.push(
        computePolygonFace(
          `face_lat_${i}`,
          isCurved
            ? `Conical Patch ${i + 1}`
            : `Slant Face O-${vertices[i].labelPlan.toUpperCase()}-${vertices[next].labelPlan.toUpperCase()}`,
          [i, next, apexIdx],
          vertices,
          'lateral'
        )
      );
    }
  }

  return {
    type,
    category,
    name: item.name,
    dimensions: { ...dims },
    isCurved,
    vertices,
    edges,
    faces,
    axisStart: { x: 0, y: 0, z: 0 },
    axisEnd: { x: 0, y: 0, z: H },
    radius,
    numBaseSides: n,
  };
}
