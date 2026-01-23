import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Info, Lightbulb, Calculator, FileText } from 'lucide-react';
import { SCORE_DEFINITIONS, ScoreKey } from '@/constants/scoreDefinitions';

interface ScoreInfoDialogProps {
  scoreKey: ScoreKey;
  trigger?: React.ReactNode;
}

export function ScoreInfoDialog({ scoreKey, trigger }: ScoreInfoDialogProps) {
  const definition = SCORE_DEFINITIONS[scoreKey];
  
  if (!definition) return null;
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <button className="p-1 hover:bg-muted rounded transition-colors">
            <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {definition.name}
            <span className="text-sm font-normal text-muted-foreground">
              (Target: {definition.goodThreshold}+)
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {definition.fullDescription}
          </p>
          
          {/* Main Formula */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Calculation</span>
            </div>
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words">
              {definition.calculation}
            </pre>
          </div>
          
          {/* Sub-components (if any) */}
          {definition.subComponents && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Score Components</p>
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(definition.subComponents).map(([key, component]) => (
                  <AccordionItem key={key} value={key} className="border rounded-lg px-3 mb-2">
                    <AccordionTrigger className="py-2 hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <span className="text-sm capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Weight: {(component.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-2 space-y-2">
                        <code className="text-xs font-mono text-foreground/80 block bg-muted p-2 rounded break-words">
                          {component.formula}
                        </code>
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium mb-1">Example:</p>
                          <p className="whitespace-pre-wrap">{component.example}</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
          
          {/* Worked Example */}
          <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Worked Example</span>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Query:</p>
                <p className="font-medium">"{definition.example.query}"</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Content:</p>
                <p className="text-muted-foreground text-xs leading-relaxed italic">
                  "{definition.example.content}"
                </p>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Breakdown:</p>
                  <span className="font-bold text-foreground">
                    Score: {definition.example.score}
                  </span>
                </div>
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {definition.example.breakdown}
                </pre>
              </div>
            </div>
          </div>
          
          {/* Tips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium">Optimization Tips</span>
            </div>
            <ul className="space-y-1.5">
              {definition.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-foreground/50">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
