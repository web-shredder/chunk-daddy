
# Export Categories Dialog Implementation Plan

## Overview
Create a new `ExportCategoriesDialog` component that provides filter checkboxes for selecting which categories and columns to include in the CSV export, then add an "Export All Categories" button to the ResultsTab header when in 4-Bucket view mode.

---

## Files to Create

### 1. `src/components/moonbug/ExportCategoriesDialog.tsx`

A dialog component following the pattern established by `ExportGapsDialog` and `ExportFanoutDialog`:

**Features:**
- Filter checkboxes for categories (Optimization, Gaps, Drift, Out of Scope)
- Filter checkboxes for columns (Query, Scores, Intent Analysis, Entity Analysis, Actions)
- Summary badges showing counts per category
- Tabs for "Configure Export" and "Preview"
- Copy to clipboard and Download buttons for CSV, Markdown, and JSON formats

**Props:**
```typescript
interface ExportCategoriesDialogProps {
  breakdown: CategoryBreakdown;
  summary: CategorizationSummary;
  primaryQuery: string;
  trigger?: React.ReactNode;
}
```

**State:**
- `categoryFilters`: Object tracking which categories to include
- `columnFilters`: Object tracking which column groups to include
- `copied`: Track which format was just copied
- `open`: Dialog open state

**UI Structure:**
- Dialog with two tabs: "Configure" and "Export"
- Configure tab: Two sections with checkbox groups (Categories and Columns)
- Export tab: CSV/Markdown/JSON options with Copy and Download buttons

---

## Files to Modify

### 2. `src/lib/export-categorized-queries.ts`

**Enhance `ExportOptions` interface:**
```typescript
interface ExportOptions {
  // Category filters (existing)
  includeOptimization: boolean;
  includeGaps: boolean;
  includeDrift: boolean;
  includeOutOfScope: boolean;
  
  // Column filters (new)
  includeScores: boolean;
  includeIntentAnalysis: boolean;
  includeEntityAnalysis: boolean;
  includeActionInfo: boolean;
}
```

**Update `exportCategorizedQueriesToCSV`:**
- Dynamically build headers array based on column filter options
- Conditionally include score columns (Content Similarity, Passage Score, Best Chunk)
- Conditionally include intent columns (Drift Score, Drift Level)
- Conditionally include entity columns (Entity Overlap %, Missing Entities)
- Conditionally include action columns (Primary Action, Category Reasoning)

**Add new export functions:**
- `exportCategorizedQueriesAsMarkdown()` - Markdown format with sections per category
- `exportCategorizedQueriesAsJSON()` - Full JSON with metadata

---

### 3. `src/components/moonbug/ResultsTab.tsx`

**Add import:**
```typescript
import { ExportCategoriesDialog } from './ExportCategoriesDialog';
```

**Add "Export All Categories" button in header:**
- Location: After the view mode toggle buttons (around line 722)
- Visibility: Only when `viewMode === 'categories'` and categorization data exists
- Uses the new `ExportCategoriesDialog` component

**Code location:** Insert after line 721 (after the 4-Bucket toggle button):
```tsx
{viewMode === 'categories' && result?.categoryBreakdown && result?.categorizationSummary && (
  <ExportCategoriesDialog
    breakdown={result.categoryBreakdown}
    summary={result.categorizationSummary}
    primaryQuery={keywords[0] || 'Primary Query'}
    trigger={
      <button className="flex items-center gap-1 py-1.5 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </button>
    }
  />
)}
```

---

### 4. `src/components/moonbug/index.ts`

**Add export:**
```typescript
export { ExportCategoriesDialog } from './ExportCategoriesDialog';
```

---

## Technical Details

### Checkbox UI Structure (Configure Tab)

**Category Filters Section:**
```
┌─ Categories to Include ─────────────────────────┐
│ ☑ Optimization Opportunities (12)              │
│ ☑ Content Gaps (8)                             │
│ ☑ Intent Drift (5)                             │
│ ☐ Out of Scope (3)                             │
└─────────────────────────────────────────────────┘
```

**Column Filters Section:**
```
┌─ Columns to Include ────────────────────────────┐
│ ☑ Query & Category (always included)           │
│ ☑ Scores (Similarity, Passage, Best Chunk)     │
│ ☑ Intent Analysis (Drift Score, Level)         │
│ ☐ Entity Analysis (Overlap %, Missing)         │
│ ☑ Actions (Primary Action, Reasoning)          │
└─────────────────────────────────────────────────┘
```

### Export Tab Structure

Following the pattern from `ExportGapsDialog`:
- Three cards for CSV, Markdown, JSON
- Each card has icon, title, description
- Copy and Download buttons for each format
- Toast feedback on copy/download success

### Preview Badge Behavior

Show a dynamic count badge that updates based on checkbox selection:
- "Exporting 25 of 28 variants"
- Badge colors match category (green for optimization, amber for gaps, etc.)

---

## Component Dependencies

- `@/components/ui/dialog` - Dialog primitives
- `@/components/ui/checkbox` - Filter checkboxes
- `@/components/ui/tabs` - Configure/Export tabs
- `@/components/ui/button` - Action buttons
- `@/components/ui/badge` - Count badges
- `lucide-react` - Icons (Download, Copy, Check, FileSpreadsheet, FileText, FileJson)
- `sonner` - Toast notifications
