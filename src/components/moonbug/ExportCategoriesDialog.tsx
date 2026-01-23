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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  Copy,
  Check,
  Grid3X3
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CategoryBreakdown, CategorizationSummary } from '@/lib/query-categorization';
import {
  exportCategorizedQueriesToCSV,
  exportCategorizedQueriesAsMarkdown,
  exportCategorizedQueriesAsJSON,
  downloadFile,
  type ExportOptions,
} from '@/lib/export-categorized-queries';

interface ExportCategoriesDialogProps {
  breakdown: CategoryBreakdown;
  summary: CategorizationSummary;
  primaryQuery: string;
  trigger?: React.ReactNode;
}

export function ExportCategoriesDialog({
  breakdown,
  summary,
  primaryQuery,
  trigger,
}: ExportCategoriesDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Category filters
  const [categoryFilters, setCategoryFilters] = useState({
    includeOptimization: true,
    includeGaps: true,
    includeDrift: true,
    includeOutOfScope: false, // Default off - usually not needed
  });
  
  // Column filters
  const [columnFilters, setColumnFilters] = useState({
    includeScores: true,
    includeIntentAnalysis: true,
    includeEntityAnalysis: false, // Default off - verbose
    includeActionInfo: true,
  });
  
  const options: ExportOptions = {
    ...categoryFilters,
    ...columnFilters,
  };
  
  // Calculate how many variants will be exported
  const exportCount = useMemo(() => {
    let count = 0;
    if (categoryFilters.includeOptimization) count += breakdown.optimizationOpportunities.length;
    if (categoryFilters.includeGaps) count += breakdown.contentGaps.length;
    if (categoryFilters.includeDrift) count += breakdown.intentDrift.length;
    if (categoryFilters.includeOutOfScope) count += breakdown.outOfScope.length;
    return count;
  }, [categoryFilters, breakdown]);
  
  const handleCopy = async (format: 'csv' | 'markdown' | 'json') => {
    let content: string;
    switch (format) {
      case 'csv':
        content = exportCategorizedQueriesToCSV(breakdown, summary, primaryQuery, options);
        break;
      case 'markdown':
        content = exportCategorizedQueriesAsMarkdown(breakdown, summary, primaryQuery, options);
        break;
      case 'json':
        content = exportCategorizedQueriesAsJSON(breakdown, summary, primaryQuery, options);
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
        content = exportCategorizedQueriesToCSV(breakdown, summary, primaryQuery, options);
        filename = `categorized-queries-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      case 'markdown':
        content = exportCategorizedQueriesAsMarkdown(breakdown, summary, primaryQuery, options);
        filename = `categorized-queries-${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
      case 'json':
        content = exportCategorizedQueriesAsJSON(breakdown, summary, primaryQuery, options);
        filename = `categorized-queries-${timestamp}.json`;
        mimeType = 'application/json';
        break;
    }
    
    downloadFile(content, filename, mimeType);
    toast.success(`Downloaded ${filename}`);
  };
  
  if (summary.total === 0) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export Categories ({summary.total})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-accent" />
            Export Categorized Queries
          </DialogTitle>
          <DialogDescription>
            Configure which categories and columns to include in your export
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs transition-opacity",
              categoryFilters.includeOptimization 
                ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" 
                : "opacity-50"
            )}
          >
            {breakdown.optimizationOpportunities.length} Optimization
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs transition-opacity",
              categoryFilters.includeGaps 
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" 
                : "opacity-50"
            )}
          >
            {breakdown.contentGaps.length} Gaps
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs transition-opacity",
              categoryFilters.includeDrift 
                ? "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400" 
                : "opacity-50"
            )}
          >
            {breakdown.intentDrift.length} Drift
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs transition-opacity",
              categoryFilters.includeOutOfScope 
                ? "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400" 
                : "opacity-50"
            )}
          >
            {breakdown.outOfScope.length} Out of Scope
          </Badge>
          
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            Exporting {exportCount} of {summary.total}
          </Badge>
        </div>
        
        <Tabs defaultValue="configure" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          
          <TabsContent value="configure" className="flex-1 mt-4 space-y-6">
            {/* Category Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Categories to Include</Label>
              <div className="space-y-2 pl-1">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-optimization"
                    checked={categoryFilters.includeOptimization}
                    onCheckedChange={(checked) => 
                      setCategoryFilters(prev => ({ ...prev, includeOptimization: !!checked }))
                    }
                  />
                  <Label htmlFor="include-optimization" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                    Optimization Opportunities
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                      {breakdown.optimizationOpportunities.length}
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-gaps"
                    checked={categoryFilters.includeGaps}
                    onCheckedChange={(checked) => 
                      setCategoryFilters(prev => ({ ...prev, includeGaps: !!checked }))
                    }
                  />
                  <Label htmlFor="include-gaps" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                    Content Gaps
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      {breakdown.contentGaps.length}
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-drift"
                    checked={categoryFilters.includeDrift}
                    onCheckedChange={(checked) => 
                      setCategoryFilters(prev => ({ ...prev, includeDrift: !!checked }))
                    }
                  />
                  <Label htmlFor="include-drift" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                    Intent Drift
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
                      {breakdown.intentDrift.length}
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-outofscope"
                    checked={categoryFilters.includeOutOfScope}
                    onCheckedChange={(checked) => 
                      setCategoryFilters(prev => ({ ...prev, includeOutOfScope: !!checked }))
                    }
                  />
                  <Label htmlFor="include-outofscope" className="text-sm font-normal cursor-pointer flex items-center gap-2">
                    Out of Scope
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400">
                      {breakdown.outOfScope.length}
                    </Badge>
                  </Label>
                </div>
              </div>
            </div>
            
            {/* Column Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Columns to Include</Label>
              <div className="space-y-2 pl-1">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-query"
                    checked={true}
                    disabled
                  />
                  <Label htmlFor="include-query" className="text-sm font-normal text-muted-foreground cursor-not-allowed">
                    Query & Category <span className="text-xs">(always included)</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-scores"
                    checked={columnFilters.includeScores}
                    onCheckedChange={(checked) => 
                      setColumnFilters(prev => ({ ...prev, includeScores: !!checked }))
                    }
                  />
                  <Label htmlFor="include-scores" className="text-sm font-normal cursor-pointer">
                    Scores <span className="text-xs text-muted-foreground">(Similarity, Passage, Best Chunk)</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-intent"
                    checked={columnFilters.includeIntentAnalysis}
                    onCheckedChange={(checked) => 
                      setColumnFilters(prev => ({ ...prev, includeIntentAnalysis: !!checked }))
                    }
                  />
                  <Label htmlFor="include-intent" className="text-sm font-normal cursor-pointer">
                    Intent Analysis <span className="text-xs text-muted-foreground">(Drift Score, Level)</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-entity"
                    checked={columnFilters.includeEntityAnalysis}
                    onCheckedChange={(checked) => 
                      setColumnFilters(prev => ({ ...prev, includeEntityAnalysis: !!checked }))
                    }
                  />
                  <Label htmlFor="include-entity" className="text-sm font-normal cursor-pointer">
                    Entity Analysis <span className="text-xs text-muted-foreground">(Overlap %, Missing Entities)</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="include-action"
                    checked={columnFilters.includeActionInfo}
                    onCheckedChange={(checked) => 
                      setColumnFilters(prev => ({ ...prev, includeActionInfo: !!checked }))
                    }
                  />
                  <Label htmlFor="include-action" className="text-sm font-normal cursor-pointer">
                    Actions <span className="text-xs text-muted-foreground">(Primary Action, Reasoning)</span>
                  </Label>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="export" className="flex-1 mt-4">
            <div className="space-y-4">
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
