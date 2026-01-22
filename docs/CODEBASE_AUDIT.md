# Chunk Daddy Codebase Audit

**Generated:** 2026-01-22  
**Purpose:** Complete snapshot of current architecture for planning future changes

---

## Section 1: App Structure

### 1.1 All Routes & Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/pages/Index.tsx` | Main application page with all 7 workflow tabs |
| `/auth` | `src/pages/Auth.tsx` | Authentication (login/signup) |
| `*` | `src/pages/NotFound.tsx` | 404 fallback |

### 1.2 All 7 Tabs (Workflow Steps)

#### Tab 1: Content (`id: 'content'`)
- **Component:** `src/components/moonbug/ContentTab.tsx`
- **UI Elements:** Markdown editor, URL import section, word/token count, chunking settings dialog
- **User Actions:** Paste/import content, configure chunking options, click "Chunk It, Daddy"
- **Reads from state:** `content`, `chunkerOptions`, `sourceUrl`
- **Writes to state:** `content`, `chunkerOptions`, `parsedElements`, `layoutChunks`, `sourceUrl`
- **Navigation:** → Queries tab (after chunking)

#### Tab 2: Queries (`id: 'analyze'`)
- **Component:** `src/components/moonbug/AnalyzeTab.tsx`
- **UI Elements:** Query input, auto-suggest, fanout tree generator, query sidebar
- **User Actions:** Add queries manually, generate AI fanout, run analysis
- **Reads from state:** `keywords`, `hasChunks`, `content`, `chunkerOptions`
- **Writes to state:** `keywords`, `queryIntentTypes`
- **Navigation:** → Chunk Analysis tab (after running analysis)

#### Tab 3: Chunk Analysis (`id: 'results'`)
- **Component:** `src/components/moonbug/ResultsTab.tsx`
- **UI Elements:** Chunk list with scores, document structure tree, query assignments view, detail panel
- **User Actions:** Filter/sort chunks, view details, reassign queries, export gaps
- **Reads from state:** `result`, `layoutChunks`, `keywords`, `queryIntentTypes`, `content`
- **Writes to state:** Local `queryAssignments` state (NOT persisted to Index.tsx)
- **Navigation:** → Structure tab

#### Tab 4: Structure (`id: 'architecture'`)
- **Component:** `src/components/moonbug/ArchitectureTab.tsx`
- **UI Elements:** Architecture report, task list, CSV export
- **User Actions:** Run architecture analysis, toggle tasks, export to CSV
- **Reads from state:** `result`, `layoutChunks`, `keywords`, `architectureAnalysis`
- **Writes to state:** `architectureAnalysis`, `architectureTasks`
- **Navigation:** → Optimization tab

#### Tab 5: Optimization (`id: 'optimize'`)
- **Component:** `src/components/moonbug/OptimizeTab.tsx`
- **UI Elements:** Optimization plan panel with 4 expandable sections
- **User Actions:** Toggle architecture tasks, toggle briefs, reassign queries, click "Confirm & Optimize"
- **Reads from state:** `result`, `keywords`, `architectureTasks`, `layoutChunks`, `content`
- **Writes to state:** `optimizationResult`, `optimizedContent`, `streamedChunks`, `streamedBriefs`, `streamedArchitectureTasks`
- **Navigation:** → Outputs tab (auto-navigates on optimization start)

#### Tab 6: Outputs (`id: 'outputs'`)
- **Component:** `src/components/moonbug/OutputsTab.tsx`
- **UI Elements:** Progress indicator, streamed architecture tasks, optimized chunks with before/after, content briefs
- **User Actions:** Copy content, export report, apply changes
- **Reads from state:** `streamedArchitectureTasks`, `streamedChunks`, `streamedBriefs`, `isStreamingOptimization`, `streamingProgress`, `streamingStep`
- **Writes to state:** (None directly - triggers handlers in Index.tsx)
- **Navigation:** → Report tab or back to Optimization

#### Tab 7: Final Report (`id: 'report'`)
- **Component:** `src/components/moonbug/ReportTab.tsx`
- **UI Elements:** Summary sub-tab, Action Items sub-tab, Exports sub-tab
- **User Actions:** View summary, review action items, export markdown/JSON
- **Reads from state:** `optimizationResult`, `optimizedContent`, `originalContent`, `keywords`, `layoutChunks`
- **Writes to state:** (None - read-only view)
- **Navigation:** Can navigate to Outputs for chunk details

### 1.3 Component Tree

```
Index.tsx (src/pages/Index.tsx)
├── TopBar.tsx
├── WorkflowStepper.tsx
├── ContentTab.tsx
│   ├── MarkdownEditor
│   ├── ChunkingSettings
│   └── UrlImportSection (inline)
├── AnalyzeTab.tsx
│   ├── QueryAutoSuggest
│   ├── QuerySidebar
│   ├── FanoutListView
│   └── ExportFanoutDialog
├── ResultsTab.tsx
│   ├── ChunkCard
│   ├── ChunkDetailsPanel
│   └── ExportGapsDialog
├── ArchitectureTab.tsx
│   ├── ArchitectureReport
│   └── ArchitectureTasksPanel
├── OptimizeTab.tsx
│   └── OptimizationPlanPanel
├── OutputsTab.tsx
│   └── (Inline collapsible sections)
├── ReportTab.tsx
│   ├── ReportSummary
│   ├── ReportActionItems
│   └── ReportExports
├── DebugPanel.tsx
└── StreamingDebugLogger (internal)
```

---

## Section 2: State Management

### 2.1 Global State (Index.tsx)

All primary state lives in `src/pages/Index.tsx` lines 44-98:

| Variable | Type | Initial Value | Set By | Read By |
|----------|------|---------------|--------|---------|
| `activeTab` | `string` | `'content'` | Tab clicks, auto-navigation | All tabs for conditional rendering |
| `content` | `string` | `""` | ContentTab, Apply Optimization | ContentTab, AnalyzeTab, ResultsTab, streaming |
| `keywords` | `string[]` | `[]` | AnalyzeTab | ResultsTab, ArchitectureTab, OptimizeTab, ReportTab |
| `queryIntentTypes` | `Record<string, FanoutIntentType>` | `{}` | AnalyzeTab fanout | ResultsTab query assignments |
| `chunkerOptions` | `ChunkerOptions` | `{maxChunkSize:512, chunkOverlap:50, cascadeHeadings:true}` | ContentTab, AnalyzeTab settings | handleChunk, handleAnalyze |
| `parsedElements` | `DocumentElement[]` | `[]` | handleChunk, handleAnalyze | ResultsTab structure view |
| `layoutChunks` | `LayoutAwareChunk[]` | `[]` | handleChunk, handleAnalyze | ResultsTab, ArchitectureTab, OptimizeTab |
| `contentHashAtAnalysis` | `string` | `""` | handleAnalyze | Detect content modifications |
| `optimizedContent` | `string` | `""` | handleOptimizationComplete, streaming | ReportTab, OutputsTab |
| `sourceUrl` | `string \| null` | `null` | ContentTab URL import | ContentTab display |
| `optimizationResult` | `FullOptimizationResult \| null` | `null` | handleOptimizationComplete, streaming | ReportTab, OutputsTab |
| `architectureAnalysis` | `ArchitectureAnalysis \| null` | `null` | ArchitectureTab | ArchitectureTab, completedSteps |
| `architectureTasks` | `ArchitectureTask[]` | `[]` | ArchitectureTab task generation | OptimizeTab plan panel |
| `architectureLoading` | `boolean` | `false` | ArchitectureTab | ArchitectureTab spinner |
| `optimizeViewState` | `'assignment' \| 'optimizing' \| 'review'` | `'assignment'` | OptimizeTab | OptimizeTab |
| `acceptedChunks` | `Set<number>` | `new Set()` | OptimizeTab review | OptimizeTab review |
| `rejectedChunks` | `Set<number>` | `new Set()` | OptimizeTab review | OptimizeTab review |
| `editedChunks` | `Map<number, string>` | `new Map()` | OptimizeTab review | OptimizeTab review |
| `isStreamingOptimization` | `boolean` | `false` | handleStreamingOptimization | OutputsTab, DebugPanel |
| `streamingStep` | `string` | `''` | handleStreamingOptimization | OutputsTab progress |
| `streamingProgress` | `number` | `0` | handleStreamingOptimization | OutputsTab progress bar |
| `streamedArchitectureTasks` | `ArchitectureTask[]` | `[]` | handleStreamingOptimization | OutputsTab |
| `streamedChunks` | `StreamedChunk[]` | `[]` | handleStreamingOptimization | OutputsTab |
| `streamedBriefs` | `ContentBrief[]` | `[]` | handleStreamingOptimization | OutputsTab |
| `localProjectName` | `string` | `'Untitled Project'` | Project load/rename/new | TopBar |

### 2.2 Custom Hooks

#### `useAnalysis` (`src/hooks/useAnalysis.ts`)
- **Internal State:** `isAnalyzing`, `error`, `result`, `progress`
- **Exposes:** `analyze()`, `reset()`, `setResultFromProject()`, state getters
- **API Calls:** `supabase.functions.invoke('generate-embeddings')`
- **Purpose:** Manages embedding generation and similarity scoring

#### `useOptimizer` (`src/hooks/useOptimizer.ts`)
- **Internal State:** `step`, `progress`, `error`, `result`
- **Exposes:** `optimize()`, `reset()`, state getters
- **API Calls:** `supabase.functions.invoke('optimize-content')` (multiple types)
- **Purpose:** Legacy non-streaming optimization (still used for some flows)

#### `useProjects` (`src/hooks/useProjects.ts`)
- **Internal State:** `currentProject`, `projects`, `isLoading`, `isSaving`, `hasUnsavedChanges`, `lastSavedAt`
- **Exposes:** `saveProject()`, `loadProject()`, `newProject()`, `markUnsaved()`, `renameProject()`, `deleteProject()`
- **API Calls:** Supabase `chunk_daddy_projects` table CRUD
- **Purpose:** Project persistence to database

#### `useAuth` (`src/hooks/useAuth.ts`)
- **Internal State:** `user`, `loading`
- **Exposes:** `user`, `loading`, `signIn()`, `signUp()`, `signOut()`
- **Purpose:** Authentication state management

#### `useStreamingDebug` (`src/hooks/useStreamingDebug.ts`)
- **Internal State:** None (uses `useDebug` context)
- **Exposes:** `logStreamingStart()`, `logArchitectureEvent()`, `logChunkEvent()`, `logBriefEvent()`, `logStreamingComplete()`, `logStreamingError()`, `logSSEParseError()`
- **Purpose:** Structured logging for streaming optimization events

### 2.3 Persistence

#### Supabase Database (`chunk_daddy_projects` table)

| Column | Type | What Gets Saved |
|--------|------|-----------------|
| `id` | uuid | Auto-generated |
| `user_id` | uuid | From auth session |
| `project_name` | text | User-provided name |
| `content` | text | Raw markdown content |
| `queries` | jsonb | `string[]` of keywords |
| `settings` | jsonb | `ChunkerOptions` object |
| `results` | jsonb | `AnalysisResult` object |
| `optimized_content` | text | Final optimized markdown |
| `optimization_result` | jsonb | `FullOptimizationResult` object |
| `architecture_analysis` | jsonb | `ArchitectureAnalysis` object |

#### LocalStorage
- **None** - All persistence via Supabase

#### Ephemeral (Lost on Refresh)
- `parsedElements` - Re-parsed from content on project load
- `layoutChunks` - Re-parsed from content on project load
- `streamedArchitectureTasks` - Lost after streaming completes
- `streamedChunks` - Lost after streaming completes
- `streamedBriefs` - Lost after streaming completes
- `acceptedChunks`, `rejectedChunks`, `editedChunks` - Review state
- `queryAssignments` in ResultsTab - Computed fresh each time
- All streaming progress state (`streamingStep`, `streamingProgress`)

---

## Section 3: Data Flow

### 3.1 Core Data Types

#### `LayoutAwareChunk` (`src/lib/layout-chunker.ts:35-50`)
```typescript
interface LayoutAwareChunk {
  id: string;
  text: string;                 // Full text WITH cascade heading context (used for embedding)
  textWithoutCascade: string;   // Body text only (used for display)
  headingPath: string[];        // Breadcrumb of parent headings
  sourceLines: [number, number]; // Line range in source markdown
  metadata: {
    type: 'section' | 'paragraph' | 'heading';
    hasCascade: boolean;
    headingLevels: number[];
    wordCount: number;
    charCount: number;
    tokenEstimate: number;
    cascadeTokens?: number;
  };
}
```

#### `AnalysisResult` (`src/hooks/useAnalysis.ts:52-68`)
```typescript
interface AnalysisResult {
  originalScores: OriginalScore | null;
  chunkScores: ChunkScore[];      // Per-chunk scores for each query
  noCascadeScores: ChunkScore[] | null;
  optimizedScores: ChunkScore[] | null;
  improvements: ImprovementResult[] | null;
  timestamp: Date;
  documentChamfer?: number;       // Overall document-query coverage score
  coverageMap?: CoverageEntry[];
  coverageSummary?: { 
    covered: number; 
    weak: number; 
    gaps: number; 
    totalQueries: number 
  };
}
```

#### `QueryAssignmentMap` (`src/lib/query-assignment.ts:21-27`)
```typescript
interface QueryAssignmentMap {
  assignments: QueryAssignment[];     // Query → best chunk mapping
  chunkAssignments: ChunkAssignment[]; // Chunk → assigned query mapping
  unassignedQueries: string[];        // Queries with no good match
  intentTypes: Record<string, FanoutIntentType>;
}
```

#### `FullOptimizationResult` (`src/lib/optimizer-types.ts`)
```typescript
interface FullOptimizationResult {
  analysis: ContentAnalysis;
  optimizedChunks: ValidatedChunk[];  // Chunks with before/after text
  explanations: ChangeExplanation[];
  originalContent: string;
  timestamp: Date;
  summary?: OptimizationSummary;
  originalScores?: Record<number, Record<string, number>>;
  originalFullScores?: Record<number, Record<string, FullScoreMetrics>>;
  optimizedFullScores?: Record<number, Record<string, FullScoreMetrics>>;
  contentBriefs: ContentBrief[];      // Generated briefs for unassigned queries
  allOriginalChunks: OriginalChunkInfo[]; // Original chunks for reconstruction
}
```

#### `StreamedChunk` (inline in Index.tsx)
```typescript
interface StreamedChunk {
  chunk_number: number;           // Index in optimized chunks array
  originalChunkIndex: number;     // Index in original layoutChunks array
  original_text: string;
  optimized_text: string;
  heading?: string;
  query: string;                  // The query this chunk was optimized for
  changes_applied: string[];      // List of changes made
}
```

### 3.2 Data Transformation Pipeline

```
┌─────────────────────┐
│   Raw Markdown      │  User pastes or imports content
└──────────┬──────────┘
           │ parseMarkdown()
           │ src/lib/layout-chunker.ts:283
           ▼
┌─────────────────────┐
│  DocumentElement[]  │  Headings, paragraphs, code blocks, lists
└──────────┬──────────┘
           │ createLayoutAwareChunks()
           │ src/lib/layout-chunker.ts:520
           ▼
┌─────────────────────┐
│ LayoutAwareChunk[]  │  Chunks with heading cascade context
└──────────┬──────────┘
           │ generateEmbeddings() → edge function
           │ src/lib/embeddings.ts + supabase/functions/generate-embeddings
           ▼
┌─────────────────────┐
│  EmbeddingResult[]  │  1536-dim vectors per chunk + query
└──────────┬──────────┘  (server-side, OpenAI text-embedding-3-large)
           │ calculateAllMetrics()
           │ src/lib/similarity.ts:164
           ▼
┌─────────────────────┐
│  SimilarityScores   │  cosine, euclidean, manhattan, dotProduct per pair
└──────────┬──────────┘
           │ calculatePassageScore()
           │ src/lib/similarity.ts:199
           ▼
┌─────────────────────┐
│  PassageScore 0-100 │  Normalized score per chunk-query pair
└──────────┬──────────┘
           │ computeQueryAssignments()
           │ src/lib/query-assignment.ts:46
           ▼
┌─────────────────────┐
│ QueryAssignmentMap  │  Which query goes to which chunk
└──────────┬──────────┘
           │ optimize-content-stream edge function (SSE)
           │ supabase/functions/optimize-content-stream
           ▼
┌─────────────────────┐
│ StreamedChunk[] +   │  Optimized text + content briefs
│ ContentBrief[]      │  (server-side, Lovable AI Gateway)
└──────────┬──────────┘
           │ handleStreamingOptimization()
           │ src/pages/Index.tsx:336
           ▼
┌─────────────────────┐
│FullOptimizationResult│ Final result for display + persistence
│+ optimizedContent   │
└─────────────────────┘
```

---

## Section 4: Edge Functions (API)

### 4.1 All Edge Functions

#### `generate-embeddings` (`supabase/functions/generate-embeddings/index.ts`)
- **Input:** `{ texts: string[] }`
- **Output:** `{ embeddings: Array<{ text: string; embedding: number[] }> }`
- **Called by:** `src/lib/embeddings.ts → generateEmbeddings()`
- **Model:** OpenAI `text-embedding-3-large` (1536 dimensions)

#### `optimize-content` (`supabase/functions/optimize-content/index.ts`)
Multiplexed endpoint handling multiple operation types:

| `type` value | Purpose | Called By |
|--------------|---------|-----------|
| `analyze` | Content structure analysis | useOptimizer |
| `optimize` | Full document optimization | useOptimizer |
| `optimize_focused` | Per-chunk optimization | useOptimizer |
| `explain` | Generate change explanations | useOptimizer |
| `suggest_keywords` | Keyword suggestions | AnalyzeTab |
| `summarize` | Generate summary | useOptimizer |
| `generateContentBrief` | Single content brief | useOptimizer |
| `generate_fanout` | Query fanout list | AnalyzeTab |
| `generate_fanout_tree` | Recursive fanout tree | AnalyzeTab |
| `deduplicate_fanout` | Dedupe via embeddings | AnalyzeTab |
| `analyze_architecture` | Architecture analysis | ArchitectureTab |

- **Model:** OpenAI via Responses API

#### `optimize-content-stream` (`supabase/functions/optimize-content-stream/index.ts`)
SSE streaming endpoint for real-time optimization:

| `type` value | SSE Events | Purpose |
|--------------|------------|---------|
| `apply_architecture_stream` | `task_started`, `task_applied`, `architecture_complete` | Apply architecture fixes |
| `optimize_chunks_stream` | `chunk_started`, `chunk_optimized`, `chunks_complete` | Optimize assigned chunks |
| `generate_briefs_stream` | `brief_started`, `brief_generated`, `briefs_complete` | Generate content briefs |

- **Called by:** `handleStreamingOptimization()` in Index.tsx
- **Model:** Lovable AI Gateway (google/gemini-2.5-flash)

#### `fetch-url-content` (`supabase/functions/fetch-url-content/index.ts`)
- **Input:** `{ url: string }`
- **Output:** `{ success, title, content, markdown, sourceUrl, fetchedAt }`
- **Called by:** ContentTab URL import section

#### `analyze-content-queries` (`supabase/functions/analyze-content-queries/index.ts`)
- **Input:** `{ content: string, existingQueries?: string[] }`
- **Output:** `{ success, detectedTopic, primaryQuery, suggestions, gaps }`
- **Called by:** AnalyzeTab `QueryAutoSuggest` component
- **Model:** Lovable AI Gateway (google/gemini-2.5-flash)

### 4.2 Streaming vs Non-Streaming

| Operation | Type | Client Handler |
|-----------|------|----------------|
| Embeddings generation | Non-streaming | `generateEmbeddings()` in embeddings.ts |
| Architecture analysis | Non-streaming | `supabase.functions.invoke()` |
| Query fanout generation | Non-streaming | `supabase.functions.invoke()` |
| Query auto-suggest | Non-streaming | `supabase.functions.invoke()` |
| **Content optimization** | **SSE Streaming** | `handleStreamingOptimization()` in Index.tsx |
| **Architecture apply** | **SSE Streaming** | Same as above |
| **Brief generation** | **SSE Streaming** | Same as above |

---

## Section 5: Optimization Flow (Critical Path)

### 5.1 Before Optimization Starts

**Required State:**
- `result` (AnalysisResult) must exist - from Tab 3 analysis
- `layoutChunks` must be populated - from Tab 1 chunking
- `keywords` must have at least 1 query - from Tab 2

**OptimizationPlanPanel shows 4 expandable sections:**
1. **Chunk Optimization** - Chunks with assigned queries (computed via `computeQueryAssignments()`)
2. **Architecture Tasks** - From `architectureTasks` array, filtered by `isSelected`
3. **Content Gaps** - `unassignedQueries` that need briefs
4. **What You'll Get** - Summary of expected outputs

**User can configure:**
- Toggle "Apply Architecture" master checkbox
- Toggle individual architecture tasks
- Toggle "Generate Briefs" master checkbox
- Reassign queries to different chunks via dropdown

### 5.2 When User Clicks "Confirm & Optimize"

**Flow:** `OptimizeTab.tsx` → `Index.tsx:handleStreamingOptimization()`

1. `handleStreamingOptimize()` in OptimizeTab.tsx (line 627) is called
2. It calls `onStreamingOptimize(params)` prop
3. This triggers `handleStreamingOptimization()` in Index.tsx (line 336)

**Data sent to server:**
```typescript
{
  applyArchitecture: boolean,
  architectureTasks: ArchitectureTask[],  // Only selected tasks
  generateBriefs: boolean,
  unassignedQueries: string[],
  chunkAssignments: Array<{
    chunkIndex: number,     // Index in layoutChunks
    query: string           // The assigned query
  }>
}
```

### 5.3 During Optimization

**Phase 1: Architecture (if `applyArchitecture` is true)**
```
POST /optimize-content-stream
Body: { type: 'apply_architecture_stream', tasks, content, chunks }

SSE Events:
- task_started: { index, total, task }
- task_applied: { index, total, task, updatedContent }
- architecture_complete: { appliedCount, updatedContent }

State Updates:
- streamedArchitectureTasks: accumulates applied tasks
- streamingProgress: 0% → 20%
- streamingStep: "Applying architecture fixes..."
```

**Phase 2: Chunk Optimization**
```
POST /optimize-content-stream
Body: { type: 'optimize_chunks_stream', queryAssignments, chunks, content }

SSE Events:
- chunk_started: { index, total, chunkIndex, query }
- chunk_optimized: { index, total, chunkIndex, originalChunkIndex, original_text, optimized_text, changes }
- chunks_complete: { optimizedCount, totalChunks }

State Updates:
- streamedChunks: accumulates (ONLY if originalChunkIndex in expectedChunkIndices)
- streamingProgress: 20% → 70%
- streamingStep: "Optimizing chunk X of Y..."

ENFORCEMENT: Unexpected chunk indices are logged and skipped (Index.tsx:586-593)
```

**Phase 3: Brief Generation (if `generateBriefs` is true)**
```
POST /optimize-content-stream
Body: { type: 'generate_briefs_stream', queries: unassignedQueries, content, chunks }

SSE Events:
- brief_started: { index, total, query }
- brief_generated: { index, total, query, brief }
- briefs_complete: { generatedCount, totalQueries }

State Updates:
- streamedBriefs: accumulates generated briefs
- streamingProgress: 70% → 100%
- streamingStep: "Generating brief X of Y..."
```

### 5.4 When Optimization Completes

**Completion Detection:** (Index.tsx:640-700)
- All phases complete OR stream closes (`done === true`)

**State Built from Accumulated Data:**
```typescript
const streamedResult: FullOptimizationResult = {
  analysis: { /* empty */ },
  optimizedChunks: accumulatedChunks.map(chunk => ({
    chunk_number: chunk.chunk_number,
    original_text: chunk.original_text,
    optimized_text: chunk.optimized_text,
    heading: chunk.heading,
    changes_applied: [],
    actual_scores: {}
  })),
  explanations: [],
  originalContent: content,
  timestamp: new Date(),
  contentBriefs: accumulatedBriefs,
  allOriginalChunks: layoutChunks.map((c, i) => ({
    chunkIndex: i,
    text: c.text,
    heading: c.headingPath[c.headingPath.length - 1]
  }))
};
```

**Content Reconstruction:** (Index.tsx:682-693)
```typescript
const reconstructedParts = layoutChunks.map((originalChunk, idx) => {
  const optimized = accumulatedChunks.find(c => c.originalChunkIndex === idx);
  if (optimized) {
    return optimized.optimized_text;
  }
  return originalChunk.textWithoutCascade;
});
const reconstructedContent = reconstructedParts.join('\n\n');
```

**Final State Updates:**
```typescript
setOptimizationResult(streamedResult);
setOptimizedContent(reconstructedContent);
setIsStreamingOptimization(false);
setStreamingProgress(100);
markUnsaved(content, keywords, result, chunkerOptions, reconstructedContent, streamedResult);
```

**User Location:** Outputs tab (auto-navigated at optimization start)

### 5.5 Apply Changes

**What "Apply Changes" does:** (OutputsTab → Index.tsx)

When user clicks "Apply Changes" button:
1. `onApplyChanges()` callback is invoked
2. This calls `handleApplyOptimization(optimizedContent)` in Index.tsx

**`handleApplyOptimization` (Index.tsx:307-313):**
```typescript
const handleApplyOptimization = (newContent: string) => {
  setOptimizedContent(newContent);
  setContent(newContent);  // Replaces editor content
  markUnsaved(newContent, keywords, result, chunkerOptions, newContent, optimizationResult);
  setActiveTab('content');  // Navigate back to content tab
  toast.success('Optimized content applied to editor');
};
```

**Document Reconstruction Logic:**
The full document is reconstructed by:
1. Taking all original `layoutChunks`
2. For each chunk, checking if there's an optimized version in `streamedChunks`
3. Using optimized text where available, original text otherwise
4. Joining with `\n\n` separator

---

## Section 6: Known Issues & TODOs

### 6.1 Console Errors
- **JSON parse errors:** AI responses sometimes malformed, handled by `parseAIResponse` recovery
- **Skipping unexpected chunk warnings:** `Skipping unexpected chunk X, not in expected set` (enforcement working correctly)
- **Missing embedding dimension errors:** When embeddings fail to generate

### 6.2 TODO Comments
| File | Line | Comment |
|------|------|---------|
| `index.html` | 6 | `TODO: Set the document title to the name of your application` |
| `index.html` | 11 | `TODO: Update og:title to match your application name` |

### 6.3 Incomplete Features

| Feature | Location | Issue |
|---------|----------|-------|
| Tree view delete | `AnalyzeTab.tsx:505-506` | `onDeleteSelected` and `onDeleteQuery` not implemented for tree mode |
| Brief modal | `ReportTab.tsx:142-147` | `handleViewBrief` only navigates, doesn't open detail modal |
| Chunk highlighting | `Index.tsx:974-977` | Navigation to outputs doesn't scroll to/highlight specific chunk |
| Architecture task toggle | `OptimizeTab.tsx:616-620` | Individual task toggles in OptimizationPlanPanel not fully wired to Index.tsx |
| Streaming changes_applied | `Index.tsx:666` | Always empty array `[]`, actual changes not captured |

### 6.4 State Inconsistencies

| Issue | Description | Impact |
|-------|-------------|--------|
| QueryAssignments not lifted | ResultsTab manages local `queryAssignments` state that isn't passed to OptimizeTab | OptimizeTab recomputes assignments, may differ from what user saw |
| Review state ephemeral | `acceptedChunks`, `rejectedChunks`, `editedChunks` lost on refresh | User must re-review after page reload |
| Index mapping complexity | Streaming uses `originalChunkIndex` for remapping | Edge case bugs possible if indices drift |
| Architecture tasks selection | Tasks selected in ArchitectureTab may not match OptimizationPlanPanel | User confusion about what will be applied |

---

## Section 7: File Index

### Pages
```
src/pages/Index.tsx              - Main page, global state, streaming handler (~1050 lines)
src/pages/Auth.tsx               - Authentication page
src/pages/NotFound.tsx           - 404 page
```

### Tab Components
```
src/components/moonbug/ContentTab.tsx       - Tab 1: Content input
src/components/moonbug/AnalyzeTab.tsx       - Tab 2: Query management
src/components/moonbug/ResultsTab.tsx       - Tab 3: Chunk analysis
src/components/moonbug/ArchitectureTab.tsx  - Tab 4: Structure analysis
src/components/moonbug/OptimizeTab.tsx      - Tab 5: Optimization plan
src/components/moonbug/OutputsTab.tsx       - Tab 6: Streaming outputs
src/components/moonbug/ReportTab.tsx        - Tab 7: Final report
```

### Supporting Components
```
src/components/moonbug/OptimizationPlanPanel.tsx  - Plan configuration UI
src/components/moonbug/ArchitectureTasksPanel.tsx - Task selection UI
src/components/moonbug/DebugPanel.tsx             - Debug overlay
src/components/moonbug/WorkflowStepper.tsx        - Navigation stepper
src/components/moonbug/TopBar.tsx                 - Header with project selector
src/components/moonbug/QuerySidebar.tsx           - Query list sidebar
src/components/moonbug/QueryAutoSuggest.tsx       - AI query suggestions
src/components/moonbug/ChunkCard.tsx              - Chunk display card
src/components/moonbug/ChunkDetailsPanel.tsx      - Chunk detail sheet
src/components/moonbug/FanoutListView.tsx         - Fanout tree display
src/components/moonbug/ExportFanoutDialog.tsx     - Fanout export dialog
src/components/moonbug/ExportGapsDialog.tsx       - Gaps export dialog
```

### Hooks
```
src/hooks/useAnalysis.ts        - Analysis state and embeddings
src/hooks/useOptimizer.ts       - Non-streaming optimization (legacy)
src/hooks/useProjects.ts        - Project persistence
src/hooks/useAuth.ts            - Authentication state
src/hooks/useStreamingDebug.ts  - Streaming debug logging
src/hooks/useApiKey.ts          - API key management (unused?)
```

### Libraries
```
src/lib/layout-chunker.ts       - Markdown parsing and chunking (main: createLayoutAwareChunks)
src/lib/similarity.ts           - Scoring calculations (cosine, chamfer, passageScore)
src/lib/query-assignment.ts     - Query-to-chunk assignment algorithm
src/lib/embeddings.ts           - Embedding API wrapper
src/lib/optimizer-types.ts      - Type definitions for optimization
src/lib/project-types.ts        - Type definitions for projects
src/lib/tier-colors.ts          - Score tier color utilities
src/lib/sentence-utils.ts       - Sentence splitting utilities
src/lib/chunk-preview.ts        - Chunk preview formatting
src/lib/csv-export.ts           - CSV export utilities
src/lib/export-content-gaps.ts  - Content gaps export
src/lib/export-fanout.ts        - Fanout export
src/lib/report-generator.ts     - Report generation
src/lib/score-metadata.ts       - Score metadata helpers
src/lib/url-fetcher.ts          - URL content fetching
```

### Edge Functions
```
supabase/functions/generate-embeddings/index.ts     - OpenAI embeddings
supabase/functions/optimize-content/index.ts        - Non-streaming AI operations
supabase/functions/optimize-content-stream/index.ts - SSE streaming optimization
supabase/functions/analyze-content-queries/index.ts - Query auto-suggest
supabase/functions/fetch-url-content/index.ts       - URL content fetcher
```

### Context
```
src/contexts/DebugContext.tsx   - Debug event logging context
```

---

## Appendix: Critical Line References

### Index.tsx Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `handleStreamingOptimization` | 336-720 | Main streaming optimization handler |
| `handleApplyOptimization` | 307-313 | Apply optimized content to editor |
| `handleAnalyze` | 200-280 | Run embeddings + scoring |
| `handleChunk` | 155-195 | Parse and chunk content |
| `handleSave` | 315-330 | Save project to database |

### Similarity.ts Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `cosineSimilarity` | 5-20 | Calculate cosine similarity |
| `calculateAllMetrics` | 164-190 | Calculate all similarity metrics |
| `calculatePassageScore` | 199-240 | Normalize to 0-100 score |
| `chamferSimilarity` | 100-160 | Document-level coverage score |

### Layout-chunker.ts Key Functions
| Function | Lines | Purpose |
|----------|-------|---------|
| `parseMarkdown` | 283-400 | Parse markdown to elements |
| `createLayoutAwareChunks` | 520-700 | Create chunks from elements |
| `applyHeadingCascade` | 450-510 | Add heading context to chunks |

---

*End of Audit Document*
