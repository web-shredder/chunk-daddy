import { useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Download,
  Search,
  AlertCircle,
  FileJson,
  FileText,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatScore, getScoreColorClass } from '@/lib/similarity';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';
import type { ChunkScore } from '@/hooks/useAnalysis';

interface ResultsTabProps {
  hasResults: boolean;
  chunks: LayoutAwareChunk[];
  chunkScores: ChunkScore[];
  keywords: string[];
  contentModified: boolean;
  onReanalyze: () => void;
  onGoToAnalyze: () => void;
}

export function ResultsTab({
  hasResults,
  chunks,
  chunkScores,
  keywords,
  contentModified,
  onReanalyze,
  onGoToAnalyze,
}: ResultsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedHeadings, setExpandedHeadings] = useState<Set<string>>(new Set(['root']));

  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="empty-state">
          <BarChart3 size={48} strokeWidth={1} />
          <h3>No analysis yet</h3>
          <p>Run an analysis to see chunk structure and relevance scores</p>
          <button className="btn-secondary" onClick={onGoToAnalyze}>
            Go to Analyze
          </button>
        </div>
      </div>
    );
  }

  const selectedChunk = chunks[selectedIndex];
  const selectedScore = chunkScores[selectedIndex];

  // Filter chunks by search
  const filteredChunks = searchQuery
    ? chunks.filter(
        (c, i) =>
          c.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.headingPath.some((h) =>
            h.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : chunks;

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
        scores: chunkScores[idx]?.keywordScores.map((ks) => ({
          keyword: ks.keyword,
          cosine: ks.scores.cosine,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
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

  const getScoreClass = (value: number) => {
    if (value >= 0.7) return 'score-high';
    if (value >= 0.5) return 'score-medium';
    return 'score-low';
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Warning Banner */}
      {contentModified && (
        <div className="flex items-center gap-3 px-6 py-3 bg-warning/10 border-b border-warning/30 text-warning text-[13px]">
          <AlertCircle className="h-4 w-4" />
          <span>Content modified since analysis. Results may be outdated.</span>
          <button className="btn-secondary ml-auto" onClick={onReanalyze}>
            Re-analyze Now
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tree Structure */}
        <div className="w-80 border-r border-border flex flex-col bg-surface shrink-0">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chunks..."
                className="pl-9 moonbug-input h-8 text-[13px]"
              />
            </div>
          </div>

          {/* Tree Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filteredChunks.map((chunk, idx) => {
                const score = chunkScores[chunks.indexOf(chunk)];
                const avgScore = score
                  ? score.keywordScores.reduce((sum, ks) => sum + ks.scores.cosine, 0) /
                    score.keywordScores.length
                  : 0;
                const isActive = chunks.indexOf(chunk) === selectedIndex;

                return (
                  <button
                    key={chunk.id}
                    onClick={() => setSelectedIndex(chunks.indexOf(chunk))}
                    className={cn(
                      'tree-item w-full text-left',
                      isActive && 'active'
                    )}
                  >
                    <span className="truncate flex-1">
                      {chunk.headingPath.length > 0
                        ? chunk.headingPath[chunk.headingPath.length - 1]
                        : `Chunk ${chunk.id.replace('chunk-', '')}`}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono',
                        getScoreColorClass(avgScore)
                      )}
                    >
                      {avgScore.toFixed(2)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail Header */}
          <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
                className="icon-button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[13px] text-muted-foreground font-mono">
                Chunk {selectedIndex + 1} / {chunks.length}
              </span>
              <button
                onClick={() =>
                  setSelectedIndex(Math.min(chunks.length - 1, selectedIndex + 1))
                }
                disabled={selectedIndex === chunks.length - 1}
                className="icon-button"
              >
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Detail Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Heading Context */}
              {selectedChunk?.headingPath.length > 0 && (
                <div>
                  <h4 className="text-label mb-3">Heading Context</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    {selectedChunk.headingPath.map((h, i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <ChevronRight className="h-3 w-3" />}
                        <span>{h}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Scores */}
              {selectedScore && (
                <div>
                  <h4 className="text-label mb-3">Relevance Scores</h4>
                  <div className="space-y-2">
                    {selectedScore.keywordScores.map((ks) => (
                      <div
                        key={ks.keyword}
                        className="flex items-center justify-between p-3 bg-background border border-border rounded-md"
                      >
                        <span className="text-[13px] text-muted-foreground">
                          "{ks.keyword}"
                        </span>
                        <span
                          className={cn(
                            'font-mono text-sm font-semibold',
                            getScoreClass(ks.scores.cosine)
                          )}
                        >
                          {ks.scores.cosine.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
