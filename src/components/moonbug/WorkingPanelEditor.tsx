/**
 * WorkingPanelEditor Component
 * A simplified TipTap-based markdown editor for the Query Working Panel.
 * Optimized for analysis briefs and content editing with a minimal toolbar.
 */

import { useState, useCallback, useEffect } from 'react';
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
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkingPanelEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  disabled?: boolean;
  className?: string;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
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

function ToolbarButton({ icon, label, onClick, isActive, disabled }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7",
            isActive && "bg-accent text-accent-foreground"
          )}
          onClick={onClick}
          disabled={disabled}
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

export function WorkingPanelEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '200px',
  maxHeight = '400px',
  disabled = false,
  className,
}: WorkingPanelEditorProps) {
  const [copied, setCopied] = useState(false);
  const [isUpdatingFromProp, setIsUpdatingFromProp] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
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
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'working-panel-editor prose prose-sm dark:prose-invert focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingFromProp || disabled) return;
      
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
  
  // Update editable state when disabled changes
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  const setLink = useCallback(() => {
    if (!editor || disabled) return;
    
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, disabled]);
  
  if (!editor) {
    return null;
  }
  
  return (
    <div className={cn(
      "border border-border rounded-lg overflow-hidden bg-card",
      disabled && "opacity-60",
      className
    )}>
      {/* Simplified Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Heading2 className="h-3.5 w-3.5" />}
            label="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<Heading3 className="h-3.5 w-3.5" />}
            label="Heading 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            disabled={disabled}
          />
          
          <Separator orientation="vertical" className="h-4 mx-1" />
          
          <ToolbarButton
            icon={<Bold className="h-3.5 w-3.5" />}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<Italic className="h-3.5 w-3.5" />}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            disabled={disabled}
          />
          
          <Separator orientation="vertical" className="h-4 mx-1" />
          
          <ToolbarButton
            icon={<List className="h-3.5 w-3.5" />}
            label="Bullet List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<ListOrdered className="h-3.5 w-3.5" />}
            label="Numbered List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<Quote className="h-3.5 w-3.5" />}
            label="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            disabled={disabled}
          />
          
          <Separator orientation="vertical" className="h-4 mx-1" />
          
          <ToolbarButton
            icon={<LinkIcon className="h-3.5 w-3.5" />}
            label="Link"
            onClick={setLink}
            isActive={editor.isActive('link')}
            disabled={disabled}
          />
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={handleCopy}
          disabled={!value}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          Copy
        </Button>
      </div>
      
      {/* Editor Area */}
      <div 
        className="working-panel-editor-container relative overflow-auto px-3 py-3"
        style={{ minHeight, maxHeight }}
      >
        <EditorContent 
          editor={editor} 
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

/**
 * MarkdownPreview Component
 * Read-only markdown renderer for displaying original content
 */
interface MarkdownPreviewProps {
  content: string;
  label?: string;
  className?: string;
}

export function MarkdownPreview({ content, label, className }: MarkdownPreviewProps) {
  const htmlContent = marked.parse(content) as string;
  
  return (
    <div className={cn(
      "p-4 bg-muted rounded-lg border border-border",
      className
    )}>
      {label && (
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
          {label}
        </p>
      )}
      <div 
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
