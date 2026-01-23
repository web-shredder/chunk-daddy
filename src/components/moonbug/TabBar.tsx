import { FileText, Microscope, Target, Download, TrendingUp, Loader2, Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Updated tab IDs for 5-tab flow
export type TabId = 'content' | 'queries' | 'coverage' | 'downloads' | 'progress';

interface Tab {
  id: TabId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

// New 5-tab structure
const tabs: Tab[] = [
  { id: 'content', icon: FileText, label: 'Content' },
  { id: 'queries', icon: Microscope, label: 'Queries' },
  { id: 'coverage', icon: Target, label: 'Coverage' },
  { id: 'downloads', icon: Download, label: 'Downloads' },
  { id: 'progress', icon: TrendingUp, label: 'Progress' },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasContent: boolean;
  hasAnalysis: boolean;
  hasOptimizationResult: boolean;
  hasOutputs: boolean;
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
  hasOptimizationResult,
  hasOutputs,
  isAnalyzing,
  isSaving,
  hasUnsavedChanges,
  wordCount,
  lastSaved,
  onSave,
}: TabBarProps) {
  const isMobile = useIsMobile();

  // Updated validation for 5-tab flow
  const getTabDisabled = (tabId: TabId): boolean => {
    if (tabId === 'queries') return !hasContent;
    if (tabId === 'coverage') return !hasAnalysis;
    if (tabId === 'downloads') return !hasOutputs && !hasOptimizationResult;
    if (tabId === 'progress') return !hasOptimizationResult;
    return false;
  };

  return (
    <div className="h-11 bg-background border-b border-border flex items-center px-2 md:px-6 gap-0.5 md:gap-1 shrink-0 overflow-x-auto">
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
              'relative flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-2 rounded-md',
              'border-none bg-transparent text-xs md:text-sm font-medium',
              'cursor-pointer transition-all duration-150 shrink-0',
              isActive && 'text-primary',
              !isActive && !isDisabled && 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
              isDisabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className={cn(isMobile && 'sr-only')}>{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary" />
            )}
          </button>
        );
      })}

      {/* Status */}
      <div className="ml-auto flex items-center gap-2 md:gap-4 text-xs text-muted-foreground shrink-0">
        {isAnalyzing && (
          <span className="flex items-center gap-1.5 text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">Analyzing...</span>
          </span>
        )}
        
        {!isAnalyzing && hasContent && !isMobile && (
          <span>{wordCount} words</span>
        )}

        {lastSaved && !isMobile && (
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
            <span className="hidden sm:inline">Save</span>
          </button>
        )}
      </div>
    </div>
  );
}
