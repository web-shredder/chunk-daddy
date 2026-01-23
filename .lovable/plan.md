

# SEO Seed Keywords Section Implementation Plan

## Overview
Add a new "Probable Seed Keywords for SEO" section to the Query Intelligence Dashboard that repurposes the extracted entities as actionable SEO research starting points. This section will present keywords in a format optimized for SEO tools like Ahrefs, SEMrush, or Google Keyword Planner.

---

## Design Philosophy

The extracted entities (Primary, Secondary, Branded, Temporal) are exactly what was causing "keyword stuffing" in the primary query. Instead of discarding them, we repurpose them as:
- **Seed keywords** for keyword research tools
- **Topic clusters** for content planning
- **Entity variations** for semantic SEO

---

## File to Modify

### `src/components/moonbug/QueryIntelligenceDashboard.tsx`

**Location**: After the "Intent Preservation Entities" section (around line 833)

**New Section: "SEO Seed Keywords"**

```text
┌──────────────────────────────────────────────────────────────┐
│ 🌱 Probable Seed Keywords for SEO                           │
│ Copy-ready keywords for research tools                       │
├──────────────────────────────────────────────────────────────┤
│ CORE TOPICS                          [Copy All]              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ RPO • recruitment process outsourcing • talent acquisition││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ MODIFIERS & QUALIFIERS                                       │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ best • how to • vs • comparison • for small business     ││
│ │ 2024 • pricing • cost • review • alternatives            ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ BRAND TERMS                                                  │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Acme Corp • TalentAcquire Pro                            ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ SUGGESTED COMBINATIONS                    [Copy All]         │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ RPO pricing                                              ││
│ │ best RPO providers 2024                                  ││
│ │ recruitment process outsourcing vs in-house              ││
│ │ how to choose RPO                                        ││
│ └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Add Helper Function for Keyword Combinations

```typescript
function generateSEOCombinations(entities: ExtractedEntities): string[] {
  const combinations: string[] = [];
  const primaryEntity = entities.primary[0] || '';
  
  if (!primaryEntity) return combinations;
  
  // Common SEO modifiers
  const modifiers = [
    'best', 'top', 'how to', 'what is', 'vs', 
    'pricing', 'cost', 'review', 'alternatives', 'guide'
  ];
  
  // Generate combinations with modifiers
  modifiers.forEach(mod => {
    if (mod === 'what is' || mod === 'how to') {
      combinations.push(`${mod} ${primaryEntity}`);
    } else if (mod === 'vs') {
      // Skip vs if no secondary entities
      if (entities.secondary.length > 0) {
        combinations.push(`${primaryEntity} vs ${entities.secondary[0]}`);
      }
    } else {
      combinations.push(`${mod} ${primaryEntity}`);
    }
  });
  
  // Add temporal combinations if applicable
  if (entities.temporal.length > 0) {
    const year = entities.temporal.find(t => /\d{4}/.test(t));
    if (year) {
      combinations.push(`best ${primaryEntity} ${year}`);
    }
  }
  
  return combinations.slice(0, 8); // Limit to 8 suggestions
}
```

### 2. Add Copy-to-Clipboard Functionality

```typescript
const handleCopyKeywords = (keywords: string[], label: string) => {
  const text = keywords.join('\n');
  navigator.clipboard.writeText(text);
  toast.success(`Copied ${keywords.length} keywords`, {
    description: `${label} copied to clipboard`,
  });
};
```

### 3. New UI Section Component

```tsx
{/* Section: SEO Seed Keywords */}
{extractedEntities && (extractedEntities.primary.length > 0) && (
  <Collapsible defaultOpen={false}>
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold text-sm">Probable Seed Keywords for SEO</h3>
          <Badge variant="secondary" className="text-xs">
            {allKeywords.length} keywords
          </Badge>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="p-4 pt-0 space-y-4">
          {/* Core Topics Section */}
          <KeywordGroup 
            label="Core Topics" 
            keywords={extractedEntities.primary}
            variant="primary"
            onCopy={handleCopyKeywords}
          />
          
          {/* Secondary Concepts */}
          {extractedEntities.secondary.length > 0 && (
            <KeywordGroup 
              label="Supporting Concepts" 
              keywords={extractedEntities.secondary}
              variant="secondary"
              onCopy={handleCopyKeywords}
            />
          )}
          
          {/* Branded Terms */}
          {extractedEntities.branded.length > 0 && (
            <KeywordGroup 
              label="Brand Terms" 
              keywords={extractedEntities.branded}
              variant="branded"
              onCopy={handleCopyKeywords}
            />
          )}
          
          {/* Generated Combinations */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Suggested Keyword Combinations
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={() => handleCopyKeywords(seoCombinations, 'Combinations')}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy All
              </Button>
            </div>
            <div className="bg-muted/30 rounded-md p-3 font-mono text-xs space-y-1">
              {seoCombinations.map((combo, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between group hover:bg-muted/50 px-2 py-1 rounded"
                >
                  <span>{combo}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      navigator.clipboard.writeText(combo);
                      toast.success('Copied', { description: combo });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Export All as CSV */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportSEOKeywords}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export All Keywords (CSV)
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
)}
```

### 4. KeywordGroup Subcomponent

```tsx
function KeywordGroup({ 
  label, 
  keywords, 
  variant, 
  onCopy 
}: { 
  label: string; 
  keywords: string[]; 
  variant: 'primary' | 'secondary' | 'branded';
  onCopy: (keywords: string[], label: string) => void;
}) {
  const styles = {
    primary: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    secondary: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    branded: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => onCopy(keywords, label)}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <Badge 
            key={kw} 
            variant="outline" 
            className={cn("text-xs cursor-pointer hover:opacity-80", styles[variant])}
            onClick={() => {
              navigator.clipboard.writeText(kw);
              toast.success('Copied', { description: kw });
            }}
          >
            {kw}
          </Badge>
        ))}
      </div>
    </div>
  );
}
```

### 5. CSV Export Function

```typescript
const handleExportSEOKeywords = () => {
  if (!extractedEntities) return;
  
  const rows = [
    ['Keyword', 'Type', 'Priority'],
    ...extractedEntities.primary.map(k => [k, 'Core Topic', 'High']),
    ...extractedEntities.secondary.map(k => [k, 'Supporting Concept', 'Medium']),
    ...extractedEntities.branded.map(k => [k, 'Brand Term', 'High']),
    ...seoCombinations.map(k => [k, 'Suggested Combination', 'Medium']),
  ];
  
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'seo-seed-keywords.csv';
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success('Keywords exported', {
    description: `${rows.length - 1} keywords saved to CSV`,
  });
};
```

---

## State Additions

Add to component state:
```typescript
// Memoized SEO combinations
const seoCombinations = useMemo(() => {
  if (!extractedEntities) return [];
  return generateSEOCombinations(extractedEntities);
}, [extractedEntities]);

// Total keyword count for badge
const allKeywords = useMemo(() => {
  if (!extractedEntities) return [];
  return [
    ...extractedEntities.primary,
    ...extractedEntities.secondary,
    ...extractedEntities.branded,
    ...seoCombinations,
  ];
}, [extractedEntities, seoCombinations]);
```

---

## Import Additions

Add to imports:
```typescript
import { Copy, Download } from 'lucide-react';
// toast already imported via sonner
```

---

## UI Behavior

1. **Section starts collapsed** - Users can expand when needed
2. **Click-to-copy on individual keywords** - Quick single keyword copy
3. **Copy All buttons** - Bulk copy for each section
4. **Hover effects** - Visual feedback on interactive elements
5. **CSV export** - Full export for importing into SEO tools

---

## Summary

This feature:
- Repurposes the "keyword list" that was previously causing the primary query bug
- Provides actionable SEO research data
- Supports multiple copy mechanisms for different workflows
- Includes a CSV export for importing into tools like Ahrefs or SEMrush
- Follows existing dashboard styling patterns
