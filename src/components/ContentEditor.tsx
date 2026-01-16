import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getWordCount, getCharCount } from '@/lib/chunking';

interface ContentEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxChars?: number;
}

export function ContentEditor({
  label,
  value,
  onChange,
  placeholder = 'Enter your content here...',
  maxChars = 5000,
}: ContentEditorProps) {
  const wordCount = getWordCount(value);
  const charCount = getCharCount(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{wordCount} words</span>
          <span>{charCount}/{maxChars} chars</span>
        </div>
      </div>
      
      <Textarea
        value={value}
        onChange={(e) => {
          if (e.target.value.length <= maxChars) {
            onChange(e.target.value);
          }
        }}
        placeholder={placeholder}
        className="min-h-[200px] font-sans text-sm leading-relaxed resize-none"
      />
    </div>
  );
}
