import { FileText, Microscope, BarChart3, Loader2, Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabId = 'content' | 'analyze' | 'results';

interface Tab {
  id: TabId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const tabs: Tab[] = [
  { id: 'content', icon: FileText, label: 'Content' },
  { id: 'analyze', icon: Microscope, label: 'Analyze' },
  { id: 'results', icon: BarChart3, label: 'Results' },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasContent: boolean;
  hasAnalysis: boolean;
  isAnalyzing: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  wordCount: number;
  lastSaved?: Date | null;
  onSave: () => void;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export function TabBar({
  activeTab,
  onTabChange,
  hasContent,
  hasAnalysis,
  isAnalyzing,
  isSaving,
  hasUnsavedChanges,
  wordCount,
  lastSaved,
  onSave,
}: TabBarProps) {
  const getTabDisabled = (tabId: TabId): boolean => {
    if (tabId === 'analyze') return !hasContent;
    if (tabId === 'results') return !hasAnalysis;
    return false;
  };

  return (
    <div className="h-11 bg-background border-b border-border flex items-center px-6 gap-1 shrink-0">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isDisabled = getTabDisabled(tab.id);

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-md',
              'border-none bg-transparent text-sm font-medium',
              'cursor-pointer transition-all duration-150',
              isActive && 'text-primary',
              !isActive && !isDisabled && 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
              isDisabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        );
      })}

      {/* Status */}
      <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
        {isAnalyzing && (
          <span className="flex items-center gap-1.5 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing...
          </span>
        )}
        
        {!isAnalyzing && hasContent && (
          <span>{wordCount} words</span>
        )}

        {lastSaved && (
          <span className="flex items-center gap-1">
            {hasUnsavedChanges ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                Unsaved
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-success" />
                Saved {formatTimeAgo(lastSaved)}
              </>
            )}
          </span>
        )}

        {hasUnsavedChanges && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-primary hover:bg-accent-muted transition-colors"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save
          </button>
        )}
      </div>
    </div>
  );
}
