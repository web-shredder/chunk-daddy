import { useState } from 'react';
import { Settings, ChevronDown, FolderOpen, LogOut, Loader2, Pencil, Trash2, Menu } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

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

  const ProjectSwitcher = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-md border border-border bg-transparent text-foreground text-xs md:text-sm cursor-pointer transition-all duration-150 hover:border-border-hover hover:bg-white/[0.03]">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[100px] md:max-w-[200px] truncate">{projectName}</span>
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
  );

  return (
    <>
      <header className="h-16 md:h-24 bg-surface border-b border-border flex items-center px-3 md:px-6 gap-3 md:gap-6 shrink-0">
        {/* Project Switcher */}
        <ProjectSwitcher />

        {/* Centered Logo */}
        <div className="flex-1 flex justify-center">
          <img
            alt="Chunk Daddy"
            className="h-12 md:h-20 object-contain"
            src="/lovable-uploads/c8eed07c-8b59-45e6-acf5-5605cf3054c6.png"
          />
        </div>

        {/* Desktop: User email */}
        {userEmail && !isMobile && (
          <span className="text-xs text-muted-foreground hidden md:block">
            {userEmail}
          </span>
        )}

        {/* Desktop: Settings */}
        {!isMobile && (
          <button className="icon-button" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
        )}

        {/* Desktop: Logout */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}

        {/* Mobile: Hamburger menu */}
        {isMobile && (
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button className="icon-button">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {userEmail && (
                  <div className="px-2 py-3 bg-muted/30 rounded-md">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium truncate">{userEmail}</p>
                  </div>
                )}
                <button 
                  className="flex items-center gap-3 w-full p-3 rounded-md hover:bg-muted/50 transition-colors text-left"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Settings</span>
                </button>
                <button 
                  className="flex items-center gap-3 w-full p-3 rounded-md hover:bg-muted/50 transition-colors text-left text-destructive"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignOut();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        )}
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
