import assert from 'node:assert/strict';
import { buildLocalSolid } from '../engine/geometry';
import { generateIsometricDrawing, KTU_ISOMETRIC_PRESETS } from '../engine/isometric';
import { generateConstructionSteps, generateThreeStageSteps, KTU_QUESTION_BANK } from '../engine/learning';
import { KTU_LINE_PRESETS, solveLineProblem } from '../engine/lines';
import { dist3, normalize3, radToDeg, sub3 } from '../engine/math';
import {
  createDefaultOrientation,
  createDefaultPosition,
  solveOrientation,
  transformSolid,
} from '../engine/orientation';
import { generateOrthographicDrawing } from '../engine/projection';
import { KTU_SECTION_PRESETS, solveSectionedSolid } from '../engine/section';
import { validateDimensions } from '../lib/validation';

function approxEqual(actual: number, expected: number, tol = 1e-3, msg = '') {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg} expected ${expected} ± ${tol}, got ${actual}`
  );
}

console.log('Running EG Studio Mathematical & Projection Engine Tests...\n');

// 1. Dimension validation
{
  const valid = validateDimensions('hexagonal_prism', {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 6,
  });
  assert.equal(valid.valid, true, 'Valid hexagonal prism dimensions should pass');

  const invalidZero = validateDimensions('hexagonal_prism', {
    sideLength: 0,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: -10,
    numSides: 6,
  });
  assert.equal(invalidZero.valid, false, 'Zero/negative dimensions must be rejected');
  console.log('✓ Test 1: Dimension validation passed');
}

// 2. Simple position: Axis perpendicular to HP (resting on base on HP)
{
  const solid = buildLocalSolid('hexagonal_prism', {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 6,
  });
  const ori = { ...createDefaultOrientation(), restingCondition: 'base_hp' as const, alphaHP: 90, betaVP: 0 };
  const pos = createDefaultPosition();
  const solved = solveOrientation(solid, ori, pos, { kind: 'axis' });

  assert.equal(solved.validation.valid, true);
  approxEqual(solved.validation.actualAlphaHP, 90, 1e-3, 'Axis perpendicular to HP alpha');
  approxEqual(solved.validation.actualBetaVP, 0, 1e-3, 'Axis parallel to VP beta');
  approxEqual(solved.validation.restingContactErrorMm, 0, 1e-4, 'Base resting on HP Z=0');
  console.log('✓ Test 2: Simple position (axis perpendicular to HP) passed');
}

// 3. Simple position: Axis perpendicular to VP (resting on base on VP)
{
  const solid = buildLocalSolid('square_prism', {
    sideLength: 35,
    baseWidth: 35,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 4,
  });
  const ori = { ...createDefaultOrientation(), restingCondition: 'base_vp' as const, alphaHP: 0, betaVP: 90 };
  const pos = { ...createDefaultPosition(), snapToHP: false, aboveHP: 20, snapToVP: true };
  const solved = solveOrientation(solid, ori, pos, { kind: 'axis' });

  assert.equal(solved.validation.valid, true);
  approxEqual(solved.validation.actualAlphaHP, 0, 1e-3, 'Axis parallel to HP alpha');
  approxEqual(solved.validation.actualBetaVP, 90, 1e-3, 'Axis perpendicular to VP beta');
  approxEqual(solved.validation.restingContactErrorMm, 0, 1e-4, 'Base resting on VP Y=0');
  console.log('✓ Test 3: Axis perpendicular to VP & parallel to HP passed');
}

// 4. 30° inclination to HP, parallel to VP
{
  const solid = buildLocalSolid('pentagonal_prism', {
    sideLength: 25,
    baseWidth: 25,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 5,
  });
  const ori = { ...createDefaultOrientation(), restingCondition: 'base_edge_hp' as const, alphaHP: 30, betaVP: 0 };
  const pos = createDefaultPosition();
  const solved = solveOrientation(solid, ori, pos, { kind: 'axis' });

  assert.equal(solved.validation.valid, true);
  approxEqual(solved.validation.actualAlphaHP, 30, 1e-3, '30 deg to HP');
  approxEqual(solved.validation.actualBetaVP, 0, 1e-3, 'Parallel to VP');
  approxEqual(solved.validation.planAxisLength, 60 * Math.cos((30 * Math.PI) / 180), 1e-2, 'Plan length = L cos 30');
  approxEqual(solved.validation.restingContactErrorMm, 0, 1e-4, 'Resting base edge on HP');
  console.log('✓ Test 4: 30° inclination to HP & parallel to VP passed');
}

// 5. 45° inclination to VP, parallel to HP (Rectangular face resting on HP)
{
  const solid = buildLocalSolid('hexagonal_prism', {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 6,
  });
  const ori = {
    ...createDefaultOrientation(),
    restingCondition: 'face_hp' as const,
    alphaHP: 0,
    betaVP: 45,
    referenceFaceId: 'face_lat_0',
  };
  const pos = createDefaultPosition();
  const solved = solveOrientation(solid, ori, pos, { kind: 'axis' });

  assert.equal(solved.validation.valid, true, 'Rectangular face on HP with alpha=0, beta=45 must be valid');
  approxEqual(solved.validation.actualAlphaHP, 0, 1e-3, 'Axis parallel to HP');
  approxEqual(solved.validation.actualBetaVP, 45, 1e-3, '45 deg to VP');
  approxEqual(solved.validation.restingContactErrorMm, 0, 1e-4, 'Rectangular face flush on HP (Z=0)');
  approxEqual(solved.validation.elevationAxisLength, 60 * Math.cos((45 * Math.PI) / 180), 1e-2, 'Elevation length = L cos 45');
  console.log('✓ Test 5: Resting rectangular face on HP + 45° to VP passed');
}

// 6. Valid combined inclination (30° to HP, 45° to VP) & Invalid combined inclination (60° to HP, 45° to VP)
{
  const solid = buildLocalSolid('hexagonal_prism', {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 6,
  });
  const pos = createDefaultPosition();

  // Valid: sin²(30) + sin²(45) = 0.25 + 0.50 = 0.75 <= 1
  const validOri = { ...createDefaultOrientation(), restingCondition: 'base_edge_hp' as const, alphaHP: 30, betaVP: 45 };
  const validSolved = solveOrientation(solid, validOri, pos, { kind: 'axis' });
  assert.equal(validSolved.validation.valid, true);
  approxEqual(validSolved.validation.actualAlphaHP, 30, 1e-2, 'Combined alpha = 30°');
  approxEqual(validSolved.validation.actualBetaVP, 45, 1e-2, 'Combined beta = 45°');
  assert.ok(validSolved.validation.apparentBetaPlan > 45, 'Apparent angle in Plan must exceed true beta (45°)');
  approxEqual(validSolved.validation.restingContactErrorMm, 0, 1e-3, 'Resting base edge stays on Z=0');

  // Invalid: sin²(60) + sin²(45) = 0.75 + 0.50 = 1.25 > 1
  const invalidOri = { ...createDefaultOrientation(), restingCondition: 'base_edge_hp' as const, alphaHP: 60, betaVP: 45 };
  const invalidSolved = solveOrientation(solid, invalidOri, pos, { kind: 'axis' });
  assert.equal(invalidSolved.validation.valid, false, '60° HP + 45° VP must be rejected');
  assert.ok(invalidSolved.validation.errors.length > 0, 'Rejection reason must be populated');

  // Invalid conflict: prism rectangular face on HP + alpha=30°
  const conflictOri = { ...createDefaultOrientation(), restingCondition: 'face_hp' as const, alphaHP: 30, betaVP: 45 };
  const conflictSolved = solveOrientation(solid, conflictOri, pos, { kind: 'axis' });
  assert.equal(conflictSolved.validation.valid, false, 'Prism flat face on HP cannot have alpha=30°');
  console.log('✓ Test 6: Valid & invalid combined inclinations + constraint conflict checks passed');
}

// 7. Projection alignment, edge visibility, and rotation distance preservation
{
  const solid = buildLocalSolid('square_pyramid', {
    sideLength: 35,
    baseWidth: 35,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 4,
  });
  const ori = { ...createDefaultOrientation(), restingCondition: 'base_edge_hp' as const, alphaHP: 40, betaVP: 35 };
  const pos = createDefaultPosition();
  const solved = solveOrientation(solid, ori, pos, { kind: 'axis' });
  const world = transformSolid(solid, solved.quaternion, pos);

  // Distance preservation
  for (const edge of solid.edges) {
    const localLen = dist3(solid.vertices[edge.v0].pos, solid.vertices[edge.v1].pos);
    const worldLen = dist3(world.worldVertices[edge.v0].pos, world.worldVertices[edge.v1].pos);
    approxEqual(worldLen, localLen, 1e-4, `Edge ${edge.id} distance preservation`);
  }

  // Projection alignment & hidden edge visibility
  const drawing = generateOrthographicDrawing(world, 'first_angle');
  assert.equal(drawing.planPoints.length, drawing.elevationPoints.length);
  for (let i = 0; i < drawing.planPoints.length; i++) {
    approxEqual(
      drawing.planPoints[i].x,
      drawing.elevationPoints[i].x,
      1e-5,
      `Vertex ${i} Plan & Elevation X alignment`
    );
  }
  const hasVisiblePlan = drawing.planLines.some((l) => l.style === 'visible');
  const hasHiddenPlan = drawing.planLines.some((l) => l.style === 'hidden');
  assert.ok(hasVisiblePlan, 'Tilted square pyramid Plan must have visible edges');
  assert.ok(hasHiddenPlan, 'Tilted square pyramid Plan (base facing down) must have hidden edges');
  console.log('✓ Test 7: Distance preservation, orthographic X-alignment, and hidden edge visibility passed');
}

// 8. Curved solids (Cylinder & Cone) + KTU Step Generator
{
  const cyl = buildLocalSolid('cylinder', {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 22,
    axisLength: 60,
    numSides: 6,
  });
  const ori = { ...createDefaultOrientation(), restingCondition: 'base_corner_hp' as const, alphaHP: 35, betaVP: 40 };
  const pos = createDefaultPosition();
  const solved = solveOrientation(cyl, ori, pos, { kind: 'axis' });
  const world = transformSolid(cyl, solved.quaternion, pos);
  const drawing = generateOrthographicDrawing(world, 'first_angle');
  assert.ok(drawing.planLines.some((l) => l.id.includes('cyl_sil')), 'Tilted cylinder must generate silhouette generators');
  assert.ok(drawing.planLines.some((l) => l.style === 'hidden'), 'Tilted cylinder must generate hidden rear rim arcs');

  for (const problem of KTU_QUESTION_BANK) {
    const res = generateConstructionSteps(
      problem.solidType,
      problem.dimensions,
      problem.orientation,
      problem.position
    );
    assert.ok(res.steps.length >= 3, `Problem ${problem.id} should generate construction steps`);
  }
  console.log('✓ Test 8: Curved solids analytical silhouettes & KTU step-by-step generator passed');
}

// 9. Full-solid tilt & rotate relative to HP and VP
{
  const solid = buildLocalSolid('hexagonal_prism', {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 60,
    numSides: 6,
  });
  const pos = createDefaultPosition();
  const ori = {
    ...createDefaultOrientation(),
    mode: 'solid_tilt_rotate' as const,
    solidTiltHP: 60, // Tilted 60° from vertical -> axis is 30° to HP
    solidTiltVP: 0,
    solidRotateVP: 45,
    solidRoll: 30,
  };
  const solved = solveOrientation(solid, ori, pos, { kind: 'axis' });
  assert.equal(solved.validation.valid, true);
  approxEqual(solved.validation.actualAlphaHP, 30, 1e-2, '60 deg tilt from vertical gives 30 deg to HP');
  assert.ok(solved.validation.actualBetaVP > 30, '45 deg rotate to VP inclines axis to VP');
  console.log('✓ Test 9: Full-solid tilt & rotate relative to HP and VP passed');
}

// 10. KTU Corner-on-HP with Slant / Longer Edge at 45° HP & 45° VP (Pentagonal Prism & Pyramid, 30mm / 80mm)
{
  const dims = {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 80,
    numSides: 5,
  };
  const pos = createDefaultPosition();

  // 10a: Pentagonal Prism
  const prism = buildLocalSolid('pentagonal_prism', dims);
  const prismOri = {
    ...createDefaultOrientation(),
    restingCondition: 'base_corner_hp' as const,
    inclinedElement: 'slant_edge' as const,
    alphaHP: 45,
    betaVP: 45,
  };
  const prismSolved = solveOrientation(prism, prismOri, pos, { kind: 'axis' });
  const prismWorld = transformSolid(prism, prismSolved.quaternion, pos);
  assert.equal(prismSolved.validation.valid, true, 'Pentagonal Prism 45° HP & 45° VP must be valid');
  approxEqual(prismSolved.validation.actualAlphaHP, 45, 1e-2, 'Prism axis/longer edge 45° to HP');
  approxEqual(prismSolved.validation.actualBetaVP, 45, 1e-2, 'Prism axis/longer edge 45° to VP');
  approxEqual(prismSolved.validation.restingContactErrorMm, 0, 1e-4, 'Prism resting base corner on HP Z=0');
  assert.ok(
    prismWorld.worldVertices.every((v) => v.pos.z >= -1e-4),
    'All prism vertices must stay at or above HP (Z >= 0)'
  );

  // 10b: Pentagonal Pyramid
  const pyramid = buildLocalSolid('pentagonal_pyramid', dims);
  const pyramidOri = {
    ...createDefaultOrientation(),
    restingCondition: 'base_corner_hp' as const,
    inclinedElement: 'slant_edge' as const,
    alphaHP: 45,
    betaVP: 45,
  };
  const pyramidSolved = solveOrientation(pyramid, pyramidOri, pos, { kind: 'axis' });
  const pyramidWorld = transformSolid(pyramid, pyramidSolved.quaternion, pos);
  assert.equal(pyramidSolved.validation.valid, true, 'Pentagonal Pyramid slant edge 45° HP & 45° VP must be valid');
  const slantEdgeDir = normalize3(
    sub3(pyramidWorld.worldAxisEnd, pyramidWorld.worldVertices[0].pos)
  );
  const slantAlpha = radToDeg(Math.asin(Math.abs(slantEdgeDir.z)));
  const slantBeta = radToDeg(Math.asin(Math.abs(slantEdgeDir.y)));
  approxEqual(slantAlpha, 45, 1e-2, 'Pyramid slant edge 45° to HP');
  approxEqual(slantBeta, 45, 1e-2, 'Pyramid slant edge 45° to VP');
  approxEqual(pyramidSolved.validation.restingContactErrorMm, 0, 1e-4, 'Pyramid resting corner on HP Z=0');
  assert.ok(
    pyramidWorld.worldVertices.every((v) => v.pos.z >= -1e-4),
    'All pyramid vertices must stay at or above HP (Z >= 0)'
  );

  console.log('✓ Test 10: KTU Pentagonal Prism & Pyramid corner-on-HP slant-edge 45° HP & 45° VP passed');
}

// 11. 3-Stage Guided Output (Simple Position -> Inclined to HP Only -> Inclined to VP)
{
  const dims = {
    sideLength: 30,
    baseWidth: 30,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 80,
    numSides: 5,
  };
  const pos = createDefaultPosition();

  // Simple Position -> 1 stage
  const simpleRes = generateThreeStageSteps(
    'pentagonal_prism',
    dims,
    { ...createDefaultOrientation(), restingCondition: 'base_hp', alphaHP: 90, betaVP: 0 },
    pos
  );
  assert.equal(simpleRes.stages.length, 1);
  assert.equal(simpleRes.stages[0].title, 'Step 1: Simple Position');

  // Inclined to HP only -> 2 stages
  const hpOnlyRes = generateThreeStageSteps(
    'pentagonal_prism',
    dims,
    { ...createDefaultOrientation(), restingCondition: 'base_corner_hp', alphaHP: 45, betaVP: 0 },
    pos
  );
  assert.equal(hpOnlyRes.stages.length, 2);
  assert.equal(hpOnlyRes.stages[1].title, 'Step 2: Inclined to HP Only');

  // Inclined to HP and VP -> 3 stages
  const bothRes = generateThreeStageSteps(
    'pentagonal_prism',
    dims,
    {
      ...createDefaultOrientation(),
      restingCondition: 'base_corner_hp',
      inclinedElement: 'slant_edge',
      alphaHP: 45,
      betaVP: 45,
    },
    pos
  );
  assert.equal(bothRes.stages.length, 3);
  assert.equal(bothRes.stages[0].title, 'Step 1: Simple Position');
  assert.equal(bothRes.stages[1].title, 'Step 2: Inclined to HP Only');
  assert.equal(bothRes.stages[2].title, 'Step 3: Inclined to VP (Final Figure)');
  console.log('✓ Test 11: 3-stage guided steps (Simple Position -> HP Only -> VP) passed');
}

// 12. Module 1 (Straight Lines Q1 & Q2)
{
  const q1 = solveLineProblem(KTU_LINE_PRESETS[0].input);
  assert.equal(q1.valid, true, 'Q1 must be valid');
  approxEqual(q1.planLength, 80 * Math.cos((30 * Math.PI) / 180), 1e-2, 'Q1 TV length = 80 cos 30');
  approxEqual(q1.elevLength, 80 * Math.cos((45 * Math.PI) / 180), 1e-2, 'Q1 FV length = 80 cos 45');
  approxEqual(q1.apparentBetaPlan, 54.7356, 0.05, 'Q1 apparent beta in plan');
  approxEqual(q1.apparentAlphaElev, 45.0, 0.05, 'Q1 apparent alpha in elevation');
  assert.ok(q1.ht !== null && Math.abs(q1.ht.z) < 1e-4, 'Q1 HT must lie on HP');
  assert.ok(q1.vt !== null && Math.abs(q1.vt.y) < 1e-4, 'Q1 VT must lie on VP');

  const q2 = solveLineProblem(KTU_LINE_PRESETS[1].input);
  assert.equal(q2.valid, true, 'Q2 must be valid');
  approxEqual(q2.trueThetaHP, radToDeg(Math.acos(50 / 60)), 0.05, 'Q2 true theta = acos(50/60)');
  approxEqual(q2.truePhiVP, radToDeg(Math.acos(40 / 60)), 0.05, 'Q2 true phi = acos(40/60)');
  assert.ok(q2.ht !== null && q2.vt !== null, 'Q2 HT and VT must be found');
  console.log('✓ Test 12: Module 1 (Lines Q1 & Q2 apparent angles, true angles, HT/VT traces) passed');
}

// 13. Module 2 Q3 (Hexagonal Pyramid 30° HP, Top View 45° VP, Apex away & right) & Q4 (Cube body diagonal ⊥ VP)
{
  const q3 = KTU_QUESTION_BANK.find((p) => p.id === 'ktu_hex_pyramid_corner_apparent_45')!;
  assert.ok(q3, 'Q3 preset must exist');
  const q3Local = buildLocalSolid(q3.solidType, q3.dimensions);
  const q3Solved = solveOrientation(q3Local, q3.orientation, q3.position, { kind: 'axis' });
  const q3World = transformSolid(q3Local, q3Solved.quaternion, q3.position);
  assert.equal(q3Solved.validation.valid, true, 'Q3 must be valid');
  approxEqual(q3Solved.validation.actualAlphaHP, 30, 1e-2, 'Q3 axis 30° to HP');
  approxEqual(q3Solved.validation.apparentBetaPlan, 45, 1e-2, 'Q3 top view axis 45° to VP');
  assert.ok(q3World.worldAxisEnd.x > q3World.worldAxisStart.x, 'Q3 apex must be toward right (+X)');
  assert.ok(q3World.worldAxisEnd.y > q3World.worldAxisStart.y, 'Q3 apex must be away from VP (+Y)');

  const q4 = KTU_QUESTION_BANK.find((p) => p.id === 'ktu_cube_corner_body_diag_vp')!;
  assert.ok(q4, 'Q4 preset must exist');
  const q4Local = buildLocalSolid(q4.solidType, q4.dimensions);
  const q4Solved = solveOrientation(q4Local, q4.orientation, q4.position, { kind: 'axis' });
  const q4World = transformSolid(q4Local, q4Solved.quaternion, q4.position);
  assert.equal(q4Solved.validation.valid, true, 'Q4 cube body diagonal ⊥ VP must be valid');
  approxEqual(q4Solved.validation.restingContactErrorMm, 0, 1e-3, 'Q4 cube rests on a base corner on HP');
  approxEqual(q4Solved.validation.actualInclinedAlphaHP ?? -1, 0, 1e-2, 'Q4 body diagonal horizontal (0° HP)');
  approxEqual(q4Solved.validation.actualInclinedBetaVP ?? -1, 90, 1e-2, 'Q4 body diagonal perpendicular to VP (90° VP)');
  assert.ok(q4World.worldVertices.every((v) => v.pos.z >= -1e-4), 'All cube vertices at or above HP');
  console.log('✓ Test 13: Module 2 Q3 (Apparent 45° VP) & Q4 (Cube body diagonal ⊥ VP) passed');
}

// 14. Module 3 Q5 (Pentagonal Pyramid section & development) & Q6 (Square Prism body diagonal section)
{
  const q5 = solveSectionedSolid(KTU_SECTION_PRESETS[0].input);
  approxEqual(q5.sectionAngleDeg, 40, 1e-2, 'Q5 section angle 40°');
  assert.ok(q5.cutPolygon3D.length === 5, 'Q5 cutting all 5 slant edges produces a 5-sided section');
  assert.ok(q5.trueShapeAreaMm2 > 100, 'Q5 true shape area must be positive');
  assert.equal(q5.development.kind, 'pyramid_or_cone', 'Q5 uses radial-line pyramid development');
  assert.ok(q5.development.cutPolyline.length === 6, 'Q5 pentagonal pyramid development has 6 cut stations (closed loop)');

  const q6 = solveSectionedSolid(KTU_SECTION_PRESETS[1].input);
  const expectedTheta = radToDeg(Math.atan2(65, 35 * Math.SQRT2));
  approxEqual(q6.sectionAngleDeg, expectedTheta, 0.05, 'Q6 body diagonal section angle with XY');
  assert.ok(q6.cutPolygon3D.length >= 3, 'Q6 section polygon valid');
  assert.ok(q6.hatchPlanLines.length > 0, 'Q6 sectional top view has 45° hatching lines');
  console.log('✓ Test 14: Module 3 Q5 (Development) & Q6 (Body diagonal section & XY angle) passed');
}

// 15. Module 4 Q7 (Square Pyramid on Hemisphere) & Q8 (Cylinder on Square Plate)
{
  const q7 = generateIsometricDrawing(KTU_ISOMETRIC_PRESETS[0].input);
  approxEqual(q7.totalHeightMm, 25 + 40, 1e-2, 'Q7 total height = Hemisphere R (25) + Pyramid H (40)');
  approxEqual(q7.isoScaleFactor, 1.0, 1e-4, 'Q7 uses true-length Isometric View (1.0)');
  assert.ok(q7.lines.some((l) => l.id.includes('dome')), 'Q7 hemisphere generates isometric spherical dome arc');

  const q8 = generateIsometricDrawing(KTU_ISOMETRIC_PRESETS[1].input);
  approxEqual(q8.totalHeightMm, 18 + 55, 1e-2, 'Q8 total height = Plate (18) + Cylinder (55)');
  approxEqual(q8.isoScaleFactor, 1.0, 1e-4, 'Q8 uses true-length Isometric View (1.0)');
  assert.ok(q8.lines.some((l) => l.id.includes('top_sil')), 'Q8 cylinder generates silhouette generators');
  console.log('✓ Test 15: Module 4 Q7 & Q8 isometric combination views passed');
}

// 16. Hexagonal Prism: side 20mm, axis 70mm, resting edge on HP inclined at 40° to VP, axis inclined at 60° to HP
{
  const dims = {
    sideLength: 20,
    baseWidth: 20,
    rectangularBase: false,
    baseRadius: 25,
    axisLength: 70,
    numSides: 6,
  };
  const prism = buildLocalSolid('hexagonal_prism', dims);
  const ori = {
    ...createDefaultOrientation(),
    restingCondition: 'base_edge_hp' as const,
    vpAngleType: 'resting_edge' as const,
    alphaHP: 60,
    betaVP: 40,
    referenceEdgeId: 'edge_base_0',
  };
  const pos = createDefaultPosition();
  const solved = solveOrientation(prism, ori, pos, { kind: 'axis' });
  const world = transformSolid(prism, solved.quaternion, pos);

  assert.equal(solved.validation.valid, true, 'Hexagonal prism edge 40° VP & axis 60° HP must be valid');
  approxEqual(solved.validation.actualAlphaHP, 60, 1e-2, 'Axis 60° to HP');
  approxEqual(solved.validation.restingEdgeAngleVP ?? -1, 40, 1e-2, 'Resting base edge 40° to VP');
  approxEqual(solved.validation.apparentBetaPlan, 50, 1e-2, 'Axis top view angle = 90° - 40° = 50°');
  const expectedTrueBeta = radToDeg(Math.asin(Math.cos((60 * Math.PI) / 180) * Math.sin((50 * Math.PI) / 180)));
  approxEqual(solved.validation.actualBetaVP, expectedTrueBeta, 1e-2, 'True axis beta matches 3D geometry');
  approxEqual(solved.validation.restingContactErrorMm, 0, 1e-4, 'Resting base edge lies on HP Z=0');
  assert.ok(solved.validation.sinSqSum <= 1 + 1e-6, 'sin²α + sin²β must not exceed 1');
  assert.ok(world.worldVertices.every((v) => v.pos.z >= -1e-4), 'All vertices at or above HP');

  const stagesRes = generateThreeStageSteps('hexagonal_prism', dims, ori, pos);
  assert.equal(stagesRes.feasible, true);
  assert.equal(stagesRes.stages.length, 3, 'Must produce 3 stages');
  assert.ok(stagesRes.stages[2].badge.includes('Resting Edge'), 'Stage 3 badge reflects resting edge angle');
  console.log('✓ Test 16: Hexagonal prism resting edge 40° VP & axis 60° HP passed');
}

console.log('\nAll EG Studio mathematical engine tests PASSED.');
