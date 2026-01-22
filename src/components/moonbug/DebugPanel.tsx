import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Bug, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalysisResult } from '@/hooks/useAnalysis';
import type { FullOptimizationResult, ArchitectureAnalysis, ArchitectureTask } from '@/lib/optimizer-types';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

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
  isStreamingOptimization?: boolean;
  streamingStep?: string;
  streamingProgress?: number;
}

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
  isStreamingOptimization,
  streamingStep,
  streamingProgress,
}: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
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
    console.log(`\n=== TAB TRANSITION: ${activeTab} ===`);
    console.log('Data availability:');
    console.log({
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
    
    // Check for data loss warnings
    if (activeTab === 'results' && !result) {
      console.warn('⚠️ User in Results tab but no analysis result!');
    }
    if (activeTab === 'optimize' && !result?.chunkScores) {
      console.warn('⚠️ User in Optimize tab but no chunk scores from analysis!');
    }
    if (activeTab === 'architecture' && architectureAnalysis) {
      console.log('✓ Architecture data preserved:', {
        issuesCount: architectureAnalysis.issues?.length,
        tasksCount: architectureTasks?.length,
      });
    }
    if (activeTab === 'outputs' && isStreamingOptimization) {
      console.log('📡 Streaming optimization in progress:', {
        step: streamingStep,
        progress: streamingProgress,
      });
    }
  }, [activeTab, content, keywords, layoutChunks, result, architectureAnalysis, architectureTasks, optimizationResult, optimizedContent, isStreamingOptimization, streamingStep, streamingProgress]);

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 h-8 w-8 p-0 bg-background/80 backdrop-blur border shadow-lg hover:bg-accent"
        title="Show Debug Panel (Ctrl+Shift+D)"
      >
        <Bug className="h-4 w-4" />
      </Button>
    );
  }

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <Badge 
      variant={ok ? "default" : "secondary"} 
      className={cn(
        "text-[10px] px-1.5 py-0 h-4",
        ok ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </Badge>
  );

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-lg transition-all duration-200",
      isExpanded ? "h-[280px]" : "h-[80px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-3">
          <Bug className="h-4 w-4 text-primary" />
          <span className="text-sm font-mono font-medium">Debug Panel</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            Tab: {activeTab}
          </Badge>
          {isStreamingOptimization && (
            <Badge variant="default" className="bg-primary text-primary-foreground text-[10px] animate-pulse">
              Streaming: {streamingProgress}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Summary Row (always visible) */}
      <div className="px-4 py-2 flex items-center gap-6 text-xs font-mono overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Content:</span>
          <StatusBadge ok={!!content} label={content ? `${content.length} chars` : 'empty'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Chunks:</span>
          <StatusBadge ok={layoutChunks?.length > 0} label={String(layoutChunks?.length || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Queries:</span>
          <StatusBadge ok={keywords?.length > 0} label={String(keywords?.length || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Analysis:</span>
          <StatusBadge ok={!!result} label={result ? `${result.chunkScores?.length || 0} scores` : 'none'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Architecture:</span>
          <StatusBadge ok={!!architectureAnalysis} label={architectureAnalysis ? `${architectureAnalysis.issues?.length || 0} issues` : 'none'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Optimization:</span>
          <StatusBadge ok={!!optimizationResult} label={optimizationResult ? `${optimizationResult.optimizedChunks?.length || 0} chunks` : 'none'} />
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <ScrollArea className="h-[180px] px-4">
          <div className="grid grid-cols-3 gap-4 py-2 text-xs font-mono">
            {/* Column 1: Content & Chunks */}
            <div className="space-y-2">
              <h4 className="font-semibold text-muted-foreground uppercase text-[10px]">Content</h4>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Length:</span> {content?.length || 0} chars</p>
                <p><span className="text-muted-foreground">Chunks:</span> {layoutChunks?.length || 0}</p>
                <p><span className="text-muted-foreground">Queries:</span> {keywords?.length || 0}</p>
                {keywords?.length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground max-h-[60px] overflow-y-auto">
                    {keywords.slice(0, 5).map((q, i) => (
                      <p key={i} className="truncate">{i + 1}. {q}</p>
                    ))}
                    {keywords.length > 5 && <p>...and {keywords.length - 5} more</p>}
                  </div>
                )}
              </div>
            </div>
            
            {/* Column 2: Analysis */}
            <div className="space-y-2">
              <h4 className="font-semibold text-muted-foreground uppercase text-[10px]">Analysis</h4>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Has Result:</span> {result ? 'YES' : 'NO'}</p>
                {result && (
                  <>
                    <p><span className="text-muted-foreground">Chunk Scores:</span> {result.chunkScores?.length || 0}</p>
                    <p><span className="text-muted-foreground">Doc Chamfer:</span> {result.documentChamfer?.toFixed(4) || 'N/A'}</p>
                    <p><span className="text-muted-foreground">Coverage:</span> {result.coverageMap?.length || 0} entries</p>
                    {result.coverageSummary && (
                      <p className="text-[10px]">
                        <span className="text-muted-foreground">Status:</span>{' '}
                        {result.coverageSummary.covered} covered, {result.coverageSummary.weak} weak, {result.coverageSummary.gaps} gaps
                      </p>
                    )}
                  </>
                )}
              </div>
              
              <h4 className="font-semibold text-muted-foreground uppercase text-[10px] mt-3">Architecture</h4>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Has Analysis:</span> {architectureAnalysis ? 'YES' : 'NO'}</p>
                {architectureAnalysis && (
                  <>
                    <p><span className="text-muted-foreground">Issues:</span> {architectureAnalysis.issues?.length || 0}</p>
                    <p><span className="text-muted-foreground">Tasks:</span> {architectureTasks?.length || 0}</p>
                    <p><span className="text-muted-foreground">Selected:</span> {architectureTasks?.filter(t => t.isSelected).length || 0}</p>
                  </>
                )}
              </div>
            </div>
            
            {/* Column 3: Optimization */}
            <div className="space-y-2">
              <h4 className="font-semibold text-muted-foreground uppercase text-[10px]">Optimization</h4>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Has Result:</span> {optimizationResult ? 'YES' : 'NO'}</p>
                {optimizationResult && (
                  <>
                    <p><span className="text-muted-foreground">Optimized Chunks:</span> {optimizationResult.optimizedChunks?.length || 0}</p>
                    <p><span className="text-muted-foreground">All Orig Chunks:</span> {optimizationResult.allOriginalChunks?.length || 0}</p>
                    <p><span className="text-muted-foreground">Content Briefs:</span> {optimizationResult.contentBriefs?.length || 0}</p>
                    <p><span className="text-muted-foreground">Explanations:</span> {optimizationResult.explanations?.length || 0}</p>
                  </>
                )}
                <p><span className="text-muted-foreground">Optimized Content:</span> {optimizedContent ? `${optimizedContent.length} chars` : 'none'}</p>
              </div>
              
              <h4 className="font-semibold text-muted-foreground uppercase text-[10px] mt-3">Workflow</h4>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Completed Steps:</span></p>
                <p className="text-[10px] break-words">{completedSteps.join(', ') || 'none'}</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
