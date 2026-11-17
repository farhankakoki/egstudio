import type {
  ConstructionStep,
  KtuProblemSpec,
  OrientationState,
  PositionState,
  ProjectionConvention,
  SolidDimensions,
  SolidType,
} from '../types/geometry';
import { buildLocalSolid } from './geometry';
import { createDefaultOrientation, createDefaultPosition, solveOrientation, transformSolid } from './orientation';
import { generateOrthographicDrawing } from './projection';

export const KTU_QUESTION_BANK: KtuProblemSpec[] = [
  {
    id: 'ktu_pent_prism_corner_45_45',
    level: 4,
    title: 'Pentagonal Prism — Base Corner on HP, Longer/Slant Edge 45° HP & 45° VP',
    statement:
      'A pentagonal prism, side of base 30 mm and axis 80 mm, is resting on a base corner on HP, with its longer/slant edge inclined at 45° to HP and 45° to VP.',
    solidType: 'pentagonal_prism',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 80,
      numSides: 5,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      inclinedElement: 'slant_edge',
      alphaHP: 45,
      betaVP: 45,
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_pent_pyramid_corner_45_45',
    level: 4,
    title: 'Pentagonal Pyramid — Base Corner on HP, Slant Edge 45° HP & 45° VP',
    statement:
      'A pentagonal pyramid, side of base 30 mm and axis 80 mm, rests on a base corner on HP, with the slant edge from that corner inclined at 45° to HP and 45° to VP.',
    solidType: 'pentagonal_pyramid',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 80,
      numSides: 5,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      inclinedElement: 'slant_edge',
      alphaHP: 45,
      betaVP: 45,
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_hex_prism_edge_both',
    level: 4,
    title: 'Hexagonal Prism — Base Edge on HP, Axis Inclined to HP & VP',
    statement:
      'A hexagonal prism of 30 mm base side and 60 mm axis length rests on HP on one of its base edges, with its axis inclined at 30° to HP and 45° to VP.',
    solidType: 'hexagonal_prism',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 60,
      numSides: 6,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_edge_hp',
      alphaHP: 30,
      betaVP: 45,
      baseReference: 'edge_perp_vp',
      referenceEdgeId: 'edge_base_0',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_hex_prism_rect_face',
    level: 3,
    title: 'Hexagonal Prism — Rectangular Face on HP, Axis Inclined to VP',
    statement:
      'A hexagonal prism of 30 mm base side and 60 mm axis length rests on HP on one of its rectangular faces, with its axis parallel to HP and inclined at 45° to VP.',
    solidType: 'hexagonal_prism',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 60,
      numSides: 6,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'face_hp',
      alphaHP: 0,
      betaVP: 45,
      referenceFaceId: 'face_lat_0',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_sq_pyramid_both',
    level: 4,
    title: 'Square Pyramid — Base Edge on HP, Inclined to HP & VP',
    statement:
      'A square pyramid of 35 mm base side and 60 mm axis length rests on HP on one of its base edges such that its axis is inclined at 40° to HP and 35° to VP.',
    solidType: 'square_pyramid',
    dimensions: {
      sideLength: 35,
      baseWidth: 35,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 60,
      numSides: 4,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_edge_hp',
      alphaHP: 40,
      betaVP: 35,
      referenceEdgeId: 'edge_base_0',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_pent_pyramid_slant_face',
    level: 4,
    title: 'Pentagonal Pyramid — Slant Triangular Face on HP',
    statement:
      'A pentagonal pyramid of 30 mm base side and 65 mm axis length rests on HP on one of its triangular slant faces, with its axis inclined at 45° to VP.',
    solidType: 'pentagonal_pyramid',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 65,
      numSides: 5,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'face_hp',
      alphaHP: 18, // Will be overridden/snapped to exact slant face angle
      betaVP: 45,
      referenceFaceId: 'face_lat_0',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_pent_prism_corner_hp',
    level: 2,
    title: 'Pentagonal Prism — Corner on HP, Inclined at 45° to HP',
    statement:
      'A pentagonal prism of 25 mm base side and 60 mm axis length rests on HP on one of its base corners with its axis inclined at 45° to HP and parallel to VP.',
    solidType: 'pentagonal_prism',
    dimensions: {
      sideLength: 25,
      baseWidth: 25,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 60,
      numSides: 5,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      alphaHP: 45,
      betaVP: 0,
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_sq_prism_simple',
    level: 1,
    title: 'Square Prism — Simple Position Resting on HP',
    statement:
      'A square prism of 35 mm base side and 60 mm axis length rests on HP on its base with its vertical faces parallel/perpendicular to VP.',
    solidType: 'square_prism',
    dimensions: {
      sideLength: 35,
      baseWidth: 35,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 60,
      numSides: 4,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_hp',
      alphaHP: 90,
      betaVP: 0,
      baseReference: 'edge_perp_vp',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_cylinder_both',
    level: 4,
    title: 'Cylinder — Point on Base Rim on HP, Axis Inclined to HP & VP',
    statement:
      'A cylinder of 44 mm base diameter (22 mm radius) and 60 mm axis length rests on HP on a point of its base rim, with its axis inclined at 35° to HP and 40° to VP.',
    solidType: 'cylinder',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 22,
      axisLength: 60,
      numSides: 6,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      alphaHP: 35,
      betaVP: 40,
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_cone_generator_vp',
    level: 4,
    title: 'Cone — Resting on Generator on HP, Axis Inclined to VP',
    statement:
      'A cone of 50 mm base diameter (25 mm radius) and 65 mm axis length rests on HP on one of its generators, with its axis inclined at 45° to VP.',
    solidType: 'cone',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 65,
      numSides: 6,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'generator_hp',
      alphaHP: 21.04,
      betaVP: 45,
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_hex_pyramid_corner_apparent_45',
    level: 4,
    title: 'Q3 · Hexagonal Pyramid — Base Corner on HP, Axis 30° HP & Top View 45° VP',
    statement:
      'A hexagonal pyramid of base side 30 mm and axis length 60 mm is resting on one of its base corners on HP. Its axis is inclined at 30° to HP and top view of the axis is inclined at 45° to VP. Apex is away from VP and towards right side.',
    solidType: 'hexagonal_pyramid',
    dimensions: {
      sideLength: 30,
      baseWidth: 30,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 60,
      numSides: 6,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      inclinedElement: 'axis',
      vpAngleType: 'apparent',
      alphaHP: 30,
      betaVP: 45,
      leanDirectionX: 'positive',
      leanDirectionY: 'positive',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_cube_corner_body_diag_vp',
    level: 4,
    title: 'Q4 · Cube — Corner on HP, Body Diagonal Perpendicular to VP',
    statement:
      'A cube of 40 mm side is resting on one of its corners on HP. Draw its projections if the body diagonal of the cube is perpendicular to VP.',
    solidType: 'cube',
    dimensions: {
      sideLength: 40,
      baseWidth: 40,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 40,
      numSides: 4,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      inclinedElement: 'body_diagonal',
      vpAngleType: 'true',
      alphaHP: 0,
      betaVP: 90,
      leanDirectionX: 'positive',
      leanDirectionY: 'positive',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
  {
    id: 'ktu_hex_prism_edge_40vp_60hp',
    level: 4,
    title: 'Hexagonal Prism — Resting Edge 40° to VP, Axis 60° to HP',
    statement:
      'A hexagonal prism, side of base 20 mm and axis 70 mm, is resting on an edge of base on the HP. The resting edge is inclined at 40° to the VP, with its axis inclined at 60° to HP.',
    solidType: 'hexagonal_prism',
    dimensions: {
      sideLength: 20,
      baseWidth: 20,
      rectangularBase: false,
      baseRadius: 25,
      axisLength: 70,
      numSides: 6,
    },
    orientation: {
      ...createDefaultOrientation(),
      restingCondition: 'base_edge_hp',
      vpAngleType: 'resting_edge',
      alphaHP: 60,
      betaVP: 40,
      baseReference: 'edge_perp_vp',
      referenceEdgeId: 'edge_base_0',
    },
    position: { ...createDefaultPosition(), inFrontOfVP: 25, snapToHP: true },
  },
];

export interface StepGenerationResult {
  steps: ConstructionStep[];
  feasible: boolean;
  conflictReason?: string;
}

/**
 * Generates dynamic, mathematically verified KTU step-by-step construction steps
 * for any solid + orientation problem.
 */
export function generateConstructionSteps(
  solidType: SolidType,
  dimensions: SolidDimensions,
  orientation: OrientationState,
  position: PositionState,
  convention: ProjectionConvention = 'first_angle'
): StepGenerationResult {
  const local = buildLocalSolid(solidType, dimensions);
  const selected = { kind: 'axis' as const };

  // Normalize alpha for face_hp / generator_hp when coming from preset or user
  const finalSolved = solveOrientation(local, orientation, position, selected);
  const finalValidation = finalSolved.validation;

  // Stage 1: Initial simple position (axis perpendicular to HP, resting on base on HP)
  const stage1Ori: OrientationState = {
    ...orientation,
    mode: 'inclination',
    restingCondition: orientation.restingCondition === 'base_vp' ? 'base_vp' : 'base_hp',
    alphaHP: orientation.restingCondition === 'base_vp' ? 0 : 90,
    betaVP: orientation.restingCondition === 'base_vp' ? 90 : 0,
  };
  const stage1Solved = solveOrientation(local, stage1Ori, position, selected);
  const stage1World = transformSolid(local, stage1Solved.quaternion, position);
  const stage1Drawing = generateOrthographicDrawing(stage1World, convention);

  const steps: ConstructionStep[] = [];
  let stepCounter = 1;

  // Step 1: Initial 3D Position
  steps.push({
    stepNumber: stepCounter++,
    title: 'Initial Simple Position',
    whatToDraw:
      orientation.restingCondition === 'base_vp'
        ? `Imagine the ${local.name} resting with its base flat on VP so its axis is perpendicular to VP.`
        : `Assume the ${local.name} rests on its base on HP (Z = 0) with its axis perpendicular to HP. Keep ${
            orientation.restingCondition === 'base_edge_hp'
              ? 'the resting base edge on the right (+X) perpendicular to VP'
              : orientation.restingCondition === 'face_hp'
                ? 'the resting face edge on the right (+X) perpendicular to VP'
                : 'the reference base edge aligned for tilting'
          }.`,
    whyNecessary:
      'In KTU Engineering Graphics, we always start with the axis perpendicular to one reference plane so the true shape of the base appears directly in one orthographic view.',
    formulaNote: `True base: ${local.isCurved ? `Radius = ${dimensions.baseRadius} mm` : `Side = ${dimensions.sideLength} mm`}, Axis = ${dimensions.axisLength} mm`,
    worldSolid: stage1World,
    drawing: stage1Drawing,
    highlightIds: [],
    stageLabel: 'initial',
  });

  // Step 2: Initial Plan
  steps.push({
    stepNumber: stepCounter++,
    title: 'Initial Plan (Top View)',
    whatToDraw:
      orientation.restingCondition === 'base_vp'
        ? `Draw the initial Plan below XY showing true axis length ${dimensions.axisLength} mm perpendicular to XY.`
        : `Draw the true shape of the base (${local.name.split(' ')[0]}) below the XY line at ${position.inFrontOfVP} mm in front of VP. Label base corners a, b, c... and top/apex corners.`,
    whyNecessary:
      'Because the axis is perpendicular to HP, looking from above shows the true dimensions of every base edge and corner without foreshortening.',
    worldSolid: stage1World,
    drawing: stage1Drawing,
    highlightIds: stage1Drawing.planLines.map((l) => l.id),
    stageLabel: 'initial',
  });

  // Step 3: Initial Elevation
  steps.push({
    stepNumber: stepCounter++,
    title: 'Initial Elevation (Front View)',
    whatToDraw: `Project vertical lines upward from every corner of the initial Plan across XY. Mark the axis height ${dimensions.axisLength} mm above XY to complete the initial Front View (a', b', ... and o').`,
    whyNecessary:
      'The initial Elevation gives the true axis length and exact heights of all lateral/slant faces before we tilt the solid toward HP.',
    worldSolid: stage1World,
    drawing: stage1Drawing,
    highlightIds: stage1Drawing.elevationLines.map((l) => l.id),
    stageLabel: 'initial',
  });

  const needsFirstTilt =
    orientation.mode === 'euler' ||
    (orientation.restingCondition !== 'base_hp' && orientation.restingCondition !== 'base_vp');

  const actualAlpha = finalValidation.actualAlphaHP;
  const actualBeta = finalValidation.actualBetaVP;

  if (needsFirstTilt) {
    // Stage 2: First Change of Position (tilted to HP by requested alpha, parallel to VP i.e. beta=0)
    const stage2Alpha =
      orientation.mode === 'inclination' &&
      (orientation.inclinedElement === 'slant_edge' || orientation.inclinedElement === 'body_diagonal')
        ? orientation.alphaHP
        : actualAlpha;
    const stage2Ori: OrientationState = {
      ...orientation,
      mode: 'inclination',
      alphaHP: stage2Alpha,
      betaVP: 0,
    };
    const stage2Solved = solveOrientation(local, stage2Ori, position, selected);
    const stage2World = transformSolid(local, stage2Solved.quaternion, position);
    const stage2Drawing = generateOrthographicDrawing(stage2World, convention);

    const isBodyDiag =
      orientation.restingCondition === 'base_corner_hp' && orientation.inclinedElement === 'body_diagonal';

    // Step 4: First Change of Position (Tilted Elevation)
    steps.push({
      stepNumber: stepCounter++,
      title: isBodyDiag
        ? `First Change of Position (Body Diagonal Parallel to HP, Axis at ${actualAlpha.toFixed(1)}°)`
        : `First Change of Position (Axis at ${actualAlpha.toFixed(1)}° to HP)`,
      whatToDraw:
        isBodyDiag
          ? `Redraw the initial Elevation tilted on a resting corner on XY so the body diagonal becomes horizontal (α = ${stage2Alpha.toFixed(1)}° to XY, parallel to both HP and VP).`
          : orientation.restingCondition === 'face_hp'
            ? `Redraw the initial Elevation tilted down so the selected lateral/slant face rests flush on the XY line (HP). Axis now sits at α = ${actualAlpha.toFixed(1)}° to HP.`
            : `Redraw the initial Elevation tilted around the resting ${
                orientation.restingCondition === 'base_edge_hp' ? 'base edge' : 'corner'
              } on XY so the axis makes α = ${actualAlpha.toFixed(1)}° with XY.`,
      whyNecessary:
        'Tilting parallel to VP preserves all true lengths seen in the Front View, allowing us to transfer the Elevation geometry unchanged by rigid rotation.',
      formulaNote: `Elevation Axis Length = ${stage2Solved.validation.elevationAxisLength.toFixed(1)} mm (True Length while β = 0°)`,
      worldSolid: stage2World,
      drawing: stage2Drawing,
      highlightIds: stage2Drawing.elevationLines.map((l) => l.id),
      stageLabel: 'first_tilt',
    });

    // Step 5: Second Plan
    steps.push({
      stepNumber: stepCounter++,
      title: 'Second Plan (Projected from Tilted Elevation)',
      whatToDraw:
        'Drop vertical projectors downward from all corners of the tilted Elevation and intersect them with horizontal locus lines drawn from the corresponding corners of the initial Plan.',
      whyNecessary:
        'This gives the foreshortened Top View of the tilted solid. Its Plan axis length is now shortened to L·cos(α).',
      formulaNote: `Plan Axis Length = L·cos(${actualAlpha.toFixed(1)}°) = ${stage2Solved.validation.planAxisLength.toFixed(1)} mm`,
      worldSolid: stage2World,
      drawing: stage2Drawing,
      highlightIds: stage2Drawing.planLines.map((l) => l.id),
      stageLabel: 'first_tilt',
    });
  }

  // Stage 3: Second Change of Position (inclined to VP)
  const finalWorld = transformSolid(local, finalSolved.quaternion, position);
  const finalDrawing = generateOrthographicDrawing(finalWorld, convention);

  if (actualBeta > 0.2 || (finalValidation.actualInclinedBetaVP ?? 0) > 0.2 || orientation.mode === 'euler') {
    const isParallelToHP = actualAlpha < 0.2;
    const isApparentGiven = orientation.vpAngleType === 'apparent';
    const isRestingEdgeGiven =
      orientation.vpAngleType === 'resting_edge' && orientation.restingCondition === 'base_edge_hp';
    const isBodyDiag =
      orientation.restingCondition === 'base_corner_hp' && orientation.inclinedElement === 'body_diagonal';
    const apparentBeta = finalValidation.apparentBetaPlan;

    steps.push({
      stepNumber: stepCounter++,
      title: isBodyDiag
        ? `Second Change of Position (Body Diagonal at ${(finalValidation.actualInclinedBetaVP ?? actualBeta).toFixed(1)}° to VP)`
        : isRestingEdgeGiven
          ? `Second Change of Position (Resting Edge at ${orientation.betaVP.toFixed(1)}° to VP)`
          : isApparentGiven
            ? `Second Change of Position (Top View directly at ${orientation.betaVP.toFixed(1)}° to VP)`
            : isParallelToHP
              ? `Second Change of Position (Axis at ${actualBeta.toFixed(1)}° to VP)`
              : `Second Change of Position (Apparent Angle β' = ${apparentBeta.toFixed(1)}° in Plan)`,
      whatToDraw: isBodyDiag
        ? `Rotate the Second Plan in HP so the horizontal body diagonal makes ${(finalValidation.actualInclinedBetaVP ?? actualBeta).toFixed(1)}° (perpendicular) with XY.`
        : isRestingEdgeGiven
          ? `Rotate the Second Plan in HP so the resting base edge makes ${orientation.betaVP.toFixed(1)}° directly with the XY line (this automatically places the Plan of the axis at ${apparentBeta.toFixed(1)}° to XY).`
          : isApparentGiven
            ? `Directly rotate the Second Plan so the top view of the axis makes ${orientation.betaVP.toFixed(1)}° with XY (no locus construction needed since top-view angle is given). Keep the apex ${
                orientation.leanDirectionY === 'positive' ? 'away from VP' : 'toward VP'
              } and toward the ${orientation.leanDirectionX === 'positive' ? 'right' : 'left'} side.`
            : isParallelToHP
              ? `Rotate the Second Plan in HP so the axis makes the true inclination β = ${actualBeta.toFixed(1)}° directly with the XY line.`
              : `Because the axis is already inclined at α = ${actualAlpha.toFixed(1)}° to HP, its Plan length is foreshortened (${finalValidation.planAxisLength.toFixed(1)} mm). Use the locus construction to rotate the Second Plan so the axis makes apparent angle β' = ${apparentBeta.toFixed(1)}° with XY.`,
      whyNecessary: isRestingEdgeGiven
        ? 'Because the resting base edge lies directly on HP (Z = 0), its true length appears directly in Plan, so its angle to VP is measured directly in the Top View against XY.'
        : isApparentGiven
          ? 'When the problem explicitly specifies the top-view (apparent) angle to VP, that angle is measured directly in Plan on the foreshortened axis.'
          : isParallelToHP || isBodyDiag
            ? 'Since the reference line is horizontal (parallel to HP), its Plan length equals its True Length, so true and apparent VP angles are identical.'
            : `In orthographic projection, true angle β = ${actualBeta.toFixed(1)}° cannot be measured directly on a foreshortened Plan line. Rotating the Plan to apparent angle β' = ${apparentBeta.toFixed(1)}° ensures the true 3D axis satisfies sin(β) = |dy|.`,
      formulaNote: isRestingEdgeGiven
        ? `Resting Edge to VP = ${orientation.betaVP.toFixed(1)}° · Axis Plan β' = ${apparentBeta.toFixed(1)}° · True Axis β = ${actualBeta.toFixed(1)}°`
        : `True β = ${actualBeta.toFixed(1)}° · Apparent β' = ${apparentBeta.toFixed(1)}° · Plan length = ${finalValidation.planAxisLength.toFixed(1)} mm`,
      worldSolid: finalWorld,
      drawing: finalDrawing,
      highlightIds: finalDrawing.planLines.map((l) => l.id),
      stageLabel: 'second_tilt',
    });

    steps.push({
      stepNumber: stepCounter++,
      title: 'Final Elevation (Front View)',
      whatToDraw:
        'Project vertical lines upward from every vertex of the rotated Final Plan and intersect them with horizontal locus lines drawn from the Stage-2 Elevation to locate final vertices a1\', b1\', ... and o1\'.',
      whyNecessary:
        'Rotating in Plan (around a vertical Z-axis) keeps every point at the exact same height above HP (Z-coordinate), so horizontal locus lines from Stage 2 directly locate heights in the Final Elevation.',
      formulaNote: `Elevation Axis Length = L·cos(${actualBeta.toFixed(1)}°) = ${finalValidation.elevationAxisLength.toFixed(1)} mm · Apparent α' = ${finalValidation.apparentAlphaElevation.toFixed(1)}°`,
      worldSolid: finalWorld,
      drawing: finalDrawing,
      highlightIds: finalDrawing.elevationLines.map((l) => l.id),
      stageLabel: 'second_tilt',
    });
  }

  // Step 8: Visibility & Line Finishing
  const allHiddenIds = [
    ...finalDrawing.planLines.filter((l) => l.style === 'hidden').map((l) => l.id),
    ...finalDrawing.elevationLines.filter((l) => l.style === 'hidden').map((l) => l.id),
  ];
  steps.push({
    stepNumber: stepCounter++,
    title: 'Visibility Rules & Line Finishing',
    whatToDraw:
      'Darken the outer boundary contour in both Plan and Elevation as continuous thick lines. Darken edges of faces facing the observer (topmost in Plan, frontmost in Elevation). Draw rear occluded edges as dashed lines (- - -) and the axis as a chain-dot line.',
    whyNecessary:
      'Engineering drawings communicate 3D depth strictly through line convention: visible edges are continuous thick lines while hidden interior edges behind front faces are dashed.',
    worldSolid: finalWorld,
    drawing: finalDrawing,
    highlightIds: allHiddenIds,
    stageLabel: 'finishing',
  });

  return {
    steps,
    feasible: finalValidation.valid,
    conflictReason: finalValidation.errors[0],
  };
}

export interface ThreeStageStep {
  stageNumber: 1 | 2 | 3;
  title: string;
  badge: string;
  whatToDraw: string;
  formulaNote: string;
  worldSolid: ReturnType<typeof transformSolid>;
  drawing: ReturnType<typeof generateOrthographicDrawing>;
  highlightIds: string[];
}

export interface ThreeStageResult {
  stages: ThreeStageStep[];
  feasible: boolean;
  conflictReason?: string;
}

/**
 * Generates the beginner-friendly 3-stage sequence:
 * 1. Simple Position (upright on HP or VP)
 * 2. Inclined to HP only (beta = 0°)
 * 3. Inclined to VP (final drawing with beta > 0°)
 */
export function generateThreeStageSteps(
  solidType: SolidType,
  dimensions: SolidDimensions,
  orientation: OrientationState,
  position: PositionState,
  convention: ProjectionConvention = 'first_angle'
): ThreeStageResult {
  const local = buildLocalSolid(solidType, dimensions);
  const selected = { kind: 'axis' as const };
  const finalSolved = solveOrientation(local, orientation, position, selected);
  const finalValidation = finalSolved.validation;
  const stages: ThreeStageStep[] = [];

  // Stage 1: Simple Position
  const stage1Ori: OrientationState = {
    ...orientation,
    mode: 'inclination',
    restingCondition: orientation.restingCondition === 'base_vp' ? 'base_vp' : 'base_hp',
    alphaHP: orientation.restingCondition === 'base_vp' ? 0 : 90,
    betaVP: orientation.restingCondition === 'base_vp' ? 90 : 0,
  };
  const stage1Solved = solveOrientation(local, stage1Ori, position, selected);
  const stage1World = transformSolid(local, stage1Solved.quaternion, position);
  const stage1Drawing = generateOrthographicDrawing(stage1World, convention);

  stages.push({
    stageNumber: 1,
    title: 'Step 1: Simple Position',
    badge: orientation.restingCondition === 'base_vp' ? 'Base on VP' : 'Base on HP',
    whatToDraw:
      orientation.restingCondition === 'base_vp'
        ? `First draw the ${local.name} resting with its base flat on VP (Elevation shows the true shape of the base; Plan shows the axis ${dimensions.axisLength} mm perpendicular to XY).`
        : `First draw the ${local.name} standing upright on its base on HP. The Plan (below XY) shows the true base shape (${local.isCurved ? `Radius ${dimensions.baseRadius} mm` : `Side ${dimensions.sideLength} mm`}), and the Elevation (above XY) shows the true axis height (${dimensions.axisLength} mm).`,
    formulaNote: local.isCurved
      ? `Radius = ${dimensions.baseRadius} mm · Axis = ${dimensions.axisLength} mm`
      : `Base Side = ${dimensions.sideLength} mm · Axis = ${dimensions.axisLength} mm`,
    worldSolid: stage1World,
    drawing: stage1Drawing,
    highlightIds: [],
  });

  const needsStage2 =
    orientation.mode !== 'inclination' ||
    (orientation.restingCondition !== 'base_hp' && orientation.restingCondition !== 'base_vp');

  if (needsStage2) {
    const stage2Alpha =
      orientation.mode === 'inclination' &&
      (orientation.inclinedElement === 'slant_edge' || orientation.inclinedElement === 'body_diagonal')
        ? orientation.alphaHP
        : finalValidation.actualAlphaHP;
    const stage2Ori: OrientationState = {
      ...orientation,
      mode: 'inclination',
      alphaHP: stage2Alpha,
      betaVP: 0,
    };
    const stage2Solved = solveOrientation(local, stage2Ori, position, selected);
    const stage2World = transformSolid(local, stage2Solved.quaternion, position);
    const stage2Drawing = generateOrthographicDrawing(stage2World, convention);

    const isBodyDiag =
      orientation.restingCondition === 'base_corner_hp' && orientation.inclinedElement === 'body_diagonal';

    const elementWord =
      isBodyDiag
        ? 'body diagonal'
        : orientation.restingCondition === 'base_corner_hp' &&
            orientation.inclinedElement === 'slant_edge'
          ? local.category === 'prism'
            ? 'longer edge / axis'
            : 'slant edge'
          : 'axis';

    stages.push({
      stageNumber: 2,
      title: 'Step 2: Inclined to HP Only',
      badge: `${isBodyDiag ? 'Diagonal' : 'α'} = ${stage2Alpha.toFixed(1)}° to HP · β = 0°`,
      whatToDraw:
        orientation.restingCondition === 'face_hp'
          ? `Now lay the Elevation from Step 1 onto the XY line so the resting face touches HP (β = 0° to VP). Then drop vertical lines down and draw horizontal lines from Step 1 Plan to get the new Plan.`
          : `Tilt the Elevation from Step 1 around its resting corner/edge on XY so the ${elementWord} is at ${stage2Alpha.toFixed(1)}° to HP (staying parallel to VP, β = 0°). Then project downward from Elevation and across from Step 1 Plan to get the Step 2 Plan.`,
      formulaNote: `True α to HP = ${stage2Alpha.toFixed(1)}° · Plan Axis = ${stage2Solved.validation.planAxisLength.toFixed(1)} mm`,
      worldSolid: stage2World,
      drawing: stage2Drawing,
      highlightIds: [
        ...stage2Drawing.elevationLines.map((l) => l.id),
        ...stage2Drawing.planLines.map((l) => l.id),
      ],
    });
  }

  const actualBeta = finalValidation.actualBetaVP;
  const inclinedBeta = finalValidation.actualInclinedBetaVP;
  const hasVpInclination =
    actualBeta > 0.2 || (inclinedBeta !== null && inclinedBeta > 0.2) || orientation.mode !== 'inclination';

  if (hasVpInclination) {
    const finalWorld = transformSolid(local, finalSolved.quaternion, position);
    const finalDrawing = generateOrthographicDrawing(finalWorld, convention);
    const targetBeta = inclinedBeta ?? actualBeta;
    const apparentBeta = finalValidation.apparentBetaPlan;
    const isApparentGiven = orientation.vpAngleType === 'apparent';
    const isRestingEdgeGiven =
      orientation.vpAngleType === 'resting_edge' && orientation.restingCondition === 'base_edge_hp';

    stages.push({
      stageNumber: stages.length === 1 ? 2 : 3,
      title: 'Step 3: Inclined to VP (Final Figure)',
      badge: isRestingEdgeGiven
        ? `Resting Edge = ${orientation.betaVP}° to VP`
        : isApparentGiven
          ? `Top View β' = ${orientation.betaVP}° to VP`
          : `β = ${targetBeta.toFixed(1)}° to VP`,
      whatToDraw:
        isRestingEdgeGiven
          ? `Rotate the Step 2 Plan in HP so the resting base edge makes ${orientation.betaVP.toFixed(1)}° directly with XY (which puts the top view of the axis at ${apparentBeta.toFixed(1)}° to XY). Then project upward from every corner of this rotated Plan and across from Step 2 Elevation to finish the Final Front View.`
          : isApparentGiven
            ? `Rotate the Step 2 Plan directly so the top view of the axis makes ${orientation.betaVP.toFixed(1)}° with XY, keeping the apex ${
                orientation.leanDirectionY === 'positive' ? 'away from VP' : 'toward VP'
              } and toward the ${orientation.leanDirectionX === 'positive' ? 'right' : 'left'} side. Then project upward and across from Step 2 Elevation to finish the Front View.`
            : finalValidation.actualAlphaHP < 0.2
              ? `Rotate the Step 2 Plan so the reference element makes ${targetBeta.toFixed(1)}° with the XY line, then project upward and across from Step 2 Elevation to complete the Final Elevation with dashed hidden lines.`
              : `Rotate the Step 2 Plan so the inclined edge/axis sits at β = ${targetBeta.toFixed(1)}° to VP (apparent angle β' = ${apparentBeta.toFixed(1)}° in Plan). Project upward from every corner of this rotated Plan and across from Step 2 Elevation to draw the Final Front View.`,
      formulaNote: isRestingEdgeGiven
        ? `Resting Edge to VP = ${orientation.betaVP.toFixed(1)}° · Axis Plan β' = ${apparentBeta.toFixed(1)}° · True Axis β = ${targetBeta.toFixed(1)}°`
        : isApparentGiven
          ? `Top View β' = ${orientation.betaVP.toFixed(1)}° · True β = ${targetBeta.toFixed(1)}°`
          : `True β to VP = ${targetBeta.toFixed(1)}° · Apparent β' = ${apparentBeta.toFixed(1)}°`,
      worldSolid: finalWorld,
      drawing: finalDrawing,
      highlightIds: finalDrawing.planLines
        .filter((l) => l.style === 'hidden')
        .concat(finalDrawing.elevationLines.filter((l) => l.style === 'hidden'))
        .map((l) => l.id),
    });
  }

  return {
    stages,
    feasible: finalValidation.valid,
    conflictReason: finalValidation.errors[0],
  };
}
