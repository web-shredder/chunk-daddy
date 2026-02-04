import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, Bug, X, Download, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebug, type DebugEvent } from '@/contexts/DebugContext';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { FullOptimizationResult, ArchitectureAnalysis, ArchitectureTask, ContentBrief } from '@/lib/optimizer-types';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { QueryAssignmentMap } from '@/lib/query-assignment';

interface StreamingState {
  isStreaming: boolean;
  progress: number;
  currentStep: string;
  architectureTasksStreamed: number;
  chunksStreamed: number;
  briefsStreamed: number;
}

interface DebugPanelProps {
  activeTab: string;
  content: string;
  keywords: string[];
  layoutChunks: LayoutAwareChunk[];
  result: AnalysisResult | null;
  architectureAnalysis: ArchitectureAnalysis | null;
  architectureTasks: ArchitectureTask[];
  optimizationResult: FullOptimizationResult | null;
  optimizedContent: string;
  completedSteps: string[];
  queryAssignments?: QueryAssignmentMap | null;
  selectedArchitectureTasks?: ArchitectureTask[];
  applyArchitecture?: boolean;
  generateBriefs?: boolean;
  streaming?: StreamingState;
}

type TabType = 'state' | 'ui' | 'streaming' | 'events';

export function DebugPanel({
  activeTab,
  content,
  keywords,
  layoutChunks,
  result,
  architectureAnalysis,
  architectureTasks,
  optimizationResult,
  optimizedContent,
  completedSteps,
  queryAssignments,
  selectedArchitectureTasks,
  applyArchitecture,
  generateBriefs,
  streaming,
}: DebugPanelProps) {
  const { events, exportDebugData, clearDebug, isEnabled, setEnabled, logEvent } = useDebug();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<TabType>('state');
  
  // Toggle visibility with keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(v => !v);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Log tab transitions
  useEffect(() => {
    logEvent('TAB_TRANSITION', {
      content: content ? `${content.length} chars` : null,
      chunks: layoutChunks?.length || 0,
      queries: keywords?.length || 0,
      hasAnalysis: !!result,
      chunkScores: result?.chunkScores?.length || 0,
      documentChamfer: result?.documentChamfer?.toFixed(4) || 'N/A',
      hasArchitecture: !!architectureAnalysis,
      architectureTasks: architectureTasks?.length || 0,
      hasOptimization: !!optimizationResult,
      optimizedChunks: optimizationResult?.optimizedChunks?.length || 0,
      hasOptimizedContent: !!optimizedContent,
    });
  }, [activeTab]);

  // Build current state object for display
  const currentState = useMemo(() => ({
    activeTab,
    content,
    keywords,
    layoutChunks,
    result,
    architectureAnalysis,
    architectureTasks,
    optimizationResult,
    optimizedContent,
    completedSteps,
    queryAssignments,
    selectedArchitectureTasks,
    applyArchitecture,
    generateBriefs,
    streaming,
  }), [activeTab, content, keywords, layoutChunks, result, architectureAnalysis, architectureTasks, optimizationResult, optimizedContent, completedSteps, queryAssignments, selectedArchitectureTasks, applyArchitecture, generateBriefs, streaming]);

  const errorCount = events.filter(e => e.error).length;
  const streamingActive = streaming?.isStreaming || false;

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 h-8 px-2 gap-1.5 bg-background/80 backdrop-blur border shadow-lg hover:bg-accent font-mono text-xs"
        title="Show Debug Panel (Ctrl+Shift+D)"
      >
        <Bug className="h-4 w-4" />
        <span className="hidden sm:inline">Debug</span>
        {events.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            {events.length}
          </Badge>
        )}
        {errorCount > 0 && (
          <Badge variant="destructive" className="h-4 px-1 text-[10px]">
            {errorCount}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-lg transition-all duration-200",
      isExpanded ? "h-[400px]" : "h-[140px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <Bug className="h-4 w-4 text-primary" />
          <span className="text-sm font-mono font-medium">Debug Panel</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {activeTab}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {events.length} events
          </Badge>
          {errorCount > 0 && (
            <Badge variant="destructive" className="font-mono text-[10px]">
              {errorCount} errors
            </Badge>
          )}
          {streamingActive && (
            <Badge className="bg-primary text-primary-foreground text-[10px] animate-pulse">
              🔴 STREAMING {streaming?.progress}%
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={isEnabled}
              onCheckedChange={setEnabled}
              className="h-4 w-7"
            />
            <span className="text-[10px] text-muted-foreground">Log</span>
          </div>
          
          <Button variant="ghost" size="sm" onClick={exportDebugData} className="h-6 px-2 gap-1">
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline text-xs">Export</span>
          </Button>
          
          <Button variant="ghost" size="sm" onClick={clearDebug} className="h-6 px-2">
            <Trash2 className="h-3 w-3" />
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-6 px-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)} className="h-6 w-6 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/30 bg-muted/10">
        <TabButton active={activeSection === 'state'} onClick={() => setActiveSection('state')}>
          State
        </TabButton>
        <TabButton active={activeSection === 'ui'} onClick={() => setActiveSection('ui')}>
          UI Snapshot
        </TabButton>
        <TabButton active={activeSection === 'streaming'} onClick={() => setActiveSection('streaming')}>
          Streaming {streamingActive && '🔴'}
        </TabButton>
        <TabButton active={activeSection === 'events'} onClick={() => setActiveSection('events')}>
          Events ({events.length})
        </TabButton>
      </div>

      {/* Content */}
      <ScrollArea className={isExpanded ? "h-[300px]" : "h-[60px]"}>
        <div className="p-3">
          {activeSection === 'state' && <StateView state={currentState} />}
          {activeSection === 'ui' && <UISnapshotView state={currentState} />}
          {activeSection === 'streaming' && <StreamingView state={currentState} events={events} />}
          {activeSection === 'events' && <EventLogView events={events} />}
        </div>
      </ScrollArea>
    </div>
  );
}

// Tab Button
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 text-xs font-mono rounded transition-colors",
        active 
          ? "bg-primary text-primary-foreground" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

// State View
function StateView({ state }: { state: DebugPanelProps }) {
  const { content, keywords, layoutChunks, result, architectureAnalysis, architectureTasks, optimizationResult, optimizedContent, streaming } = state;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
      {/* Content */}
      <Section title="Content">
        <DataRow label="Length" value={content?.length || 0} />
        <DataRow label="Chunks" value={layoutChunks?.length || 0} />
        <DataRow label="Queries" value={keywords?.length || 0} />
        {keywords?.length > 0 && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {keywords.slice(0, 3).map((q: string, i: number) => (
              <div key={i} className="truncate">{q}</div>
            ))}
            {keywords.length > 3 && <div>+{keywords.length - 3} more</div>}
          </div>
        )}
      </Section>

      {/* Analysis */}
      <Section title="Analysis">
        <DataRow label="Has Result" value={!!result} />
        {result && (
          <>
            <DataRow label="Chunk Scores" value={result.chunkScores?.length || 0} />
            <DataRow label="Doc Chamfer" value={result.documentChamfer?.toFixed(3) || 'N/A'} />
            <DataRow label="Best Score" value={getBestScore(result)} />
            <DataRow label="Worst Score" value={getWorstScore(result)} />
          </>
        )}
      </Section>

      {/* Architecture */}
      <Section title="Architecture">
        <DataRow label="Has Analysis" value={!!architectureAnalysis} />
        {architectureAnalysis && (
          <>
            <DataRow label="Issues" value={architectureAnalysis.issues?.length || 0} />
            <DataRow label="Tasks" value={architectureTasks?.length || 0} />
            <DataRow label="Selected" value={architectureTasks?.filter(t => t.isSelected).length || 0} />
          </>
        )}
      </Section>

      {/* Optimization */}
      <Section title="Optimization">
        <DataRow label="Has Result" value={!!optimizationResult} />
        {optimizationResult && (
          <>
            <DataRow label="Opt Chunks" value={optimizationResult.optimizedChunks?.length || 0} />
            <DataRow label="Briefs" value={optimizationResult.contentBriefs?.length || 0} />
          </>
        )}
        <DataRow label="Opt Content" value={optimizedContent ? `${optimizedContent.length} chars` : 'none'} />
        {streaming?.isStreaming && (
          <>
            <DataRow label="Progress" value={`${streaming.progress}%`} highlight />
            <DataRow label="Step" value={streaming.currentStep} />
          </>
        )}
      </Section>
    </div>
  );
}

// UI Snapshot View
function UISnapshotView({ state }: { state: DebugPanelProps }) {
  const { activeTab, queryAssignments, applyArchitecture, generateBriefs, selectedArchitectureTasks, streaming, result } = state;
  
  const issues = detectIssues(state);
  
  return (
    <div className="space-y-4 text-xs font-mono">
      {/* Current Tab State */}
      <Section title={`Tab: ${activeTab}`}>
        {activeTab === 'optimize' && queryAssignments && (
          <>
            <DataRow label="Total Chunks" value={queryAssignments.chunkAssignments?.length || 0} />
            <DataRow label="Assigned Chunks" value={queryAssignments.chunkAssignments?.filter(ca => ca.assignedQuery).length || 0} />
            <DataRow label="Unassigned Queries" value={queryAssignments.unassignedQueries?.length || 0} />
            <DataRow label="Apply Architecture" value={applyArchitecture} />
            <DataRow label="Generate Briefs" value={generateBriefs} />
            <DataRow label="Arch Tasks" value={selectedArchitectureTasks?.length || 0} />
          </>
        )}
        {activeTab === 'results' && result && (
          <>
            <DataRow label="Chunk Scores" value={result.chunkScores?.length || 0} />
            <DataRow label="Avg Score" value={getAvgScore(result)} />
            <DataRow label="Coverage" value={result.coverageSummary ? `${result.coverageSummary.covered}/${result.coverageSummary.covered + result.coverageSummary.weak + result.coverageSummary.gaps}` : 'N/A'} />
          </>
        )}
        {activeTab === 'outputs' && streaming && (
          <>
            <DataRow label="Streaming" value={streaming.isStreaming} highlight={streaming.isStreaming} />
            <DataRow label="Progress" value={`${streaming.progress}%`} />
            <DataRow label="Arch Streamed" value={streaming.architectureTasksStreamed} />
            <DataRow label="Chunks Streamed" value={streaming.chunksStreamed} />
            <DataRow label="Briefs Streamed" value={streaming.briefsStreamed} />
          </>
        )}
      </Section>

      {/* User Expectations (Optimize tab) */}
      {activeTab === 'optimize' && queryAssignments && (
        <Section title="Expected Optimization">
          <div className="p-2 bg-muted/50 rounded text-[11px]">
            <p>• Optimize {queryAssignments.chunkAssignments?.filter(ca => ca.assignedQuery).length || 0} chunks</p>
            <p>• Apply {applyArchitecture ? (selectedArchitectureTasks?.length || 0) : 0} architecture fixes</p>
            <p>• Generate {generateBriefs ? (queryAssignments.unassignedQueries?.length || 0) : 0} content briefs</p>
          </div>
        </Section>
      )}

      {/* Issues */}
      <Section title="Detected Issues">
        {issues.length === 0 ? (
          <p className="text-accent">✓ No obvious issues</p>
        ) : (
          <div className="space-y-1">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-1 text-primary">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// Streaming View
function StreamingView({ state, events }: { state: DebugPanelProps; events: DebugEvent[] }) {
  const { streaming } = state;
  const streamingEvents = events.filter(e => 
    e.action.includes('STREAM') || e.action.includes('OPTIMIZATION') || e.action.includes('SSE')
  );

  return (
    <div className="space-y-4 text-xs font-mono">
      {/* Current Streaming State */}
      <Section title="Streaming Status">
        {streaming?.isStreaming ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-full bg-muted rounded h-2">
                <div 
                  className="bg-primary h-2 rounded transition-all" 
                  style={{ width: `${streaming.progress}%` }} 
                />
              </div>
              <span>{streaming.progress}%</span>
            </div>
            <DataRow label="Current Step" value={streaming.currentStep} highlight />
            <DataRow label="Arch Tasks" value={streaming.architectureTasksStreamed} />
            <DataRow label="Chunks" value={streaming.chunksStreamed} />
            <DataRow label="Briefs" value={streaming.briefsStreamed} />
          </>
        ) : (
          <p className="text-muted-foreground">No active streaming</p>
        )}
      </Section>

      {/* Streaming Events */}
      <Section title={`Streaming Events (${streamingEvents.length})`}>
        {streamingEvents.length === 0 ? (
          <p className="text-muted-foreground">No streaming events yet</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-auto">
            {streamingEvents.slice().reverse().slice(0, 20).map((event) => (
              <div key={event.id} className={cn(
                "p-1.5 rounded text-[10px]",
                event.error ? "bg-destructive/10 text-destructive" : "bg-muted/50"
              )}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{event.action}</span>
                  <span className="text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {Object.keys(event.data).length > 0 && (
                  <pre className="mt-1 text-[9px] text-muted-foreground overflow-hidden">
                    {JSON.stringify(event.data, null, 1).slice(0, 200)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// Event Log View
function EventLogView({ events }: { events: DebugEvent[] }) {
  const [filter, setFilter] = useState<'all' | 'errors' | 'streaming'>('all');
  
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filter === 'errors') return e.error;
      if (filter === 'streaming') return e.action.includes('STREAM') || e.action.includes('OPTIMIZATION');
      return true;
    });
  }, [events, filter]);

  return (
    <div className="space-y-2 text-xs font-mono">
      {/* Filter Tabs */}
      <div className="flex gap-1">
        <TabButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All ({events.length})
        </TabButton>
        <TabButton active={filter === 'errors'} onClick={() => setFilter('errors')}>
          Errors ({events.filter(e => e.error).length})
        </TabButton>
        <TabButton active={filter === 'streaming'} onClick={() => setFilter('streaming')}>
          Streaming
        </TabButton>
      </div>

      {/* Event List */}
      <div className="space-y-1 max-h-60 overflow-auto">
        {filteredEvents.slice().reverse().map((event) => (
          <div key={event.id} className={cn(
            "p-2 rounded",
            event.error ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                {event.tab}
              </Badge>
              <span className="font-medium">{event.action}</span>
              <span className="text-muted-foreground ml-auto">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              {event.error && <Badge variant="destructive" className="text-[9px]">ERROR</Badge>}
            </div>
            {Object.keys(event.data).length > 0 && (
              <details className="text-[10px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Data
                </summary>
                <pre className="mt-1 p-1 bg-background rounded overflow-auto max-h-20">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </details>
            )}
            {Object.keys(event.uiState).length > 0 && (
              <details className="text-[10px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  UI State
                </summary>
                <pre className="mt-1 p-1 bg-background rounded overflow-auto max-h-20">
                  {JSON.stringify(event.uiState, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper Components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DataRow({ label, value, highlight, warn }: { 
  label: string; 
  value: unknown; 
  highlight?: boolean;
  warn?: boolean;
}) {
  const displayValue = typeof value === 'boolean' 
    ? (value ? '✓ YES' : '✗ NO') 
    : String(value);
  
  const valueClass = highlight 
    ? 'text-primary font-bold' 
    : warn 
    ? 'text-yellow-500'
    : typeof value === 'boolean'
    ? value ? 'text-green-500' : 'text-red-400'
    : 'text-foreground';

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className={valueClass}>{displayValue}</span>
    </div>
  );
}

// Helper functions
function getBestScore(result: AnalysisResult | null): string {
  if (!result?.chunkScores) return 'N/A';
  const scores = result.chunkScores.flatMap(cs => 
    cs.keywordScores?.map(ks => {
      const cosine = ks.scores?.cosine || 0;
      return cosine * 100;
    }) || []
  ).filter(s => typeof s === 'number');
  return scores.length > 0 ? Math.max(...scores).toFixed(1) : 'N/A';
}

function getWorstScore(result: AnalysisResult | null): string {
  if (!result?.chunkScores) return 'N/A';
  const scores = result.chunkScores.flatMap(cs => 
    cs.keywordScores?.map(ks => {
      const cosine = ks.scores?.cosine || 0;
      return cosine * 100;
    }) || []
  ).filter(s => typeof s === 'number');
  return scores.length > 0 ? Math.min(...scores).toFixed(1) : 'N/A';
}

function getAvgScore(result: AnalysisResult | null): string {
  if (!result?.chunkScores) return 'N/A';
  const scores = result.chunkScores.flatMap(cs => 
    cs.keywordScores?.map(ks => {
      const cosine = ks.scores?.cosine || 0;
      return cosine * 100;
    }) || []
  ).filter(s => typeof s === 'number');
  if (scores.length === 0) return 'N/A';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return avg.toFixed(1);
}

function detectIssues(state: DebugPanelProps): string[] {
  const issues: string[] = [];
  
  if (!state.content) issues.push('No content loaded');
  if (state.keywords?.length === 0) issues.push('No queries added');
  if (state.activeTab === 'results' && !state.result) issues.push('In Results tab but no analysis');
  if (state.activeTab === 'optimize' && !state.queryAssignments) issues.push('In Optimize tab but no assignments');
  if (state.streaming?.isStreaming && state.streaming.progress === 0) issues.push('Streaming at 0% progress');
  if (state.optimizationResult && !state.optimizedContent) issues.push('Has opt result but no opt content');
  
  return issues;
}

export default DebugPanel;
