import { useState, useEffect, useCallback } from 'react';
import { checkApiStatus } from '@/lib/embeddings';

export function useApiKey() {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    try {
      const valid = await checkApiStatus();
      setIsValid(valid);
      if (!valid) {
        setError('API key not configured or invalid');
      }
    } catch (err) {
      setIsValid(false);
      setError(err instanceof Error ? err.message : 'Failed to check API status');
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isValidating,
    isValid,
    error,
    recheckStatus: checkStatus,
  };
}
