import type { LineProblemInput, LineSolution, Vec3 } from '../types/geometry';
import { clamp, degToRad, radToDeg } from './math';

export interface LinePreset {
  id: string;
  title: string;
  statement: string;
  input: LineProblemInput;
}

export const KTU_LINE_PRESETS: LinePreset[] = [
  {
    id: 'ktu_m1_q1',
    title: 'Q1 · Line CD (80 mm, 30° HP, 45° VP, Apparent Angles & Traces)',
    statement:
      'The end C of a line CD is on HP and 25 mm in front of VP. Line is inclined at 30° to HP and 45° to VP. Draw its projections and find the apparent length and apparent inclinations. Assume length of CD is 80 mm. Also locate its traces.',
    input: {
      startLabel: 'c',
      endLabel: 'd',
      inputMode: 'angles',
      trueLength: 80,
      startAboveHP: 0,
      startInFrontVP: 25,
      thetaHP: 30,
      phiVP: 45,
      planLength: 69.28,
      elevLength: 56.57,
      leanRight: true,
      leanForward: true,
      leanUp: true,
    },
  },
  {
    id: 'ktu_m1_q2',
    title: 'Q2 · Line PQ (60 mm, TV 50 mm, FV 40 mm, True Angles & Traces)',
    statement:
      'A line PQ of length 60 mm has its end P 15 mm above HP and 20 mm in front of VP. Its top view and front view measure 50 mm and 40 mm respectively. Draw its projections and determine its true inclinations with HP and VP. Also mark its traces.',
    input: {
      startLabel: 'p',
      endLabel: 'q',
      inputMode: 'views',
      trueLength: 60,
      startAboveHP: 15,
      startInFrontVP: 20,
      thetaHP: 33.56,
      phiVP: 48.19,
      planLength: 50,
      elevLength: 40,
      leanRight: true,
      leanForward: true,
      leanUp: true,
    },
  },
];

export function solveLineProblem(input: LineProblemInput): LineSolution {
  const errors: string[] = [];
  const L = input.trueLength;

  if (!Number.isFinite(L) || L <= 0) {
    errors.push('True length must be greater than 0 mm.');
  }

  const p0: Vec3 = {
    x: 0,
    y: input.startInFrontVP,
    z: input.startAboveHP,
  };

  let thetaRad = 0;
  let phiRad = 0;

  if (input.inputMode === 'angles') {
    const theta = clamp(input.thetaHP, 0, 90);
    const phi = clamp(input.phiVP, 0, 90);
    thetaRad = degToRad(theta);
    phiRad = degToRad(phi);
    const sinSq = Math.sin(thetaRad) ** 2 + Math.sin(phiRad) ** 2;
    if (sinSq > 1 + 1e-4) {
      errors.push(
        `Impossible inclination: θ + φ = ${(theta + phi).toFixed(1)}° > 90° (sin²θ + sin²φ = ${sinSq.toFixed(3)} > 1).`
      );
    }
  } else {
    if (input.planLength <= 0 || input.planLength > L + 1e-4) {
      errors.push(`Top view length (${input.planLength} mm) must be between 0 and True Length (${L} mm).`);
    }
    if (input.elevLength <= 0 || input.elevLength > L + 1e-4) {
      errors.push(`Front view length (${input.elevLength} mm) must be between 0 and True Length (${L} mm).`);
    }
    if (input.planLength * input.planLength + input.elevLength * input.elevLength < L * L - 1e-2) {
      errors.push(
        `Invalid view lengths: TopView² + FrontView² must be ≥ TrueLength² (${L * L} mm²).`
      );
    }
    thetaRad = Math.acos(clamp(input.planLength / Math.max(1e-4, L), -1, 1));
    phiRad = Math.acos(clamp(input.elevLength / Math.max(1e-4, L), -1, 1));
  }

  const dz = L * Math.sin(thetaRad);
  const dy = L * Math.sin(phiRad);
  const dxSq = Math.max(0, L * L - dz * dz - dy * dy);
  const dx = Math.sqrt(dxSq);

  const sx = input.leanRight ? 1 : -1;
  const sy = input.leanForward ? 1 : -1;
  const sz = input.leanUp ? 1 : -1;

  const p1: Vec3 = {
    x: p0.x + sx * dx,
    y: p0.y + sy * dy,
    z: p0.z + sz * dz,
  };

  const planLength = Math.hypot(dx, dy);
  const elevLength = Math.hypot(dx, dz);
  const trueThetaHP = radToDeg(Math.asin(clamp(dz / Math.max(1e-4, L), 0, 1)));
  const truePhiVP = radToDeg(Math.asin(clamp(dy / Math.max(1e-4, L), 0, 1)));
  const apparentAlphaElev = elevLength > 1e-4 ? radToDeg(Math.atan2(dz, dx)) : 0;
  const apparentBetaPlan = planLength > 1e-4 ? radToDeg(Math.atan2(dy, dx)) : 0;

  let ht: Vec3 | null = null;
  if (Math.abs(p1.z - p0.z) > 1e-4) {
    const tHt = -p0.z / (p1.z - p0.z);
    ht = {
      x: p0.x + tHt * (p1.x - p0.x),
      y: p0.y + tHt * (p1.y - p0.y),
      z: 0,
    };
  }

  let vt: Vec3 | null = null;
  if (Math.abs(p1.y - p0.y) > 1e-4) {
    const tVt = -p0.y / (p1.y - p0.y);
    vt = {
      x: p0.x + tVt * (p1.x - p0.x),
      y: 0,
      z: p0.z + tVt * (p1.z - p0.z),
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    p0,
    p1,
    trueLength: L,
    planLength,
    elevLength,
    trueThetaHP,
    truePhiVP,
    apparentAlphaElev,
    apparentBetaPlan,
    ht,
    vt,
  };
}
