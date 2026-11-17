import { useProjectStore } from '../../store/project-store';

export function GuideView() {
  const setActiveSection = useProjectStore((s) => s.setActiveSection);

  return (
    <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="pb-5 border-b border-slate-200">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Engineering Graphics Guide (KTU Syllabus)
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Essential theory for first-year B.Tech Engineering Graphics students: coordinate conventions, First-Angle Projection, line types, and the Change-of-Position method.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Reference Planes & Coordinate System
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every solid in EG Studio sits in the First Quadrant using standard descriptive geometry coordinates:
          </p>
          <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 pt-1 font-mono">
            <li>X-axis → Direction along the XY reference line</li>
            <li>Y-axis → Depth in front of the Vertical Plane (VP: Y = 0)</li>
            <li>Z-axis → Height above the Horizontal Plane (HP: Z = 0)</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
          <h2 className="font-display text-base font-semibold text-slate-900">
            02. First-Angle Projection (KTU Standard)
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The object is placed in the First Quadrant (above HP and in front of VP). After projecting onto VP and HP, the Horizontal Plane is rotated 90° clockwise:
          </p>
          <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 pt-1">
            <li>
              <strong className="text-slate-900">Elevation (Front View):</strong> Drawn <strong>above</strong> the XY line using coordinates <span className="font-mono">(x, z)</span>.
            </li>
            <li>
              <strong className="text-slate-900">Plan (Top View):</strong> Drawn <strong>below</strong> the XY line using coordinates <span className="font-mono">(x, y)</span>.
            </li>
          </ul>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-slate-900">
          03. Standard Drawing Line Conventions (BIS / ISO)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <svg width="100%" height="16" viewBox="0 0 120 16">
              <line x1="4" y1="8" x2="116" y2="8" stroke="#0f172a" strokeWidth="2.4" />
            </svg>
            <div className="font-semibold text-slate-900">Visible Edge</div>
            <p className="text-slate-600">Continuous thick dark line for all edges visible to the observer.</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <svg width="100%" height="16" viewBox="0 0 120 16">
              <line x1="4" y1="8" x2="116" y2="8" stroke="#475569" strokeWidth="1.5" strokeDasharray="5 3" />
            </svg>
            <div className="font-semibold text-slate-900">Hidden Edge</div>
            <p className="text-slate-600">Short dashed line for edges occluded behind front-facing surfaces.</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <svg width="100%" height="16" viewBox="0 0 120 16">
              <line x1="4" y1="8" x2="116" y2="8" stroke="#2563eb" strokeWidth="1.2" strokeDasharray="10 3 2 3" />
            </svg>
            <div className="font-semibold text-slate-900">Axis / Centerline</div>
            <p className="text-slate-600">Long-dash dot thin chain line representing the solid&apos;s axis of symmetry.</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <svg width="100%" height="16" viewBox="0 0 120 16">
              <line x1="4" y1="8" x2="116" y2="8" stroke="#94a3b8" strokeWidth="0.9" />
            </svg>
            <div className="font-semibold text-slate-900">Projector / Construction</div>
            <p className="text-slate-600">Thin continuous line connecting matching points between Elevation and Plan.</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900">
          04. True vs Apparent Inclination Law
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          For a unit axis direction vector <span className="font-mono text-slate-900">d = (dx, dy, dz)</span>, true inclination to HP is <span className="font-mono text-slate-900">α = arcsin(|dz|)</span> and true inclination to VP is <span className="font-mono text-slate-900">β = arcsin(|dy|)</span>. Because <span className="font-mono text-slate-900">dx² + dy² + dz² = 1</span>, a solid can only exist in 3D space when:
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-blue-800">
          sin²(α) + sin²(β) ≤ 1 &nbsp; (equivalently α + β ≤ 90°)
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          When both α &gt; 0° and β &gt; 0°, the Plan axis length is foreshortened to <span className="font-mono">L·cos(α)</span> and the Elevation axis length to <span className="font-mono">L·cos(β)</span>. Consequently, the apparent angle <span className="font-mono">β&apos;</span> measured in Plan is always greater than the true angle <span className="font-mono">β</span>.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveSection('learn')}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
        >
          Practice in Learn Mode
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('workspace')}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
        >
          Open 3D Workspace
        </button>
      </div>
    </div>
  );
}
