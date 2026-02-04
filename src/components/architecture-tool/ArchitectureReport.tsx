import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  ArrowRight, 
  Copy, 
  Layers, 
  Link2, 
  MessageSquareWarning,
  Target,
  Unlink,
  CheckCircle2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArchitectureAnalysis, ArchitectureIssue, ArchitectureIssueType } from '@/lib/optimizer-types';

interface ArchitectureReportProps {
  analysis: ArchitectureAnalysis;
  onNavigateToChunk?: (chunkIndex: number) => void;
}

const issueIcons: Record<ArchitectureIssueType, React.ReactNode> = {
  MISPLACED_CONTENT: <ArrowRight className="h-4 w-4" />,
  REDUNDANCY: <Copy className="h-4 w-4" />,
  BROKEN_ATOMICITY: <Unlink className="h-4 w-4" />,
  TOPIC_INCOHERENCE: <Layers className="h-4 w-4" />,
  COVERAGE_GAP: <Target className="h-4 w-4" />,
  ORPHANED_MENTION: <MessageSquareWarning className="h-4 w-4" />,
};

const issueDescriptions: Record<ArchitectureIssueType, string> = {
  MISPLACED_CONTENT: 'Content appears in the wrong section based on its topic',
  REDUNDANCY: 'Same information repeated across multiple chunks',
  BROKEN_ATOMICITY: 'Chunk references external context and cannot stand alone',
  TOPIC_INCOHERENCE: 'Single chunk covers multiple unrelated topics',
  COVERAGE_GAP: 'Query clusters with no chunk scoring above threshold',
  ORPHANED_MENTION: 'Topic mentioned briefly but never developed',
};

const severityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-primary/10 text-primary border-primary/20',
};

const IssueCard: React.FC<{
  issue: ArchitectureIssue;
  onNavigateToChunk?: (chunkIndex: number) => void;
}> = ({ issue, onNavigateToChunk }) => {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {issueIcons[issue.type]}
            </span>
            <CardTitle className="text-sm font-medium">
              {issue.type.replace(/_/g, ' ')}
            </CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-xs", severityColors[issue.severity])}>
            {issue.severity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{issue.description}</p>
        
        <div className="text-xs">
          <span className="font-medium text-muted-foreground">Recommendation: </span>
          <span className="text-foreground">{issue.recommendation}</span>
        </div>
        
        <div className="text-xs">
          <span className="font-medium text-muted-foreground">Impact: </span>
          <span className="text-foreground">{issue.impact}</span>
        </div>
        
        {issue.chunkIndices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.chunkIndices.map(idx => (
              <Badge 
                key={idx}
                variant="secondary" 
                className="text-xs cursor-pointer hover:bg-accent/20 transition-colors"
                onClick={() => onNavigateToChunk?.(idx)}
              >
                Chunk {idx + 1}
              </Badge>
            ))}
          </div>
        )}
        
        {issue.relatedQueries && issue.relatedQueries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
            {issue.relatedQueries.map((q, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                {q}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ArchitectureReport: React.FC<ArchitectureReportProps> = ({
  analysis,
  onNavigateToChunk,
}) => {
  const { summary, issues } = analysis;
  
  // Group issues by type
  const issuesByType = issues.reduce((acc, issue) => {
    acc[issue.type] = acc[issue.type] || [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<ArchitectureIssueType, ArchitectureIssue[]>);
  
  const scoreColor = summary.architectureScore >= 80 
    ? 'text-green-600' 
    : summary.architectureScore >= 60 
    ? 'text-yellow-600' 
    : 'text-destructive';
  
  return (
    <div className="space-y-4 p-4">
      {/* Summary Card */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Architecture Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className={cn("text-3xl font-bold tabular-nums", scoreColor)}>
                {summary.architectureScore}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Architecture Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{summary.highPriority}</p>
              <p className="text-xs text-muted-foreground mt-1">High Priority</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{summary.mediumPriority}</p>
              <p className="text-xs text-muted-foreground mt-1">Medium Priority</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{summary.lowPriority}</p>
              <p className="text-xs text-muted-foreground mt-1">Low Priority</p>
            </div>
          </div>
          
          {summary.topRecommendation && (
            <Alert className="bg-muted/50 border-border">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <span className="font-medium">Top Recommendation:</span> {summary.topRecommendation}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Issues by Type */}
      {Object.entries(issuesByType).map(([type, typeIssues]) => (
        <div key={type} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {issueIcons[type as ArchitectureIssueType]}
            <span>{type.replace(/_/g, ' ')}</span>
            <Badge variant="secondary" className="text-xs ml-1">
              {typeIssues.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {issueDescriptions[type as ArchitectureIssueType]}
          </p>
          <div className="space-y-2">
            {typeIssues.map(issue => (
              <IssueCard 
                key={issue.id} 
                issue={issue} 
                onNavigateToChunk={onNavigateToChunk} 
              />
            ))}
          </div>
        </div>
      ))}
      
      {issues.length === 0 && (
        <Alert className="bg-green-500/10 border-green-500/30">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-700">
            No architectural issues detected. Your content structure looks good!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ArchitectureReport;
