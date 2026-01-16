import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  FolderOpen,
  Loader2,
  FileText,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { ProjectSummary } from '@/lib/project-types';

interface ProjectManagerProps {
  projects: ProjectSummary[];
  isLoading: boolean;
  currentProjectId?: string;
  onLoadProject: (projectId: string) => Promise<void>;
  onRenameProject: (projectId: string, newName: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onNewProject: () => void;
}

interface ProjectListItemProps {
  project: ProjectSummary;
  isActive: boolean;
  onLoad: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

function ProjectListItem({
  project,
  isActive,
  onLoad,
  onRename,
  onDelete,
}: ProjectListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.project_name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveRename = () => {
    if (editName.trim() && editName !== project.project_name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(project.project_name);
    setIsEditing(false);
  };

  return (
    <>
      <div
        className={`p-4 rounded-lg border transition-colors ${
          isActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') handleCancelRename();
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={handleSaveRename}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCancelRename}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h4 className="font-medium text-sm truncate">
                {project.project_name}
              </h4>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Updated {formatDistanceToNow(new Date(project.updated_at))} ago
            </p>
            <p className="text-xs text-muted-foreground">
              {project.queries?.length || 0} queries
            </p>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={onLoad}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Load
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.project_name}". This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
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

export function ProjectManager({
  projects,
  isLoading,
  currentProjectId,
  onLoadProject,
  onRenameProject,
  onDeleteProject,
  onNewProject,
}: ProjectManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLoad = async (projectId: string) => {
    await onLoadProject(projectId);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Your Projects</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Projects</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Button
            onClick={() => {
              onNewProject();
              setIsOpen(false);
            }}
            variant="outline"
            className="w-full"
          >
            + New Project
          </Button>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No saved projects yet</p>
              <p className="text-xs mt-1">
                Your work will be saved automatically
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {projects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isActive={project.id === currentProjectId}
                    onLoad={() => handleLoad(project.id)}
                    onRename={(newName) => onRenameProject(project.id, newName)}
                    onDelete={() => onDeleteProject(project.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
