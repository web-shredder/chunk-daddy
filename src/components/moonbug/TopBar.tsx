import { useState } from 'react';
import { Settings, ChevronDown, FolderOpen, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import chunkDaddyMascot from '@/assets/chunk-daddy.png';

interface TopBarProps {
  projectName: string;
  projects: Array<{ id: string; project_name: string }>;
  currentProjectId?: string;
  isLoading?: boolean;
  userEmail?: string;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onSignOut: () => void;
}

export function TopBar({
  projectName,
  projects,
  currentProjectId,
  isLoading,
  userEmail,
  onSelectProject,
  onNewProject,
  onSignOut,
}: TopBarProps) {
  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-6 gap-6 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img 
          src={chunkDaddyMascot} 
          alt="Chunk Daddy" 
          className="w-7 h-7 rounded object-contain"
        />
        <span className="text-base font-semibold text-foreground">
          Chunk Daddy
        </span>
      </div>

      {/* Project Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-transparent text-foreground text-sm cursor-pointer transition-all duration-150 hover:border-border-hover hover:bg-white/[0.03]">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[200px] truncate">{projectName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 bg-elevated">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={project.id === currentProjectId ? 'bg-accent-muted' : ''}
                >
                  <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{project.project_name}</span>
                </DropdownMenuItem>
              ))}
              {projects.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={onNewProject}>
                <span className="text-primary">+ New Project</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User email */}
      {userEmail && (
        <span className="text-xs text-muted-foreground hidden md:block">
          {userEmail}
        </span>
      )}

      {/* Settings */}
      <button className="icon-button" title="Settings">
        <Settings className="h-4 w-4" />
      </button>

      {/* Logout */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onSignOut}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
