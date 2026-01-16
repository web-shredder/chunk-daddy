import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import type { ChunkingStrategy } from '@/lib/chunking';

interface ChunkingStrategySelectProps {
  strategy: ChunkingStrategy;
  onChange: (strategy: ChunkingStrategy) => void;
  fixedSize: number;
  onFixedSizeChange: (size: number) => void;
}

export function ChunkingStrategySelect({
  strategy,
  onChange,
  fixedSize,
  onFixedSizeChange,
}: ChunkingStrategySelectProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Chunking Strategy</Label>
      
      <RadioGroup
        value={strategy}
        onValueChange={(value) => onChange(value as ChunkingStrategy)}
        className="space-y-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="paragraph" id="paragraph" />
          <Label htmlFor="paragraph" className="text-sm font-normal cursor-pointer">
            Paragraph (split by double line breaks)
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="semantic" id="semantic" />
          <Label htmlFor="semantic" className="text-sm font-normal cursor-pointer">
            Semantic (group 2-3 sentences)
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="fixed" id="fixed" />
          <Label htmlFor="fixed" className="text-sm font-normal cursor-pointer">
            Fixed size (character count)
          </Label>
        </div>
      </RadioGroup>
      
      {strategy === 'fixed' && (
        <div className="flex items-center gap-2 pl-6">
          <Input
            type="number"
            value={fixedSize}
            onChange={(e) => onFixedSizeChange(parseInt(e.target.value) || 500)}
            className="w-24"
            min={100}
            max={2000}
          />
          <span className="text-sm text-muted-foreground">characters</span>
        </div>
      )}
    </div>
  );
}
