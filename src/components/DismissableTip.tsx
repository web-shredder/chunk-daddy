import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DismissableTipProps {
  tipId: string;
  children: React.ReactNode;
  className?: string;
}

export function DismissableTip({ tipId, children, className }: DismissableTipProps) {
  const [dismissed, setDismissed] = useState(true);
  
  useEffect(() => {
    const isDismissed = localStorage.getItem(`tip-${tipId}`) === 'dismissed';
    setDismissed(isDismissed);
  }, [tipId]);
  
  const handleDismiss = () => {
    localStorage.setItem(`tip-${tipId}`, 'dismissed');
    setDismissed(true);
  };
  
  if (dismissed) return null;
  
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg",
      "bg-surface border border-border",
      "text-sm text-muted-foreground",
      "animate-in fade-in slide-in-from-top-1 duration-200",
      className
    )}>
      <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
      <p className="flex-1 leading-relaxed">{children}</p>
      <button 
        onClick={handleDismiss}
        className="icon-button h-6 w-6 -mr-1 -mt-1"
        aria-label="Dismiss tip"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
