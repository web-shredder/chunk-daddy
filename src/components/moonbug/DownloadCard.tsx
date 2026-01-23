/**
 * DownloadCard Component
 * Reusable card for download options with format selection
 */
import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type DownloadFormat = 'markdown' | 'txt' | 'html' | 'csv' | 'json' | 'pdf';

interface DownloadCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  formats: DownloadFormat[];
  onDownload: (format: DownloadFormat) => void | Promise<void>;
  disabled?: boolean;
  badge?: string;
  featured?: boolean;
}

const formatLabels: Record<DownloadFormat, string> = {
  markdown: 'Markdown',
  txt: 'Plain Text',
  html: 'HTML',
  csv: 'CSV',
  json: 'JSON',
  pdf: 'PDF'
};

const formatExtensions: Record<DownloadFormat, string> = {
  markdown: '.md',
  txt: '.txt',
  html: '.html',
  csv: '.csv',
  json: '.json',
  pdf: '.pdf'
};

export function DownloadCard({
  title,
  description,
  icon,
  formats,
  onDownload,
  disabled,
  badge,
  featured
}: DownloadCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<DownloadFormat | null>(null);
  
  const handleDownload = async (format: DownloadFormat) => {
    if (disabled || isDownloading) return;
    
    setIsDownloading(true);
    setDownloadingFormat(format);
    
    try {
      await onDownload(format);
      toast.success(`Downloaded ${title} as ${formatLabels[format]}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(`Failed to download ${title}`);
    } finally {
      setIsDownloading(false);
      setDownloadingFormat(null);
    }
  };
  
  return (
    <Card className={cn(
      "transition-all",
      featured && "border-primary/50 bg-primary/5 dark:bg-primary/10",
      disabled && "opacity-50"
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl shrink-0",
            featured 
              ? "bg-primary/10 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{title}</h3>
              {badge && (
                <Badge variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              )}
              {featured && (
                <Badge variant="default" className="text-xs">
                  Recommended
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="border-t pt-4">
        <div className="flex flex-wrap gap-2 w-full">
          {formats.map(format => (
            <Button
              key={format}
              variant={featured ? "default" : "outline"}
              size="sm"
              onClick={() => handleDownload(format)}
              disabled={disabled || isDownloading}
              className="gap-1.5"
            >
              {isDownloading && downloadingFormat === format ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {formatLabels[format]}
              <span className="text-xs opacity-60">{formatExtensions[format]}</span>
            </Button>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}

export default DownloadCard;
