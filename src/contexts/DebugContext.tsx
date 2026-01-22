import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

export interface DebugEvent {
  id: string;
  timestamp: string;
  tab: string;
  action: string;
  data: Record<string, unknown>;
  uiState: Record<string, unknown>;
  error?: boolean;
}

interface DebugContextType {
  events: DebugEvent[];
  logEvent: (action: string, data: Record<string, unknown>, uiState?: Record<string, unknown>, isError?: boolean) => void;
  exportDebugData: () => void;
  clearDebug: () => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  currentTab: string;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

interface DebugProviderProps {
  children: ReactNode;
  currentTab: string;
}

export function DebugProvider({ children, currentTab }: DebugProviderProps) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isEnabled, setEnabled] = useState(true);
  const eventIdCounter = useRef(0);

  const logEvent = useCallback((
    action: string, 
    data: Record<string, unknown>, 
    uiState: Record<string, unknown> = {}, 
    isError: boolean = false
  ) => {
    if (!isEnabled) return;
    
    const event: DebugEvent = {
      id: `evt_${Date.now()}_${eventIdCounter.current++}`,
      timestamp: new Date().toISOString(),
      tab: currentTab,
      action,
      data: JSON.parse(JSON.stringify(data)), // Deep clone to prevent mutations
      uiState: JSON.parse(JSON.stringify(uiState)),
      error: isError,
    };
    
    setEvents(prev => [...prev.slice(-500), event]); // Keep last 500 events
    
    // Console log with color coding
    const style = isError 
      ? 'color: #ef4444; font-weight: bold' 
      : 'color: #22c55e; font-weight: normal';
    console.log(`%c🔍 [${currentTab}] ${action}`, style, event);
  }, [currentTab, isEnabled]);

  const exportDebugData = useCallback(() => {
    const timestamp = new Date().toISOString();
    
    const streamingEvents = events.filter(e => 
      e.action.includes('STREAM') || e.action.includes('OPTIMIZATION')
    );
    
    const debugReport = {
      meta: {
        exportedAt: timestamp,
        version: '2.0',
        totalEvents: events.length,
        appVersion: 'Chunk Daddy',
      },
      
      events: events,
      
      summary: {
        tabsVisited: [...new Set(events.map(e => e.tab))],
        actionsPerformed: events.map(e => ({ 
          action: e.action, 
          timestamp: e.timestamp,
          tab: e.tab,
        })),
        errorCount: events.filter(e => e.error).length,
        errors: events.filter(e => e.error).map(e => ({
          action: e.action,
          timestamp: e.timestamp,
          tab: e.tab,
          data: e.data,
        })),
        streamingEvents: streamingEvents.length,
        optimizationAttempts: events.filter(e => e.action === 'OPTIMIZATION_STARTED').length,
        completedOptimizations: events.filter(e => e.action === 'OPTIMIZATION_COMPLETE').length,
        failedOptimizations: events.filter(e => e.action === 'OPTIMIZATION_FAILED').length,
      },
      
      timeline: events.map(e => ({
        time: new Date(e.timestamp).toLocaleTimeString(),
        tab: e.tab,
        action: e.action,
        error: e.error || false,
      })),
    };

    // Create downloadable file
    const blob = new Blob([JSON.stringify(debugReport, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chunk-daddy-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('📥 Debug data exported:', debugReport.summary);
  }, [events]);

  const clearDebug = useCallback(() => {
    setEvents([]);
    console.log('🗑️ Debug log cleared');
  }, []);

  return (
    <DebugContext.Provider value={{ 
      events, 
      logEvent, 
      exportDebugData, 
      clearDebug, 
      isEnabled, 
      setEnabled,
      currentTab,
    }}>
      {children}
    </DebugContext.Provider>
  );
}

export const useDebug = () => {
  const context = useContext(DebugContext);
  if (!context) {
    // Return a no-op version if used outside provider (for safety)
    return {
      events: [],
      logEvent: () => {},
      exportDebugData: () => {},
      clearDebug: () => {},
      isEnabled: false,
      setEnabled: () => {},
      currentTab: '',
    };
  }
  return context;
};
