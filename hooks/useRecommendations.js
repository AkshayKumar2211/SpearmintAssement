'use client';

import { useCallback, useState } from 'react';
import { fetchRecommendations } from '@/lib/fetchRecommendations';
import { searchProducts } from '@/lib/localSearch';

const isInputError = (err) => err.status >= 400 && err.status < 500;

/**
 * Manages the request lifecycle for AI recommendations and maps the returned
 * ids back onto full product objects, preserving the AI's ranking. If the API
 * can't be reached at all, it falls back to the same keyword search in the browser.
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
        let response;
        try {
          response = await fetchRecommendations(query);
        } catch (err) {
          if (isInputError(err)) throw err;
          response = { source: 'fallback', ...searchProducts(query, products) };
        }

        const { source, summary, recommendations } = response;
        const byId = new Map(products.map((p) => [p.id, p]));
        const items = recommendations
          .filter(({ id }) => byId.has(id))
          .map(({ id, reason }) => ({ ...byId.get(id), reason }));
        setResult({ query, source, summary, items });
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
