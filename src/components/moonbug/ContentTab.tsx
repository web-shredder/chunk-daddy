import { FileText, ChevronRight, Loader2 } from 'lucide-react';
import { MarkdownEditor } from '@/components/MarkdownEditor';

interface ContentTabProps {
  content: string;
  onChange: (content: string) => void;
  onChunk: () => void;
  isChunking: boolean;
  wordCount: number;
  tokenCount: number;
}

export function ContentTab({
  content,
  onChange,
  onChunk,
  isChunking,
  wordCount,
  tokenCount,
}: ContentTabProps) {
  const hasContent = content.trim().length > 0;

  if (!hasContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="empty-state">
          <FileText size={48} strokeWidth={1} />
          <h3>Start with your content</h3>
          <p>
            Paste or write markdown to analyze how it chunks in RAG systems
          </p>
        </div>
        
        <div className="w-full max-w-3xl px-6 mt-8">
          <MarkdownEditor
            value={content}
            onChange={onChange}
            placeholder="# Start typing your markdown here...

Paste or write your content. Use headings (# H1, ## H2, ### H3) to create document structure.

The chunker will respect your heading hierarchy and create semantically coherent chunks."
            minHeight="300px"
            maxHeight="500px"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Editor Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <MarkdownEditor
            value={content}
            onChange={onChange}
            placeholder="Start typing or paste your content here..."
            minHeight="calc(100vh - 240px)"
            maxHeight="none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="h-16 border-t border-border flex items-center justify-between px-6 bg-surface shrink-0">
        <span className="text-xs text-muted-foreground">
          {wordCount.toLocaleString()} words • ~{tokenCount.toLocaleString()} tokens
        </span>
        
        <button
          onClick={onChunk}
          disabled={!hasContent || isChunking}
          className="btn-primary"
        >
          {isChunking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Chunking...
            </>
          ) : (
            <>
              Chunk It, Daddy
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
