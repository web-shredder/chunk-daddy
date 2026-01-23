import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronLeft, ChevronRight, Loader2, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
export type WorkflowStep = {
  id: string;
  label: string;
  shortLabel?: string; // For mobile
};
interface WorkflowStepperProps {
  steps: WorkflowStep[];
  currentStepId: string;
  completedStepIds: string[];
  onStepClick: (stepId: string) => void;
  // Status indicators
  isAnalyzing?: boolean;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  wordCount?: number;
  lastSaved?: Date | null;
  onSave?: () => void;
}
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}
export function WorkflowStepper({
  steps,
  currentStepId,
  completedStepIds,
  onStepClick,
  isAnalyzing,
  isSaving,
  hasUnsavedChanges,
  wordCount,
  lastSaved,
  onSave
}: WorkflowStepperProps) {
  console.log('[WorkflowStepper] Rendering with:', { currentStepId, steps: steps.map(s => s.id) });
  
  const handleStepClick = (stepId: string) => {
    console.log('[WorkflowStepper] Step clicked:', stepId);
    onStepClick(stepId);
  };
  
  const isMobile = useIsMobile();
  const currentIndex = steps.findIndex(s => s.id === currentStepId);

  // Mobile: Show compact navigation
  if (isMobile) {
    const prevStep = currentIndex > 0 ? steps[currentIndex - 1] : null;
    const nextStep = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;
    const currentStep = steps[currentIndex];
    return <div className="bg-background border-b border-border px-3 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* Previous button */}
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => prevStep && handleStepClick(prevStep.id)} disabled={!prevStep}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Current step indicator */}
          <div className="flex flex-col items-center gap-1 flex-1">
            {/* Dot indicators */}
            <div className="flex items-center gap-1.5">
              {steps.map(step => {
              const isCompleted = completedStepIds.includes(step.id);
              const isCurrent = step.id === currentStepId;
              return <button key={step.id} onClick={() => handleStepClick(step.id)} className={cn("w-2 h-2 rounded-full transition-all", isCompleted && !isCurrent && "bg-primary", isCurrent && "w-2.5 h-2.5 bg-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background", !isCompleted && !isCurrent && "bg-muted border border-muted-foreground/30")} />;
            })}
            </div>
            
            {/* Current step name */}
            <span className="text-sm font-medium text-foreground">
              {currentStep?.shortLabel || currentStep?.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Step {currentIndex + 1} of {steps.length}
            </span>
          </div>
          
          {/* Next button */}
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => nextStep && handleStepClick(nextStep.id)} disabled={!nextStep}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>;
  }

  // Desktop: Full horizontal stepper
  return <div className="bg-background border-b border-border px-6 py-4 shrink-0">
      <div className="flex items-start justify-center ">
        {/* Stepper */}
        <div className="flex items-start flex-1 max-w-4xl">
          {steps.map((step, index) => {
          const isCompleted = completedStepIds.includes(step.id);
          const isCurrent = step.id === currentStepId;
          const isFuture = !isCompleted && !isCurrent;
          const isLast = index === steps.length - 1;
          return <div key={step.id} className={cn("flex items-start", !isLast && "flex-1")}>
                {/* Step circle + label container */}
                <button onClick={() => handleStepClick(step.id)} className="flex flex-col items-center gap-2 group cursor-pointer">
                  {/* Circle */}
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all", isCompleted && !isCurrent && "bg-primary text-primary-foreground", isCurrent && "bg-primary text-primary-foreground ring-[3px] ring-primary/30 ring-offset-2 ring-offset-background", isFuture && "bg-transparent border-2 border-muted text-muted-foreground", "group-hover:scale-110")}>
                    {index + 1}
                  </div>
                  
                  {/* Label */}
                  <span className={cn("text-xs text-center max-w-[80px] leading-tight transition-colors", isCompleted && !isCurrent && "text-foreground", isCurrent && "text-primary font-medium", isFuture && "text-muted-foreground", "group-hover:text-foreground")}>
                    {step.label}
                  </span>
                </button>
                
                {/* Connector line */}
                {!isLast && <div className="flex-1 flex items-center pt-3 px-2 min-w-[24px]">
                    <div className={cn("h-0.5 w-full rounded-full transition-colors", isCompleted || isCurrent ? "bg-primary" : "bg-muted")} />
                  </div>}
              </div>;
        })}
        </div>
        
        {/* Status area - right side */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 ml-6">
          {isAnalyzing && <span className="flex items-center gap-1.5 text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing...
            </span>}
          
          {!isAnalyzing && wordCount !== undefined && wordCount > 0 && <span>{wordCount} words</span>}

          {lastSaved && <span className="flex items-center gap-1">
              {hasUnsavedChanges ? <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--warning))] animate-pulse" />
                  Unsaved
                </> : <>
                  <Check className="h-3 w-3 text-[hsl(var(--success))]" />
                  Saved {formatTimeAgo(lastSaved)}
                </>}
            </span>}

          {hasUnsavedChanges && onSave && <button onClick={onSave} disabled={isSaving} className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-primary hover:bg-accent transition-colors">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </button>}
        </div>
      </div>
    </div>;
}