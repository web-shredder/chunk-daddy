import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Link,
  List,
  Trash2,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { getDocumentStats, SAMPLE_MARKDOWN } from '@/lib/layout-chunker';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ToolbarButton({ icon, label, onClick }: ToolbarButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClick}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Paste or write your markdown content here...',
  minHeight = '400px',
}: MarkdownEditorProps) {
  const [copied, setCopied] = useState(false);
  
  const stats = getDocumentStats(value);
  
  const insertText = useCallback((prefix: string, suffix: string = '') => {
    const textarea = document.querySelector('textarea[data-markdown-editor]') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  }, [value, onChange]);
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);
  
  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);
  
  const handleLoadSample = useCallback(() => {
    onChange(SAMPLE_MARKDOWN);
  }, [onChange]);
  
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Heading1 className="h-4 w-4" />}
            label="Heading 1"
            onClick={() => insertText('# ', '\n')}
          />
          <ToolbarButton
            icon={<Heading2 className="h-4 w-4" />}
            label="Heading 2"
            onClick={() => insertText('## ', '\n')}
          />
          <ToolbarButton
            icon={<Heading3 className="h-4 w-4" />}
            label="Heading 3"
            onClick={() => insertText('### ', '\n')}
          />
          
          <Separator orientation="vertical" className="h-5 mx-1" />
          
          <ToolbarButton
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            onClick={() => insertText('**', '**')}
          />
          <ToolbarButton
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            onClick={() => insertText('*', '*')}
          />
          <ToolbarButton
            icon={<Code className="h-4 w-4" />}
            label="Code"
            onClick={() => insertText('`', '`')}
          />
          
          <Separator orientation="vertical" className="h-5 mx-1" />
          
          <ToolbarButton
            icon={<Link className="h-4 w-4" />}
            label="Link"
            onClick={() => insertText('[', '](url)')}
          />
          <ToolbarButton
            icon={<List className="h-4 w-4" />}
            label="List"
            onClick={() => insertText('- ', '\n')}
          />
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
              <Check className="h-3.5 w-3.5 text-green-600" />
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
      
      {/* Editor and Preview */}
      <div className="grid grid-cols-2 divide-x divide-border" style={{ minHeight }}>
        {/* Editor Panel */}
        <div className="relative">
          <div className="absolute top-2 left-3 text-xs text-muted-foreground font-medium">
            Editor
          </div>
          <Textarea
            data-markdown-editor
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
              "w-full h-full resize-none border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0",
              "font-mono text-sm leading-relaxed pt-8 pb-4 px-3"
            )}
            style={{ minHeight }}
          />
        </div>
        
        {/* Preview Panel */}
        <div className="relative bg-muted/20">
          <div className="absolute top-2 left-3 text-xs text-muted-foreground font-medium">
            Preview
          </div>
          <ScrollArea className="h-full pt-8 pb-4 px-3" style={{ minHeight }}>
            {value ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Preview will appear here...
              </p>
            )}
          </ScrollArea>
        </div>
      </div>
      
      {/* Stats Bar */}
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
    </div>
  );
}
