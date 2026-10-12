'use client';

import { useCallback, useState } from 'react';
import { fetchRecommendations } from '@/lib/fetchRecommendations';

/**
 * Manages the request lifecycle for AI recommendations and maps the returned
 * ids back onto full product objects, preserving the AI's ranking.
 */
export function useRecommendations(products) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const recommend = useCallback(
    async (query) => {
      setIsLoading(true);
      setError('');
      try {
        const { summary, recommendations } = await fetchRecommendations(query);
        const byId = new Map(products.map((p) => [p.id, p]));
        const items = recommendations
          .filter(({ id }) => byId.has(id))
          .map(({ id, reason }) => ({ ...byId.get(id), reason }));
        setResult({ query, summary, items });
      } catch (err) {
        setError(err.message);
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [products],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError('');
  }, []);

  return { result, isLoading, error, recommend, reset };
}
