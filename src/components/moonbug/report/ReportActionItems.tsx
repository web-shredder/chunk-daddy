import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ContentBrief } from '@/lib/optimizer-types';

export interface ActionItem {
  type: string;
  title: string;
  description: string;
  chunkIndex?: number;
  brief?: ContentBrief;
}

export interface ActionItems {
  critical: ActionItem[];
  recommended: ActionItem[];
  optional: ActionItem[];
}

interface ReportActionItemsProps {
  actionItems: ActionItems;
  onNavigateToChunk: (index: number) => void;
  onViewBrief?: (brief: ContentBrief) => void;
}

export function ReportActionItems({ actionItems, onNavigateToChunk, onViewBrief }: ReportActionItemsProps) {
  const copyAsMarkdown = () => {
    const lines: string[] = ['# Action Items\n'];
    
    if (actionItems.critical.length > 0) {
      lines.push('## Critical\n');
      actionItems.critical.forEach(item => {
        lines.push(`- [ ] **${item.title}**`);
        lines.push(`  ${item.description}\n`);
      });
    }
    
    if (actionItems.recommended.length > 0) {
      lines.push('## Recommended\n');
      actionItems.recommended.forEach(item => {
        lines.push(`- [ ] **${item.title}**`);
        lines.push(`  ${item.description}\n`);
      });
    }
    
    if (actionItems.optional.length > 0) {
      lines.push('## Optional\n');
      actionItems.optional.forEach(item => {
        lines.push(`- [ ] ${item.title}`);
        lines.push(`  ${item.description}\n`);
      });
    }
    
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Copied action items as Markdown');
  };

  const totalItems = actionItems.critical.length + actionItems.recommended.length + actionItems.optional.length;

  if (totalItems === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No action items. All optimizations look good!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionItems.critical.length > 0 && (
        <ActionSection
          title="Critical"
          count={actionItems.critical.length}
          items={actionItems.critical}
          variant="critical"
          onNavigateToChunk={onNavigateToChunk}
          onViewBrief={onViewBrief}
        />
      )}
      
      {actionItems.recommended.length > 0 && (
        <ActionSection
          title="Recommended"
          count={actionItems.recommended.length}
          items={actionItems.recommended}
          variant="recommended"
          onNavigateToChunk={onNavigateToChunk}
          onViewBrief={onViewBrief}
        />
      )}
      
      {actionItems.optional.length > 0 && (
        <ActionSection
          title="Optional"
          count={actionItems.optional.length}
          items={actionItems.optional}
          variant="optional"
          onNavigateToChunk={onNavigateToChunk}
          onViewBrief={onViewBrief}
        />
      )}
      
      <div className="flex justify-end pt-2">
        <Button variant="outline" size="sm" onClick={copyAsMarkdown}>
          <Copy className="h-4 w-4 mr-2" />
          Copy as Markdown
        </Button>
      </div>
    </div>
  );
}

function ActionSection({
  title,
  count,
  items,
  variant,
  onNavigateToChunk,
  onViewBrief,
}: {
  title: string;
  count: number;
  items: ActionItem[];
  variant: 'critical' | 'recommended' | 'optional';
  onNavigateToChunk: (index: number) => void;
  onViewBrief?: (brief: ContentBrief) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  
  const variantStyles = {
    critical: 'bg-[hsl(var(--destructive)/0.08)] border-l-4 border-l-[hsl(var(--destructive))]',
    recommended: 'bg-[hsl(var(--warning)/0.08)] border-l-4 border-l-[hsl(var(--warning))]',
    optional: 'bg-muted/50 border-l-4 border-l-muted',
  };
  
  const iconStyles = {
    critical: '🔴',
    recommended: '🟠',
    optional: '⚪',
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg overflow-hidden', variantStyles[variant])}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/20 transition-colors">
            <span className="text-sm font-medium text-foreground">
              {iconStyles[variant]} {title.toUpperCase()} ({count})
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {items.map((item, index) => (
              <div
                key={index}
                className="bg-surface border border-border rounded-md p-3"
              >
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                {item.chunkIndex !== undefined && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 mt-2 text-primary"
                    onClick={() => onNavigateToChunk(item.chunkIndex!)}
                  >
                    View Chunk →
                  </Button>
                )}
                {item.brief && onViewBrief && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 mt-2 text-primary"
                    onClick={() => onViewBrief(item.brief!)}
                  >
                    View Brief →
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
