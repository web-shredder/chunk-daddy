import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, Layers, Split, Repeat } from 'lucide-react';
import { previewChunkCount, type ChunkerOptions } from '@/lib/layout-chunker';

interface ChunkingSettingsProps {
  content: string;
  options: ChunkerOptions;
  onChange: (options: ChunkerOptions) => void;
  hideCard?: boolean;
}

const STORAGE_KEY = 'chunk-daddy-settings';

export function ChunkingSettings({ content, options, onChange, hideCard = false }: ChunkingSettingsProps) {
  const [chunkPreview, setChunkPreview] = useState(0);
  
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onChange(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);
  
  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [options]);
  
  // Update chunk preview count
  useEffect(() => {
    if (content.trim()) {
      const count = previewChunkCount(content, options);
      setChunkPreview(count);
    } else {
      setChunkPreview(0);
    }
  }, [content, options]);
  
  const settingsContent = (
    <div className="space-y-5">
      {/* Chunk preview badge - show at top when hideCard */}
      {hideCard && chunkPreview > 0 && (
        <div className="flex justify-end">
          <Badge variant="secondary" className="text-xs">
            ~{chunkPreview} chunks
          </Badge>
        </div>
      )}
      
      {/* Heading Cascade Toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="cascade" className="text-sm font-medium cursor-pointer">
                Enable Heading Cascade
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]">
                  <p className="text-xs">
                    Prepends parent headings to each chunk for better semantic context.
                    This is how Google's RAG systems improve retrieval accuracy.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              Each chunk includes its parent headings for context
            </p>
          </div>
          <Switch
            id="cascade"
            checked={options.cascadeHeadings}
            onCheckedChange={(checked) => onChange({ ...options, cascadeHeadings: checked })}
          />
        </div>
        
        {/* Max Chunk Size Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Split className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-medium">Max Chunk Size</Label>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {options.maxChunkSize} tokens
            </Badge>
          </div>
          <Slider
            value={[options.maxChunkSize]}
            onValueChange={([value]) => onChange({ ...options, maxChunkSize: value })}
            min={128}
            max={2048}
            step={64}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            <span>128</span>
            <span>512</span>
            <span>1024</span>
            <span>2048</span>
          </div>
        </div>
        
        {/* Chunk Overlap Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-sm font-medium">Chunk Overlap</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px]">
                  <p className="text-xs">
                    When long paragraphs are split, this many tokens from the end of each chunk
                    are included at the start of the next chunk.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {options.chunkOverlap} tokens
            </Badge>
          </div>
          <Slider
            value={[options.chunkOverlap]}
            onValueChange={([value]) => onChange({ ...options, chunkOverlap: value })}
            min={0}
            max={200}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground px-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
            <span>200</span>
          </div>
        </div>
    </div>
  );
  
  if (hideCard) {
    return settingsContent;
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Chunking Settings
          </CardTitle>
          {chunkPreview > 0 && (
            <Badge variant="secondary" className="text-xs">
              ~{chunkPreview} chunks
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Configure layout-aware chunking with heading cascades
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {settingsContent}
      </CardContent>
    </Card>
  );
}
