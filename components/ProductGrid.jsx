import ProductCard from './ProductCard.jsx';

export default function ProductGrid({ products, ranked = false }) {
  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} rank={ranked ? index + 1 : null} />
      ))}
    </div>
  );
}
