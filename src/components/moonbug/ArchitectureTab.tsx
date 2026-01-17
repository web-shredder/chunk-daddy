import { useState } from 'react';
import { Layers, Loader2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { ArchitectureReport } from '@/components/analysis/ArchitectureReport';
import { calculatePassageScore } from '@/lib/similarity';
import type { ArchitectureAnalysis } from '@/lib/optimizer-types';
import type { LayoutAwareChunk } from '@/lib/layout-chunker';

interface ChunkScore {
  chunkId: string;
  text: string;
  keywordScores: Array<{
    keyword: string;
    scores: {
      cosine: number;
      euclidean: number;
      manhattan: number;
      dotProduct: number;
      chamfer: number;
    };
  }>;
}

interface ArchitectureTabProps {
  hasResults: boolean;
  chunks: LayoutAwareChunk[];
  chunkScores: ChunkScore[];
  keywords: string[];
  onGoToResults: () => void;
  onNavigateToChunk?: (chunkIndex: number) => void;
}

export function ArchitectureTab({
  hasResults,
  chunks,
  chunkScores,
  keywords,
  onGoToResults,
  onNavigateToChunk,
}: ArchitectureTabProps) {
  const [architectureAnalysis, setArchitectureAnalysis] = useState<ArchitectureAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeArchitecture = async () => {
    setIsAnalyzing(true);
    try {
      // Build chunk scores in the format the API expects
      const formattedChunkScores = chunkScores.map((cs) => {
        const scores: Record<string, number> = {};
        cs.keywordScores.forEach(ks => {
          const passageScore = calculatePassageScore(ks.scores.cosine, ks.scores.chamfer);
          scores[ks.keyword] = passageScore / 100;
        });
        return { scores };
      });

      // Build chunk info including heading path for location context
      const chunkInfo = chunks.map((c, idx) => ({
        text: c.text || String(c),
        headingPath: c.headingPath || [],
        heading: c.headingPath?.[c.headingPath.length - 1] || '',
        textWithoutCascade: c.textWithoutCascade || c.text,
      }));

      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: {
          type: 'analyze_architecture',
          chunks: chunkInfo.map(c => c.text),
          queries: keywords,
          chunkScores: formattedChunkScores,
          headings: chunkInfo.map(c => c.heading),
          // Include heading paths for location context
          chunkMetadata: chunkInfo.map((c, idx) => ({
            index: idx,
            headingPath: c.headingPath,
            preview: c.textWithoutCascade.slice(0, 200),
          })),
        },
      });
      
      if (error) throw error;
      if (data?.result) {
        setArchitectureAnalysis(data.result);
        toast.success(`Architecture analysis complete: ${data.result.issues?.length || 0} issues found`);
      }
    } catch (err) {
      console.error('Architecture analysis failed:', err);
      toast.error('Failed to analyze architecture');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!hasResults) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="empty-state">
          <Layers size={48} strokeWidth={1} />
          <h3>Run Analysis First</h3>
          <p>Architecture analysis requires chunk analysis results</p>
          <button className="btn-secondary" onClick={onGoToResults}>
            Go to Results
          </button>
        </div>
      </div>
    );
  }

  if (!architectureAnalysis) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="empty-state max-w-md">
          <Layers size={48} strokeWidth={1} />
          <h3>Architecture Analysis</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Identifies structural issues across your document: misplaced content, redundancy, broken atomicity, and coverage gaps.
          </p>
          <p className="text-muted-foreground text-xs mb-6">
            This analysis examines where each chunk sits in the document and whether it's in the right place for the queries it targets.
          </p>
          <button 
            onClick={handleAnalyzeArchitecture}
            disabled={isAnalyzing}
            className="btn-primary flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing Structure...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4" />
                Run Architecture Analysis
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Architecture Report</span>
          {architectureAnalysis.summary.totalIssues > 0 && (
            <span className="text-xs text-muted-foreground">
              {architectureAnalysis.summary.totalIssues} issues found
            </span>
          )}
        </div>
        <button 
          onClick={handleAnalyzeArchitecture}
          disabled={isAnalyzing}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          {isAnalyzing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Layers className="h-3 w-3" />
          )}
          Re-analyze
        </button>
      </div>

      {/* Report Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <ArchitectureReport 
            analysis={architectureAnalysis}
            onNavigateToChunk={(idx) => {
              if (onNavigateToChunk) {
                onNavigateToChunk(idx);
              }
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
