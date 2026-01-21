import { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  Trash2,
  FileText,
  Copy,
  Check,
  Scissors,
} from 'lucide-react';
import { getDocumentStats, SAMPLE_MARKDOWN, type ChunkerOptions } from '@/lib/layout-chunker';
import { computeChunkBoundaries, type ChunkPreviewData } from '@/lib/chunk-preview';
import { ChunkBoundaryIndicator } from '@/components/editor/ChunkBoundaryIndicator';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  chunkerOptions?: ChunkerOptions;
  showChunkPreview?: boolean;
  onChunkPreviewToggle?: (enabled: boolean) => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

// Initialize turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Configure marked for Markdown to HTML conversion
marked.setOptions({
  breaks: true,
  gfm: true,
});

function ToolbarButton({ icon, label, onClick, isActive }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            isActive && "bg-accent text-accent-foreground"
          )}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Component to render chunk boundaries inline
function ChunkBoundariesOverlay({ 
  previewData, 
  content 
}: { 
  previewData: ChunkPreviewData; 
  content: string;
}) {
  if (previewData.boundaries.length === 0) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentLine = 0;

  previewData.boundaries.forEach((boundary, idx) => {
    // Get content from currentLine to boundary.lineEnd
    const chunkLines = lines.slice(currentLine, boundary.lineEnd + 1);
    const chunkContent = chunkLines.join('\n');
    
    if (chunkContent.trim()) {
      elements.push(
        <div key={`content-${idx}`} className="chunk-content-block">
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: marked.parse(chunkContent) as string 
            }}
          />
        </div>
      );
    }

    // Add boundary indicator (not for the last chunk)
    if (idx < previewData.boundaries.length - 1) {
      elements.push(
        <ChunkBoundaryIndicator
          key={`boundary-${idx}`}
          chunkIndex={boundary.chunkIndex}
          tokenCount={boundary.tokenCount}
          cascadeTokens={boundary.cascadeTokens}
          reason={boundary.reason}
          headingPath={boundary.headingPath}
        />
      );
    }

    currentLine = boundary.lineEnd + 1;
  });

  // Add any remaining content after the last boundary
  if (currentLine < lines.length) {
    const remainingContent = lines.slice(currentLine).join('\n');
    if (remainingContent.trim()) {
      elements.push(
        <div key="content-final" className="chunk-content-block">
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: marked.parse(remainingContent) as string 
            }}
          />
        </div>
      );
    }
  }

  return <div className="chunk-boundaries-container">{elements}</div>;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Start typing or paste your content here...',
  minHeight = '400px',
  maxHeight,
  chunkerOptions,
  showChunkPreview: externalShowChunkPreview,
  onChunkPreviewToggle,
}: MarkdownEditorProps) {
  const [copied, setCopied] = useState(false);
  const [isUpdatingFromProp, setIsUpdatingFromProp] = useState(false);
  const [internalShowChunkPreview, setInternalShowChunkPreview] = useState(false);
  
  // Use external control if provided, otherwise internal state
  const showChunkPreview = externalShowChunkPreview ?? internalShowChunkPreview;
  
  const stats = getDocumentStats(value);
  
  // Compute chunk boundaries with debounce
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);
  
  const chunkPreviewData = useMemo(() => {
    if (!showChunkPreview || !chunkerOptions || !debouncedValue.trim()) {
      return { boundaries: [], totalChunks: 0, headingSplits: 0, tokenSplits: 0 };
    }
    return computeChunkBoundaries(debouncedValue, chunkerOptions);
  }, [debouncedValue, chunkerOptions, showChunkPreview]);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor prose prose-sm dark:prose-invert focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingFromProp) return;
      
      // Convert Tiptap content to markdown
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      onChange(markdown);
    },
  });

  // Sync value prop to editor content
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    
    // Get current markdown from editor
    const currentHtml = editor.getHTML();
    const currentMarkdown = turndownService.turndown(currentHtml);
    
    // Only update if value actually changed (avoid cursor jumping)
    if (value !== currentMarkdown) {
      setIsUpdatingFromProp(true);
      
      // Convert markdown to HTML and set content
      const html = marked.parse(value) as string;
      editor.commands.setContent(html, { emitUpdate: false });
      
      setIsUpdatingFromProp(false);
    }
  }, [value, editor]);
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);
  
  const handleClear = useCallback(() => {
    onChange('');
    editor?.commands.clearContent();
  }, [onChange, editor]);
  
  const handleLoadSample = useCallback(() => {
    onChange(SAMPLE_MARKDOWN);
  }, [onChange]);

  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleToggleChunkPreview = useCallback(() => {
    const newValue = !showChunkPreview;
    if (onChunkPreviewToggle) {
      onChunkPreviewToggle(newValue);
    } else {
      setInternalShowChunkPreview(newValue);
    }
  }, [showChunkPreview, onChunkPreviewToggle]);
  
  if (!editor) {
    return null;
  }
  
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Heading1 className="h-4 w-4" />}
            label="Heading 1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
          />
          <ToolbarButton
            icon={<Heading2 className="h-4 w-4" />}
            label="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
          />
          <ToolbarButton
            icon={<Heading3 className="h-4 w-4" />}
            label="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
          />
          
          <Separator orientation="vertical" className="h-5 mx-1" />
          
          <ToolbarButton
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
          />
          <ToolbarButton
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
          />
          <ToolbarButton
            icon={<Code className="h-4 w-4" />}
            label="Code"
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
          />
          
          <Separator orientation="vertical" className="h-5 mx-1" />
          
          <ToolbarButton
            icon={<LinkIcon className="h-4 w-4" />}
            label="Link"
            onClick={setLink}
            isActive={editor.isActive('link')}
          />
          <ToolbarButton
            icon={<List className="h-4 w-4" />}
            label="List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
          />
          
          {chunkerOptions && (
            <>
              <Separator orientation="vertical" className="h-5 mx-1" />
              
              <Button
                variant={showChunkPreview ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 gap-1.5 text-xs font-medium transition-all",
                  showChunkPreview && "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                )}
                onClick={handleToggleChunkPreview}
              >
                <Scissors className="h-3.5 w-3.5" />
                {showChunkPreview ? (
                  chunkPreviewData.totalChunks > 0 ? (
                    <>Viewing {chunkPreviewData.totalChunks} Chunks</>
                  ) : (
                    <>Hide Preview</>
                  )
                ) : (
                  <>Preview Chunks</>
                )}
              </Button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleLoadSample}
          >
            <FileText className="h-3.5 w-3.5" />
            Sample
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleCopy}
            disabled={!value}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
            onClick={handleClear}
            disabled={!value}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>
      
      {/* Editor / Preview Area */}
      <div 
        className="tiptap-container relative overflow-auto"
        style={{ minHeight, maxHeight }}
      >
        {showChunkPreview && chunkPreviewData.boundaries.length > 0 ? (
          <div className="h-full w-full px-4 py-4">
            <ChunkBoundariesOverlay 
              previewData={chunkPreviewData} 
              content={value} 
            />
          </div>
        ) : (
          <EditorContent 
            editor={editor} 
            className="h-full w-full px-4 py-4"
          />
        )}
      </div>
      
      {/* Stats Bar - only show when content exists */}
      {value.trim() && (
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{stats.charCount.toLocaleString()} characters</span>
          <span>{stats.wordCount.toLocaleString()} words</span>
          <span>{stats.paragraphCount} paragraphs</span>
        </div>
        <div className="flex items-center gap-4">
          {stats.headingCount > 0 && (
            <span className="flex items-center gap-2">
              {stats.h1Count > 0 && <span className="font-medium">H1: {stats.h1Count}</span>}
              {stats.h2Count > 0 && <span className="font-medium">H2: {stats.h2Count}</span>}
              {stats.h3Count > 0 && <span className="font-medium">H3: {stats.h3Count}</span>}
              {(stats.h4Count + stats.h5Count + stats.h6Count) > 0 && (
                <span className="font-medium">H4+: {stats.h4Count + stats.h5Count + stats.h6Count}</span>
              )}
            </span>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
