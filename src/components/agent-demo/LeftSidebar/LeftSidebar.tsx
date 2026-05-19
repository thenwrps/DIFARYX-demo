import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Database,
  FileText,
  History,
  Layers,
  Settings,
} from 'lucide-react';
import type { DemoDataset, DemoProject } from '../../../data/demoProjects';
import { getWorkspaceRoute } from '../../../data/demoProjects';

interface LeftSidebarProps {
  currentDataset: DemoDataset;
  currentProject: DemoProject;
  onNavigate?: (route: string) => void;
  uploadedEvidenceSearch?: string;
  uploadedTechnique?: string;
}

export function LeftSidebar({
  currentDataset,
  currentProject,
  uploadedEvidenceSearch,
  uploadedTechnique,
}: LeftSidebarProps) {
  const workspaceRoute = getWorkspaceRoute(
    currentProject,
    currentDataset.technique,
    currentDataset.id
  );
  const workspaceDemoRoute = workspaceRoute.includes('?')
    ? `${workspaceRoute}&mode=demo`
    : `${workspaceRoute}?mode=demo`;

  const multiTechRoute = `/workspace/multi?project=${currentProject.id}&mode=demo`;
  const notebookRoute = uploadedEvidenceSearch
    ? `/notebook?${uploadedEvidenceSearch}&template=research`
    : `/notebook?project=${currentProject.id}&mode=demo`;
  const reportRoute = uploadedEvidenceSearch
    ? `/report?${uploadedEvidenceSearch}&template=xrd-summary`
    : `/reports?project=${currentProject.id}&mode=demo`;
  const agentRoute = uploadedEvidenceSearch
    ? `/demo/agent?${uploadedEvidenceSearch}`
    : `/demo/agent?project=${currentProject.id}&mode=demo`;
  const dataRoute = uploadedEvidenceSearch
    ? `/workspace/${uploadedTechnique ?? currentDataset.technique.toLowerCase()}?mode=quick&${uploadedEvidenceSearch}`
    : workspaceDemoRoute;
  const workflowRoute = uploadedEvidenceSearch
    ? `/workspace/${uploadedTechnique ?? currentDataset.technique.toLowerCase()}?mode=quick&${uploadedEvidenceSearch}`
    : multiTechRoute;

  return (
    <aside className="flex w-[72px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <nav className="flex-1 space-y-1 p-4">
        <NavItem
          icon={Activity}
          label="Agent Workspace"
          to={agentRoute}
          active
        />
        <NavItem
          icon={Layers}
          label="Workflows"
          to={workflowRoute}
        />
        <NavItem
          icon={Database}
          label="Data"
          to={dataRoute}
        />
        <NavItem
          icon={BookOpen}
          label="Notebook"
          to={notebookRoute}
        />
        <NavItem
          icon={FileText}
          label="Report"
          to={reportRoute}
        />
        <NavItem
          icon={History}
          label="History"
          to="/history?mode=demo"
        />
        <NavItem
          icon={Settings}
          label="Settings"
          to="/settings"
        />
      </nav>

      <div className="border-t border-slate-200 p-3">
        <div className="flex flex-col items-center gap-1">
          <div
            className="h-2 w-2 rounded-full bg-emerald-500"
            title="System Online"
          />
          <span className="text-[9px] font-semibold text-slate-500">Online</span>
        </div>
      </div>
    </aside>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  to: string;
}

function NavItem({ icon: Icon, label, active, to }: NavItemProps) {
  const className = `flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-blue-600 text-white'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;

  return (
    <Link to={to} className={className} title={label} aria-label={label}>
      <Icon size={18} className="shrink-0" />
    </Link>
  );
}
