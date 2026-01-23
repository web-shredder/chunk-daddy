
# Fix: Coverage Tab State Persistence

## Problem Summary

All edits, optimization work, and approvals in the Coverage panel are stored in **local React state** that is:
1. Never lifted to the parent `Index.tsx`
2. Never saved to the database
3. Reset whenever the tab unmounts or the page reloads

This means any analysis text you write, any optimized content you generate, and any approvals you make are **completely lost** when you navigate away.

---

## Solution Overview

We need to:
1. **Add a database column** for coverage state
2. **Lift the coverage state** to `Index.tsx` (like we do for `queryIntelligence`)
3. **Wire up the persistence** through `useProjects`
4. **Restore the state** when loading a project

---

## Implementation Steps

### Step 1: Add Database Migration

Add a new JSONB column `coverage_state` to the `chunk_daddy_projects` table to store:
- Query work items with their statuses
- Optimization states (analysis text, optimized content, user edits)
- Approval states

```sql
ALTER TABLE chunk_daddy_projects 
ADD COLUMN coverage_state jsonb DEFAULT NULL;
```

---

### Step 2: Update Project Types

Update `src/lib/project-types.ts` to include the new field:

```typescript
import type { CoverageState } from '@/types/coverage';

export interface ChunkDaddyProject {
  // ... existing fields ...
  coverage_state: CoverageState | null;  // NEW
}
```

---

### Step 3: Update useProjects Hook

Modify `src/hooks/useProjects.ts`:

1. Add `coverageState` to the `pendingData` ref type
2. Add it as a parameter to `saveProject()`
3. Add it as a parameter to `markUnsaved()`
4. Include it in the database save payload

---

### Step 4: Lift State to Index.tsx

In `src/pages/Index.tsx`:

1. Add global state for coverage:
   ```typescript
   const [coverageState, setCoverageState] = useState<CoverageState | null>(null);
   ```

2. Pass coverage state to `CoverageTab` as props:
   ```typescript
   <CoverageTab
     coverageState={coverageState}
     onCoverageStateChange={setCoverageState}
     // ... existing props
   />
   ```

3. Include coverage state in `markUnsaved()` calls
4. Restore coverage state when loading a project

---

### Step 5: Update CoverageTab Component

Modify `src/components/moonbug/CoverageTab.tsx`:

1. Accept `coverageState` and `onCoverageStateChange` as props
2. Initialize from props instead of empty state
3. Call `onCoverageStateChange` whenever local state changes
4. Merge with base work items intelligently (preserve edits, update scores)

---

### Step 6: Restore State on Project Load

In `Index.tsx`, when `currentProject` changes:

```typescript
if (currentProject.coverage_state) {
  setCoverageState(currentProject.coverage_state);
} else {
  setCoverageState(null);
}
```

---

## Technical Details

### CoverageState Structure (already defined)

```typescript
interface CoverageState {
  queries: QueryWorkItem[];          // Status, scores, approved text
  activeQueryId: string | null;      // Currently open panel
  optimizationStates: Record<string, QueryOptimizationState>;  // Analysis/content per query
}
```

### What Gets Persisted

- **Query statuses**: `optimized`, `in_progress`, `ready`, `gap`
- **Generated analysis/brief**: User can continue editing where they left off
- **Generated content**: Optimized or new content
- **User edits**: Any modifications to generated content
- **Scores**: Before and after scores for comparisons
- **Approvals**: Which queries have been approved

### Merge Strategy on Load

When loading a project with existing coverage state:
1. Start with saved `queries` and `optimizationStates`
2. Re-run `transformToWorkItems` to get fresh chunk assignments/scores
3. Merge: preserve user edits and approvals, update derived data (chunk matches, scores)

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/` | Add `coverage_state` column |
| `src/lib/project-types.ts` | Add `coverage_state` to interface |
| `src/hooks/useProjects.ts` | Add to save/load/markUnsaved |
| `src/pages/Index.tsx` | Lift state, pass to CoverageTab, restore on load |
| `src/components/moonbug/CoverageTab.tsx` | Accept props, sync with parent |

---

## Risk Mitigation

- **Backward Compatibility**: The column defaults to `NULL`, so existing projects load fine
- **Large State**: JSONB can handle the coverage state size (typically <100KB)
- **State Conflicts**: Clear state when creating a new project or running re-analysis
