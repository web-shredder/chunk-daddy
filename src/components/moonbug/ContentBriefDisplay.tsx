import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Copy, 
  Download,
  CheckCircle,
  BookOpen,
  Link2,
  Lightbulb,
  X,
  Target,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface ContentBrief {
  heading: string;
  estimatedWords: string;
  placement: string;
  keyPoints: string[];
  requiredEntities: string[];
  semanticEnrichment: string[];
  exampleSentences: string[];
  internalLinks: string[];
  queryAlignment: string;
  gapAnalysis?: string;
}

interface ContentBriefDisplayProps {
  gapQuery: string;
  brief: ContentBrief;
  onClose: () => void;
  onApplyToContent?: () => void;
}

export function ContentBriefDisplay({
  gapQuery,
  brief,
  onClose,
  onApplyToContent,
}: ContentBriefDisplayProps) {
  
  const copyBriefAsMarkdown = () => {
    const markdown = `# Content Brief: ${brief.heading}

**Gap Query:** ${gapQuery}
**Estimated Length:** ${brief.estimatedWords} words
**Placement:** ${brief.placement}

## Key Points to Cover
${brief.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## Required Entities
${brief.requiredEntities.map(e => `- ${e}`).join('\n')}

## Semantic Enrichment
Related concepts to include for depth:
${brief.semanticEnrichment.map(s => `- ${s}`).join('\n')}

## Example Sentences
${brief.exampleSentences.map((s) => `> ${s}`).join('\n\n')}

## Internal Linking Opportunities
${brief.internalLinks.map(l => `- ${l}`).join('\n')}

## Query Alignment
${brief.queryAlignment}
${brief.gapAnalysis ? `\n## Gap Analysis\n${brief.gapAnalysis}` : ''}
`;
    navigator.clipboard.writeText(markdown);
    toast.success('Brief copied to clipboard as Markdown');
  };
  
  const downloadBrief = () => {
    const blob = new Blob([JSON.stringify({ gapQuery, brief }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-brief-${gapQuery.slice(0, 30).replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Brief downloaded as JSON');
  };
  
  return (
    <Card className="border-amber-200 dark:border-amber-800/50 bg-gradient-to-b from-amber-50/50 to-background dark:from-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Content Brief
              </span>
            </div>
            <CardTitle className="text-lg font-semibold break-words">
              {brief.heading}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 break-words">
              For gap query: <span className="font-medium">"{gapQuery}"</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="font-mono text-xs">
              {brief.estimatedWords} words
            </Badge>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-5">
        {/* Placement */}
        <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
          <Target className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Placement:</span>
          <span className="font-medium">{brief.placement}</span>
        </div>
        
        <Separator />
        
        {/* Key Points */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            Key Points to Cover
          </h4>
          <ol className="space-y-2 pl-1">
            {brief.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-muted-foreground font-mono text-xs mt-0.5 w-5 shrink-0">
                  {i + 1}.
                </span>
                <span className="break-words">{point}</span>
              </li>
            ))}
          </ol>
        </div>
        
        <Separator />
        
        {/* Required Entities */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Required Entities
          </h4>
          <div className="flex flex-wrap gap-2">
            {brief.requiredEntities.map((entity, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {entity}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Semantic Enrichment */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Semantic Enrichment
          </h4>
          <p className="text-xs text-muted-foreground">
            Related concepts to include for depth:
          </p>
          <div className="flex flex-wrap gap-2">
            {brief.semanticEnrichment.map((concept, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {concept}
              </Badge>
            ))}
          </div>
        </div>
        
        <Separator />
        
        {/* Example Sentences */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Example Sentences</h4>
          <div className="space-y-2">
            {brief.exampleSentences.map((sentence, i) => (
              <blockquote 
                key={i} 
                className="text-sm italic border-l-2 border-muted-foreground/30 pl-3 py-1 text-muted-foreground break-words"
              >
                {sentence}
              </blockquote>
            ))}
          </div>
        </div>
        
        {/* Internal Links */}
        {brief.internalLinks.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Internal Linking Opportunities
            </h4>
            <ul className="space-y-1 pl-1">
              {brief.internalLinks.map((link, i) => (
                <li key={i} className="text-sm text-muted-foreground break-words">
                  • {link}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <Separator />
        
        {/* Query Alignment */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            How This Addresses the Gap
          </h4>
          <p className="text-sm text-muted-foreground break-words">
            {brief.queryAlignment}
          </p>
        </div>

        {/* Gap Analysis (if present) */}
        {brief.gapAnalysis && (
          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
            <h4 className="text-sm font-semibold">Gap Analysis</h4>
            <p className="text-sm text-muted-foreground break-words">
              {brief.gapAnalysis}
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          Close
        </Button>
        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
          <Button variant="secondary" size="sm" onClick={copyBriefAsMarkdown} className="flex-1 sm:flex-none">
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy Markdown
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadBrief} className="flex-1 sm:flex-none">
            <Download className="h-3.5 w-3.5 mr-1" />
            Download
          </Button>
          {onApplyToContent && (
            <Button size="sm" onClick={onApplyToContent} className="flex-1 sm:flex-none">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Apply to Content
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default ContentBriefDisplay;
