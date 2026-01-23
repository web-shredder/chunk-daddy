

# Fix: SEO Section Not Visible in Query Intelligence Dashboard

## Problem
The "Probable Seed Keywords for SEO" section is not visible in the Query Intelligence Dashboard because the `extractedEntities` prop is not being passed to the component.

## Root Cause
In `src/components/moonbug/QueryAutoSuggest.tsx`, the `QueryIntelligenceDashboard` component is rendered without passing the `extractedEntities` prop, even though the data is available in the `entities` state.

**Current code (lines 817-828):**
```tsx
<QueryIntelligenceDashboard
  suggestions={suggestions}
  intentSummary={intentSummary}
  criticalGaps={criticalGaps}
  followUpQueries={followUpQueries}
  priorityActions={priorityActions}
  competitiveGaps={competitiveGaps}
  gapSummary={gapSummary}
  existingQueries={existingQueries}
  onAddQueries={onAddQueries}
  contentIntelligence={intelligence}
  // extractedEntities is MISSING here!
/>
```

The SEO section has a conditional render check:
```tsx
{extractedEntities && extractedEntities.primary.length > 0 && (
  // SEO section content
)}
```

Since `extractedEntities` is `undefined`, the section never renders.

---

## Solution

### File: `src/components/moonbug/QueryAutoSuggest.tsx`

**Change Location:** Around line 817-828

Add the missing `extractedEntities` and `filteredQueries` props to the `QueryIntelligenceDashboard` component:

```tsx
<QueryIntelligenceDashboard
  suggestions={suggestions}
  intentSummary={intentSummary}
  criticalGaps={criticalGaps}
  followUpQueries={followUpQueries}
  priorityActions={priorityActions}
  competitiveGaps={competitiveGaps}
  gapSummary={gapSummary}
  existingQueries={existingQueries}
  onAddQueries={onAddQueries}
  contentIntelligence={intelligence}
  extractedEntities={entities}           // ADD THIS
  filteredQueries={filteredQueries}      // ADD THIS (bonus: enables drift display)
/>
```

---

## Why This Fixes It

1. The `entities` state in `QueryAutoSuggest` is populated after analysis completes (line 378)
2. It contains `{ primary: string[]; secondary: string[]; temporal: string[]; branded: string[] }`
3. Once passed as `extractedEntities`, the dashboard's conditional check passes and the SEO section renders
4. The SEO section will display:
   - Core Topics (primary entities)
   - Supporting Concepts (secondary entities)
   - Brand Terms (branded entities)
   - Temporal Keywords (temporal entities like "2026")
   - Suggested Keyword Combinations

---

## Testing

After this fix:
1. Go to the Queries tab
2. Enter content and run auto-suggest analysis
3. Switch to Dashboard view
4. Scroll down past the "Extracted Entities" section
5. You should see the collapsible "Probable Seed Keywords for SEO" section with the plant icon

