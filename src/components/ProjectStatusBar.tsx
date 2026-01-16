import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Save, Pencil, Check, X, Loader2, Cloud, CloudOff } from 'lucide-react';

interface ProjectStatusBarProps {
  projectName: string;
  onRename: (newName: string) => void;
  onSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
}

export function ProjectStatusBar({
  projectName,
  onRename,
  onSave,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
}: ProjectStatusBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(projectName);
  const [, setTick] = useState(0);

  // Update edit name when project changes
  useEffect(() => {
    setEditName(projectName);
  }, [projectName]);

  // Force re-render for relative time updates
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveRename = () => {
    if (editName.trim() && editName !== projectName) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(projectName);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg border">
      {/* Project Name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm max-w-[200px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleSaveRename}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleCancelRename}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 text-sm font-medium truncate hover:text-primary transition-colors group"
          >
            <span className="truncate">{projectName || 'Untitled Project'}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Save Status */}
      <div className="flex items-center gap-2">
        {hasUnsavedChanges ? (
          <Badge variant="outline" className="text-xs gap-1 text-yellow-600 border-yellow-300">
            <CloudOff className="h-3 w-3" />
            Unsaved
          </Badge>
        ) : lastSavedAt ? (
          <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-300">
            <Cloud className="h-3 w-3" />
            Saved {formatDistanceToNow(lastSavedAt)} ago
          </Badge>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="h-7 px-2 text-xs"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
