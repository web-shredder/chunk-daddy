import { useState } from 'react';
import { Settings, ChevronDown, FolderOpen, LogOut, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TopBarProps {
  projectName: string;
  projects: Array<{
    id: string;
    project_name: string;
  }>;
  currentProjectId?: string;
  isLoading?: boolean;
  userEmail?: string;
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  onSignOut: () => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onDeleteProject?: (projectId: string) => void;
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
  onRenameProject,
  onDeleteProject,
}: TopBarProps) {
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [projectToRename, setProjectToRename] = useState<{ id: string; name: string } | null>(null);

  const handleOpenRename = (projectId: string, projectName: string) => {
    setProjectToRename({ id: projectId, name: projectName });
    setNewName(projectName);
    setIsRenameOpen(true);
  };

  const handleRename = () => {
    if (newName.trim() && projectToRename && onRenameProject) {
      onRenameProject(projectToRename.id, newName.trim());
      setIsRenameOpen(false);
      setProjectToRename(null);
    }
  };

  const handleOpenDelete = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (projectToDelete && onDeleteProject) {
      onDeleteProject(projectToDelete.id);
      setIsDeleteOpen(false);
      setProjectToDelete(null);
    }
  };

  return (
    <>
      <header className="h-14 bg-surface border-b border-border flex items-center px-6 gap-6 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img
            alt="Chunk Daddy"
            className="w-20 h-12 rounded object-contain"
            src="/lovable-uploads/c8eed07c-8b59-45e6-acf5-5605cf3054c6.png"
          />
          <span className="text-base font-semibold text-foreground"></span>
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
                  <div
                    key={project.id}
                    className={`flex items-center group ${project.id === currentProjectId ? 'bg-accent-muted' : ''}`}
                  >
                    <DropdownMenuItem
                      onClick={() => onSelectProject(project.id)}
                      className="flex-1"
                    >
                      <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="truncate flex-1">{project.project_name}</span>
                    </DropdownMenuItem>
                    <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onRenameProject && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRename(project.id, project.project_name);
                          }}
                          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDeleteProject && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDelete(project.id, project.project_name);
                          }}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
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

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={(open) => {
        setIsRenameOpen(open);
        if (!open) setProjectToRename(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRename();
                }
              }}
              placeholder="Project name"
              className="moonbug-input"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => {
        setIsDeleteOpen(open);
        if (!open) setProjectToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
