import { useState, useMemo } from 'react';
import { FileBarChart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReportSummary, ReportActionItems, ReportExports, type ActionItem, type ActionItems } from './report';
import { getTierFromScore } from '@/lib/tier-colors';
import type { FullOptimizationResult, ContentBrief } from '@/lib/optimizer-types';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface ReportTabProps {
  hasOptimizationResult: boolean;
  optimizationResult: FullOptimizationResult | null;
  optimizedContent: string;
  originalContent: string;
  keywords: string[];
  layoutChunks?: LayoutAwareChunk[];
  onApplyContent: (content: string) => void;
  onGoToOptimize: () => void;
  onReanalyze: () => void;
  onSaveProject?: () => void;
  projectName?: string;
  onNavigateToOutputs?: (chunkIndex?: number) => void;
}

export function ReportTab({
  hasOptimizationResult,
  optimizationResult,
  optimizedContent,
  originalContent,
  keywords,
  layoutChunks,
  onApplyContent,
  onGoToOptimize,
  onReanalyze,
  onSaveProject,
  projectName,
  onNavigateToOutputs,
}: ReportTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('summary');

  // Calculate action items
  const actionItems = useMemo<ActionItems>(() => {
    if (!optimizationResult) return { critical: [], recommended: [], optional: [] };
    
    const critical: ActionItem[] = [];
    const recommended: ActionItem[] = [];
    const optional: ActionItem[] = [];
    
    // Check for score decreases and weak scores
    optimizationResult.optimizedChunks?.forEach((chunk, index) => {
      const origScores = optimizationResult.originalFullScores?.[index] || {};
      const optScores = optimizationResult.optimizedFullScores?.[index] || {};
      
      let totalOrig = 0;
      let totalOpt = 0;
      let count = 0;
      
      Object.keys(optScores).forEach(query => {
        if (origScores[query]) {
          totalOrig += origScores[query].passageScore;
          totalOpt += optScores[query].passageScore;
          count++;
        }
      });
      
      if (count > 0) {
        const avgOriginal = Math.round(totalOrig / count);
        const avgOptimized = Math.round(totalOpt / count);
        const scoreDelta = avgOptimized - avgOriginal;
        
        if (scoreDelta < -2) {
          critical.push({
            type: 'score_decrease',
            title: `Chunk ${index + 1} score decreased`,
            description: `Score went from ${avgOriginal} to ${avgOptimized} (${scoreDelta}). Review and possibly reject.`,
            chunkIndex: index,
          });
        } else if (avgOptimized < 60 && avgOptimized >= 40) {
          recommended.push({
            type: 'weak_score',
            title: `Chunk ${index + 1} still underperforming`,
            description: `Score is ${avgOptimized} (${getTierFromScore(avgOptimized)} tier). May need manual rewrite.`,
            chunkIndex: index,
          });
        }
      }
    });
    
    // Check for content briefs (critical)
    optimizationResult.contentBriefs?.forEach((brief: ContentBrief) => {
      critical.push({
        type: 'content_gap',
        title: `Create content for: "${brief.targetQuery}"`,
        description: 'No existing content addresses this query. Brief generated.',
        brief,
      });
    });
    
    // Check for large chunks (optional)
    layoutChunks?.forEach((chunk, index) => {
      if (chunk.metadata.tokenEstimate > 600) {
        optional.push({
          type: 'large_chunk',
          title: `Consider splitting Chunk ${index + 1}`,
          description: `${chunk.metadata.tokenEstimate} tokens, may have mixed topics.`,
          chunkIndex: index,
        });
      }
    });
    
    return { critical, recommended, optional };
  }, [optimizationResult, layoutChunks]);

  const criticalCount = actionItems.critical.length;

  // Empty state
  if (!hasOptimizationResult || !optimizationResult) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <FileBarChart className="h-12 w-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No optimization results yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Run optimization from the Optimization tab to generate a report.
          </p>
          <Button onClick={onGoToOptimize} variant="outline">
            Go to Optimization →
          </Button>
        </div>
      </div>
    );
  }

  const handleNavigateToChunk = (chunkIndex: number) => {
    if (onNavigateToOutputs) {
      onNavigateToOutputs(chunkIndex);
    }
  };

  const handleViewBrief = (brief: ContentBrief) => {
    // For now, just navigate to outputs. Could open a modal in future.
    if (onNavigateToOutputs) {
      onNavigateToOutputs();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="min-h-12 md:h-14 px-4 md:px-6 py-2 md:py-0 border-b border-border flex items-center justify-between gap-2 bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileBarChart className="h-4 w-4 text-accent" />
            Final Report
          </h3>
          <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
            {new Date(optimizationResult.timestamp).toLocaleDateString()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onSaveProject && (
            <Button size="sm" onClick={onSaveProject}>
              Save Project
            </Button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="h-full flex flex-col">
          <div className="px-4 md:px-6 pt-4 border-b border-border">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="summary" className="text-xs md:text-sm">
                Summary
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs md:text-sm relative">
                Action Items
                {criticalCount > 0 && (
                  <Badge 
                    className="ml-2 h-5 min-w-5 px-1.5 text-[10px] bg-[hsl(var(--destructive))] text-white border-0"
                  >
                    {criticalCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="exports" className="text-xs md:text-sm">
                Exports
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6 max-w-4xl">
              <TabsContent value="summary" className="mt-0">
                <ReportSummary optimizationResult={optimizationResult} />
              </TabsContent>

              <TabsContent value="actions" className="mt-0">
                <ReportActionItems
                  actionItems={actionItems}
                  onNavigateToChunk={handleNavigateToChunk}
                  onViewBrief={handleViewBrief}
                />
              </TabsContent>

              <TabsContent value="exports" className="mt-0">
                <ReportExports
                  content={originalContent}
                  optimizedContent={optimizedContent}
                  optimizationResult={optimizationResult}
                  keywords={keywords}
                  projectName={projectName}
                />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
