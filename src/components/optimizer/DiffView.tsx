import { cn } from '@/lib/utils';
import type { ValidatedChunk } from '@/lib/optimizer-types';

interface DiffViewProps {
  originalContent: string;
  optimizedChunks: ValidatedChunk[];
  acceptedChanges: Set<string>;
}

export function DiffView({ originalContent, optimizedChunks, acceptedChanges }: DiffViewProps) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Original Panel */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Original</h4>
        <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto">
          {originalContent}
        </div>
      </div>

      {/* Optimized Panel */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          Optimized
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {acceptedChanges.size} changes
          </span>
        </h4>
        <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed min-h-[200px] max-h-[400px] overflow-y-auto space-y-4">
          {optimizedChunks.map((chunk, idx) => (
            <div key={idx} className="space-y-1">
              {chunk.heading && (
                <h5 className="font-semibold text-primary">{chunk.heading}</h5>
              )}
              <p>
                {renderTextWithHighlights(chunk, acceptedChanges)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderTextWithHighlights(chunk: ValidatedChunk, acceptedChanges: Set<string>) {
  let text = chunk.optimized_text;
  
  // Highlight accepted changes
  const acceptedChangesList = chunk.changes_applied.filter(c => acceptedChanges.has(c.change_id));
  
  if (acceptedChangesList.length === 0) {
    return text;
  }

  // Simple highlighting - mark sections that were changed
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  acceptedChangesList.forEach((change, i) => {
    const changeIndex = text.indexOf(change.after);
    if (changeIndex !== -1) {
      // Add text before the change
      if (changeIndex > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, changeIndex)}</span>);
      }
      // Add highlighted change
      parts.push(
        <mark
          key={`change-${i}`}
          className="bg-green-200/50 dark:bg-green-900/50 px-0.5 rounded"
          title={change.reason}
        >
          {change.after}
        </mark>
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
