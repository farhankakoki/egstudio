export type SolidCategory = 'prism' | 'pyramid' | 'curved';

export type SolidType =
  | 'triangular_prism'
  | 'square_prism'
  | 'pentagonal_prism'
  | 'hexagonal_prism'
  | 'custom_prism'
  | 'cube'
  | 'triangular_pyramid'
  | 'square_pyramid'
  | 'pentagonal_pyramid'
  | 'hexagonal_pyramid'
  | 'custom_pyramid'
  | 'cylinder'
  | 'cone'
  | 'hemisphere';

export interface SolidDimensions {
  sideLength: number;   // Base edge length (mm) for regular prisms/pyramids
  baseWidth: number;    // Secondary base width (mm) for rectangular/square prism when unlocked
  rectangularBase: boolean; // Allows baseWidth !== sideLength on square_prism
  baseRadius: number;   // Radius (mm) for cylinder & cone
  axisLength: number;   // Axis height/length (mm)
  numSides: number;     // Number of sides for custom prisms/pyramids (3..12)
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Quat = [number, number, number, number]; // [x, y, z, w]

export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

export interface SolidVertex {
  id: string;
  labelPlan: string;      // e.g. 'a', '1', 'o'
  labelElev: string;      // e.g. "a'", "1'", "o'"
  pos: Vec3;              // Local or World EG coordinates (X=along XY, Y=depth from VP, Z=height above HP)
  group: 'base' | 'top' | 'apex';
}

export interface SolidEdge {
  id: string;
  label: string;
  v0: number;             // index into vertices
  v1: number;             // index into vertices
  type: 'base' | 'top' | 'lateral' | 'generator';
}

export interface SolidFace {
  id: string;
  label: string;
  vertexIndices: number[]; // CCW outward winding in EG right-handed coords
  triangles: [number, number, number][]; // Triangulated indices for rendering & occlusion
  normal: Vec3;           // Outward unit normal
  center: Vec3;
  type: 'base' | 'top' | 'lateral';
}

export interface SolidGeometry {
  type: SolidType;
  category: SolidCategory;
  name: string;
  dimensions: SolidDimensions;
  isCurved: boolean;
  vertices: SolidVertex[];
  edges: SolidEdge[];
  faces: SolidFace[];
  axisStart: Vec3;        // Base center O1 (0, 0, 0)
  axisEnd: Vec3;          // Top center O2 or Apex O (0, 0, H)
  radius: number;         // Circumradius or cylinder/cone base radius
  numBaseSides: number;
}

export interface WorldSolid {
  local: SolidGeometry;
  worldVertices: SolidVertex[];
  worldFaces: SolidFace[];
  worldAxisStart: Vec3;
  worldAxisEnd: Vec3;
  axisDirection: Vec3;    // Unit vector from base center to top/apex
  quaternion: Quat;
  translation: Vec3;
  boundingBox: {
    min: Vec3;
    max: Vec3;
  };
}

export type OrientationMode = 'inclination' | 'solid_tilt_rotate' | 'euler';

export type RestingCondition =
  | 'base_hp'        // Resting on HP on its base
  | 'base_vp'        // Resting on VP on its base
  | 'base_edge_hp'   // Resting on HP on a selected base edge
  | 'base_corner_hp' // Resting on HP on a base corner
  | 'face_hp'        // Resting on HP on a lateral/slant face
  | 'generator_hp'   // Cone/Cylinder resting on HP on a generator
  | 'free';          // Free spatial axis orientation

export type BaseEdgeReference = 'edge_perp_vp' | 'edge_parallel_vp' | 'custom_roll';

export type RotationDirection = 'positive' | 'negative';

export type SelectedFeature =
  | { kind: 'axis' }
  | { kind: 'face'; faceId: string }
  | { kind: 'edge'; edgeId: string };

export type ProjectionConvention = 'first_angle' | 'third_angle';

export interface OrientationState {
  mode: OrientationMode;
  // Full-solid tilt & rotate angles relative to HP & VP (degrees)
  solidTiltHP: number;    // Tilt solid relative to HP (around Y axis, -180..180)
  solidTiltVP: number;    // Tilt solid toward/away from VP (around X axis, -180..180)
  solidRotateVP: number;  // Rotate solid in HP relative to VP (around Z axis, -180..180)
  solidRoll: number;      // Spin solid around its own local axis (-180..180)
  // Euler angles (degrees)
  eulerX: number;
  eulerY: number;
  eulerZ: number;
  // Inclination constraint mode
  restingCondition: RestingCondition;
  inclinedElement: 'axis' | 'slant_edge' | 'body_diagonal'; // Which line element is inclined at alpha/beta
  vpAngleType?: 'true' | 'apparent' | 'resting_edge'; // Whether betaVP is true angle to VP, top-view apparent angle, or resting base edge angle to VP
  alphaHP: number;        // Requested inclination to HP (degrees, 0..90)
  betaVP: number;         // Requested inclination to VP (degrees, 0..90)
  leanDirectionX: RotationDirection; // +X (right) or -X (left)
  leanDirectionY: RotationDirection; // +Y (forward toward viewer) or -Y (toward VP)
  baseReference: BaseEdgeReference;
  rollAngle: number;      // Roll around axis (degrees, -180..180)
  referenceFaceId: string | null;
  referenceEdgeId: string | null;
  // Feature inclination target (optional override when inclining a selected edge/face)
  featureTargetPlane: 'HP' | 'VP' | null;
  featureTargetAngle: number;
}

export interface PositionState {
  xOffset: number;        // mm along XY
  inFrontOfVP: number;    // mm (min Y >= inFrontOfVP when not resting on VP)
  aboveHP: number;        // mm (min Z >= aboveHP when not resting on HP)
  snapToHP: boolean;      // Forces min Z = 0
  snapToVP: boolean;      // Forces min Y = 0
}

export interface OrientationValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sinSqSum: number;
  maxAllowedBeta: number;
  actualAlphaHP: number;
  actualBetaVP: number;
  apparentAlphaElevation: number;
  apparentBetaPlan: number;
  trueAxisLength: number;
  planAxisLength: number;
  elevationAxisLength: number;
  restingContactErrorMm: number;
  selectedFeatureAngleHP: number | null;
  selectedFeatureAngleVP: number | null;
  actualInclinedAlphaHP: number | null;
  actualInclinedBetaVP: number | null;
  restingEdgeAngleVP?: number | null;
}

export type LineStyleType = 'visible' | 'hidden' | 'axis' | 'construction' | 'projector' | 'xy' | 'highlight';

export interface ProjectedLine2D {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: LineStyleType;
  label?: string;
}

export interface ProjectedPoint2D {
  id: string;
  x: number;
  y: number;
  label: string;
  isApex?: boolean;
}

export interface ProjectedDimension2D {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
  text: string;
}

export interface OrthographicDrawing {
  convention: ProjectionConvention;
  planLines: ProjectedLine2D[];
  elevationLines: ProjectedLine2D[];
  planPoints: ProjectedPoint2D[];
  elevationPoints: ProjectedPoint2D[];
  projectors: ProjectedLine2D[];
  dimensions: ProjectedDimension2D[];
  bounds: {
    minX: number;
    maxX: number;
    minPlanY: number;
    maxPlanY: number;
    minElevZ: number;
    maxElevZ: number;
  };
}

export interface DrawingSettings {
  convention: ProjectionConvention;
  showHidden: boolean;
  showConstruction: boolean;
  showDimensions: boolean;
  showLabels: boolean;
  drawingTitle: string;
  scaleLabel: string;
}

export interface ConstructionStep {
  stepNumber: number;
  title: string;
  whatToDraw: string;
  whyNecessary: string;
  formulaNote?: string;
  worldSolid: WorldSolid;
  drawing: OrthographicDrawing;
  highlightIds: string[];
  stageLabel: 'initial' | 'first_tilt' | 'second_tilt' | 'finishing';
}

export interface KtuProblemSpec {
  id: string;
  level: 1 | 2 | 3 | 4;
  title: string;
  statement: string;
  solidType: SolidType;
  dimensions: SolidDimensions;
  orientation: OrientationState;
  position: PositionState;
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  solidType: SolidType;
  dimensions: SolidDimensions;
  orientation: OrientationState;
  position: PositionState;
  drawingSettings: DrawingSettings;
}

export type AppSection =
  | 'home'
  | 'lines'
  | 'solids'
  | 'sections'
  | 'isometric'
  | 'workspace'
  | 'learn'
  | 'projects'
  | 'guide';

export type CameraPreset = 'isometric' | 'front' | 'top' | 'side' | 'reset';

// Module 1: Straight Lines
export interface LineProblemInput {
  startLabel: string;
  endLabel: string;
  inputMode: 'angles' | 'views';
  trueLength: number;
  startAboveHP: number;
  startInFrontVP: number;
  thetaHP: number;      // True inclination to HP (deg)
  phiVP: number;        // True inclination to VP (deg)
  planLength: number;   // Top view length (mm)
  elevLength: number;   // Front view length (mm)
  leanRight: boolean;
  leanForward: boolean;
  leanUp: boolean;
}

export interface LineSolution {
  valid: boolean;
  errors: string[];
  p0: Vec3;
  p1: Vec3;
  trueLength: number;
  planLength: number;
  elevLength: number;
  trueThetaHP: number;
  truePhiVP: number;
  apparentAlphaElev: number;
  apparentBetaPlan: number;
  ht: Vec3 | null;
  vt: Vec3 | null;
}

export interface AiQuestionAnswer {
  module: 'solids' | 'lines' | 'sections' | 'isometric' | 'general';
  title: string;
  summary: string;
  givenData: { label: string; value: string }[];
  keyResults: { label: string; value: string }[];
  steps: { title: string; instruction: string }[];
  solidsConfig?: {
    solidType: SolidType;
    sideLength: number;
    baseWidth: number;
    rectangularBase: boolean;
    baseRadius: number;
    axisLength: number;
    numSides: number;
    restingCondition: RestingCondition;
    inclinedElement: 'axis' | 'slant_edge' | 'body_diagonal';
    vpAngleType: 'true' | 'apparent' | 'resting_edge';
    alphaHP: number;
    betaVP: number;
    leanDirectionX: RotationDirection;
    leanDirectionY: RotationDirection;
    inFrontOfVP: number;
  };
  linesConfig?: LineProblemInput;
  sectionsConfig?: {
    solidType: SolidType;
    sideLength: number;
    baseRadius: number;
    axisLength: number;
    baseEdgeOrientation: 'edge_perp_vp' | 'edge_parallel_vp' | 'edge_45_vp';
    inFrontOfVP: number;
    planeMode: 'angle_height' | 'through_body_diagonal';
    sectionAngleDeg: number;
    sectionHeightAtAxis: number;
    keepPortion: 'bottom' | 'top';
  };
  isometricConfig?: {
    scaleMode: 'view' | 'projection';
    hasTopSolid: boolean;
    bottomType: SolidType;
    bottomSideOrRadius: number;
    bottomSecondaryWidth: number;
    bottomHeight: number;
    topType: SolidType;
    topSideOrRadius: number;
    topSecondaryWidth: number;
    topHeight: number;
  };
}

