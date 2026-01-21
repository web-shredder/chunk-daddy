import { useState } from 'react';
import { ChevronRight, Loader2, Settings2, Globe, Download, X, ChevronDown, ExternalLink } from 'lucide-react';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ChunkingSettings } from '@/components/ChunkingSettings';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fetchUrlContent } from '@/lib/url-fetcher';
import type { ChunkerOptions } from '@/lib/layout-chunker';

// Extracted as standalone component to prevent focus loss on re-render
interface UrlImportSectionProps {
  urlInput: string;
  setUrlInput: (value: string) => void;
  isUrlSectionOpen: boolean;
  setIsUrlSectionOpen: (open: boolean) => void;
  isFetching: boolean;
  onFetch: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function UrlImportSection({
  urlInput,
  setUrlInput,
  isUrlSectionOpen,
  setIsUrlSectionOpen,
  isFetching,
  onFetch,
  onKeyDown,
}: UrlImportSectionProps) {
  return (
    <Collapsible open={isUrlSectionOpen} onOpenChange={setIsUrlSectionOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <Globe className="h-4 w-4" />
          <span>Import from URL</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isUrlSectionOpen ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1"
            disabled={isFetching}
          />
          <Button
            onClick={onFetch}
            disabled={!urlInput.trim() || isFetching}
            size="default"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Fetch
              </>
            )}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Extracted as standalone component to prevent unnecessary re-renders
interface SourceUrlBadgeProps {
  sourceUrl: string | null;
  onClear: () => void;
}

function SourceUrlBadge({ sourceUrl, onClear }: SourceUrlBadgeProps) {
  if (!sourceUrl) return null;
  
  let hostname = '';
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    hostname = sourceUrl;
  }
  
  return (
    <Badge variant="outline" className="gap-1.5 text-xs font-normal">
      <Globe className="h-3 w-3" />
      <span className="hidden sm:inline">Source:</span>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline max-w-[200px] truncate"
      >
        {hostname}
      </a>
      <button
        onClick={onClear}
        className="ml-1 hover:text-destructive transition-colors"
        title="Clear source"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

interface ContentTabProps {
  content: string;
  onChange: (content: string) => void;
  onChunk: () => void;
  isChunking: boolean;
  wordCount: number;
  tokenCount: number;
  chunkerOptions: ChunkerOptions;
  onOptionsChange: (options: ChunkerOptions) => void;
  sourceUrl?: string | null;
  onSourceUrlChange?: (url: string | null) => void;
}

export function ContentTab({
  content,
  onChange,
  onChunk,
  isChunking,
  wordCount,
  tokenCount,
  chunkerOptions,
  onOptionsChange,
  sourceUrl,
  onSourceUrlChange,
}: ContentTabProps) {
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isUrlSectionOpen, setIsUrlSectionOpen] = useState(false);
  
  const hasContent = content.trim().length > 0;
  
  const handleChunkClick = () => {
    setShowSettingsDialog(true);
  };
  
  const handleConfirmChunk = () => {
    setShowSettingsDialog(false);
    onChunk();
  };

  const handleFetchUrl = async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;
    
    // Basic URL validation
    let url = trimmedUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    setIsFetching(true);
    try {
      const result = await fetchUrlContent(url);
      
      // Set the content
      onChange(result.markdown);
      onSourceUrlChange?.(result.sourceUrl);
      
      const wordCount = result.content.split(/\s+/).filter(Boolean).length;
      toast.success(`Imported content from ${new URL(result.sourceUrl).hostname}`, {
        description: `${result.title} — ${wordCount.toLocaleString()} words`,
      });
      
      // Clear URL input and close section
      setUrlInput('');
      setIsUrlSectionOpen(false);
      
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch URL', {
        description: error instanceof Error ? error.message : 'Could not retrieve content from this URL',
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && urlInput.trim() && !isFetching) {
      e.preventDefault();
      handleFetchUrl();
    }
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
          <UrlImportSection
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            isUrlSectionOpen={isUrlSectionOpen}
            setIsUrlSectionOpen={setIsUrlSectionOpen}
            isFetching={isFetching}
            onFetch={handleFetchUrl}
            onKeyDown={handleKeyDown}
          />
          
          <MarkdownEditor 
            value={content} 
            onChange={onChange} 
            placeholder="# Start typing your markdown here...

Paste or write your content. Use headings (# H1, ## H2, ### H3) to create document structure.

The chunker will respect your heading hierarchy and create semantically coherent chunks." 
            minHeight="300px" 
            maxHeight="500px"
            chunkerOptions={chunkerOptions}
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
          <UrlImportSection
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            isUrlSectionOpen={isUrlSectionOpen}
            setIsUrlSectionOpen={setIsUrlSectionOpen}
            isFetching={isFetching}
            onFetch={handleFetchUrl}
            onKeyDown={handleKeyDown}
          />
          
          <MarkdownEditor 
            value={content} 
            onChange={onChange} 
            placeholder="Start typing or paste your content here..." 
            minHeight="calc(100vh - 340px)" 
            maxHeight="none"
            chunkerOptions={chunkerOptions}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="min-h-14 md:h-16 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 px-4 md:px-6 py-3 md:py-0 bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} words • ~{tokenCount.toLocaleString()} tokens
          </span>
          <SourceUrlBadge sourceUrl={sourceUrl ?? null} onClear={() => onSourceUrlChange?.(null)} />
        </div>
        
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
