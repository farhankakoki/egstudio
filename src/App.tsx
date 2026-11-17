/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GuideView } from './components/guide/GuideView';
import { HomePage } from './components/home/HomePage';
import { TopNav } from './components/layout/TopNav';
import { LearnModeView } from './components/learn/LearnModeView';
import { IsometricModuleView } from './components/modules/IsometricModuleView';
import { LinesModuleView } from './components/modules/LinesModuleView';
import { SectionsModuleView } from './components/modules/SectionsModuleView';
import { ProjectsView } from './components/projects/ProjectsView';
import { SolidLibraryView } from './components/solid-selector/SolidLibraryView';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { useProjectStore } from './store/project-store';

export default function App() {
  const activeSection = useProjectStore((s) => s.activeSection);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav />
      <main className="flex-1">
        {activeSection === 'home' && <HomePage />}
        {activeSection === 'lines' && <LinesModuleView />}
        {activeSection === 'solids' && <SolidLibraryView />}
        {activeSection === 'sections' && <SectionsModuleView />}
        {activeSection === 'isometric' && <IsometricModuleView />}
        {activeSection === 'workspace' && <WorkspaceView />}
        {activeSection === 'learn' && <LearnModeView />}
        {activeSection === 'projects' && <ProjectsView />}
        {activeSection === 'guide' && <GuideView />}
      </main>
    </div>
  );
}
