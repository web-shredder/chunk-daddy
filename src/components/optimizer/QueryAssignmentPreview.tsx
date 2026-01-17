import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ArrowRight, Target, AlertCircle, Check, Star, FileText, Loader2 } from 'lucide-react';
import { 
  QueryAssignmentMap, 
  ChunkScoreData, 
  reassignQuery,
  formatScorePercent,
  getScoreColorClass 
} from '@/lib/query-assignment';
import type { ContentBrief } from '@/lib/optimizer-types';

interface QueryAssignmentPreviewProps {
  assignmentMap: QueryAssignmentMap;
  chunkScores: ChunkScoreData[];
  onAssignmentChange: (newMap: QueryAssignmentMap) => void;
  onConfirm: () => void;
  isOptimizing?: boolean;
  onGenerateBrief?: (query: string) => Promise<ContentBrief | null>;
  generatedBriefs?: ContentBrief[];
}

export function QueryAssignmentPreview({
  assignmentMap,
  chunkScores,
  onAssignmentChange,
  onConfirm,
  isOptimizing = false,
  onGenerateBrief,
  generatedBriefs = [],
}: QueryAssignmentPreviewProps) {
  const [generatingBrief, setGeneratingBrief] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const handleReassign = (query: string, newChunkIndex: string) => {
    const { updatedMap } = reassignQuery(
      assignmentMap, 
      query, 
      parseInt(newChunkIndex, 10),
      chunkScores
    );
    onAssignmentChange(updatedMap);
  };

  const handleGenerateBrief = async (query: string) => {
    if (!onGenerateBrief) return;
    setGeneratingBrief(query);
    try {
      await onGenerateBrief(query);
    } finally {
      setGeneratingBrief(null);
    }
  };

  const handleGenerateAllBriefs = async () => {
    if (!onGenerateBrief || !assignmentMap.unassignedQueries.length) return;
    setGeneratingAll(true);
    try {
      for (const query of assignmentMap.unassignedQueries) {
        if (generatedBriefs?.some(b => b.targetQuery === query)) continue;
        await onGenerateBrief(query);
      }
    } finally {
      setGeneratingAll(false);
    }
  };

  const pendingBriefs = assignmentMap.unassignedQueries.filter(
    q => !generatedBriefs?.some(b => b.targetQuery === q)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Query-to-Chunk Assignments
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Each query will optimize its assigned chunk. Review and adjust if needed.
          </p>
        </div>
        <Button 
          onClick={onConfirm} 
          disabled={isOptimizing || assignmentMap.assignments.length === 0}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {isOptimizing ? 'Optimizing...' : 'Confirm & Optimize'}
        </Button>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {assignmentMap.chunkAssignments
            .filter(ca => ca.assignedQuery)
            .map((chunkAssignment) => (
              <Card key={chunkAssignment.chunkIndex} className="bg-surface border-border overflow-hidden">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium truncate min-w-0 flex-1">
                      Chunk {chunkAssignment.chunkIndex + 1}
                      {chunkAssignment.chunkHeading && (
                        <span className="text-muted-foreground ml-2 truncate" title={chunkAssignment.chunkHeading}>
                          — {chunkAssignment.chunkHeading}
                        </span>
                      )}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs shrink-0">
                      1 query
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-4 space-y-2">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 break-words">
                    {chunkAssignment.chunkPreview}
                  </p>
                  
                  {chunkAssignment.assignedQuery && (
                    <div className="space-y-2">
                      <div 
                        className="flex items-center justify-between gap-2 py-2 px-3 bg-muted/30 rounded-md"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {chunkAssignment.assignedQuery.isPrimary && (
                            <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          )}
                          <span className="text-sm truncate query-text" title={chunkAssignment.assignedQuery.query}>
                            {chunkAssignment.assignedQuery.query}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-mono ${getScoreColorClass(chunkAssignment.assignedQuery.score)}`}>
                            {formatScorePercent(chunkAssignment.assignedQuery.score)}
                          </span>
                          
                          <Select
                            value={chunkAssignment.assignedQuery.assignedChunkIndex.toString()}
                            onValueChange={(value) => handleReassign(chunkAssignment.assignedQuery!.query, value)}
                          >
                            <SelectTrigger className="w-24 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {chunkScores.map((chunk, idx) => (
                                <SelectItem key={idx} value={idx.toString()}>
                                  Chunk {idx + 1}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

          {/* Queries needing new content */}
          {assignmentMap.unassignedQueries.length > 0 && (
            <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-300 dark:border-amber-600">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Queries Needing New Content ({assignmentMap.unassignedQueries.length})
                  </CardTitle>
                  {onGenerateBrief && pendingBriefs.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAllBriefs}
                      disabled={generatingAll || generatingBrief !== null}
                      className="text-xs"
                    >
                      {generatingAll ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3 mr-1" />
                          Generate All Briefs
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <p className="text-xs text-muted-foreground mb-3">
                  These queries have no viable chunk match. Generate content briefs or force-assign to existing chunks.
                </p>
                <div className="space-y-3">
                  {assignmentMap.unassignedQueries.map((query) => {
                    const existingBrief = generatedBriefs?.find(b => b.targetQuery === query);
                    const isGenerating = generatingBrief === query;
                    
                    return (
                      <div 
                        key={query}
                        className="p-3 bg-background border border-amber-200 dark:border-amber-700 rounded-lg space-y-2 overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate flex-1 min-w-0" title={query}>"{query}"</span>
                          <div className="flex items-center gap-2">
                            {onGenerateBrief && !existingBrief && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateBrief(query)}
                                disabled={isGenerating || generatingAll}
                                className="text-xs h-7"
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <FileText className="h-3 w-3 mr-1" />
                                    Generate Brief
                                  </>
                                )}
                              </Button>
                            )}
                            <Select
                              onValueChange={(value) => handleReassign(query, value)}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
                                <SelectValue placeholder="Assign" />
                              </SelectTrigger>
                              <SelectContent>
                                {chunkScores.map((chunk, idx) => (
                                  <SelectItem key={idx} value={idx.toString()}>
                                    Chunk {idx + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {existingBrief && (
                          <div className="mt-2 p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-700 text-sm">
                            <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Brief Generated
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              <strong>Suggested section:</strong> {existingBrief.suggestedHeading}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              <strong>Placement:</strong> {existingBrief.placementDescription}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {assignmentMap.assignments.length === 0 && assignmentMap.unassignedQueries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No query assignments available.</p>
              <p className="text-sm">Run analysis first to generate assignments.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      {assignmentMap.assignments.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
          <span>
            {assignmentMap.assignments.length} queries assigned to {assignmentMap.chunkAssignments.length} chunks
          </span>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            <span>Each chunk will be optimized for its assigned queries only</span>
          </div>
        </div>
      )}
    </div>
  );
}
