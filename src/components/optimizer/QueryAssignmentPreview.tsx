import React from 'react';
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
import { ArrowRight, Target, AlertCircle, Check, Star } from 'lucide-react';
import { 
  QueryAssignmentMap, 
  ChunkScoreData, 
  reassignQuery,
  formatScorePercent,
  getScoreColorClass 
} from '@/lib/query-assignment';

interface QueryAssignmentPreviewProps {
  assignmentMap: QueryAssignmentMap;
  chunkScores: ChunkScoreData[];
  onAssignmentChange: (newMap: QueryAssignmentMap) => void;
  onConfirm: () => void;
  isOptimizing?: boolean;
}

export function QueryAssignmentPreview({
  assignmentMap,
  chunkScores,
  onAssignmentChange,
  onConfirm,
  isOptimizing = false,
}: QueryAssignmentPreviewProps) {
  const handleReassign = (query: string, newChunkIndex: string) => {
    const updated = reassignQuery(
      assignmentMap, 
      query, 
      parseInt(newChunkIndex, 10),
      chunkScores
    );
    onAssignmentChange(updated);
  };

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
          {assignmentMap.chunkAssignments.map((chunkAssignment) => (
            <Card key={chunkAssignment.chunkIndex} className="bg-surface border-border">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Chunk {chunkAssignment.chunkIndex + 1}
                    {chunkAssignment.chunkHeading && (
                      <span className="text-muted-foreground ml-2">
                        — {chunkAssignment.chunkHeading}
                      </span>
                    )}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {chunkAssignment.assignedQueries.length} queries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4 space-y-2">
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {chunkAssignment.chunkPreview}
                </p>
                
                <div className="space-y-2">
                  {chunkAssignment.assignedQueries.map((assignment) => (
                    <div 
                      key={assignment.query}
                      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {assignment.isPrimary && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        )}
                        <span className="text-sm truncate">{assignment.query}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono ${getScoreColorClass(assignment.score)}`}>
                          {formatScorePercent(assignment.score)}
                        </span>
                        
                        <Select
                          value={assignment.assignedChunkIndex.toString()}
                          onValueChange={(value) => handleReassign(assignment.query, value)}
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
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Unassigned queries warning */}
          {assignmentMap.unassignedQueries.length > 0 && (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Unassigned Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <p className="text-xs text-muted-foreground mb-2">
                  These queries didn't score well against any chunk. Consider adding relevant content or manually assigning them.
                </p>
                <div className="space-y-2">
                  {assignmentMap.unassignedQueries.map((query) => (
                    <div 
                      key={query}
                      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md"
                    >
                      <span className="text-sm truncate">{query}</span>
                      
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
                  ))}
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
