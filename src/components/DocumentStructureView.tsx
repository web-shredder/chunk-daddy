import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Hash,
  Eye,
} from 'lucide-react';
import type { LayoutAwareChunk, DocumentElement } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';
import { formatScore, getScoreColorClass } from '@/lib/similarity';
import { cn } from '@/lib/utils';

interface DocumentStructureViewProps {
  elements: DocumentElement[];
  chunks: LayoutAwareChunk[];
  chunkScores?: ChunkScore[];
  keywords: string[];
  onSelectChunk?: (chunk: LayoutAwareChunk, score?: ChunkScore) => void;
  selectedChunkId?: string;
}

interface HeadingNode {
  heading: DocumentElement;
  children: HeadingNode[];
  chunks: Array<{
    chunk: LayoutAwareChunk;
    score?: ChunkScore;
  }>;
}

function buildHeadingTree(
  elements: DocumentElement[],
  chunks: LayoutAwareChunk[],
  chunkScores?: ChunkScore[]
): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  
  // Create a map of chunks by their heading path
  const chunksByPath = new Map<string, Array<{ chunk: LayoutAwareChunk; score?: ChunkScore }>>();
  
  for (const chunk of chunks) {
    const pathKey = chunk.headingPath.join(' > ');
    if (!chunksByPath.has(pathKey)) {
      chunksByPath.set(pathKey, []);
    }
    const score = chunkScores?.find(cs => cs.chunkId === chunk.id);
    chunksByPath.get(pathKey)!.push({ chunk, score });
  }
  
  for (const element of elements) {
    if (element.type === 'heading') {
      const node: HeadingNode = {
        heading: element,
        children: [],
        chunks: [],
      };
      
      // Find chunks that belong to this heading
      const pathKey = element.headings.map(h => h.text).join(' > ');
      const matchingChunks = chunksByPath.get(pathKey) || [];
      node.chunks = matchingChunks;
      
      // Find parent in stack
      while (stack.length > 0 && stack[stack.length - 1].heading.level! >= element.level!) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      
      stack.push(node);
    }
  }
  
  // Handle chunks without headings (content before first heading)
  const orphanChunks = chunks.filter(c => c.headingPath.length === 0);
  if (orphanChunks.length > 0) {
    // Add as a virtual "root" node
    const orphanNode: HeadingNode = {
      heading: {
        type: 'heading',
        level: 0,
        content: '(Document Root)',
        headings: [],
        lineStart: 0,
        lineEnd: 0,
      },
      children: [],
      chunks: orphanChunks.map(chunk => ({
        chunk,
        score: chunkScores?.find(cs => cs.chunkId === chunk.id),
      })),
    };
    root.unshift(orphanNode);
  }
  
  return root;
}

function HeadingNodeView({
  node,
  keywords,
  depth = 0,
  onSelectChunk,
  selectedChunkId,
}: {
  node: HeadingNode;
  keywords: string[];
  depth?: number;
  onSelectChunk?: (chunk: LayoutAwareChunk, score?: ChunkScore) => void;
  selectedChunkId?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasContent = node.children.length > 0 || node.chunks.length > 0;
  const level = node.heading.level || 0;
  
  return (
    <div className={cn("relative", depth > 0 && "ml-4 border-l border-border/50 pl-2")}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn(
            "flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md",
            "hover:bg-muted/50 transition-colors group"
          )}>
            {hasContent ? (
              isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            
            <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
            
            <span className={cn(
              "text-sm truncate",
              level === 1 && "font-semibold",
              level === 2 && "font-medium",
              level >= 3 && "text-muted-foreground"
            )}>
              {node.heading.content}
            </span>
            
            {level > 0 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                H{level}
              </Badge>
            )}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          {/* Chunks under this heading */}
          {node.chunks.map(({ chunk, score }) => (
            <ChunkItem
              key={chunk.id}
              chunk={chunk}
              score={score}
              keywords={keywords}
              onSelect={onSelectChunk}
              isSelected={selectedChunkId === chunk.id}
            />
          ))}
          
          {/* Child headings */}
          {node.children.map((child, idx) => (
            <HeadingNodeView
              key={idx}
              node={child}
              keywords={keywords}
              depth={depth + 1}
              onSelectChunk={onSelectChunk}
              selectedChunkId={selectedChunkId}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ChunkItem({
  chunk,
  score,
  keywords,
  onSelect,
  isSelected,
}: {
  chunk: LayoutAwareChunk;
  score?: ChunkScore;
  keywords: string[];
  onSelect?: (chunk: LayoutAwareChunk, score?: ChunkScore) => void;
  isSelected?: boolean;
}) {
  const preview = chunk.textWithoutCascade.slice(0, 100);
  
  return (
    <button
      onClick={() => onSelect?.(chunk, score)}
      className={cn(
        "flex flex-col gap-1.5 w-full text-left py-2 px-3 ml-6 rounded-md",
        "border border-transparent transition-all",
        "hover:bg-accent/50 hover:border-border",
        isSelected && "bg-accent border-border ring-1 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          Chunk {chunk.id.replace('chunk-', '')} · {chunk.metadata.wordCount} words · ~{chunk.metadata.tokenEstimate} tokens
        </span>
        {onSelect && (
          <Eye className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
        )}
      </div>
      
      <p className="text-xs text-muted-foreground line-clamp-2 pl-5">
        {preview}...
      </p>
      
      {/* Scores */}
      {score && keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-5 mt-1">
          {score.keywordScores.map((ks) => (
            <Badge
              key={ks.keyword}
              variant="secondary"
              className={cn("text-[10px] px-1.5 py-0 h-4 gap-1", getScoreColorClass(ks.scores.cosine))}
            >
              {ks.keyword}: {formatScore(ks.scores.cosine)}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

export function DocumentStructureView({
  elements,
  chunks,
  chunkScores,
  keywords,
  onSelectChunk,
  selectedChunkId,
}: DocumentStructureViewProps) {
  const tree = buildHeadingTree(elements, chunks, chunkScores);
  
  if (tree.length === 0 && chunks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No document structure detected</p>
          <p className="text-xs mt-1">Add headings (# H1, ## H2, etc.) to see the structure</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">Document Structure</h3>
          <Badge variant="outline" className="text-xs">
            {chunks.length} chunks
          </Badge>
        </div>
        
        <ScrollArea className="h-[500px]">
          <div className="p-3 space-y-1">
            {tree.map((node, idx) => (
              <HeadingNodeView
                key={idx}
                node={node}
                keywords={keywords}
                onSelectChunk={onSelectChunk}
                selectedChunkId={selectedChunkId}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
