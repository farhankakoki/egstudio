import type { Mat3, Quat, Vec2, Vec3 } from '../types/geometry';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const EPS = 1e-6;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function degToRad(deg: number): number {
  return deg * DEG2RAD;
}

export function radToDeg(rad: number): number {
  return rad * RAD2DEG;
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function len3(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function normalize3(v: Vec3): Vec3 {
  const l = len3(v);
  if (l < EPS) return { x: 0, y: 0, z: 1 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

export function dist2(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function quatIdentity(): Quat {
  return [0, 0, 0, 1];
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (l < EPS) return [0, 0, 0, 1];
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatFromAxisAngle(axis: Vec3, angleRad: number): Quat {
  const n = normalize3(axis);
  const half = angleRad * 0.5;
  const s = Math.sin(half);
  return quatNormalize([n.x * s, n.y * s, n.z * s, Math.cos(half)]);
}

/**
 * Intrinsic or extrinsic XYZ Euler -> Quaternion
 * Using intrinsic XYZ: q = qx * qy * qz
 */
export function quatFromEulerDeg(rxDeg: number, ryDeg: number, rzDeg: number): Quat {
  const qx = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, degToRad(rxDeg));
  const qy = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, degToRad(ryDeg));
  const qz = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, degToRad(rzDeg));
  return quatNormalize(quatMultiply(quatMultiply(qz, qy), qx));
}

export function quatToMat3(q: Quat): Mat3 {
  const [x, y, z, w] = quatNormalize(q);
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  return [
    1 - (yy + zz), xy - wz, xz + wy,
    xy + wz, 1 - (xx + zz), yz - wx,
    xz - wy, yz + wx, 1 - (xx + yy),
  ];
}

/**
 * Build a quaternion from an orthonormal basis (u, v, w) where u x v = w (right-handed).
 */
export function quatFromBasis(u: Vec3, v: Vec3, w: Vec3): Quat {
  const m00 = u.x, m01 = v.x, m02 = w.x;
  const m10 = u.y, m11 = v.y, m12 = w.y;
  const m20 = u.z, m21 = v.z, m22 = w.z;

  const trace = m00 + m11 + m22;
  let x = 0, y = 0, z = 0, s = 0, qw = 1;

  if (trace > 0) {
    s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    qw = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    qw = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    qw = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }

  return quatNormalize([x, y, z, qw]);
}

export function applyMat3(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

export function applyQuat(q: Quat, v: Vec3): Vec3 {
  return applyMat3(quatToMat3(q), v);
}

/**
 * Shortest-arc quaternion rotating unit vector `from` to unit vector `to`.
 */
export function quatFromUnitVectors(from: Vec3, to: Vec3): Quat {
  const a = normalize3(from);
  const b = normalize3(to);
  const d = clamp(dot3(a, b), -1, 1);

  if (d > 1 - EPS) {
    return quatIdentity();
  }
  if (d < -1 + EPS) {
    // 180-degree rotation around any orthogonal axis
    let ortho = cross3({ x: 1, y: 0, z: 0 }, a);
    if (len3(ortho) < EPS) {
      ortho = cross3({ x: 0, y: 1, z: 0 }, a);
    }
    return quatFromAxisAngle(normalize3(ortho), Math.PI);
  }
  const c = cross3(a, b);
  return quatNormalize([c.x, c.y, c.z, 1 + d]);
}
