import { useState } from 'react';
import { ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ChunkingSettings } from '@/components/ChunkingSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ChunkerOptions } from '@/lib/layout-chunker';

interface ContentTabProps {
  content: string;
  onChange: (content: string) => void;
  onChunk: () => void;
  isChunking: boolean;
  wordCount: number;
  tokenCount: number;
  chunkerOptions: ChunkerOptions;
  onOptionsChange: (options: ChunkerOptions) => void;
}

export function ContentTab({
  content,
  onChange,
  onChunk,
  isChunking,
  wordCount,
  tokenCount,
  chunkerOptions,
  onOptionsChange
}: ContentTabProps) {
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const hasContent = content.trim().length > 0;
  
  const handleChunkClick = () => {
    setShowSettingsDialog(true);
  };
  
  const handleConfirmChunk = () => {
    setShowSettingsDialog(false);
    onChunk();
  };

  if (!hasContent) {
    return (
      <div className="flex-1 my-0 flex-col mb-0 py-0 flex items-center justify-start pb-0 pt-12 md:pt-[75px]">
        <div className="empty-state my-0 h-0">
          <h3>Start with your content</h3>
          <p>
            Paste or write markdown to analyze how it chunks in RAG systems
          </p>
        </div>
        
        <div className="w-full max-w-3xl px-4 md:px-6 mt-8">
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
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <MarkdownEditor 
            value={content} 
            onChange={onChange} 
            placeholder="Start typing or paste your content here..." 
            minHeight="calc(100vh - 280px)" 
            maxHeight="none" 
          />
        </div>
      </div>

      {/* Footer */}
      <div className="min-h-14 md:h-16 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 px-4 md:px-6 py-3 md:py-0 bg-surface shrink-0">
        <span className="text-xs text-muted-foreground">
          {wordCount.toLocaleString()} words • ~{tokenCount.toLocaleString()} tokens
        </span>
        
        <button 
          onClick={handleChunkClick} 
          disabled={!hasContent || isChunking} 
          className="btn-primary w-full sm:w-auto"
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
      
      {/* Chunking Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Chunking Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <ChunkingSettings
              content={content}
              options={chunkerOptions}
              onChange={onOptionsChange}
              hideCard={true}
            />
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmChunk} className="gap-2">
              Chunk It, Daddy
              <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
