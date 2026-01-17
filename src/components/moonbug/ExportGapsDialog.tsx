import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ContentGap,
  analyzeContentGaps,
  exportGapsAsCSV,
  exportGapsAsMarkdown,
  exportGapsAsJSON,
  downloadFile,
} from '@/lib/export-content-gaps';
import type { ChunkScore } from '@/hooks/useAnalysis';

interface ExportGapsDialogProps {
  unassignedQueries: string[];
  chunks: Array<{ 
    id: string; 
    text: string; 
    textWithoutCascade?: string;
    headingPath?: string[];
  }>;
  chunkScores: ChunkScore[];
  primaryQuery?: string;
  intentTypes?: Record<string, string>;
  trigger?: React.ReactNode;
}

export function ExportGapsDialog({
  unassignedQueries,
  chunks,
  chunkScores,
  primaryQuery,
  intentTypes,
  trigger,
}: ExportGapsDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  const gaps = useMemo(() => 
    analyzeContentGaps(unassignedQueries, chunks, chunkScores, intentTypes),
    [unassignedQueries, chunks, chunkScores, intentTypes]
  );
  
  const critical = gaps.filter(g => !g.bestMatchChunk || g.bestMatchChunk.score < 30);
  const moderate = gaps.filter(g => g.bestMatchChunk && g.bestMatchChunk.score >= 30 && g.bestMatchChunk.score < 50);
  const minor = gaps.filter(g => g.bestMatchChunk && g.bestMatchChunk.score >= 50);
  
  const handleCopy = async (format: 'csv' | 'markdown' | 'json') => {
    let content: string;
    switch (format) {
      case 'csv':
        content = exportGapsAsCSV(gaps);
        break;
      case 'markdown':
        content = exportGapsAsMarkdown(gaps, primaryQuery);
        break;
      case 'json':
        content = exportGapsAsJSON(gaps, { primaryQuery });
        break;
    }
    
    await navigator.clipboard.writeText(content);
    setCopied(format);
    toast.success(`Copied ${format.toUpperCase()} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };
  
  const handleDownload = (format: 'csv' | 'markdown' | 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];
    let content: string;
    let filename: string;
    let mimeType: string;
    
    switch (format) {
      case 'csv':
        content = exportGapsAsCSV(gaps);
        filename = `content-gaps-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      case 'markdown':
        content = exportGapsAsMarkdown(gaps, primaryQuery);
        filename = `content-gaps-${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
      case 'json':
        content = exportGapsAsJSON(gaps, { primaryQuery });
        filename = `content-gaps-${timestamp}.json`;
        mimeType = 'application/json';
        break;
    }
    
    downloadFile(content, filename, mimeType);
    toast.success(`Downloaded ${filename}`);
  };
  
  if (unassignedQueries.length === 0) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export Content Gaps ({unassignedQueries.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Export Content Gaps
          </DialogTitle>
          <DialogDescription>
            Export {unassignedQueries.length} unassigned queries with analysis and recommendations
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {critical.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {critical.length} Critical (need new content)
            </Badge>
          )}
          {moderate.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
              {moderate.length} Moderate (expand existing)
            </Badge>
          )}
          {minor.length > 0 && (
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
              {minor.length} Minor (optimize existing)
            </Badge>
          )}
        </div>
        
        {/* Preview tabs */}
        <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview Gaps</TabsTrigger>
            <TabsTrigger value="export">Export Options</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {gaps.map((gap, idx) => (
                  <div
                    key={gap.query}
                    className="p-3 rounded-lg border border-border bg-card space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground break-words">
                          {gap.query}
                        </p>
                        {gap.intentType && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {gap.intentType.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "shrink-0 font-mono text-xs",
                          !gap.bestMatchChunk || gap.bestMatchChunk.score < 30
                            ? "text-red-600 border-red-500/30"
                            : gap.bestMatchChunk.score < 50
                              ? "text-yellow-600 border-yellow-500/30"
                              : "text-green-600 border-green-500/30"
                        )}
                      >
                        {gap.bestMatchChunk?.score || 0}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      {gap.diagnosis}
                    </p>
                    
                    <p className="text-xs text-accent">
                      → {gap.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="export" className="flex-1 mt-4">
            <div className="space-y-4">
              {/* Markdown export */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Markdown</p>
                    <p className="text-xs text-muted-foreground">
                      For Notion, docs, content briefs
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy('markdown')}
                  >
                    {copied === 'markdown' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    Copy
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleDownload('markdown')}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download .md
                  </Button>
                </div>
              </div>
              
              {/* CSV export */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">CSV Spreadsheet</p>
                    <p className="text-xs text-muted-foreground">
                      For Excel, Google Sheets, data analysis
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy('csv')}
                  >
                    {copied === 'csv' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    Copy
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleDownload('csv')}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download .csv
                  </Button>
                </div>
              </div>
              
              {/* JSON export */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <FileJson className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">JSON Data</p>
                    <p className="text-xs text-muted-foreground">
                      For automation, API integration, full data
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy('json')}
                  >
                    {copied === 'json' ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    Copy
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleDownload('json')}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download .json
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
