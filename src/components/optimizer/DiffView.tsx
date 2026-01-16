import { cn } from '@/lib/utils';
import type { ValidatedChunk } from '@/lib/optimizer-types';
import { FileText, ArrowRight, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { calculateDaddyScore, getDaddyScoreTier, getDaddyScoreTierBgClass, formatScore, formatImprovement, getImprovementColorClass } from '@/lib/similarity';

interface DiffViewProps {
  originalContent: string;
  optimizedChunks: ValidatedChunk[];
  acceptedChanges: Set<string>;
  originalScores?: Record<number, Record<string, number>>;
}

export function DiffView({ optimizedChunks, acceptedChanges, originalScores }: DiffViewProps) {
  if (optimizedChunks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No optimizations available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {optimizedChunks.map((chunk, idx) => {
        // Calculate score improvements
        const origScores = originalScores?.[chunk.chunk_number];
        const newScores = chunk.scores;
        
        const origCosine = origScores?.cosine;
        const origChamfer = origScores?.chamfer;
        const newCosine = newScores?.cosine;
        const newChamfer = newScores?.chamfer;
        
        const origDaddy = origCosine !== undefined && origChamfer !== undefined 
          ? calculateDaddyScore(origCosine, origChamfer) 
          : undefined;
        const newDaddy = newCosine !== undefined && newChamfer !== undefined 
          ? calculateDaddyScore(newCosine, newChamfer) 
          : undefined;
        
        const daddyImprovement = origDaddy !== undefined && newDaddy !== undefined
          ? ((newDaddy - origDaddy) / Math.max(origDaddy, 1)) * 100
          : undefined;
        
        const cosineImprovement = origCosine !== undefined && newCosine !== undefined
          ? ((newCosine - origCosine) / Math.max(origCosine, 0.001)) * 100
          : undefined;

        return (
        <div 
          key={idx} 
          className="border rounded-lg overflow-hidden"
        >
          {/* Chunk Header with Score Comparison */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Chunk {chunk.chunk_number}</span>
              {chunk.heading && (
                <span className="text-muted-foreground">— {chunk.heading}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Score improvement badge */}
              {newDaddy !== undefined && (
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                  getDaddyScoreTierBgClass(getDaddyScoreTier(newDaddy))
                )}>
                  <Zap className="h-3 w-3" />
                  {origDaddy !== undefined ? (
                    <>
                      <span className="opacity-60">{origDaddy}</span>
                      <ArrowRight className="h-3 w-3 opacity-60" />
                      <span className="font-bold">{newDaddy}</span>
                      {daddyImprovement !== undefined && daddyImprovement !== 0 && (
                        <span className={cn(
                          "ml-1",
                          daddyImprovement > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                        )}>
                          {daddyImprovement > 0 ? '+' : ''}{daddyImprovement.toFixed(0)}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-bold">{newDaddy}</span>
                  )}
                </div>
              )}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                chunk.changes_applied.length > 0 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {chunk.changes_applied.length} change{chunk.changes_applied.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {/* Score Details Row */}
          {(origCosine !== undefined || newCosine !== undefined) && (
            <div className="px-4 py-2 bg-muted/10 border-b flex items-center gap-4 text-xs">
              {newCosine !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cosine:</span>
                  {origCosine !== undefined ? (
                    <div className="flex items-center gap-1 font-mono">
                      <span className="opacity-60">{formatScore(origCosine)}</span>
                      <ArrowRight className="h-3 w-3 opacity-40" />
                      <span className="font-semibold">{formatScore(newCosine)}</span>
                      {cosineImprovement !== undefined && (
                        <span className={cn(
                          "text-[10px]",
                          getImprovementColorClass(cosineImprovement)
                        )}>
                          ({formatImprovement(cosineImprovement)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono font-semibold">{formatScore(newCosine)}</span>
                  )}
                </div>
              )}
              {newChamfer !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Chamfer:</span>
                  {origChamfer !== undefined ? (
                    <div className="flex items-center gap-1 font-mono">
                      <span className="opacity-60">{formatScore(origChamfer)}</span>
                      <ArrowRight className="h-3 w-3 opacity-40" />
                      <span className="font-semibold">{formatScore(newChamfer)}</span>
                    </div>
                  ) : (
                    <span className="font-mono font-semibold">{formatScore(newChamfer)}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Before / After Panels */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
            {/* Original Panel */}
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Before
              </h4>
              <div className="text-sm leading-relaxed whitespace-pre-wrap bg-destructive/5 rounded-md p-3">
                {renderOriginalWithDeletions(chunk)}
              </div>
            </div>

            {/* Optimized Panel */}
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                After
                <ArrowRight className="h-3 w-3" />
              </h4>
              <div className="text-sm leading-relaxed whitespace-pre-wrap bg-green-500/5 rounded-md p-3">
                {chunk.heading && (
                  <span className="font-semibold text-primary block mb-2">{chunk.heading}</span>
                )}
                {renderOptimizedWithAdditions(chunk, acceptedChanges)}
              </div>
            </div>
          </div>

          {/* Changes List */}
          {chunk.changes_applied.length > 0 && (
            <div className="px-4 py-3 bg-muted/20 border-t space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Changes Applied:</h5>
              <ul className="space-y-1.5">
                {chunk.changes_applied.map((change, i) => (
                  <li 
                    key={change.change_id} 
                    className={cn(
                      "text-xs flex items-start gap-2 p-2 rounded",
                      acceptedChanges.has(change.change_id) 
                        ? "bg-green-500/10" 
                        : "bg-muted/50"
                    )}
                  >
                    <span className="font-mono text-muted-foreground shrink-0">
                      {i + 1}.
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-destructive/20 text-destructive-foreground px-1.5 py-0.5 rounded line-through">
                          {truncateText(change.before, 50)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="bg-green-500/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                          {truncateText(change.after, 50)}
                        </span>
                      </div>
                      <p className="text-muted-foreground italic">{change.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function renderOriginalWithDeletions(chunk: ValidatedChunk) {
  let text = chunk.original_text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Sort changes by position in the original text
  const sortedChanges = [...chunk.changes_applied].sort((a, b) => {
    const posA = text.indexOf(a.before);
    const posB = text.indexOf(b.before);
    return posA - posB;
  });

  sortedChanges.forEach((change, i) => {
    const changeIndex = text.indexOf(change.before, lastIndex);
    if (changeIndex !== -1) {
      // Add text before the change
      if (changeIndex > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, changeIndex)}</span>);
      }
      // Add deleted text with strikethrough
      parts.push(
        <del
          key={`del-${i}`}
          className="bg-destructive/20 text-destructive line-through decoration-destructive/50"
          title={`Changed to: ${change.after}`}
        >
          {change.before}
        </del>
      );
      lastIndex = changeIndex + change.before.length;
    }
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

function renderOptimizedWithAdditions(chunk: ValidatedChunk, acceptedChanges: Set<string>) {
  let text = chunk.optimized_text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Sort changes by position in the optimized text
  const sortedChanges = [...chunk.changes_applied].sort((a, b) => {
    const posA = text.indexOf(a.after);
    const posB = text.indexOf(b.after);
    return posA - posB;
  });

  sortedChanges.forEach((change, i) => {
    const changeIndex = text.indexOf(change.after, lastIndex);
    if (changeIndex !== -1) {
      // Add text before the change
      if (changeIndex > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, changeIndex)}</span>);
      }
      // Add highlighted new text
      const isAccepted = acceptedChanges.has(change.change_id);
      parts.push(
        <ins
          key={`ins-${i}`}
          className={cn(
            "no-underline rounded px-0.5",
            isAccepted 
              ? "bg-green-500/30 text-green-700 dark:text-green-300" 
              : "bg-green-500/15 text-green-600 dark:text-green-400"
          )}
          title={`Changed from: ${change.before}`}
        >
          {change.after}
        </ins>
      );
      lastIndex = changeIndex + change.after.length;
    }
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}
