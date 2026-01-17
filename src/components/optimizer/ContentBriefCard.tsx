import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Copy, FileText } from 'lucide-react';
import { ContentBrief } from '@/lib/optimizer-types';
import { useToast } from '@/hooks/use-toast';

interface ContentBriefCardProps {
  brief: ContentBrief;
  index?: number;
}

export function ContentBriefCard({ brief, index }: ContentBriefCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const copyBrief = () => {
    const markdown = `## ${brief.suggestedHeading}

**Target Query:** ${brief.targetQuery}
**Placement:** ${brief.placementDescription}
**Target Length:** ${brief.targetWordCount.min}-${brief.targetWordCount.max} words

### Key Points to Cover
${brief.keyPoints.map(p => `- ${p}`).join('\n')}

### Draft Opening
${brief.draftOpening}

### Gap Analysis
${brief.gapAnalysis}`;

    navigator.clipboard.writeText(markdown);
    toast({
      title: 'Brief copied',
      description: 'Content brief copied to clipboard as markdown',
    });
  };

  return (
    <Card className="border-2 border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200">
              <FileText className="w-3 h-3 mr-1" />
              Content Brief {index !== undefined ? `#${index + 1}` : ''}
            </Badge>
            <CardTitle className="text-base">{brief.suggestedHeading}</CardTitle>
            <p className="text-sm text-muted-foreground">Query: "{brief.targetQuery}"</p>
          </div>
          <Button variant="ghost" size="sm" onClick={copyBrief}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{brief.headingLevel.toUpperCase()}</Badge>
          <Badge variant="secondary">{brief.targetWordCount.min}-{brief.targetWordCount.max} words</Badge>
        </div>
        
        <p className="text-sm">
          <span className="font-medium">Placement:</span> {brief.placementDescription}
        </p>

        <div>
          <p className="text-sm font-medium mb-1">Key Points:</p>
          <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
            {brief.keyPoints.slice(0, expanded ? undefined : 3).map((point, i) => (
              <li key={i}>{point}</li>
            ))}
            {!expanded && brief.keyPoints.length > 3 && (
              <li className="text-amber-600">+{brief.keyPoints.length - 3} more...</li>
            )}
          </ul>
        </div>

        {expanded && (
          <>
            <div>
              <p className="text-sm font-medium mb-1">Draft Opening:</p>
              <p className="text-sm text-muted-foreground italic">"{brief.draftOpening}"</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Gap Analysis:</p>
              <p className="text-sm text-muted-foreground">{brief.gapAnalysis}</p>
            </div>
          </>
        )}

        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full">
          {expanded ? (
            <>Show Less <ChevronUp className="ml-1 w-4 h-4" /></>
          ) : (
            <>Show More <ChevronDown className="ml-1 w-4 h-4" /></>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
