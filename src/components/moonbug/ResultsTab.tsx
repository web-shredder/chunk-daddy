import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Copy, Download, Search, AlertCircle, FileJson, FileText, TreeDeciduous, List, Table } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatScore, getScoreColorClass, getImprovementColorClass, formatImprovement, calculatePassageScore, getPassageScoreTier, getPassageScoreTierColorClass } from '@/lib/similarity';
import { PassageScoreHero } from './PassageScoreHero';
import { downloadCSV } from '@/lib/csv-export';
import type { LayoutAwareChunk, DocumentElement } from '@/lib/layout-chunker';
import type { ChunkScore, AnalysisResult } from '@/hooks/useAnalysis';
interface ResultsTabProps {
  hasResults: boolean;
  chunks: LayoutAwareChunk[];
  chunkScores: ChunkScore[];
  keywords: string[];
  contentModified: boolean;
  onReanalyze: () => void;
  onGoToAnalyze: () => void;
  content: string;
  onApplyOptimization: (optimizedContent: string) => void;
  elements: DocumentElement[];
  result?: AnalysisResult;
}

// Tree node for document structure
interface HeadingNode {
  heading: DocumentElement;
  children: HeadingNode[];
  chunks: Array<{
    chunk: LayoutAwareChunk;
    score?: ChunkScore;
  }>;
}
function buildHeadingTree(elements: DocumentElement[], chunks: LayoutAwareChunk[], chunkScores?: ChunkScore[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  const chunksByPath = new Map<string, Array<{
    chunk: LayoutAwareChunk;
    score?: ChunkScore;
  }>>();
  for (const chunk of chunks) {
    const pathKey = chunk.headingPath.join(' > ');
    if (!chunksByPath.has(pathKey)) {
      chunksByPath.set(pathKey, []);
    }
    const score = chunkScores?.find(cs => cs.chunkId === chunk.id);
    chunksByPath.get(pathKey)!.push({
      chunk,
      score
    });
  }
  for (const element of elements) {
    if (element.type === 'heading') {
      const node: HeadingNode = {
        heading: element,
        children: [],
        chunks: []
      };
      const pathKey = element.headings.map(h => h.text).join(' > ');
      const matchingChunks = chunksByPath.get(pathKey) || [];
      node.chunks = matchingChunks;
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
  const orphanChunks = chunks.filter(c => c.headingPath.length === 0);
  if (orphanChunks.length > 0) {
    const orphanNode: HeadingNode = {
      heading: {
        type: 'heading',
        level: 0,
        content: '(Document Root)',
        headings: [],
        lineStart: 0,
        lineEnd: 0
      },
      children: [],
      chunks: orphanChunks.map(chunk => ({
        chunk,
        score: chunkScores?.find(cs => cs.chunkId === chunk.id)
      }))
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
  selectedChunkId
}: {
  node: HeadingNode;
  keywords: string[];
  depth?: number;
  onSelectChunk: (chunkIndex: number) => void;
  selectedChunkId?: string;
  allChunks: LayoutAwareChunk[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasContent = node.children.length > 0 || node.chunks.length > 0;
  const level = node.heading.level || 0;
  return <div className={cn("relative", depth > 0 && "ml-4 border-l border-border/50 pl-2")}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className={cn("flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md", "hover:bg-muted/50 transition-colors group")}>
            {hasContent ? isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <span className="w-3.5" />}
            
            <span className={cn("text-sm truncate", level === 1 && "font-semibold text-foreground", level === 2 && "font-medium text-foreground", level >= 3 && "text-muted-foreground")}>
              {node.heading.content}
            </span>
            
            {level > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                H{level}
              </Badge>}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          {node.chunks.map(({
          chunk,
          score
        }) => {
          const avgCosine = score ? score.keywordScores.reduce((sum, ks) => sum + ks.scores.cosine, 0) / score.keywordScores.length : 0;
          const avgChamfer = score ? score.keywordScores.reduce((sum, ks) => sum + ks.scores.chamfer, 0) / score.keywordScores.length : 0;
          const passageScore = calculatePassageScore(avgCosine, avgChamfer);
          const tier = getPassageScoreTier(passageScore);
          const isSelected = selectedChunkId === chunk.id;
          const chunkNum = parseInt(chunk.id.replace('chunk-', ''));
          return <button key={chunk.id} onClick={() => onSelectChunk(chunkNum)} className={cn("flex items-center gap-2 w-full text-left py-1.5 px-2 ml-5 rounded-md", "hover:bg-muted/50 transition-colors text-xs", isSelected && "bg-accent/20 border-l-2 border-accent")}>
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground truncate flex-1">
                  {chunk.textWithoutCascade.slice(0, 50)}...
                </span>
                {score && <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono", getPassageScoreTierColorClass(tier))}>
                    {passageScore}
                  </Badge>}
              </button>;
        })}
          
          {node.children.map((child, idx) => <HeadingNodeView key={idx} node={child} keywords={keywords} depth={depth + 1} onSelectChunk={onSelectChunk} selectedChunkId={selectedChunkId} allChunks={[]} />)}
        </CollapsibleContent>
      </Collapsible>
    </div>;
}
export function ResultsTab({
  hasResults,
  chunks,
  chunkScores,
  keywords,
  contentModified,
  onReanalyze,
  onGoToAnalyze,
  content,
  onApplyOptimization,
  elements,
  result
}: ResultsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'structure'>('structure');
  if (!hasResults) {
    return <div className="flex-1 flex items-center justify-center">
        <div className="empty-state">
          <BarChart3 size={48} strokeWidth={1} />
          <h3>No analysis yet</h3>
          <p>Run an analysis to see chunk structure and relevance scores</p>
          <button className="btn-secondary" onClick={onGoToAnalyze}>
            Go to Analyze
          </button>
        </div>
      </div>;
  }
  const selectedChunk = chunks[selectedIndex];
  const selectedScore = chunkScores[selectedIndex];
  const filteredChunks = searchQuery ? chunks.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()) || c.headingPath.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()))) : chunks;
  const handleCopy = () => {
    if (selectedChunk) {
      navigator.clipboard.writeText(selectedChunk.text);
      toast.success('Chunk copied to clipboard');
    }
  };
  const exportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      chunks: chunks.map((chunk, idx) => ({
        id: chunk.id,
        headingPath: chunk.headingPath,
        text: chunk.text,
        scores: chunkScores[idx]?.keywordScores.map(ks => ({
          keyword: ks.keyword,
          cosine: ks.scores.cosine,
          euclidean: ks.scores.euclidean,
          manhattan: ks.scores.manhattan,
          dotProduct: ks.scores.dotProduct,
          chamfer: ks.scores.chamfer
        }))
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chunk-daddy-results-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported as JSON');
  };
  const exportMarkdown = () => {
    const lines: string[] = [];
    lines.push('# Chunk Daddy Analysis Report\n');
    lines.push(`Exported: ${new Date().toLocaleString()}\n`);
    lines.push('## Chunks\n');
    for (const chunk of chunks) {
      const score = chunkScores.find(cs => cs.chunkId === chunk.id);
      lines.push(`### ${chunk.id}`);
      lines.push(`**Heading Path:** ${chunk.headingPath.join(' > ') || '(root)'}\n`);
      if (score) {
        lines.push('| Keyword | Cosine | Chamfer | Euclidean | Manhattan | Dot Product |');
        lines.push('|---------|--------|---------|-----------|-----------|-------------|');
        for (const ks of score.keywordScores) {
          lines.push(`| ${ks.keyword} | ${ks.scores.cosine.toFixed(4)} | ${ks.scores.chamfer.toFixed(4)} | ${ks.scores.euclidean.toFixed(4)} | ${ks.scores.manhattan.toFixed(4)} | ${ks.scores.dotProduct.toFixed(4)} |`);
        }
        lines.push('');
      }
      lines.push('```');
      lines.push(chunk.textWithoutCascade.slice(0, 300) + (chunk.textWithoutCascade.length > 300 ? '...' : ''));
      lines.push('```\n');
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/markdown'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chunk-daddy-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  };
  const handleExportCSV = () => {
    if (result) {
      downloadCSV(result, `chunk-daddy-results-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Exported as CSV');
    }
  };
  const getScoreClass = (value: number) => {
    if (value >= 0.7) return 'score-high';
    if (value >= 0.5) return 'score-medium';
    return 'score-low';
  };
  const tree = buildHeadingTree(elements, chunks, chunkScores);
  return <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Warning Banner */}
      {contentModified && <div className="flex items-center gap-3 px-6 py-3 bg-warning/10 border-b border-warning/30 text-warning text-[13px]">
          <AlertCircle className="h-4 w-4" />
          <span>Content modified since analysis. Results may be outdated.</span>
          <button className="btn-secondary ml-auto" onClick={onReanalyze}>
            Re-analyze Now
          </button>
        </div>}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tree/List Structure */}
        <div className="w-1/2 border-r border-border flex flex-col bg-surface shrink-0">
          {/* Header with view toggle */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode('list')} className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs transition-colors", viewMode === 'list' ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <List className="h-3.5 w-3.5" />
                List
              </button>
              <button onClick={() => setViewMode('structure')} className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs transition-colors", viewMode === 'structure' ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
                <TreeDeciduous className="h-3.5 w-3.5" />
                Structure
              </button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search chunks..." className="pl-9 moonbug-input h-8 text-[13px]" />
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {viewMode === 'list' ? <div className="p-2 space-y-0.5">
                {filteredChunks.map((chunk, idx) => {
              const score = chunkScores[chunks.indexOf(chunk)];
              const avgCosine = score ? score.keywordScores.reduce((sum, ks) => sum + ks.scores.cosine, 0) / score.keywordScores.length : 0;
              const avgChamfer = score ? score.keywordScores.reduce((sum, ks) => sum + ks.scores.chamfer, 0) / score.keywordScores.length : 0;
              const passageScore = calculatePassageScore(avgCosine, avgChamfer);
              const tier = getPassageScoreTier(passageScore);
              const isActive = chunks.indexOf(chunk) === selectedIndex;
              return <button key={chunk.id} onClick={() => setSelectedIndex(chunks.indexOf(chunk))} className={cn('tree-item w-full text-left', isActive && 'active')}>
                      <span className="truncate flex-1">
                        {chunk.headingPath.length > 0 ? chunk.headingPath[chunk.headingPath.length - 1] : `Chunk ${chunk.id.replace('chunk-', '')}`}
                      </span>
                      <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono', getPassageScoreTierColorClass(tier))}>
                        {passageScore}
                      </Badge>
                    </button>;
            })}
              </div> : <div className="p-2 space-y-0.5">
                {tree.map((node, idx) => <HeadingNodeView key={idx} node={node} keywords={keywords} onSelectChunk={chunkNum => setSelectedIndex(chunkNum)} selectedChunkId={selectedChunk?.id} allChunks={chunks} />)}
              </div>}
          </ScrollArea>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail Header */}
          <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0} className="icon-button">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[13px] text-muted-foreground font-mono">
                Chunk {selectedIndex + 1} / {chunks.length}
              </span>
              <button onClick={() => setSelectedIndex(Math.min(chunks.length - 1, selectedIndex + 1))} disabled={selectedIndex === chunks.length - 1} className="icon-button">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={handleCopy} className="icon-button" title="Copy">
                <Copy className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="icon-button" title="Export">
                    <Download className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-elevated">
                  <DropdownMenuItem onClick={exportJSON}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportMarkdown}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as Markdown
                  </DropdownMenuItem>
                  {result && <DropdownMenuItem onClick={handleExportCSV}>
                      <Table className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Detail Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Passage Score Hero - Average of per-keyword passage scores */}
              {selectedScore && (() => {
                // Calculate passage score for each keyword, then average
                const keywordPassageScores = selectedScore.keywordScores.map(ks => 
                  calculatePassageScore(ks.scores.cosine, ks.scores.chamfer)
                );
                const avgPassageScore = Math.round(
                  keywordPassageScores.reduce((sum, ps) => sum + ps, 0) / keywordPassageScores.length
                );
                const avgCosine = selectedScore.keywordScores.reduce((sum, ks) => sum + ks.scores.cosine, 0) / selectedScore.keywordScores.length;
                const avgChamfer = selectedScore.keywordScores.reduce((sum, ks) => sum + ks.scores.chamfer, 0) / selectedScore.keywordScores.length;
                return (
                  <PassageScoreHero 
                    score={avgPassageScore} 
                    cosineScore={avgCosine}
                    chamferScore={avgChamfer}
                  />
                );
              })()}

              {/* Heading Context */}
              {selectedChunk?.headingPath.length > 0 && <div>
                  <h4 className="text-label mb-3">Heading Path</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    {selectedChunk.headingPath.map((h, i) => <span key={i} className="flex items-center gap-2">
                        {i > 0 && <ChevronRight className="h-3 w-3" />}
                        <span>{h}</span>
                      </span>)}
                  </div>
                </div>}

              {/* Content */}
              <div>
                <h4 className="text-label mb-3">Content</h4>
                <pre className="bg-background border border-border rounded-md p-4 font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {selectedChunk?.text}
                </pre>
              </div>

              {/* Metadata */}
              <div>
                <h4 className="text-label mb-3">Metadata</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                  <dt className="text-muted-foreground font-medium">Tokens</dt>
                  <dd className="text-foreground font-mono">
                    ~{selectedChunk?.metadata.tokenEstimate}
                  </dd>
                  <dt className="text-muted-foreground font-medium">Words</dt>
                  <dd className="text-foreground font-mono">
                    {selectedChunk?.metadata.wordCount}
                  </dd>
                  <dt className="text-muted-foreground font-medium">Has Cascade</dt>
                  <dd className="text-foreground font-mono">
                    {selectedChunk?.metadata.hasCascade ? 'Yes' : 'No'}
                  </dd>
                </dl>
              </div>

              {/* Similarity Scores - All 5 Algorithms */}
              {selectedScore && <div>
                  <h4 className="text-label mb-3">Similarity Scores by Algorithm</h4>
                  <div className="space-y-4">
                    {selectedScore.keywordScores.map(ks => {
                      const keywordPassageScore = calculatePassageScore(ks.scores.cosine, ks.scores.chamfer);
                      const keywordTier = getPassageScoreTier(keywordPassageScore);
                      return <div key={ks.keyword} className="p-4 bg-background border border-border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">
                            "{ks.keyword}"
                          </span>
                          <Badge variant="secondary" className={cn("text-xs px-2 py-0.5 font-mono", getPassageScoreTierColorClass(keywordTier))}>
                            Score: {keywordPassageScore}
                          </Badge>
                        </div>
                        
                        {/* Score Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          {/* Cosine Similarity */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Cosine Similarity
                            </div>
                            <div className={cn("font-mono text-lg font-semibold", getScoreColorClass(ks.scores.cosine))}>
                              {formatScore(ks.scores.cosine)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Higher = more similar
                            </div>
                          </div>

                          {/* Chamfer Distance */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Chamfer Similarity
                            </div>
                            <div className={cn("font-mono text-lg font-semibold", getScoreColorClass(ks.scores.chamfer))}>
                              {formatScore(ks.scores.chamfer)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Higher = more similar
                            </div>
                          </div>

                          {/* Euclidean Distance */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Euclidean Distance
                            </div>
                            <div className="font-mono text-lg font-semibold text-foreground">
                              {formatScore(ks.scores.euclidean)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Lower = more similar
                            </div>
                          </div>

                          {/* Manhattan Distance */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Manhattan Distance
                            </div>
                            <div className="font-mono text-lg font-semibold text-foreground">
                              {formatScore(ks.scores.manhattan)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Lower = more similar
                            </div>
                          </div>

                          {/* Dot Product */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Dot Product
                            </div>
                            <div className="font-mono text-lg font-semibold text-foreground">
                              {formatScore(ks.scores.dotProduct)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Higher = more similar
                            </div>
                          </div>
                        </div>
                      </div>;
                    })}
                  </div>
                </div>}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>;
}