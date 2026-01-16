import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
}

export function KeywordInput({
  keywords,
  onChange,
  maxKeywords = 5,
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < maxKeywords) {
      onChange([...keywords, trimmed]);
      setInputValue('');
    }
  };

  const handleRemove = (keyword: string) => {
    onChange(keywords.filter(k => k !== keyword));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter target keyword..."
          className="flex-1"
          disabled={keywords.length >= maxKeywords}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAdd}
          disabled={!inputValue.trim() || keywords.length >= maxKeywords}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="px-3 py-1 text-sm"
            >
              {keyword}
              <button
                type="button"
                onClick={() => handleRemove(keyword)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        {keywords.length}/{maxKeywords} keywords • Press Enter to add
      </p>
    </div>
  );
}
