
# Fix: Coverage Panels Close Unexpectedly During Interactions

## Problem Summary
When you interact with query cards in the Coverage tab (click to open panel, generate analysis, update optimization state), the panel unexpectedly closes. This also happens when analysis is generated.

## Root Cause Analysis

The bug is in `CoverageTab.tsx` at **line 81-85** — the `setCoverageState` callback:

```typescript
const setCoverageState = useCallback((updater: CoverageState | ((prev: CoverageState) => CoverageState)) => {
  const newState = typeof updater === 'function' ? updater(coverageState) : updater;
  setLocalCoverageState(newState);
  onCoverageStateChange(newState);
}, [coverageState, onCoverageStateChange]);  // ← BUG: coverageState in deps
```

**The Problem**: The callback has `coverageState` in its dependency array. When any coverage state update happens (clicking a card, status change, optimization update), it:

1. Calls `setCoverageState(prev => ({ ...prev, activeQueryId: queryId }))`
2. The `updater` function receives `prev` but the callback uses `coverageState` directly for the evaluation
3. When the callback is recreated due to `coverageState` changing, the `updater(coverageState)` call uses a **stale closure** of `coverageState`
4. This means when you call `updater(prev)`, the `prev` argument is the old `coverageState` captured in the closure — NOT the current state
5. This causes the `activeQueryId` to be lost/reset because each update overwrites with stale data

**Why it's worse on interactions**: Every optimization state change (analysis generated, content optimized) triggers `handleOptimizationStateChange` → `setCoverageState` → state overwrite with stale value → panel closes.

## Technical Fix

### File: `src/components/moonbug/CoverageTab.tsx`

**Change the setCoverageState callback** to properly handle the function updater pattern without using stale closure:

```typescript
// BEFORE (buggy):
const setCoverageState = useCallback((updater: CoverageState | ((prev: CoverageState) => CoverageState)) => {
  const newState = typeof updater === 'function' ? updater(coverageState) : updater;
  setLocalCoverageState(newState);
  onCoverageStateChange(newState);
}, [coverageState, onCoverageStateChange]);

// AFTER (fixed):
const setCoverageState = useCallback((updater: CoverageState | ((prev: CoverageState) => CoverageState)) => {
  setLocalCoverageState(prev => {
    // Get actual previous state from React's setState
    const currentState = externalCoverageState || prev;
    const newState = typeof updater === 'function' ? updater(currentState) : updater;
    // Also notify parent
    onCoverageStateChange(newState);
    return newState;
  });
}, [externalCoverageState, onCoverageStateChange]);
```

**Key changes**:
1. Use `setLocalCoverageState(prev => ...)` to get the actual current state from React
2. Remove `coverageState` from dependencies (it was causing stale closures)
3. Use `externalCoverageState` as the source of truth when available

### Alternative Simpler Fix

If the above pattern causes issues with state syncing, an even simpler fix is to use `useRef` to track the latest state:

```typescript
// Add ref to track latest state
const coverageStateRef = useRef(coverageState);
coverageStateRef.current = coverageState;

const setCoverageState = useCallback((updater: CoverageState | ((prev: CoverageState) => CoverageState)) => {
  const currentState = coverageStateRef.current;
  const newState = typeof updater === 'function' ? updater(currentState) : updater;
  setLocalCoverageState(newState);
  onCoverageStateChange(newState);
}, [onCoverageStateChange]); // No more coverageState dependency
```

## Implementation Steps

1. **Update `setCoverageState` callback** in `CoverageTab.tsx` (lines 81-85) to use the ref pattern or functional update pattern
2. **Test the fix** by:
   - Clicking a query card → panel should open and stay open
   - Generating analysis → panel should remain open with loading state → analysis displays
   - Running optimization → panel stays open through all steps
   - Approving → panel closes after 1.5s delay (expected behavior)

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/moonbug/CoverageTab.tsx` | Fix `setCoverageState` callback to avoid stale closure |

## Expected Outcome

After this fix:
- Query panels will stay open during all interactions
- Analysis generation won't close the panel
- Optimization state changes won't reset `activeQueryId`
- The 1.5-second close after approval will continue to work as intended
