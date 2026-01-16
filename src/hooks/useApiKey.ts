import { useState, useEffect, useCallback } from 'react';
import { getStoredApiKey, storeApiKey, removeStoredApiKey, testApiKey } from '@/lib/embeddings';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load stored API key on mount
  useEffect(() => {
    const stored = getStoredApiKey();
    if (stored) {
      setApiKeyState(stored);
      setIsValid(true); // Assume valid if stored
    }
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    setError(null);
    
    if (!key) {
      setIsValid(null);
      removeStoredApiKey();
      return;
    }

    if (!key.startsWith('sk-')) {
      setError('API key should start with "sk-"');
      setIsValid(false);
      return;
    }

    setIsValidating(true);
    try {
      const valid = await testApiKey(key);
      setIsValid(valid);
      if (valid) {
        storeApiKey(key);
        setError(null);
      } else {
        setError('Invalid API key');
        removeStoredApiKey();
      }
    } catch (err) {
      setIsValid(false);
      setError('Failed to validate API key');
      removeStoredApiKey();
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearApiKey = useCallback(() => {
    setApiKeyState('');
    setIsValid(null);
    setError(null);
    removeStoredApiKey();
  }, []);

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    isValidating,
    isValid,
    error,
  };
}
