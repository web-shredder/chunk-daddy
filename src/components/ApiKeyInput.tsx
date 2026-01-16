import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';

interface ApiKeyInputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  isValidating: boolean;
  isValid: boolean | null;
  error: string | null;
  onClear: () => void;
}

export function ApiKeyInput({
  apiKey,
  onApiKeyChange,
  isValidating,
  isValid,
  error,
  onClear,
}: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const [inputValue, setInputValue] = useState(apiKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApiKeyChange(inputValue);
  };

  const getStatusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (isValid === true) {
      return <Check className="h-4 w-4 text-green-600" />;
    }
    if (isValid === false) {
      return <X className="h-4 w-4 text-destructive" />;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="api-key" className="text-sm font-medium">
          OpenAI API Key
        </Label>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          {isValid && (
            <span className="text-xs text-green-600 font-medium">API Ready</span>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="sk-..."
            className="pr-10 font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
        
        {inputValue !== apiKey && (
          <Button type="submit" size="sm" disabled={isValidating}>
            Save
          </Button>
        )}
        
        {apiKey && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setInputValue('');
              onClear();
            }}
          >
            Clear
          </Button>
        )}
      </form>
      
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      
      <p className="text-xs text-muted-foreground">
        Your key is stored locally in your browser and never sent to our servers.
      </p>
    </div>
  );
}
