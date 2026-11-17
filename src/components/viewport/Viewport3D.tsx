import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset, SelectedFeature, WorldSolid } from '../../types/geometry';

/**
 * Maps EG coordinates (X along XY, Y depth from VP, Z height above HP)
 * to Three.js world coordinates (X right, Y up, Z toward viewer).
 */
function egToThree(p: { x: number; y: number; z: number }): [number, number, number] {
  return [p.x, p.z, p.y];
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

interface CameraRigProps {
  center: THREE.Vector3;
  cameraRequest: { preset: CameraPreset; nonce: number };
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

function CameraRig({ center, cameraRequest, controlsRef }: CameraRigProps) {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);
  const lastNonce = useRef(-1);
  const centerRef = useRef(center);
  centerRef.current = center;
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && controlsRef.current) {
      controlsRef.current.target.copy(centerRef.current);
      controlsRef.current.update();
      initializedRef.current = true;
    }
  }, [controlsRef]);

  useEffect(() => {
    if (cameraRequest.nonce === lastNonce.current) return;
    lastNonce.current = cameraRequest.nonce;

    const c = centerRef.current;
    const dist = 190;
    const cx = c.x;
    const cy = c.y;
    const cz = c.z;

    switch (cameraRequest.preset) {
      case 'front':
        // Standing in front of VP (+Z_Three = +Y_EG) looking toward VP
        targetPos.current = new THREE.Vector3(cx, cy, cz + dist);
        targetLook.current = new THREE.Vector3(cx, cy, cz);
        break;
      case 'top':
        // Standing above HP (+Y_Three = +Z_EG) looking down at HP
        targetPos.current = new THREE.Vector3(cx, cy + dist, cz + 0.01);
        targetLook.current = new THREE.Vector3(cx, cy, cz);
        break;
      case 'side':
        // Looking from +X right side
        targetPos.current = new THREE.Vector3(cx + dist, cy, cz);
        targetLook.current = new THREE.Vector3(cx, cy, cz);
        break;
      case 'isometric':
      case 'reset':
      default:
        targetPos.current = new THREE.Vector3(cx + 135, cy + 105, cz + 145);
        targetLook.current = new THREE.Vector3(cx, cy, cz);
        break;
    }
  }, [cameraRequest.nonce, cameraRequest.preset]);

  useFrame((_, delta) => {
    if (!targetPos.current || !targetLook.current || !controlsRef.current) return;
    const dt = Math.min(delta, 0.05);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.current.x, 8, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.current.y, 8, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.current.z, 8, dt);

    controlsRef.current.target.x = THREE.MathUtils.damp(
      controlsRef.current.target.x,
      targetLook.current.x,
      8,
      dt
    );
    controlsRef.current.target.y = THREE.MathUtils.damp(
      controlsRef.current.target.y,
      targetLook.current.y,
      8,
      dt
    );
    controlsRef.current.target.z = THREE.MathUtils.damp(
      controlsRef.current.target.z,
      targetLook.current.z,
      8,
      dt
    );
    controlsRef.current.update();

    if (camera.position.distanceTo(targetPos.current) < 0.2) {
      targetPos.current = null;
      targetLook.current = null;
    }
  });

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const cancel = () => {
      targetPos.current = null;
      targetLook.current = null;
    };
    ctrl.addEventListener('start', cancel);
    return () => ctrl.removeEventListener('start', cancel);
  }, [controlsRef]);

  return null;
}

interface SolidMesh3DProps {
  worldSolid: WorldSolid;
  selectedFeature: SelectedFeature;
  onSelectFeature?: (f: SelectedFeature) => void;
  interactive: boolean;
}

function SolidMesh3D({
  worldSolid,
  selectedFeature,
  onSelectFeature,
  interactive,
}: SolidMesh3DProps) {
  // Build separate face meshes so individual faces can be clicked & highlighted cleanly
  const faceGeometries = useMemo(() => {
    const verts = worldSolid.worldVertices;
    return worldSolid.worldFaces.map((face) => {
      const positions: number[] = [];
      for (const [i0, i1, i2] of face.triangles) {
        // Reverse winding (i0, i2, i1) so EG -> Three.js reflection preserves outward normals
        const p0 = egToThree(verts[i0].pos);
        const p1 = egToThree(verts[i2].pos);
        const p2 = egToThree(verts[i1].pos);
        positions.push(...p0, ...p1, ...p2);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.computeVertexNormals();
      return { face, geom };
    });
  }, [worldSolid]);

  useEffect(() => {
    return () => {
      faceGeometries.forEach((f) => f.geom.dispose());
    };
  }, [faceGeometries]);

  const edgeSegments = useMemo(() => {
    if (worldSolid.local.isCurved) {
      // Draw circular base/top rims cleanly
      const segs: { id: string; pts: [number, number, number][]; isSelected: boolean }[] = [];
      const baseEdges = worldSolid.local.edges.filter((e) => e.type === 'base' || e.type === 'top');
      for (const e of baseEdges) {
        const p0 = egToThree(worldSolid.worldVertices[e.v0].pos);
        const p1 = egToThree(worldSolid.worldVertices[e.v1].pos);
        segs.push({
          id: e.id,
          pts: [p0, p1],
          isSelected: selectedFeature.kind === 'edge' && selectedFeature.edgeId === e.id,
        });
      }
      return segs;
    }

    return worldSolid.local.edges.map((e) => {
      const p0 = egToThree(worldSolid.worldVertices[e.v0].pos);
      const p1 = egToThree(worldSolid.worldVertices[e.v1].pos);
      return {
        id: e.id,
        pts: [p0, p1] as [number, number, number][],
        isSelected: selectedFeature.kind === 'edge' && selectedFeature.edgeId === e.id,
      };
    });
  }, [worldSolid, selectedFeature]);

  const axisStart3 = egToThree(worldSolid.worldAxisStart);
  const axisEnd3 = egToThree(worldSolid.worldAxisEnd);
  const axisSelected = selectedFeature.kind === 'axis';

  return (
    <group>
      {/* Faces */}
      {faceGeometries.map(({ face, geom }) => {
        const isSelected = selectedFeature.kind === 'face' && selectedFeature.faceId === face.id;
        return (
          <mesh
            key={face.id}
            geometry={geom}
            onClick={(e) => {
              if (!interactive || !onSelectFeature) return;
              e.stopPropagation();
              onSelectFeature({ kind: 'face', faceId: face.id });
            }}
          >
            <meshStandardMaterial
              color={isSelected ? '#2563eb' : '#cbd5e1'}
              roughness={0.42}
              metalness={0.12}
              transparent
              opacity={isSelected ? 0.92 : 0.88}
              polygonOffset
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
        );
      })}

      {/* Solid Edges */}
      {edgeSegments.map((seg) => (
        <Line
          key={seg.id}
          points={seg.pts}
          color={seg.isSelected ? '#dc2626' : '#0f172a'}
          lineWidth={seg.isSelected ? 3.5 : worldSolid.local.isCurved ? 1.2 : 1.7}
          onClick={(e) => {
            if (!interactive || !onSelectFeature || worldSolid.local.isCurved) return;
            e.stopPropagation();
            onSelectFeature({ kind: 'edge', edgeId: seg.id });
          }}
        />
      ))}

      {/* Internal Axis Line */}
      <Line
        points={[axisStart3, axisEnd3]}
        color={axisSelected ? '#1d4ed8' : '#64748b'}
        lineWidth={axisSelected ? 2.8 : 1.4}
        dashed
        dashSize={4}
        gapSize={2.5}
        onClick={(e) => {
          if (!interactive || !onSelectFeature) return;
          e.stopPropagation();
          onSelectFeature({ kind: 'axis' });
        }}
      />
    </group>
  );
}

function ReferencePlanes({ size = 180 }: { size?: number }) {
  const half = size / 2;

  // Build crisp grid line pairs for HP (Z_EG=0 -> Y_Three=0) and VP (Y_EG=0 -> Z_Three=0)
  const hpGridLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    const step = 20;
    for (let x = -half; x <= half; x += step) {
      lines.push([
        [x, 0, 0],
        [x, 0, size * 0.72],
      ]);
    }
    for (let y = 0; y <= size * 0.72; y += step) {
      lines.push([
        [-half, 0, y],
        [half, 0, y],
      ]);
    }
    return lines;
  }, [half, size]);

  const vpGridLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    const step = 20;
    for (let x = -half; x <= half; x += step) {
      lines.push([
        [x, 0, 0],
        [x, size * 0.65, 0],
      ]);
    }
    for (let z = 0; z <= size * 0.65; z += step) {
      lines.push([
        [-half, z, 0],
        [half, z, 0],
      ]);
    }
    return lines;
  }, [half, size]);

  return (
    <group>
      {/* HP: Z_EG = 0 -> Y_Three = 0, extending in +Z_Three (+Y_EG) */}
      <mesh position={[0, 0, (size * 0.72) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size * 0.72]} />
        <meshStandardMaterial
          color="#dbeafe"
          transparent
          opacity={0.38}
          roughness={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {hpGridLines.map((pts, i) => (
        <Line key={`hpg_${i}`} points={pts} color="#93c5fd" lineWidth={0.6} transparent opacity={0.55} />
      ))}

      {/* VP: Y_EG = 0 -> Z_Three = 0, extending in +Y_Three (+Z_EG) */}
      <mesh position={[0, (size * 0.65) / 2, 0]}>
        <planeGeometry args={[size, size * 0.65]} />
        <meshStandardMaterial
          color="#e2e8f0"
          transparent
          opacity={0.42}
          roughness={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {vpGridLines.map((pts, i) => (
        <Line key={`vpg_${i}`} points={pts} color="#94a3b8" lineWidth={0.6} transparent opacity={0.5} />
      ))}

      {/* XY Reference Line */}
      <Line
        points={[
          [-half - 10, 0.05, 0.05],
          [half + 10, 0.05, 0.05],
        ]}
        color="#0f172a"
        lineWidth={2.5}
      />

      {/* Coordinate Axes Indicator near origin corner */}
      <Line points={[[-half + 12, 0.2, 6], [-half + 34, 0.2, 6]]} color="#dc2626" lineWidth={2} />
      <Line points={[[-half + 12, 0.2, 6], [-half + 12, 22.2, 6]]} color="#16a34a" lineWidth={2} />
      <Line points={[[-half + 12, 0.2, 6], [-half + 12, 0.2, 28]]} color="#2563eb" lineWidth={2} />

      {/* Labels for HP, VP, X, Y, and axes */}
      <Html position={[-half - 16, 2, 2]} center distanceFactor={220}>
        <span className="font-mono text-xs font-bold text-slate-900 bg-white/90 px-1.5 py-0.5 rounded border border-slate-300 select-none">
          X
        </span>
      </Html>
      <Html position={[half + 16, 2, 2]} center distanceFactor={220}>
        <span className="font-mono text-xs font-bold text-slate-900 bg-white/90 px-1.5 py-0.5 rounded border border-slate-300 select-none">
          Y
        </span>
      </Html>
      <Html position={[half - 16, 2, size * 0.62]} center distanceFactor={240}>
        <span className="font-display text-xs font-semibold text-blue-800 bg-white/90 px-2 py-0.5 rounded border border-blue-200 select-none whitespace-nowrap">
          HP (Z = 0)
        </span>
      </Html>
      <Html position={[half - 16, size * 0.56, 2]} center distanceFactor={240}>
        <span className="font-display text-xs font-semibold text-slate-700 bg-white/90 px-2 py-0.5 rounded border border-slate-300 select-none whitespace-nowrap">
          VP (Y = 0)
        </span>
      </Html>
      <Html position={[-half + 37, 1, 6]} center distanceFactor={240}>
        <span className="font-mono text-[10px] font-semibold text-red-700 select-none">+X</span>
      </Html>
      <Html position={[-half + 12, 25, 6]} center distanceFactor={240}>
        <span className="font-mono text-[10px] font-semibold text-emerald-700 select-none">+Z</span>
      </Html>
      <Html position={[-half + 12, 1, 31]} center distanceFactor={240}>
        <span className="font-mono text-[10px] font-semibold text-blue-700 select-none">+Y</span>
      </Html>
    </group>
  );
}

interface Viewport3DProps {
  worldSolid: WorldSolid;
  selectedFeature?: SelectedFeature;
  onSelectFeature?: (feature: SelectedFeature) => void;
  cameraRequest: { preset: CameraPreset; nonce: number };
  onTriggerPreset?: (preset: CameraPreset) => void;
  interactive?: boolean;
  compact?: boolean;
}

export function Viewport3D({
  worldSolid,
  selectedFeature = { kind: 'axis' },
  onSelectFeature,
  cameraRequest,
  onTriggerPreset,
  interactive = true,
  compact = false,
}: Viewport3DProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const solidCenter = useMemo(() => {
    const { min, max } = worldSolid.boundingBox;
    return new THREE.Vector3(
      (min.x + max.x) / 2,
      (min.z + max.z) / 2,
      (min.y + max.y) / 2
    );
  }, [worldSolid]);

  if (contextLost) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-700 p-6 text-center">
        <p className="font-display font-semibold text-sm">3D WebGL context interrupted</p>
        <button
          type="button"
          onClick={() => setContextLost(false)}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
        >
          Reload 3D Viewport
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-hidden">
      <Canvas
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{ position: [135, 105, 170], fov: 38, near: 1, far: 2000 }}
        gl={{ antialias: !isSoftwareGl, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
          });
        }}
      >
        <color attach="background" args={['#f8fafc']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[140, 220, 180]} intensity={1.15} color="#fffcf5" />
        <directionalLight position={[-120, 90, -110]} intensity={0.45} color="#dbeafe" />
        <hemisphereLight args={['#ffffff', '#cbd5e1', 0.5]} />

        <ReferencePlanes size={180} />
        <SolidMesh3D
          worldSolid={worldSolid}
          selectedFeature={selectedFeature}
          onSelectFeature={onSelectFeature}
          interactive={interactive}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping={!isSoftwareGl}
          dampingFactor={0.08}
          minDistance={60}
          maxDistance={480}
        />

        <CameraRig center={solidCenter} cameraRequest={cameraRequest} controlsRef={controlsRef} />
      </Canvas>

      {/* Camera shortcut bar (top-left, solid surface without backdrop-blur over WebGL) */}
      {onTriggerPreset && !compact && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-xs">
          {(
            [
              { id: 'isometric', label: 'Isometric' },
              { id: 'front', label: 'Front (VP)' },
              { id: 'top', label: 'Top (HP)' },
              { id: 'side', label: 'Side' },
              { id: 'reset', label: 'Reset' },
            ] as { id: CameraPreset; label: string }[]
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onTriggerPreset(btn.id)}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {!compact && (
        <div className="absolute bottom-3 left-3 z-10 bg-white/95 border border-slate-200 rounded-md px-2.5 py-1 text-[11px] text-slate-600 pointer-events-none">
          Drag to orbit · Scroll to zoom · Right-drag to pan · Click face or edge to inspect
        </div>
      )}
    </div>
  );
}
