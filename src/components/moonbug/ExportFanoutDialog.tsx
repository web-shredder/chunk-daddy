import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileJson,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FanoutExportQuery,
  exportFanoutAsCSV,
  exportFanoutAsMarkdown,
  exportFanoutAsJSON,
  downloadFile,
} from '@/lib/export-fanout';

interface ExportFanoutDialogProps {
  queries: FanoutExportQuery[];
  primaryQuery: string;
  trigger?: React.ReactNode;
}

export function ExportFanoutDialog({
  queries,
  primaryQuery,
  trigger,
}: ExportFanoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'csv' | 'markdown' | 'json' | null>(null);
  
  const selectedCount = queries.filter(q => q.isSelected).length;
  const maxLevel = queries.length > 0 ? Math.max(...queries.map(q => q.level)) : 0;
  
  const handleCopy = async (format: 'csv' | 'markdown' | 'json') => {
    let content: string;
    switch (format) {
      case 'csv':
        content = exportFanoutAsCSV(queries, primaryQuery);
        break;
      case 'markdown':
        content = exportFanoutAsMarkdown(queries, primaryQuery);
        break;
      case 'json':
        content = exportFanoutAsJSON(queries, primaryQuery);
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
        content = exportFanoutAsCSV(queries, primaryQuery);
        filename = `fanout-queries-${timestamp}.csv`;
        mimeType = 'text/csv';
        break;
      case 'markdown':
        content = exportFanoutAsMarkdown(queries, primaryQuery);
        filename = `fanout-queries-${timestamp}.md`;
        mimeType = 'text/markdown';
        break;
      case 'json':
        content = exportFanoutAsJSON(queries, primaryQuery);
        filename = `fanout-queries-${timestamp}.json`;
        mimeType = 'application/json';
        break;
    }
    
    downloadFile(content, filename, mimeType);
    toast.success(`Downloaded ${filename}`);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Query Fanout</DialogTitle>
          <DialogDescription>
            {queries.length} queries • {maxLevel + 1} levels • {selectedCount} selected
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {/* CSV */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">CSV Spreadsheet</p>
                <p className="text-xs text-muted-foreground">For Excel, Sheets</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy('csv')}>
                {copied === 'csv' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload('csv')}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Markdown */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Markdown</p>
                <p className="text-xs text-muted-foreground">For Notion, docs</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy('markdown')}>
                {copied === 'markdown' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload('markdown')}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* JSON */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">JSON Data</p>
                <p className="text-xs text-muted-foreground">For automation, API</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy('json')}>
                {copied === 'json' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload('json')}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ExportFanoutDialog;
