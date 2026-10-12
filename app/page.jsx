import products from '@/data/products.json';
import ProductRecommender from '@/components/ProductRecommender';

export default function HomePage() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>AI Product Recommender</h1>
        <p>Tell us what you&apos;re looking for and Gemini will pick the best matches from our catalog.</p>
      </header>
      <ProductRecommender products={products} />
    </main>
  );
}
