
# Fix: PDF Export for Query Intelligence

## Problem Summary

The PDF export button for Query Intelligence doesn't work because of field name mismatches between what the edge function returns and what `gather-report-data.ts` expects.

---

## Root Cause Analysis

The `gatherReportData` function in `src/lib/gather-report-data.ts` expects:
- `suggestions[].intentPreservation` → **Actual field**: `intentScore`
- `suggestions[].intentDrift` → **Actual field**: `intentAnalysis?.driftScore`
- `suggestions[].intentDriftExplanation` → **Actual field**: `driftReason` or `intentAnalysis?.driftReasoning`
- `suggestions[].routePrediction` as string → **Actual type**: Can be an object `{ route: string, ... }` or a string

This causes:
1. All scores to be calculated as 0 (since `intentPreservation` is undefined)
2. Relevance distribution shows everything as "low" 
3. Route distribution fails when `routePrediction` is an object
4. Intent drift detection fails

---

## Solution

### File: `src/lib/gather-report-data.ts`

**Fix 1: Update `IntelligenceState` interface** (lines 129-138)

Update the suggestions interface to match actual data:
```typescript
suggestions?: Array<{
  query: string;
  variantType?: string;
  routePrediction?: { route: string } | string;  // Can be object or string
  intentScore?: number;          // Correct field name
  entityOverlap?: number;
  intentAnalysis?: {             // Actual drift structure
    driftScore?: number;
    driftLevel?: string;
    driftReasoning?: string | null;
  };
  driftReason?: string | null;
  matchStrength?: string;
}>;
```

**Fix 2: Update relevance distribution calculation** (line 183)

Change from `intentPreservation` to `intentScore`:
```typescript
// OLD
const scores = suggestions?.map(s => s.intentPreservation || 0) || [];

// NEW - use intentScore and convert from 0-1 to 0-100 scale
const scores = suggestions?.map(s => {
  const score = s.intentScore || 0;
  return score > 1 ? score : score * 100; // Handle both 0-1 and 0-100 scales
}) || [];
```

**Fix 3: Update route distribution calculation** (lines 196-205)

Handle `routePrediction` being an object:
```typescript
suggestions?.forEach(s => {
  // Handle routePrediction as object or string
  const routeValue = typeof s.routePrediction === 'object' 
    ? s.routePrediction?.route 
    : s.routePrediction;
  const route = (routeValue || 'web_search').toLowerCase();
  // ... rest of logic
});
```

**Fix 4: Update intent drift calculation** (line 208)

Change from `intentDrift` to `intentAnalysis.driftScore`:
```typescript
// OLD
const intentDriftFiltered = suggestions?.filter(s => (s.intentDrift || 0) > 40).length || 0;

// NEW
const intentDriftFiltered = suggestions?.filter(s => 
  (s.intentAnalysis?.driftScore || 0) > 40
).length || 0;
```

**Fix 5: Update queries array mapping** (lines 211-230)

Fix the score field and drift extraction:
```typescript
const queries = suggestions?.map(s => {
  // Use intentScore, handle 0-1 or 0-100 scale
  const rawScore = s.intentScore || 0;
  const score = rawScore > 1 ? rawScore : rawScore * 100;
  
  // Route handling
  const routeValue = typeof s.routePrediction === 'object' 
    ? s.routePrediction?.route?.toLowerCase() 
    : (s.routePrediction || 'web_search').toLowerCase();
  
  // Coverage status based on score
  let coverageStatus: 'strong' | 'partial' | 'weak' | 'none' = 'none';
  if (score >= 70) coverageStatus = 'strong';
  else if (score >= 50) coverageStatus = 'partial';
  else if (score >= 30) coverageStatus = 'weak';
  
  // Drift extraction
  const driftScore = s.intentAnalysis?.driftScore || 0;
  
  return {
    query: s.query,
    variantType: s.variantType || 'UNKNOWN',
    routePrediction: routeValue as 'web_search' | 'parametric' | 'hybrid',
    passageScore: Math.round(score),
    entityOverlap: Math.round((s.entityOverlap || 0) * 100),
    coverageStatus,
    intentDrift: driftScore > 20 ? {
      score: driftScore,
      explanation: s.driftReason || s.intentAnalysis?.driftReasoning || '',
    } : undefined,
  };
}) || [];
```

---

## Implementation Summary

| Line Range | Change |
|------------|--------|
| 129-138 | Update suggestions interface with correct field names |
| 183 | Use `intentScore` instead of `intentPreservation` |
| 196-205 | Handle `routePrediction` as object or string |
| 208 | Use `intentAnalysis.driftScore` for drift filtering |
| 211-230 | Fix query mapping with correct fields and scale handling |

---

## Expected Result

After the fix:
- PDF export generates successfully
- Metrics page shows correct relevance distribution
- Route distribution is accurate
- Query matrix shows proper scores and coverage status
- Intent drift queries are correctly identified
