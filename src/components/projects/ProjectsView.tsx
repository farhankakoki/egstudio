import { Copy, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getSolidCatalogItem } from '../../engine/geometry';
import { useProjectStore } from '../../store/project-store';
import { SolidIsoPreview } from '../solid-selector/SolidIsoPreview';

export function ProjectsView() {
  const projects = useProjectStore((s) => s.projects);
  const openProject = useProjectStore((s) => s.openProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const startNewDrawing = useProjectStore((s) => s.startNewDrawing);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const handleQuickSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    saveCurrentProject(newTitle.trim());
    setNewTitle('');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Saved Projects
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            All solid parameters, dimensions, orientation constraints, and projection conventions are stored locally for instant editing.
          </p>
        </div>

        <form onSubmit={handleQuickSave} className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Name current workspace..."
            className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Current
          </button>
        </form>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="font-display text-base font-semibold text-slate-900">
            No saved projects yet
          </p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Create a drawing in the Solid Library or Projection Workspace and save it to continue editing later.
          </p>
          <button
            type="button"
            onClick={startNewDrawing}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
          >
            Create New Drawing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const solidItem = getSolidCatalogItem(proj.solidType);
            const isEditing = editingId === proj.id;

            return (
              <div
                key={proj.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameProject(proj.id, editValue);
                          setEditingId(null);
                        }}
                        className="flex items-center gap-1.5 w-full"
                      >
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          className="flex-1 px-2.5 py-1 text-xs border border-blue-500 rounded-md focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 text-xs font-medium bg-blue-700 text-white rounded-md cursor-pointer"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
                        {proj.name}
                      </h2>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {solidItem.name} · α {proj.orientation.alphaHP.toFixed(0)}° · β{' '}
                    {proj.orientation.betaVP.toFixed(0)}°
                  </div>

                  <div className="h-32 bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-center">
                    <SolidIsoPreview
                      solidType={proj.solidType}
                      dimensions={proj.dimensions}
                      size={115}
                    />
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Updated {new Date(proj.updatedAt).toLocaleDateString()} ·{' '}
                    {proj.drawingSettings.convention === 'first_angle'
                      ? 'First-Angle'
                      : 'Third-Angle'}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openProject(proj.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Open & Edit
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(proj.id);
                        setEditValue(proj.name);
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                      title="Rename project"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateProject(proj.id)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                      title="Duplicate project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(proj.id)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
