'use client';

import { useMemo, useState } from 'react';
import CategoryFilter, { ALL_CATEGORIES } from './CategoryFilter';
import PreferenceForm from './PreferenceForm';
import ProductGrid from './ProductGrid';
import { useRecommendations } from '@/hooks/useRecommendations';

export default function ProductRecommender({ products }) {
  const { result, isLoading, error, recommend, reset } = useRecommendations(products);
  const [category, setCategory] = useState(ALL_CATEGORIES);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const visibleProducts =
    category === ALL_CATEGORIES ? products : products.filter((p) => p.category === category);

  return (
    <>
      <PreferenceForm onSubmit={recommend} isLoading={isLoading} />

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {result ? (
        <section>
          <div className="section-header">
            <h2>
              Recommendations for <em>&ldquo;{result.query}&rdquo;</em>
            </h2>
            <button type="button" className="link-button" onClick={reset}>
              ← Show all products
            </button>
          </div>
          {result.summary && <p className="alert info">{result.summary}</p>}
          {result.items.length > 0 ? (
            <ProductGrid products={result.items} ranked />
          ) : (
            <p className="empty">No products in our catalog match those preferences.</p>
          )}
        </section>
      ) : (
        <section>
          <div className="section-header">
            <h2>
              {category === ALL_CATEGORIES ? 'All products' : category} ({visibleProducts.length})
            </h2>
          </div>
          <CategoryFilter categories={categories} selected={category} onSelect={setCategory} />
          <ProductGrid products={visibleProducts} />
        </section>
      )}
    </>
  );
}
