import type {
  OrientationState,
  OrientationValidation,
  PositionState,
  Quat,
  SelectedFeature,
  SolidFace,
  SolidGeometry,
  SolidVertex,
  Vec3,
  WorldSolid,
} from '../types/geometry';
import {
  add3,
  applyQuat,
  clamp,
  cross3,
  degToRad,
  dot3,
  EPS,
  len3,
  normalize3,
  quatFromAxisAngle,
  quatFromEulerDeg,
  quatFromUnitVectors,
  quatIdentity,
  quatMultiply,
  radToDeg,
  scale3,
  sub3,
} from './math';

export interface SolvedOrientation {
  quaternion: Quat;
  validation: OrientationValidation;
}

export function createDefaultOrientation(): OrientationState {
  return {
    mode: 'inclination',
    solidTiltHP: 0,
    solidTiltVP: 0,
    solidRotateVP: 0,
    solidRoll: 0,
    eulerX: 0,
    eulerY: 0,
    eulerZ: 0,
    restingCondition: 'base_hp',
    inclinedElement: 'axis',
    vpAngleType: 'true',
    alphaHP: 90,
    betaVP: 0,
    leanDirectionX: 'positive',
    leanDirectionY: 'positive',
    baseReference: 'edge_perp_vp',
    rollAngle: 0,
    referenceFaceId: 'face_lat_0',
    referenceEdgeId: 'edge_base_0',
    featureTargetPlane: null,
    featureTargetAngle: 0,
  };
}

export function createDefaultPosition(): PositionState {
  return {
    xOffset: 0,
    inFrontOfVP: 25,
    aboveHP: 0,
    snapToHP: true,
    snapToVP: false,
  };
}

/**
 * Computes the natural axis angle to HP when a specific face rests flat on HP.
 */
export function getNaturalFaceRestingAlpha(solid: SolidGeometry, face: SolidFace): number {
  // Local axis is (0, 0, 1). If face normal is rotated to (0, 0, -1),
  // dot(axis_world, k) = dot((0,0,1), -face.normal) = -face.normal.z
  const dz = Math.abs(-face.normal.z);
  return radToDeg(Math.asin(clamp(dz, 0, 1)));
}

/**
 * Builds the Stage-1 quaternion (before azimuthal rotation around Z) so that:
 * - Local axis (0,0,1) tilts to have z-component = sin(alpha) * signZ
 * - Selected resting feature / base reference roll is strictly honored.
 */
function solveStage1Quaternion(
  solid: SolidGeometry,
  orientation: OrientationState,
  alphaDeg: number
): Quat {
  const { restingCondition, baseReference, rollAngle, referenceFaceId, referenceEdgeId, leanDirectionX } = orientation;
  const xSign = leanDirectionX === 'positive' ? 1 : -1;

  // Case A: Resting flat on Base on HP (alpha = 90°)
  if (restingCondition === 'base_hp') {
    let roll = 0;
    if (baseReference === 'edge_parallel_vp') roll = 90;
    else if (baseReference === 'custom_roll') roll = rollAngle;
    return quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(roll));
  }

  // Case B: Resting flat on Base on VP (axis perp to VP, beta = 90°, alpha = 0°)
  if (restingCondition === 'base_vp') {
    const dirY = orientation.leanDirectionY === 'positive' ? 1 : -1;
    // Rotate local +Z axis to +Y (or -Y)
    const qBase = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, degToRad(dirY > 0 ? -90 : 90));
    let roll = 0;
    if (baseReference === 'edge_parallel_vp') roll = 90;
    else if (baseReference === 'custom_roll') roll = rollAngle;
    const qRoll = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(roll));
    return quatMultiply(qBase, qRoll);
  }

  // Case C: Resting flat on a selected lateral/slant face on HP
  if (restingCondition === 'face_hp') {
    const face = solid.faces.find((f) => f.id === referenceFaceId) ?? solid.faces.find((f) => f.type === 'lateral');
    if (face) {
      // Align face normal to (0, 0, -1) so the face sits flush on HP (Z = 0)
      const qAlignFace = quatFromUnitVectors(face.normal, { x: 0, y: 0, z: -1 });
      // Align axis projection in XY along +X (or -X) for clean Stage-1 canonical pose
      const axisAfter = applyQuat(qAlignFace, { x: 0, y: 0, z: 1 });
      const xyLen = Math.hypot(axisAfter.x, axisAfter.y);
      if (xyLen > EPS) {
        const currentAzimuth = Math.atan2(axisAfter.y, axisAfter.x);
        const targetAzimuth = xSign > 0 ? 0 : Math.PI;
        const qAlignX = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, targetAzimuth - currentAzimuth);
        return quatMultiply(qAlignX, qAlignFace);
      }
      return qAlignFace;
    }
  }

  // Case D: Cone or Cylinder resting on a generator on HP
  if (restingCondition === 'generator_hp') {
    // Rotate local +X (a base rim point) down toward -Z so a generator along theta=0 rests on HP
    const alphaRad = solid.category === 'pyramid' || solid.type === 'cone'
      ? Math.atan2(solid.axisEnd.z, solid.radius) // Wait: for cone, generator angle to base is atan(H/R), so axis angle to HP when generator is on HP is 90 - atan(H/R) = atan(R/H)
      : 0;
    const tiltAngle = Math.PI / 2 - alphaRad;
    return quatFromAxisAngle({ x: 0, y: 1, z: 0 }, xSign * tiltAngle);
  }

  // Case E: Resting on a Base Edge on HP
  if (restingCondition === 'base_edge_hp') {
    const edge = solid.edges.find((e) => e.id === referenceEdgeId && e.type === 'base')
      ?? solid.edges.find((e) => e.type === 'base');
    if (edge) {
      const p0 = solid.vertices[edge.v0].pos;
      const p1 = solid.vertices[edge.v1].pos;
      const edgeMid = scale3(add3(p0, p1), 0.5);
      // Outward vector from base center (0,0,0) to edge midpoint in local XY
      const midDir = normalize3({ x: edgeMid.x, y: edgeMid.y, z: 0 });
      // Rotate around Z so edgeMid points along +X (if leaning +X) or -X (if leaning -X)
      const currentAngle = Math.atan2(midDir.y, midDir.x);
      const targetAngle = xSign > 0 ? 0 : Math.PI;
      const qAlignEdge = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, targetAngle - currentAngle);
      // Now tilt around Y by (90 - alpha) so edge stays on Z=0 and axis leans toward +X (if xSign>0)
      const tilt = degToRad(90 - alphaDeg);
      const qTilt = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, xSign * tilt);
      return quatMultiply(qTilt, qAlignEdge);
    }
  }

  // Case F: Resting on a Base Corner on HP
  if (restingCondition === 'base_corner_hp') {
    const corner = solid.vertices[0].pos;

    // Body diagonal inclination for Prisms / Cube (v0 -> opposite top corner)
    if (orientation.inclinedElement === 'body_diagonal' && solid.category === 'prism') {
      const oppIdx = Math.floor(solid.numBaseSides / 2);
      const oppBase = solid.vertices[oppIdx].pos;
      const spanVec = { x: corner.x - oppBase.x, y: corner.y - oppBase.y, z: 0 };
      const spanLen = Math.hypot(spanVec.x, spanVec.y);
      const currentAngle = Math.atan2(spanVec.y, spanVec.x);
      const targetAngle = xSign > 0 ? 0 : Math.PI;
      const qAlignCorner = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, targetAngle - currentAngle);

      const H = solid.axisEnd.z;
      const gamma = Math.atan2(H, spanLen);
      const alphaRad = degToRad(alphaDeg);
      // Tilt around Y so body diagonal (oppBase -> top0 OR v0 -> oppTop) makes alphaDeg with HP
      // When xSign > 0, v0 is at +span/2, oppTop is at (-span/2, 0, H); rotation by (alphaRad - gamma) gives D_z' = L_d * sin(alphaRad)
      const phi = xSign * (alphaRad - gamma);
      const qTilt = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, phi);
      return quatMultiply(qTilt, qAlignCorner);
    }

    const cornerDir = normalize3({ x: corner.x, y: corner.y, z: 0 });
    const currentAngle = Math.atan2(cornerDir.y, cornerDir.x);
    const targetAngle = xSign > 0 ? 0 : Math.PI;
    const qAlignCorner = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, targetAngle - currentAngle);

    // If inclining a Pyramid's slant edge (from corner v0 to apex) at alphaDeg to HP
    if (
      orientation.inclinedElement === 'slant_edge' &&
      (solid.category === 'pyramid' || solid.type === 'cone')
    ) {
      const H = solid.axisEnd.z;
      const R = Math.hypot(corner.x, corner.y);
      const gamma = Math.atan2(H, R);
      const alphaRad = degToRad(alphaDeg);
      const phi = alphaRad >= gamma ? alphaRad - gamma : Math.PI - alphaRad - gamma;
      const qTilt = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, xSign * phi);
      return quatMultiply(qTilt, qAlignCorner);
    }

    // For Prisms (longer edge || axis) or axis inclination: tilt so axis/longer edge makes alphaDeg with HP
    const tilt = degToRad(90 - alphaDeg);
    const qTilt = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, xSign * tilt);
    return quatMultiply(qTilt, qAlignCorner);
  }

  // Case G: Free spatial inclination with explicit base reference & roll
  let roll = 0;
  if (baseReference === 'edge_parallel_vp') roll = 90;
  else if (baseReference === 'custom_roll') roll = rollAngle;
  const qRoll = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(roll));
  const tilt = degToRad(90 - alphaDeg);
  const qTilt = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, xSign * tilt);
  return quatMultiply(qTilt, qRoll);
}

/**
 * Solves complete 3D quaternion orientation and validates all mathematical constraints.
 */
export function solveOrientation(
  solid: SolidGeometry,
  orientation: OrientationState,
  position: PositionState,
  selectedFeature: SelectedFeature
): SolvedOrientation {
  const errors: string[] = [];
  const warnings: string[] = [];

  let q: Quat = quatIdentity();
  let requestedAlpha = clamp(orientation.alphaHP, 0, 90);
  let requestedBeta = clamp(orientation.betaVP, 0, 90);

  if (orientation.mode === 'solid_tilt_rotate') {
    // Full-solid rigid tilt & rotate relative to HP (Z=0) and VP (Y=0)
    const qRoll = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(orientation.solidRoll ?? 0));
    const qTiltHP = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, degToRad(orientation.solidTiltHP ?? 0));
    const qTiltVP = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, degToRad(-(orientation.solidTiltVP ?? 0)));
    const qRotVP = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(orientation.solidRotateVP ?? 0));
    q = quatMultiply(qRotVP, quatMultiply(qTiltVP, quatMultiply(qTiltHP, qRoll)));
  } else if (orientation.mode === 'euler') {
    q = quatFromEulerDeg(orientation.eulerX, orientation.eulerY, orientation.eulerZ);
    if (Math.abs(orientation.rollAngle) > EPS) {
      const qRoll = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(orientation.rollAngle));
      q = quatMultiply(q, qRoll);
    }
  } else {
    // Constraint Solver Mode
    const { restingCondition, referenceFaceId, leanDirectionX, leanDirectionY } = orientation;

    // Enforce resting condition physics & detect conflicts
    if (restingCondition === 'base_hp') {
      if (Math.abs(requestedAlpha - 90) > 0.1) {
        warnings.push('When resting flat on Base on HP, the axis is perpendicular to HP (α = 90°, β = 0°).');
      }
      requestedAlpha = 90;
      requestedBeta = 0;
    } else if (restingCondition === 'base_vp') {
      if (Math.abs(requestedBeta - 90) > 0.1) {
        warnings.push('When resting flat on Base on VP, the axis is perpendicular to VP (β = 90°, α = 0°).');
      }
      requestedAlpha = 0;
      requestedBeta = 90;
    } else if (restingCondition === 'face_hp') {
      const face = solid.faces.find((f) => f.id === referenceFaceId) ?? solid.faces.find((f) => f.type === 'lateral');
      if (face) {
        const naturalAlpha = getNaturalFaceRestingAlpha(solid, face);
        if (Math.abs(requestedAlpha - naturalAlpha) > 0.5) {
          errors.push(
            solid.category === 'prism'
              ? `A prism resting flat on a rectangular lateral face on HP has its axis parallel to HP (α = 0°), which conflicts with α = ${requestedAlpha.toFixed(1)}°. Set α = 0° or switch to "Base Edge on HP" to incline the axis at ${requestedAlpha.toFixed(1)}°.`
              : `This pyramid resting flat on its slant triangular face on HP forces axis inclination α = ${naturalAlpha.toFixed(1)}°, which conflicts with α = ${requestedAlpha.toFixed(1)}°.`
          );
        }
        requestedAlpha = naturalAlpha;
      }
    } else if (restingCondition === 'generator_hp') {
      const naturalAlpha =
        solid.type === 'cone'
          ? radToDeg(Math.atan2(solid.radius, solid.axisEnd.z))
          : 0;
      if (Math.abs(requestedAlpha - naturalAlpha) > 0.5) {
        errors.push(
          solid.type === 'cylinder'
            ? `A cylinder resting on a generator on HP has its axis parallel to HP (α = 0°), conflicting with α = ${requestedAlpha.toFixed(1)}°.`
            : `A cone of radius ${solid.radius.toFixed(1)} mm and height ${solid.axisEnd.z.toFixed(1)} mm resting on a generator on HP forces α = ${naturalAlpha.toFixed(1)}°, conflicting with α = ${requestedAlpha.toFixed(1)}°.`
        );
      }
      requestedAlpha = naturalAlpha;
    }

    const isApparentVP = orientation.vpAngleType === 'apparent';
    const isRestingEdgeVP =
      orientation.vpAngleType === 'resting_edge' && restingCondition === 'base_edge_hp';

    // Reference vector to incline in Stage 2: axis, slant edge, or body diagonal
    let localRefVec: Vec3 = { x: 0, y: 0, z: 1 };
    if (
      orientation.inclinedElement === 'slant_edge' &&
      restingCondition === 'base_corner_hp' &&
      (solid.category === 'pyramid' || solid.type === 'cone')
    ) {
      const apexPos = solid.axisEnd;
      const cornerPos = solid.vertices[0].pos;
      localRefVec = normalize3(sub3(apexPos, cornerPos));
    } else if (
      orientation.inclinedElement === 'body_diagonal' &&
      restingCondition === 'base_corner_hp' &&
      solid.category === 'prism'
    ) {
      const oppTopIdx = solid.numBaseSides + Math.floor(solid.numBaseSides / 2);
      localRefVec = normalize3(sub3(solid.vertices[oppTopIdx].pos, solid.vertices[0].pos));
    }

    // Solve Stage 1 (tilt relative to HP with resting condition)
    const qStage1 = solveStage1Quaternion(solid, orientation, requestedAlpha);
    const d1 = applyQuat(qStage1, localRefVec);
    const refActualAlphaDeg = radToDeg(Math.asin(clamp(Math.abs(d1.z), 0, 1)));

    // Fundamental Euclidean unit-vector constraint applies to true inclination angles (not apparent top-view or resting-edge angles)
    const sinA = Math.sin(degToRad(refActualAlphaDeg));
    const sinB = Math.sin(degToRad(requestedBeta));
    const sinSqSum = sinA * sinA + sinB * sinB;
    const maxAllowedBeta = radToDeg(Math.acos(clamp(sinA, 0, 1)));

    if (!isApparentVP && !isRestingEdgeVP && sinSqSum > 1 + 1e-4) {
      errors.push(
        `Invalid inclination: sin²(${refActualAlphaDeg.toFixed(1)}°) + sin²(${requestedBeta.toFixed(1)}°) = ${sinSqSum.toFixed(3)} > 1. Because dx² = 1 - sin²(α) - sin²(β) < 0, α + β cannot exceed 90° (max β for α = ${refActualAlphaDeg.toFixed(1)}° is ${maxAllowedBeta.toFixed(1)}°).`
      );
    }

    const effectiveBeta =
      !isApparentVP && !isRestingEdgeVP && sinSqSum > 1 + 1e-4 ? maxAllowedBeta : requestedBeta;

    // Solve Stage 2 (azimuthal rotation around world Z-axis)
    const horizLen = Math.hypot(d1.x, d1.y);
    if (isRestingEdgeVP && horizLen <= 1e-5) {
      // Base is flat on HP (alpha = 90°); rotate directly using resting base edge direction in XY
      const edge =
        solid.edges.find((e) => e.id === orientation.referenceEdgeId && e.type === 'base') ??
        solid.edges.find((e) => e.type === 'base');
      if (edge) {
        const e1 = applyQuat(
          qStage1,
          sub3(solid.vertices[edge.v1].pos, solid.vertices[edge.v0].pos)
        );
        const curEdgeAngle = Math.atan2(e1.y, e1.x);
        const targetEdgeAngle = degToRad(requestedBeta);
        const qAzimuth = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, targetEdgeAngle - curEdgeAngle);
        q = quatMultiply(qAzimuth, qStage1);
      } else {
        q = qStage1;
      }
    } else if (horizLen > 1e-5) {
      const ySign = leanDirectionY === 'positive' ? 1 : -1;
      const xSign = leanDirectionX === 'positive' ? 1 : -1;

      let targetDx: number;
      let targetDy: number;
      if (isRestingEdgeVP) {
        // Resting base edge on HP is perpendicular to axis Plan in Stage 1;
        // placing resting edge at angle ψ = requestedBeta to VP sets axis Plan at (90° - ψ) to XY
        const psiRad = degToRad(requestedBeta);
        targetDx = xSign * horizLen * Math.sin(psiRad);
        targetDy = ySign * horizLen * Math.cos(psiRad);
      } else if (isApparentVP) {
        // Directly set the top-view (Plan) apparent angle β' with XY
        const betaAppRad = degToRad(requestedBeta);
        targetDy = ySign * horizLen * Math.sin(betaAppRad);
        targetDx = xSign * horizLen * Math.cos(betaAppRad);
      } else {
        const sinBEffective = Math.sin(degToRad(effectiveBeta));
        targetDy = ySign * clamp(sinBEffective, 0, horizLen);
        targetDx = xSign * Math.sqrt(Math.max(0, horizLen * horizLen - targetDy * targetDy));
      }

      const curAngle = Math.atan2(d1.y, d1.x);
      const targetAngle = Math.atan2(targetDy, targetDx);
      const qAzimuth = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, targetAngle - curAngle);
      q = quatMultiply(qAzimuth, qStage1);
    } else {
      q = qStage1;
    }

    // Optional feature target inclination override (when user explicitly sets selected edge/face angle)
    if (orientation.featureTargetPlane && selectedFeature.kind !== 'axis') {
      const targetDeg = clamp(orientation.featureTargetAngle, 0, 90);
      if (selectedFeature.kind === 'edge') {
        const edge = solid.edges.find((e) => e.id === selectedFeature.edgeId);
        if (edge) {
          const eWorld = normalize3(applyQuat(q, sub3(solid.vertices[edge.v1].pos, solid.vertices[edge.v0].pos)));
          const planeNormal: Vec3 = orientation.featureTargetPlane === 'HP' ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
          const curAngle = radToDeg(Math.asin(clamp(Math.abs(dot3(eWorld, planeNormal)), 0, 1)));
          const delta = targetDeg - curAngle;
          const rotAxis = normalize3(cross3(eWorld, planeNormal));
          if (len3(rotAxis) > EPS) {
            q = quatMultiply(quatFromAxisAngle(rotAxis, degToRad(delta)), q);
          }
        }
      } else if (selectedFeature.kind === 'face') {
        const face = solid.faces.find((f) => f.id === selectedFeature.faceId);
        if (face) {
          const nWorld = normalize3(applyQuat(q, face.normal));
          const planeNormal: Vec3 = orientation.featureTargetPlane === 'HP' ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
          const curAngle = radToDeg(Math.acos(clamp(Math.abs(dot3(nWorld, planeNormal)), 0, 1)));
          const delta = curAngle - targetDeg;
          const rotAxis = normalize3(cross3(nWorld, planeNormal));
          if (len3(rotAxis) > EPS) {
            q = quatMultiply(quatFromAxisAngle(rotAxis, degToRad(delta)), q);
          }
        }
      }
    }
  }

  // Transform solid to verify actual resulting geometry
  const worldSolid = transformSolid(solid, q, position);
  const d = worldSolid.axisDirection;

  const actualAlphaHP = radToDeg(Math.asin(clamp(Math.abs(d.z), 0, 1)));
  const actualBetaVP = radToDeg(Math.asin(clamp(Math.abs(d.y), 0, 1)));
  const trueAxisLength = len3(sub3(worldSolid.worldAxisEnd, worldSolid.worldAxisStart));

  const planAxisVec = {
    x: worldSolid.worldAxisEnd.x - worldSolid.worldAxisStart.x,
    y: worldSolid.worldAxisEnd.y - worldSolid.worldAxisStart.y,
  };
  const planAxisLength = Math.hypot(planAxisVec.x, planAxisVec.y);
  const apparentBetaPlan = planAxisLength > 1e-4
    ? radToDeg(Math.atan2(Math.abs(planAxisVec.y), Math.abs(planAxisVec.x)))
    : 0;

  const elevAxisVec = {
    x: worldSolid.worldAxisEnd.x - worldSolid.worldAxisStart.x,
    z: worldSolid.worldAxisEnd.z - worldSolid.worldAxisStart.z,
  };
  const elevationAxisLength = Math.hypot(elevAxisVec.x, elevAxisVec.z);
  const apparentAlphaElevation = elevationAxisLength > 1e-4
    ? radToDeg(Math.atan2(Math.abs(elevAxisVec.z), Math.abs(elevAxisVec.x)))
    : 0;

  // Verify resting contact error with reference plane
  let restingContactErrorMm = 0;
  if (orientation.mode === 'inclination') {
    if (orientation.restingCondition === 'base_hp') {
      const basePts = worldSolid.worldVertices.filter((v) => v.group === 'base');
      restingContactErrorMm = Math.max(...basePts.map((v) => Math.abs(v.pos.z)));
    } else if (orientation.restingCondition === 'base_vp') {
      const basePts = worldSolid.worldVertices.filter((v) => v.group === 'base');
      restingContactErrorMm = Math.max(...basePts.map((v) => Math.abs(v.pos.y)));
    } else if (orientation.restingCondition === 'face_hp') {
      const face = worldSolid.worldFaces.find((f) => f.id === orientation.referenceFaceId)
        ?? worldSolid.worldFaces.find((f) => f.type === 'lateral');
      if (face) {
        restingContactErrorMm = Math.max(...face.vertexIndices.map((idx) => Math.abs(worldSolid.worldVertices[idx].pos.z)));
      }
    } else if (orientation.restingCondition === 'base_edge_hp') {
      const edge = solid.edges.find((e) => e.id === orientation.referenceEdgeId && e.type === 'base')
        ?? solid.edges.find((e) => e.type === 'base');
      if (edge) {
        restingContactErrorMm = Math.max(
          Math.abs(worldSolid.worldVertices[edge.v0].pos.z),
          Math.abs(worldSolid.worldVertices[edge.v1].pos.z)
        );
      }
    } else if (orientation.restingCondition === 'base_corner_hp') {
      const basePts = worldSolid.worldVertices.filter((v) => v.group === 'base');
      restingContactErrorMm = Math.min(...basePts.map((v) => Math.abs(v.pos.z)));
    }
  }

  let actualInclinedAlphaHP: number | null = null;
  let actualInclinedBetaVP: number | null = null;
  if (
    orientation.mode === 'inclination' &&
    orientation.restingCondition === 'base_corner_hp'
  ) {
    if (orientation.inclinedElement === 'slant_edge') {
      if (solid.category === 'pyramid' || solid.type === 'cone') {
        const slantDir = normalize3(sub3(worldSolid.worldAxisEnd, worldSolid.worldVertices[0].pos));
        actualInclinedAlphaHP = radToDeg(Math.asin(clamp(Math.abs(slantDir.z), 0, 1)));
        actualInclinedBetaVP = radToDeg(Math.asin(clamp(Math.abs(slantDir.y), 0, 1)));
      } else {
        actualInclinedAlphaHP = actualAlphaHP;
        actualInclinedBetaVP = actualBetaVP;
      }
    } else if (orientation.inclinedElement === 'body_diagonal' && solid.category === 'prism') {
      const oppTopIdx = solid.numBaseSides + Math.floor(solid.numBaseSides / 2);
      const diagDir = normalize3(
        sub3(worldSolid.worldVertices[oppTopIdx].pos, worldSolid.worldVertices[0].pos)
      );
      actualInclinedAlphaHP = radToDeg(Math.asin(clamp(Math.abs(diagDir.z), 0, 1)));
      actualInclinedBetaVP = radToDeg(Math.asin(clamp(Math.abs(diagDir.y), 0, 1)));
    }
  }

  let restingEdgeAngleVP: number | null = null;
  if (orientation.mode === 'inclination' && orientation.restingCondition === 'base_edge_hp') {
    const edge =
      solid.edges.find((e) => e.id === orientation.referenceEdgeId && e.type === 'base') ??
      solid.edges.find((e) => e.type === 'base');
    if (edge) {
      const dir = normalize3(
        sub3(worldSolid.worldVertices[edge.v1].pos, worldSolid.worldVertices[edge.v0].pos)
      );
      restingEdgeAngleVP = radToDeg(Math.asin(clamp(Math.abs(dir.y), 0, 1)));
    }
  }

  let selectedFeatureAngleHP: number | null = null;
  let selectedFeatureAngleVP: number | null = null;
  if (selectedFeature.kind === 'axis') {
    selectedFeatureAngleHP = actualAlphaHP;
    selectedFeatureAngleVP = actualBetaVP;
  } else if (selectedFeature.kind === 'edge') {
    const edge = solid.edges.find((e) => e.id === selectedFeature.edgeId);
    if (edge) {
      const dir = normalize3(sub3(worldSolid.worldVertices[edge.v1].pos, worldSolid.worldVertices[edge.v0].pos));
      selectedFeatureAngleHP = radToDeg(Math.asin(clamp(Math.abs(dir.z), 0, 1)));
      selectedFeatureAngleVP = radToDeg(Math.asin(clamp(Math.abs(dir.y), 0, 1)));
    }
  } else if (selectedFeature.kind === 'face') {
    const face = worldSolid.worldFaces.find((f) => f.id === selectedFeature.faceId);
    if (face) {
      selectedFeatureAngleHP = radToDeg(Math.acos(clamp(Math.abs(face.normal.z), 0, 1)));
      selectedFeatureAngleVP = radToDeg(Math.acos(clamp(Math.abs(face.normal.y), 0, 1)));
    }
  }

  const useSolvedAnglesForSum =
    orientation.mode === 'inclination' &&
    (orientation.vpAngleType === 'apparent' ||
      (orientation.vpAngleType === 'resting_edge' && orientation.restingCondition === 'base_edge_hp'));
  const sinAOut = Math.sin(degToRad(useSolvedAnglesForSum ? actualAlphaHP : orientation.alphaHP));
  const sinBOut = Math.sin(degToRad(useSolvedAnglesForSum ? actualBetaVP : orientation.betaVP));
  const sinSqSum = sinAOut * sinAOut + sinBOut * sinBOut;
  const maxAllowedBeta = radToDeg(Math.acos(clamp(Math.sin(degToRad(orientation.alphaHP)), 0, 1)));

  return {
    quaternion: q,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
      sinSqSum,
      maxAllowedBeta,
      actualAlphaHP,
      actualBetaVP,
      apparentAlphaElevation,
      apparentBetaPlan,
      trueAxisLength,
      planAxisLength,
      elevationAxisLength,
      restingContactErrorMm,
      selectedFeatureAngleHP,
      selectedFeatureAngleVP,
      actualInclinedAlphaHP,
      actualInclinedBetaVP,
      restingEdgeAngleVP,
    },
  };
}

/**
 * Applies rotation quaternion `q` and translates solid so it respects HP/VP position constraints.
 */
export function transformSolid(
  local: SolidGeometry,
  quaternion: Quat,
  position: PositionState
): WorldSolid {
  const rotatedVerts = local.vertices.map((v) => applyQuat(quaternion, v.pos));

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const p of rotatedVerts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  // Center X around xOffset, position Y in front of VP, Z above HP
  const cx = (minX + maxX) / 2;
  const tx = position.xOffset - cx;
  const ty = (position.snapToVP ? 0 : Math.max(0, position.inFrontOfVP)) - minY;
  const tz = (position.snapToHP ? 0 : Math.max(0, position.aboveHP)) - minZ;

  const translation: Vec3 = { x: tx, y: ty, z: tz };

  const worldVertices: SolidVertex[] = local.vertices.map((v, i) => ({
    ...v,
    pos: add3(rotatedVerts[i], translation),
  }));

  const worldFaces: SolidFace[] = local.faces.map((f) => ({
    ...f,
    normal: normalize3(applyQuat(quaternion, f.normal)),
    center: add3(applyQuat(quaternion, f.center), translation),
  }));

  const worldAxisStart = add3(applyQuat(quaternion, local.axisStart), translation);
  const worldAxisEnd = add3(applyQuat(quaternion, local.axisEnd), translation);
  const axisDirection = normalize3(sub3(worldAxisEnd, worldAxisStart));

  return {
    local,
    worldVertices,
    worldFaces,
    worldAxisStart,
    worldAxisEnd,
    axisDirection,
    quaternion,
    translation,
    boundingBox: {
      min: { x: minX + tx, y: minY + ty, z: minZ + tz },
      max: { x: maxX + tx, y: maxY + ty, z: maxZ + tz },
    },
  };
}
