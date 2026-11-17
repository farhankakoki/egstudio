import { AlertTriangle, CheckCircle2, HelpCircle, RotateCcw } from 'lucide-react';
import { SOLID_CATALOG } from '../../engine/geometry';
import { getNaturalFaceRestingAlpha } from '../../engine/orientation';
import { useProjectStore } from '../../store/project-store';
import type {
  BaseEdgeReference,
  OrientationValidation,
  RestingCondition,
  SolidGeometry,
  SolidType,
} from '../../types/geometry';
import { NumericInput } from '../ui/NumericInput';

interface OrientationPanelProps {
  localSolid: SolidGeometry;
  validation: OrientationValidation;
}

function LabelWithTip({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
      <span>{label}</span>
      <span title={tip} className="text-slate-400 hover:text-slate-600 cursor-help">
        <HelpCircle className="w-3.5 h-3.5" />
      </span>
    </span>
  );
}

export function OrientationPanel({ localSolid, validation }: OrientationPanelProps) {
  const solidType = useProjectStore((s) => s.solidType);
  const dimensions = useProjectStore((s) => s.dimensions);
  const orientation = useProjectStore((s) => s.orientation);
  const position = useProjectStore((s) => s.position);
  const selectedFeature = useProjectStore((s) => s.selectedFeature);
  const setSolidTypeKeepConfig = useProjectStore((s) => s.setSolidTypeKeepConfig);
  const updateDimensions = useProjectStore((s) => s.updateDimensions);
  const updateOrientation = useProjectStore((s) => s.updateOrientation);
  const resetOrientation = useProjectStore((s) => s.resetOrientation);
  const updatePosition = useProjectStore((s) => s.updatePosition);
  const setSelectedFeature = useProjectStore((s) => s.setSelectedFeature);

  const lateralFaces = localSolid.faces.filter((f) => f.type === 'lateral');
  const baseEdges = localSolid.edges.filter((e) => e.type === 'base');

  const handleRestingChange = (cond: RestingCondition) => {
    const nextVpType =
      cond !== 'base_edge_hp' && orientation.vpAngleType === 'resting_edge'
        ? 'true'
        : orientation.vpAngleType;
    if (cond === 'base_hp') {
      updateOrientation({ restingCondition: cond, vpAngleType: nextVpType, alphaHP: 90, betaVP: 0 });
      updatePosition({ snapToHP: true, snapToVP: false });
    } else if (cond === 'base_vp') {
      updateOrientation({ restingCondition: cond, vpAngleType: nextVpType, alphaHP: 0, betaVP: 90 });
      updatePosition({ snapToHP: false, snapToVP: true });
    } else if (cond === 'face_hp') {
      const face =
        lateralFaces.find((f) => f.id === orientation.referenceFaceId) ?? lateralFaces[0];
      const naturalAlpha = face ? +getNaturalFaceRestingAlpha(localSolid, face).toFixed(1) : 0;
      updateOrientation({
        restingCondition: cond,
        vpAngleType: nextVpType,
        alphaHP: naturalAlpha,
        referenceFaceId: face?.id ?? null,
      });
      updatePosition({ snapToHP: true, snapToVP: false });
    } else if (cond === 'generator_hp') {
      const naturalAlpha =
        localSolid.type === 'cone'
          ? +((Math.atan2(localSolid.radius, localSolid.axisEnd.z) * 180) / Math.PI).toFixed(1)
          : 0;
      updateOrientation({ restingCondition: cond, vpAngleType: nextVpType, alphaHP: naturalAlpha });
      updatePosition({ snapToHP: true, snapToVP: false });
    } else {
      const nextAlpha = orientation.alphaHP === 90 ? 30 : orientation.alphaHP;
      updateOrientation({ restingCondition: cond, vpAngleType: nextVpType, alphaHP: nextAlpha });
      updatePosition({ snapToHP: cond !== 'free', snapToVP: false });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + Reset */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Problem Setup &amp; Orientation
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Solid, dimensions, resting face/corner &amp; angles
          </p>
        </div>
        <button
          type="button"
          onClick={resetOrientation}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* Inline Solid & Dimensions Quick Setup */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
        <div>
          <label htmlFor="ws-solid-select" className="block text-[11px] font-semibold text-slate-700 mb-1">
            Solid Type
          </label>
          <select
            id="ws-solid-select"
            value={solidType}
            onChange={(e) => setSolidTypeKeepConfig(e.target.value as SolidType)}
            className="w-full px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {SOLID_CATALOG.map((item) => (
              <option key={item.type} value={item.type}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="ws-dim-primary" className="block text-[11px] font-medium text-slate-600 mb-1">
              {localSolid.isCurved ? 'Base Radius (mm)' : solidType === 'cube' ? 'Cube Side (mm)' : 'Base Side (mm)'}
            </label>
            <NumericInput
              id="ws-dim-primary"
              min={1}
              max={200}
              step={1}
              value={localSolid.isCurved ? dimensions.baseRadius : dimensions.sideLength}
              onChange={(v) =>
                updateDimensions(
                  localSolid.isCurved ? { baseRadius: v } : { sideLength: v, baseWidth: v }
                )
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="ws-dim-axis" className="block text-[11px] font-medium text-slate-600 mb-1">
              {solidType === 'cube'
                ? 'Cube Height (Auto)'
                : solidType === 'hemisphere'
                  ? 'Height = R (Auto)'
                  : 'Axis Length (mm)'}
            </label>
            <NumericInput
              id="ws-dim-axis"
              min={1}
              max={300}
              step={1}
              disabled={solidType === 'cube' || solidType === 'hemisphere'}
              value={
                solidType === 'cube'
                  ? dimensions.sideLength
                  : solidType === 'hemisphere'
                    ? dimensions.baseRadius
                    : dimensions.axisLength
              }
              onChange={(v) => updateDimensions({ axisLength: v })}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Mode Switcher: Axis Tilt vs Full Solid Tilt/Rotate vs XYZ Euler */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => updateOrientation({ mode: 'inclination' })}
            className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              orientation.mode === 'inclination'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Axis to HP/VP
          </button>
          <button
            type="button"
            onClick={() => updateOrientation({ mode: 'solid_tilt_rotate' })}
            className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              orientation.mode === 'solid_tilt_rotate'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Solid Tilt/Rotate
          </button>
          <button
            type="button"
            onClick={() => updateOrientation({ mode: 'euler' })}
            className={`py-1.5 px-1.5 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              orientation.mode === 'euler'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            XYZ Euler
          </button>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          {orientation.mode === 'inclination'
            ? 'Rotates the solid’s axis to α (HP) and β (VP) with KTU resting constraints.'
            : orientation.mode === 'solid_tilt_rotate'
              ? 'Tilts or rotates the entire solid freely relative to HP and VP by exact angles.'
              : 'Rotates the solid directly around global X, Y, and Z coordinate axes.'}
        </p>
      </div>

      {/* Validation Status */}
      {!validation.valid ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-red-900">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Geometric Constraint Violation</span>
          </div>
          {validation.errors.map((err, idx) => (
            <p key={idx} className="leading-relaxed">
              {err}
            </p>
          ))}
          {localSolid.category === 'prism' &&
            orientation.restingCondition === 'face_hp' &&
            orientation.alphaHP > 0.5 && (
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateOrientation({ alphaHP: 0 })}
                  className="px-2.5 py-1 bg-white border border-red-300 text-red-800 font-medium rounded hover:bg-red-100 cursor-pointer"
                >
                  Keep Face Flat on HP (α = 0°)
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ restingCondition: 'base_edge_hp' })}
                  className="px-2.5 py-1 bg-red-700 text-white font-medium rounded hover:bg-red-800 cursor-pointer"
                >
                  Rest on Base Edge (α = {orientation.alphaHP}°)
                </button>
              </div>
            )}
          {validation.errors.some((e) => e.includes('Invalid inclination')) && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              {orientation.restingCondition === 'base_edge_hp' && (
                <button
                  type="button"
                  onClick={() => updateOrientation({ vpAngleType: 'resting_edge' })}
                  className="px-2.5 py-1 bg-blue-700 text-white font-medium rounded hover:bg-blue-800 cursor-pointer"
                >
                  Use {orientation.betaVP}° as Resting Edge to VP
                </button>
              )}
              <button
                type="button"
                onClick={() => updateOrientation({ vpAngleType: 'apparent' })}
                className="px-2.5 py-1 bg-white border border-red-300 text-red-900 font-medium rounded hover:bg-red-100 cursor-pointer"
              >
                Use {orientation.betaVP}° as Top View (β&apos;)
              </button>
              <button
                type="button"
                onClick={() =>
                  updateOrientation({ betaVP: Math.floor(validation.maxAllowedBeta) })
                }
                className="px-2.5 py-1 bg-red-700 text-white font-medium rounded hover:bg-red-800 cursor-pointer"
              >
                Adjust True β to {Math.floor(validation.maxAllowedBeta)}°
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-700">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Valid 3D Geometry
          </span>
          <span className="font-mono tabular-nums text-[11px] text-slate-500">
            sin²α + sin²β = {validation.sinSqSum.toFixed(2)}
          </span>
        </div>
      )}

      {orientation.mode === 'inclination' ? (
        <div className="space-y-4">
          {/* Resting Condition */}
          <div>
            <LabelWithTip
              label="Resting Condition"
              tip="Defines which edge, face, or base sits in contact with the Horizontal Plane (HP) or Vertical Plane (VP)."
            />
            <select
              value={orientation.restingCondition}
              onChange={(e) => handleRestingChange(e.target.value as RestingCondition)}
              className="mt-1.5 w-full px-2.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="base_hp">Base resting on HP (Axis ⊥ HP)</option>
              <option value="base_vp">Base resting on VP (Axis ⊥ VP)</option>
              <option value="base_edge_hp">Resting on Base Edge on HP</option>
              <option value="base_corner_hp">Resting on Base Corner on HP</option>
              {!localSolid.isCurved && (
                <option value="face_hp">
                  {localSolid.category === 'prism'
                    ? 'Resting on Rectangular Face on HP'
                    : 'Resting on Slant Face on HP'}
                </option>
              )}
              {localSolid.isCurved && (
                <option value="generator_hp">Resting on Generator on HP</option>
              )}
              <option value="free">Free Spatial Axis Orientation</option>
            </select>
          </div>

          {/* Reference Face or Edge selector when applicable */}
          {orientation.restingCondition === 'face_hp' && lateralFaces.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Resting Face
              </label>
              <select
                value={orientation.referenceFaceId ?? lateralFaces[0].id}
                onChange={(e) => {
                  const face = lateralFaces.find((f) => f.id === e.target.value);
                  const nat = face ? +getNaturalFaceRestingAlpha(localSolid, face).toFixed(1) : 0;
                  updateOrientation({ referenceFaceId: e.target.value, alphaHP: nat });
                }}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {lateralFaces.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {orientation.restingCondition === 'base_edge_hp' && baseEdges.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Resting Base Edge
              </label>
              <select
                value={orientation.referenceEdgeId ?? baseEdges[0].id}
                onChange={(e) => updateOrientation({ referenceEdgeId: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {baseEdges.map((edge) => (
                  <option key={edge.id} value={edge.id}>
                    {edge.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Which element is inclined: Axis vs Slant / Longer Edge vs Body Diagonal */}
          {orientation.restingCondition === 'base_corner_hp' && (
            <div className="p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-lg space-y-1.5">
              <LabelWithTip
                label="What is inclined at α & β?"
                tip="Choose whether the angles to HP and VP apply to the solid's Axis, Slant/Longer Edge, or Body Diagonal (prisms/cube)."
              />
              <div
                className={`grid gap-1 p-0.5 bg-white border border-slate-200 rounded-md text-[11px] ${
                  localSolid.category === 'prism' ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => updateOrientation({ inclinedElement: 'axis' })}
                  className={`py-1 px-1.5 rounded font-medium cursor-pointer ${
                    (orientation.inclinedElement ?? 'axis') === 'axis'
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Axis
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ inclinedElement: 'slant_edge' })}
                  className={`py-1 px-1.5 rounded font-medium cursor-pointer ${
                    orientation.inclinedElement === 'slant_edge'
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Slant / Longer Edge
                </button>
                {localSolid.category === 'prism' && (
                  <button
                    type="button"
                    onClick={() => updateOrientation({ inclinedElement: 'body_diagonal' })}
                    className={`py-1 px-1.5 rounded font-medium cursor-pointer ${
                      orientation.inclinedElement === 'body_diagonal'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Body Diagonal
                  </button>
                )}
              </div>
              {orientation.inclinedElement === 'slant_edge' && (
                <p className="text-[11px] text-slate-600 leading-snug">
                  {localSolid.category === 'prism'
                    ? 'On a prism, longer edges are parallel to the axis, so inclining a longer edge at α & β gives the exact same inclination to the axis.'
                    : 'Solves the exact orientation so the slant edge rising from the resting corner makes α° to HP and β° to VP.'}
                </p>
              )}
              {orientation.inclinedElement === 'body_diagonal' && (
                <p className="text-[11px] text-slate-600 leading-snug">
                  Orients the body diagonal connecting the resting corner to the opposite top corner at α° to HP and β° to VP (for ⊥ VP, set α = 0°, β = 90°).
                </p>
              )}
            </div>
          )}

          {/* Alpha (HP Inclination) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <LabelWithTip
                label={
                  orientation.restingCondition === 'base_corner_hp' &&
                  orientation.inclinedElement === 'body_diagonal'
                    ? 'Body Diagonal to HP (α)'
                    : orientation.restingCondition === 'base_corner_hp' &&
                        orientation.inclinedElement === 'slant_edge'
                      ? localSolid.category === 'prism'
                        ? 'Longer Edge / Axis to HP (α)'
                        : 'Slant Edge Angle to HP (α)'
                      : 'Axis Angle to HP (α)'
                }
                tip="True angle to the Horizontal Plane (HP). Changing α from 90° automatically tilts the solid off its flat base."
              />
              <div className="flex items-center gap-1">
                <NumericInput
                  ariaLabel="Axis Angle to HP"
                  min={0}
                  max={90}
                  step={1}
                  value={orientation.alphaHP}
                  onChange={(val) => {
                    const nextCond =
                      orientation.restingCondition === 'base_hp' && val < 90
                        ? 'base_edge_hp'
                        : orientation.restingCondition === 'base_vp'
                          ? 'free'
                          : orientation.restingCondition;
                    updateOrientation({ alphaHP: val, restingCondition: nextCond });
                  }}
                  className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-500">°</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={orientation.alphaHP}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                const nextCond =
                  orientation.restingCondition === 'base_hp' && val < 90
                    ? 'base_edge_hp'
                    : orientation.restingCondition === 'base_vp'
                      ? 'free'
                      : orientation.restingCondition;
                updateOrientation({ alphaHP: val, restingCondition: nextCond });
              }}
              className="w-full touch-pan-y accent-blue-700"
            />
            <div className="mt-1 flex items-center gap-1">
              {[0, 30, 45, 60, 90].map((deg) => (
                <button
                  key={`a_${deg}`}
                  type="button"
                  onClick={() => {
                    const nextCond =
                      deg === 90 && orientation.betaVP === 0
                        ? 'base_hp'
                        : orientation.restingCondition === 'base_hp' && deg < 90
                          ? 'base_edge_hp'
                          : orientation.restingCondition === 'base_vp'
                            ? 'free'
                            : orientation.restingCondition;
                    updateOrientation({
                      alphaHP: deg,
                      betaVP: deg === 90 ? 0 : orientation.betaVP,
                      restingCondition: nextCond,
                    });
                  }}
                  className={`flex-1 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                    Math.abs(orientation.alphaHP - deg) < 0.5
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* Beta (VP Inclination) */}
          <div className="space-y-2">
            <div
              className={`grid gap-1 p-0.5 bg-slate-100 rounded-md text-[11px] ${
                orientation.restingCondition === 'base_edge_hp' ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                onClick={() => updateOrientation({ vpAngleType: 'true' })}
                className={`py-1 px-1.5 rounded font-medium cursor-pointer ${
                  (orientation.vpAngleType ?? 'true') === 'true'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                True β
              </button>
              <button
                type="button"
                onClick={() => updateOrientation({ vpAngleType: 'apparent' })}
                className={`py-1 px-1.5 rounded font-medium cursor-pointer ${
                  orientation.vpAngleType === 'apparent'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top View β&apos;
              </button>
              {orientation.restingCondition === 'base_edge_hp' && (
                <button
                  type="button"
                  onClick={() => updateOrientation({ vpAngleType: 'resting_edge' })}
                  className={`py-1 px-1.5 rounded font-medium cursor-pointer ${
                    orientation.vpAngleType === 'resting_edge'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Resting Edge
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mb-1">
              <LabelWithTip
                label={
                  orientation.vpAngleType === 'resting_edge' &&
                  orientation.restingCondition === 'base_edge_hp'
                    ? 'Resting Edge to VP (ψ)'
                    : orientation.vpAngleType === 'apparent'
                      ? 'Top View (Apparent) Angle to VP (β\')'
                      : orientation.restingCondition === 'base_corner_hp' &&
                          orientation.inclinedElement === 'body_diagonal'
                        ? 'Body Diagonal to VP (β)'
                        : orientation.restingCondition === 'base_corner_hp' &&
                            orientation.inclinedElement === 'slant_edge'
                          ? localSolid.category === 'prism'
                            ? 'Longer Edge / Axis to VP (β)'
                            : 'Slant Edge Angle to VP (β)'
                          : 'Axis Angle to VP (β)'
                }
                tip={
                  orientation.vpAngleType === 'resting_edge' &&
                  orientation.restingCondition === 'base_edge_hp'
                    ? 'Orients the resting base edge on HP directly at this angle to VP (used when the problem states "resting edge is inclined at ... to VP").'
                    : orientation.vpAngleType === 'apparent'
                      ? 'Directly rotates the Top View (Plan) projection to this angle with XY (used when the question states "top view of axis is inclined at ... to VP").'
                      : `True angle to VP. Max allowed for α=${orientation.alphaHP.toFixed(0)}° is ${validation.maxAllowedBeta.toFixed(1)}°.`
                }
              />
              <div className="flex items-center gap-1">
                <NumericInput
                  ariaLabel="Axis Angle to VP"
                  min={0}
                  max={90}
                  step={1}
                  value={orientation.betaVP}
                  onChange={(val) => {
                    const nextCond =
                      orientation.restingCondition === 'base_hp' && val > 0
                        ? 'base_edge_hp'
                        : orientation.restingCondition === 'base_vp' && val < 90
                          ? 'free'
                          : orientation.restingCondition;
                    updateOrientation({
                      betaVP: val,
                      alphaHP:
                        orientation.restingCondition === 'base_hp' && val > 0
                          ? Math.min(orientation.alphaHP, Math.max(0, 90 - val))
                          : orientation.alphaHP,
                      restingCondition: nextCond,
                    });
                  }}
                  className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-xs text-slate-500">°</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={orientation.betaVP}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                const nextCond =
                  orientation.restingCondition === 'base_hp' && val > 0
                    ? 'base_edge_hp'
                    : orientation.restingCondition === 'base_vp' && val < 90
                      ? 'free'
                      : orientation.restingCondition;
                updateOrientation({
                  betaVP: val,
                  alphaHP:
                    orientation.restingCondition === 'base_hp' && val > 0
                      ? Math.min(orientation.alphaHP, Math.max(0, 90 - val))
                      : orientation.alphaHP,
                  restingCondition: nextCond,
                });
              }}
              className="w-full touch-pan-y accent-blue-700"
            />
            <div className="mt-1 flex items-center gap-1">
              {[0, 30, 45, 60, 90].map((deg) => (
                <button
                  key={`b_${deg}`}
                  type="button"
                  onClick={() => {
                    const nextCond =
                      deg === 90 && orientation.alphaHP === 0
                        ? 'base_vp'
                        : orientation.restingCondition === 'base_hp' && deg > 0
                          ? 'base_edge_hp'
                          : orientation.restingCondition === 'base_vp' && deg < 90
                            ? 'free'
                            : orientation.restingCondition;
                    updateOrientation({
                      betaVP: deg,
                      alphaHP:
                        orientation.restingCondition === 'base_hp' && deg > 0
                          ? Math.max(0, 90 - deg)
                          : orientation.alphaHP,
                      restingCondition: nextCond,
                    });
                  }}
                  className={`flex-1 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                    Math.abs(orientation.betaVP - deg) < 0.5
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* Base Orientation & Lean Direction */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Tilt Direction X
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionX: 'positive' })}
                  className={`py-1 rounded font-medium cursor-pointer ${
                    orientation.leanDirectionX === 'positive'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  +X
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionX: 'negative' })}
                  className={`py-1 rounded font-medium cursor-pointer ${
                    orientation.leanDirectionX === 'negative'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  -X
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                VP Tilt Direction Y
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionY: 'positive' })}
                  className={`py-1 rounded font-medium cursor-pointer ${
                    orientation.leanDirectionY === 'positive'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  +Y
                </button>
                <button
                  type="button"
                  onClick={() => updateOrientation({ leanDirectionY: 'negative' })}
                  className={`py-1 rounded font-medium cursor-pointer ${
                    orientation.leanDirectionY === 'negative'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  -Y
                </button>
              </div>
            </div>
          </div>

          {(orientation.restingCondition === 'base_hp' ||
            orientation.restingCondition === 'base_vp' ||
            orientation.restingCondition === 'free') && (
            <div>
              <LabelWithTip
                label="Base Edge Reference / Roll"
                tip="Controls how the polygon base is rotated around the axis before tilting."
              />
              <select
                value={orientation.baseReference}
                onChange={(e) =>
                  updateOrientation({ baseReference: e.target.value as BaseEdgeReference })
                }
                className="mt-1.5 w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="edge_perp_vp">Reference base edge ⊥ to VP</option>
                <option value="edge_parallel_vp">Reference base edge ∥ to VP</option>
                <option value="custom_roll">Custom roll angle around axis</option>
              </select>

              {orientation.baseReference === 'custom_roll' && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>Axis Roll</span>
                    <span className="font-mono tabular-nums">{orientation.rollAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={5}
                    value={orientation.rollAngle}
                    onChange={(e) =>
                      updateOrientation({ rollAngle: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ) : orientation.mode === 'solid_tilt_rotate' ? (
        /* Full-Solid Tilt & Rotate relative to HP & VP */
        <div className="space-y-4">
          {(
            [
              {
                key: 'solidTiltHP' as const,
                label: 'Tilt Solid to HP',
                tip: 'Tilts the entire solid relative to the Horizontal Plane (HP). 0° = upright on base, 90° = lying flat along HP.',
                presets: [0, 30, 45, 60, 90],
              },
              {
                key: 'solidTiltVP' as const,
                label: 'Tilt Solid to VP',
                tip: 'Tilts the entire solid toward or away from the Vertical Plane (VP).',
                presets: [-45, 0, 30, 45, 90],
              },
              {
                key: 'solidRotateVP' as const,
                label: 'Rotate Solid to VP (in HP)',
                tip: 'Rotates the entire solid horizontally in Plan around the vertical axis, changing its angle to VP.',
                presets: [0, 30, 45, 60, 90],
              },
              {
                key: 'solidRoll' as const,
                label: 'Spin Solid Around Own Axis',
                tip: 'Rotates the full solid around its own longitudinal axis without changing axis tilt.',
                presets: [0, 30, 45, 60, 90],
              },
            ]
          ).map((ctrl) => {
            const val = orientation[ctrl.key] ?? 0;
            return (
              <div key={ctrl.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <LabelWithTip label={ctrl.label} tip={ctrl.tip} />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateOrientation({ [ctrl.key]: Math.max(-180, val - 15) })}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                      title="Subtract 15°"
                    >
                      -15°
                    </button>
                    <NumericInput
                      ariaLabel={ctrl.label}
                      min={-180}
                      max={180}
                      step={1}
                      value={val}
                      onChange={(nextVal) => updateOrientation({ [ctrl.key]: nextVal })}
                      className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="text-xs text-slate-500">°</span>
                    <button
                      type="button"
                      onClick={() => updateOrientation({ [ctrl.key]: Math.min(180, val + 15) })}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                      title="Add 15°"
                    >
                      +15°
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={val}
                  onChange={(e) => updateOrientation({ [ctrl.key]: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex items-center gap-1">
                  {ctrl.presets.map((deg) => (
                    <button
                      key={`${ctrl.key}_${deg}`}
                      type="button"
                      onClick={() => updateOrientation({ [ctrl.key]: deg })}
                      className={`flex-1 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                        Math.abs(val - deg) < 0.5
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() =>
                updateOrientation({
                  solidTiltHP: 0,
                  solidTiltVP: 0,
                  solidRotateVP: 0,
                  solidRoll: 0,
                })
              }
              className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
            >
              Reset Solid Tilt &amp; Rotation (0°)
            </button>
          </div>
        </div>
      ) : (
        /* Direct Euler Rotation Controls */
        <div className="space-y-3.5">
          {(
            [
              { key: 'eulerX', label: 'Rotation around X (°)' },
              { key: 'eulerY', label: 'Rotation around Y (°)' },
              { key: 'eulerZ', label: 'Rotation around Z (°)' },
              { key: 'rollAngle', label: 'Local Axis Roll (°)' },
            ] as const
          ).map((ctrl) => (
            <div key={ctrl.key}>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                <span>{ctrl.label}</span>
                <NumericInput
                  ariaLabel={ctrl.label}
                  min={-180}
                  max={180}
                  step={1}
                  value={orientation[ctrl.key]}
                  onChange={(v) => updateOrientation({ [ctrl.key]: v })}
                  className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded"
                />
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={orientation[ctrl.key]}
                onChange={(e) =>
                  updateOrientation({ [ctrl.key]: parseFloat(e.target.value) })
                }
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}

      {/* Position relative to HP & VP */}
      <div className="pt-4 border-t border-slate-200 space-y-3">
        <h3 className="font-display text-xs font-semibold text-slate-800">
          Position Relative to HP & VP
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={position.snapToHP}
              onChange={(e) => updatePosition({ snapToHP: e.target.checked })}
              className="rounded border-slate-300 text-blue-700"
            />
            Rest on HP (Z = 0)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={position.snapToVP}
              onChange={(e) => updatePosition({ snapToVP: e.target.checked })}
              className="rounded border-slate-300 text-blue-700"
            />
            Rest on VP (Y = 0)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-600 mb-1">
              In front of VP (mm)
            </label>
            <NumericInput
              ariaLabel="In front of VP in mm"
              min={0}
              max={150}
              disabled={position.snapToVP}
              value={position.snapToVP ? 0 : position.inFrontOfVP}
              onChange={(v) => updatePosition({ inFrontOfVP: v })}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-600 mb-1">
              Above HP (mm)
            </label>
            <NumericInput
              ariaLabel="Above HP in mm"
              min={0}
              max={150}
              disabled={position.snapToHP}
              value={position.snapToHP ? 0 : position.aboveHP}
              onChange={(v) => updatePosition({ aboveHP: v })}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-300 rounded disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Selected Feature Inspector */}
      <div className="pt-4 border-t border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs font-semibold text-slate-800">
            Selected Feature Inspector
          </h3>
          <button
            type="button"
            onClick={() => {
              setSelectedFeature({ kind: 'axis' });
              updateOrientation({ featureTargetPlane: null });
            }}
            className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
          >
            Select Axis
          </button>
        </div>

        <select
          value={
            selectedFeature.kind === 'axis'
              ? 'axis'
              : selectedFeature.kind === 'face'
                ? `face:${selectedFeature.faceId}`
                : `edge:${selectedFeature.edgeId}`
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'axis') {
              setSelectedFeature({ kind: 'axis' });
              updateOrientation({ featureTargetPlane: null });
            } else if (val.startsWith('face:')) {
              setSelectedFeature({ kind: 'face', faceId: val.slice(5) });
            } else if (val.startsWith('edge:')) {
              setSelectedFeature({ kind: 'edge', edgeId: val.slice(5) });
            }
          }}
          aria-label="Inspect solid feature"
          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
        >
          <option value="axis">Axis (O1–O2)</option>
          {!localSolid.isCurved && (
            <optgroup label="Faces">
              {localSolid.faces.map((f) => (
                <option key={f.id} value={`face:${f.id}`}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          )}
          {!localSolid.isCurved && (
            <optgroup label="Edges">
              {localSolid.edges.map((ed) => (
                <option key={ed.id} value={`edge:${ed.id}`}>
                  {ed.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
            <span>
              Angle to HP: <strong className="text-slate-900">{validation.selectedFeatureAngleHP?.toFixed(1) ?? '—'}°</strong>
            </span>
            <span>
              Angle to VP: <strong className="text-slate-900">{validation.selectedFeatureAngleVP?.toFixed(1) ?? '—'}°</strong>
            </span>
          </div>

          {selectedFeature.kind !== 'axis' && orientation.mode === 'inclination' && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-700">
                  Incline {selectedFeature.kind} to:
                </span>
                <div className="flex items-center gap-1">
                  {(['HP', 'VP'] as const).map((plane) => (
                    <button
                      key={plane}
                      type="button"
                      onClick={() =>
                        updateOrientation({
                          featureTargetPlane:
                            orientation.featureTargetPlane === plane ? null : plane,
                        })
                      }
                      className={`px-2 py-0.5 text-[11px] font-medium rounded border cursor-pointer ${
                        orientation.featureTargetPlane === plane
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {plane}
                    </button>
                  ))}
                </div>
              </div>
              {orientation.featureTargetPlane && (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={1}
                    value={orientation.featureTargetAngle}
                    onChange={(e) =>
                      updateOrientation({ featureTargetAngle: parseFloat(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="font-mono tabular-nums text-[11px] w-10 text-right">
                    {orientation.featureTargetAngle}°
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* True vs Apparent Inclination Educational Panel */}
      <div className="pt-4 border-t border-slate-200 space-y-2.5">
        <LabelWithTip
          label="True & Apparent Inclinations"
          tip="When an axis is inclined to both HP and VP, its orthographic Plan and Elevation lengths are foreshortened, making apparent angles larger than true angles."
        />
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
          {validation.actualInclinedAlphaHP !== null && validation.actualInclinedBetaVP !== null && (
            <div className="pb-2 border-b border-slate-200 grid grid-cols-2 gap-x-3 gap-y-1 font-mono tabular-nums">
              <div>
                <span className="text-[11px] font-sans text-blue-700 block">
                  {localSolid.category === 'prism' ? 'Longer Edge α (HP)' : 'Slant Edge α (HP)'}
                </span>
                <span className="font-semibold text-blue-900">
                  {validation.actualInclinedAlphaHP.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-[11px] font-sans text-blue-700 block">
                  {localSolid.category === 'prism' ? 'Longer Edge β (VP)' : 'Slant Edge β (VP)'}
                </span>
                <span className="font-semibold text-blue-900">
                  {validation.actualInclinedBetaVP.toFixed(1)}°
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono tabular-nums">
            <div>
              <span className="text-[11px] font-sans text-slate-500 block">Axis α (to HP)</span>
              <span className="font-semibold text-slate-900">
                {validation.actualAlphaHP.toFixed(1)}°
              </span>
            </div>
            <div>
              <span className="text-[11px] font-sans text-slate-500 block">Apparent α&apos; (Elev)</span>
              <span className="font-semibold text-blue-700">
                {validation.apparentAlphaElevation.toFixed(1)}°
              </span>
            </div>
            <div>
              <span className="text-[11px] font-sans text-slate-500 block">Axis β (to VP)</span>
              <span className="font-semibold text-slate-900">
                {validation.actualBetaVP.toFixed(1)}°
              </span>
            </div>
            <div>
              <span className="text-[11px] font-sans text-slate-500 block">Apparent β&apos; (Plan)</span>
              <span className="font-semibold text-blue-700">
                {validation.apparentBetaPlan.toFixed(1)}°
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] font-mono tabular-nums text-slate-600">
            <div className="flex justify-between">
              <span>True Axis Length (L):</span>
              <span className="text-slate-900 font-medium">{validation.trueAxisLength.toFixed(1)} mm</span>
            </div>
            <div className="flex justify-between">
              <span>Plan Length (L·cos α):</span>
              <span className="text-slate-900 font-medium">{validation.planAxisLength.toFixed(1)} mm</span>
            </div>
            <div className="flex justify-between">
              <span>Elev. Length (L·cos β):</span>
              <span className="text-slate-900 font-medium">{validation.elevationAxisLength.toFixed(1)} mm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
