import { useCallback, useRef } from 'react';
import { useDebug } from '@/contexts/DebugContext';

interface StreamingPlan {
  applyArchitecture: boolean;
  architectureTasksCount: number;
  generateBriefs: boolean;
  unassignedQueriesCount: number;
  chunkAssignmentsCount: number;
}

export function useStreamingDebug() {
  const { logEvent } = useDebug();
  const streamingStats = useRef({
    architectureTasksReceived: 0,
    chunksReceived: 0,
    briefsReceived: 0,
    errors: 0,
    startTime: 0,
  });

  const logStreamingStart = useCallback((plan: StreamingPlan) => {
    streamingStats.current = {
      architectureTasksReceived: 0,
      chunksReceived: 0,
      briefsReceived: 0,
      errors: 0,
      startTime: Date.now(),
    };
    
    logEvent('STREAMING_OPTIMIZATION_STARTED', {
      plan,
      totalExpectedActions: 
        (plan.applyArchitecture ? plan.architectureTasksCount : 0) +
        plan.chunkAssignmentsCount +
        (plan.generateBriefs ? plan.unassignedQueriesCount : 0),
    }, {
      autoNavigatingTo: 'outputs',
      mode: 'SSE',
    });
  }, [logEvent]);

  const logArchitectureEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (eventType === 'task_started') {
      logEvent('STREAM_ARCHITECTURE_TASK_STARTED', {
        taskIndex: data.taskIndex,
        totalTasks: data.totalTasks,
      }, {
        step: 'architecture',
        progress: Math.round(((data.taskIndex as number) / (data.totalTasks as number)) * 20),
      });
    } else if (eventType === 'task_applied') {
      streamingStats.current.architectureTasksReceived++;
      logEvent('STREAM_ARCHITECTURE_TASK_APPLIED', {
        taskId: data.taskId,
        tasksReceived: streamingStats.current.architectureTasksReceived,
      }, {
        step: 'architecture',
      });
    } else if (eventType === 'architecture_complete') {
      logEvent('STREAM_ARCHITECTURE_COMPLETE', {
        totalTasksApplied: streamingStats.current.architectureTasksReceived,
        contentLength: (data.finalContent as string)?.length || 0,
      }, {
        step: 'architecture',
      });
    }
  }, [logEvent]);

  const logChunkEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (eventType === 'chunk_started') {
      logEvent('STREAM_CHUNK_OPTIMIZATION_STARTED', {
        chunkNumber: data.chunkNumber,
        query: data.query,
        progress: data.progress,
      }, {
        step: 'chunks',
      });
    } else if (eventType === 'chunk_optimized') {
      streamingStats.current.chunksReceived++;
      logEvent('STREAM_CHUNK_OPTIMIZED', {
        chunkNumber: data.chunkNumber,
        chunkIndex: data.chunkIndex,
        query: data.query,
        originalLength: (data.originalText as string)?.length || 0,
        optimizedLength: (data.optimizedText as string)?.length || 0,
        chunksReceived: streamingStats.current.chunksReceived,
        progress: data.progress,
      }, {
        step: 'chunks',
      });
    } else if (eventType === 'chunks_complete') {
      logEvent('STREAM_CHUNKS_COMPLETE', {
        totalChunksOptimized: streamingStats.current.chunksReceived,
      }, {
        step: 'chunks',
      });
    }
  }, [logEvent]);

  const logBriefEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    if (eventType === 'brief_started') {
      logEvent('STREAM_BRIEF_GENERATION_STARTED', {
        query: data.query,
        index: data.index,
        total: data.total,
      }, {
        step: 'briefs',
      });
    } else if (eventType === 'brief_generated') {
      streamingStats.current.briefsReceived++;
      logEvent('STREAM_BRIEF_GENERATED', {
        brief: data.brief,
        briefsReceived: streamingStats.current.briefsReceived,
        index: data.index,
        total: data.total,
      }, {
        step: 'briefs',
      });
    } else if (eventType === 'briefs_complete') {
      logEvent('STREAM_BRIEFS_COMPLETE', {
        totalBriefsGenerated: streamingStats.current.briefsReceived,
      }, {
        step: 'briefs',
      });
    }
  }, [logEvent]);

  const logStreamingComplete = useCallback(() => {
    const duration = Date.now() - streamingStats.current.startTime;
    logEvent('STREAMING_OPTIMIZATION_COMPLETE', {
      duration: `${(duration / 1000).toFixed(1)}s`,
      architectureTasksReceived: streamingStats.current.architectureTasksReceived,
      chunksReceived: streamingStats.current.chunksReceived,
      briefsReceived: streamingStats.current.briefsReceived,
      errors: streamingStats.current.errors,
    }, {
      success: true,
    });
  }, [logEvent]);

  const logStreamingError = useCallback((error: Error | string, context?: Record<string, unknown>) => {
    streamingStats.current.errors++;
    logEvent('STREAMING_OPTIMIZATION_ERROR', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      partialResults: {
        architectureTasks: streamingStats.current.architectureTasksReceived,
        chunks: streamingStats.current.chunksReceived,
        briefs: streamingStats.current.briefsReceived,
      },
    }, {
      dataLost: true,
    }, true);
  }, [logEvent]);

  const logSSEParseError = useCallback((line: string, error: Error) => {
    streamingStats.current.errors++;
    logEvent('STREAM_SSE_PARSE_ERROR', {
      line: line.slice(0, 200),
      error: error.message,
    }, {}, true);
  }, [logEvent]);

  return {
    logStreamingStart,
    logArchitectureEvent,
    logChunkEvent,
    logBriefEvent,
    logStreamingComplete,
    logStreamingError,
    logSSEParseError,
  };
}
