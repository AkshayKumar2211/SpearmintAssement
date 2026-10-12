import Image from 'next/image';
import { getProductImage } from '@/lib/productImage';

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function ProductCard({ product, rank }) {
  const { name, brand, category, price, rating, description, reason } = product;

  return (
    <article className={`product-card${reason ? ' recommended' : ''}`}>
      <div className="product-image">
        <Image src={getProductImage(product)} alt={name} fill sizes="(max-width: 520px) 100vw, 240px" />
      </div>
      <header>
        <span className="category">{category}</span>
        {rank && <span className="rank">#{rank} pick</span>}
      </header>
      <h3>{name}</h3>
      <p className="brand">{brand}</p>
      <p className="description">{description}</p>
      {reason && (
        <p className="reason">
          <strong>Why:</strong> {reason}
        </p>
      )}
      <footer>
        <span className="price">{priceFormatter.format(price)}</span>
        <span className="rating" aria-label={`Rated ${rating} out of 5`}>
          ★ {rating.toFixed(1)}
        </span>
      </footer>
    </article>
  );
}
