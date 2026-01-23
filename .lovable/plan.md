
# Fix: PDF Export and Query Intelligence Persistence

## Problem Summary

Two issues need to be addressed:

1. **PDF Export Button Fails**: The data structure passed to the PDF generator doesn't match what the generator expects, causing undefined property access errors.

2. **Query Intelligence Doesn't Persist**: The Query Intelligence state (detected topic, primary query, suggestions, entities, etc.) is stored in React state but never saved to the database, so it's lost on reload, save, or refresh.

---

## Root Cause Analysis

### PDF Export Issue

The `intelligenceState` passed from `QueryAutoSuggest.tsx` has this structure:
```typescript
{
  gaps: { 
    criticalGaps: [...],      // Array
    gapSummary: {...},
    competitiveGaps: [...],
    priorityActions: [...] 
  }
}
```

But `gather-report-data.ts` expects:
```typescript
{
  gaps: {
    critical: [...]           // Expected property name
  },
  intelligence: {
    priorityActions: [...]    // Expected on intelligence object
  }
}
```

This mismatch causes `gaps.critical` to be undefined and `intel.priorityActions` to fail.

### Persistence Issue

- `queryIntelligence` state exists in `Index.tsx` (lines 71-80)
- The database table `chunk_daddy_projects` has NO column for `query_intelligence`
- The `saveProject` function doesn't include `queryIntelligence`
- The project load effect doesn't restore `queryIntelligence`

---

## Solution

### Part 1: Fix PDF Export Data Mapping

**File: `src/lib/gather-report-data.ts`**

Update the `IntelligenceState` interface and `gatherReportData` function to handle the actual data structure being passed:

1. Update `IntelligenceState.gaps` to expect `criticalGaps` instead of `critical`
2. Move `priorityActions` to be at the top level of gaps, not on intelligence
3. Update gap extraction logic to use `gaps.criticalGaps`

```typescript
// Update interface (around line 145)
gaps?: {
  criticalGaps?: Array<{
    query: string;
    score?: number;
    entityOverlap?: number;
  }>;
  priorityActions?: Array<{
    action: string;
    impact: string;
    effort: string;
    addressesQueries?: string[];
  }>;
};
```

### Part 2: Add Database Column for Query Intelligence

**Database Migration:**

Add a new JSONB column to store Query Intelligence state:

```sql
ALTER TABLE chunk_daddy_projects 
ADD COLUMN query_intelligence jsonb DEFAULT NULL;
```

### Part 3: Update Project Types

**File: `src/lib/project-types.ts`**

Add the `query_intelligence` field to `ChunkDaddyProject`:

```typescript
export interface ChunkDaddyProject {
  // ... existing fields
  query_intelligence: {
    detectedTopic: { ... } | null;
    primaryQuery: { ... } | null;
    intelligence: any | null;
    suggestions: any[];
    intentSummary: any | null;
    gaps: any;
    entities: { primary: string[]; secondary: string[]; temporal: string[]; branded: string[] } | null;
    filtered: any[];
  } | null;
}
```

### Part 4: Update useProjects Hook

**File: `src/hooks/useProjects.ts`**

1. Add `queryIntelligence` to the `pendingData` ref type
2. Update `saveProject` to accept and save `queryIntelligence`
3. Include `query_intelligence` in the project data object

### Part 5: Update Index.tsx

**File: `src/pages/Index.tsx`**

1. Update `markUnsaved` calls to include `queryIntelligence`
2. Add restoration logic in the `currentProject` useEffect to restore `queryIntelligence`
3. Update `handleSave` to include `queryIntelligence`

---

## Technical Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/gather-report-data.ts` | Fix gaps and priorityActions data structure mapping |
| `src/lib/project-types.ts` | Add `query_intelligence` field |
| `src/hooks/useProjects.ts` | Add `queryIntelligence` to save/load flow |
| `src/pages/Index.tsx` | Include `queryIntelligence` in persistence |

### Database Change

Add column via migration:
```sql
ALTER TABLE chunk_daddy_projects 
ADD COLUMN query_intelligence jsonb DEFAULT NULL;
```

---

## Expected Behavior After Fix

1. **PDF Export**: Clicking "Export PDF" generates and downloads the Query Intelligence Report with all sections populated correctly (gaps, priority actions, entities, etc.)

2. **Persistence**: 
   - Query Intelligence results persist when saving a project
   - Results are restored when loading a project
   - Results survive page refresh (if project was saved)
   - Auto-save includes Query Intelligence data

---

## Testing Checklist

After implementation:
1. Run Query Intelligence analysis on content
2. Export PDF - verify all sections render correctly
3. Save project manually
4. Refresh page and load project - verify Query Intelligence data is restored
5. Switch tabs and return - verify data persists
6. Create new project - verify clean state
