import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  FileText, 
  Wrench, 
  ChevronDown,
  ChevronRight,
  Loader2,
  Copy,
  Download,
  ArrowRight,
  Sparkles,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { 
  ArchitectureTask,
  ContentBrief,
} from '@/lib/optimizer-types';
import { toast } from 'sonner';

interface StreamedChunk {
  chunk_number: number;
  original_text: string;
  optimized_text: string;
  assignedQuery?: string;
  heading?: string;
  originalScore?: number;
  optimizedScore?: number;
  scoreChange?: number;
  explanation?: string;
}

interface OutputsTabProps {
  // Streaming state
  isOptimizing: boolean;
  currentStep: string;
  progress: number;
  
  // Incremental results (populated as they stream in)
  appliedArchitectureTasks: ArchitectureTask[];
  optimizedChunks: StreamedChunk[];
  generatedBriefs: ContentBrief[];
  
  // Actions
  onApplyChanges: () => void;
  onCopyContent: () => void;
  onExportReport: () => void;
  onGoToOptimize: () => void;
}

export function OutputsTab({
  isOptimizing,
  currentStep,
  progress,
  appliedArchitectureTasks,
  optimizedChunks,
  generatedBriefs,
  onApplyChanges,
  onCopyContent,
  onExportReport,
  onGoToOptimize,
}: OutputsTabProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    architecture: true,
    chunks: true,
    briefs: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasAnyOutput = appliedArchitectureTasks.length > 0 || 
                       optimizedChunks.length > 0 || 
                       generatedBriefs.length > 0;

  const isComplete = !isOptimizing && hasAnyOutput;
  
  // Calculate summary stats
  const chunksImproved = optimizedChunks.filter(c => (c.scoreChange || 0) > 0).length;
  const chunksDeclined = optimizedChunks.filter(c => (c.scoreChange || 0) < 0).length;
  const avgScoreBefore = optimizedChunks.length > 0 
    ? Math.round(optimizedChunks.reduce((sum, c) => sum + (c.originalScore || 0), 0) / optimizedChunks.length)
    : 0;
  const avgScoreAfter = optimizedChunks.length > 0
    ? Math.round(optimizedChunks.reduce((sum, c) => sum + (c.optimizedScore || 0), 0) / optimizedChunks.length)
    : 0;

  return (
    <div className="flex-1 overflow-auto">
      <ScrollArea className="h-full">
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          
          {/* ============ PROGRESS HEADER ============ */}
          {isOptimizing && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    <div>
                      <p className="font-medium text-sm">{currentStep}</p>
                      <p className="text-xs text-muted-foreground">
                        Processing optimization...
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-mono text-accent">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* ============ NO OUTPUT YET ============ */}
          {!hasAnyOutput && !isOptimizing && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">No outputs yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Go to the Optimize tab and run optimization to see results here.
                </p>
                <Button variant="outline" onClick={onGoToOptimize}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Optimize
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ============ ARCHITECTURE OUTPUTS ============ */}
          {appliedArchitectureTasks.length > 0 && (
            <Collapsible open={expandedSections.architecture} onOpenChange={() => toggleSection('architecture')}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {expandedSections.architecture ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        Architecture Fixes Applied
                      </CardTitle>
                      <Badge variant="secondary">
                        {appliedArchitectureTasks.length} applied
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    {appliedArchitectureTasks.map((task, idx) => (
                      <div key={task.id || idx} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <Badge variant="outline" className="text-xs">
                            {task.type.replace(/_/g, ' ')}
                          </Badge>
                          <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-sm">{task.description}</p>
                        {task.location?.position && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Location: {task.location.position}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* ============ OPTIMIZED CHUNKS ============ */}
          {optimizedChunks.length > 0 && (
            <Collapsible open={expandedSections.chunks} onOpenChange={() => toggleSection('chunks')}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {expandedSections.chunks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Sparkles className="h-4 w-4 text-accent" />
                        Optimized Chunks
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {isComplete && avgScoreBefore > 0 && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {avgScoreBefore} → {avgScoreAfter}
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {optimizedChunks.length} chunks
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {optimizedChunks.map((chunk, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "p-4 rounded-lg border",
                          (chunk.scoreChange || 0) > 0 && "border-green-200 bg-green-50/30 dark:bg-green-950/20 dark:border-green-800/50",
                          (chunk.scoreChange || 0) < 0 && "border-red-200 bg-red-50/30 dark:bg-red-950/20 dark:border-red-800/50",
                          (chunk.scoreChange || 0) === 0 && "border-border"
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Chunk {chunk.chunk_number}</span>
                            {chunk.heading && (
                              <span className="text-sm text-muted-foreground">
                                — {chunk.heading}
                              </span>
                            )}
                          </div>
                          {chunk.originalScore !== undefined && chunk.optimizedScore !== undefined && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground font-mono">{chunk.originalScore}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge variant={(chunk.scoreChange || 0) > 0 ? 'default' : (chunk.scoreChange || 0) < 0 ? 'destructive' : 'secondary'}>
                                {chunk.optimizedScore}
                              </Badge>
                              <span className={cn(
                                "text-xs font-medium",
                                (chunk.scoreChange || 0) > 0 && "text-green-600",
                                (chunk.scoreChange || 0) < 0 && "text-red-600"
                              )}>
                                {(chunk.scoreChange || 0) > 0 ? '+' : ''}{chunk.scoreChange || 0}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Query */}
                        {chunk.assignedQuery && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Query: "{chunk.assignedQuery}"
                          </p>
                        )}

                        {/* Before/After */}
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Before</p>
                            <div className="p-2 rounded bg-muted/50 text-xs max-h-32 overflow-y-auto">
                              {chunk.original_text?.slice(0, 400)}
                              {(chunk.original_text?.length || 0) > 400 && '...'}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">After</p>
                            <div className="p-2 rounded bg-accent/10 text-xs max-h-32 overflow-y-auto">
                              {chunk.optimized_text?.slice(0, 400)}
                              {(chunk.optimized_text?.length || 0) > 400 && '...'}
                            </div>
                          </div>
                        </div>

                        {/* Explanation */}
                        {chunk.explanation && (
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            Why this helps: {chunk.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* ============ CONTENT BRIEFS ============ */}
          {generatedBriefs.length > 0 && (
            <Collapsible open={expandedSections.briefs} onOpenChange={() => toggleSection('briefs')}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {expandedSections.briefs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <FileText className="h-4 w-4 text-orange-500" />
                        Content Briefs (New Sections to Write)
                      </CardTitle>
                      <Badge variant="secondary">
                        {generatedBriefs.length} briefs
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {generatedBriefs.map((brief, idx) => (
                      <div key={idx} className="p-4 rounded-lg border border-orange-200/50 bg-orange-50/30 dark:bg-orange-950/20 dark:border-orange-800/30">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium">{brief.suggestedHeading}</p>
                          <Badge variant="outline" className="text-xs">
                            ~{brief.targetWordCount?.min || 300}-{brief.targetWordCount?.max || 500} words
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-2">
                          For query: "{brief.targetQuery}"
                        </p>
                        
                        <p className="text-xs text-muted-foreground mb-3">
                          Placement: {brief.placementDescription}
                        </p>
                        
                        {brief.keyPoints && brief.keyPoints.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium mb-1">Key points:</p>
                            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                              {brief.keyPoints.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {brief.draftOpening && (
                          <div className="mb-3">
                            <p className="text-xs font-medium mb-1">Draft opening:</p>
                            <p className="text-xs text-muted-foreground italic">
                              "{brief.draftOpening}"
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs h-7"
                            onClick={() => {
                              const briefText = 
                                `## ${brief.suggestedHeading}\n\n` +
                                `Query: ${brief.targetQuery}\n\n` +
                                `Key points:\n${brief.keyPoints?.map(p => `- ${p}`).join('\n') || ''}\n\n` +
                                `Draft opening: ${brief.draftOpening || ''}\n\n` +
                                `Target word count: ${brief.targetWordCount?.min || 300}-${brief.targetWordCount?.max || 500}`;
                              navigator.clipboard.writeText(briefText);
                              toast.success('Brief copied to clipboard');
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Brief
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* ============ ACTIONS FOOTER ============ */}
          {isComplete && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">Optimization Complete</p>
                    <p className="text-xs text-muted-foreground">
                      {chunksImproved} chunks improved, {chunksDeclined} declined
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={onExportReport}>
                      <Download className="h-4 w-4 mr-1" />
                      Export Report
                    </Button>
                    <Button variant="outline" size="sm" onClick={onCopyContent}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Content
                    </Button>
                    <Button size="sm" onClick={onApplyChanges}>
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Apply Changes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
