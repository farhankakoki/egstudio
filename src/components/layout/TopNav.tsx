import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useProjectStore } from '../../store/project-store';
import type { AppSection } from '../../types/geometry';

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'lines', label: 'Lines' },
  { id: 'solids', label: 'Solids' },
  { id: 'sections', label: 'Sections' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'workspace', label: 'Workspace' },
];

const EXTRA_MOBILE_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'learn', label: 'Learn Mode' },
  { id: 'projects', label: 'Saved Projects' },
  { id: 'guide', label: 'Guide' },
];

export function TopNav() {
  const activeSection = useProjectStore((s) => s.activeSection);
  const setActiveSection = useProjectStore((s) => s.setActiveSection);
  const startNewDrawing = useProjectStore((s) => s.startNewDrawing);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id: AppSection) => {
    setActiveSection(id);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-700 transition-colors cursor-pointer"
        >
          EG Studio
        </button>

        {/* Zone 2: Single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'text-blue-700 border-blue-700'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action CTA + mobile toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              startNewDrawing();
              setMobileOpen(false);
            }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Create New Drawing
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 cursor-pointer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`text-left px-3 py-2 text-sm font-medium rounded-md ${
              activeSection === 'home' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Home
          </button>
          {[...NAV_ITEMS, ...EXTRA_MOBILE_ITEMS].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`text-left px-3 py-2 text-sm font-medium rounded-md ${
                activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
