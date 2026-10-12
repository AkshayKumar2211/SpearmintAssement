const CATEGORY_COLORS = {
  Phone: '4f46e5',
  Laptop: '0f766e',
  Desktop: '334155',
  Tablet: '7c3aed',
  'Gaming Console': '1d4ed8',
  'PlayStation Game': '0b1f5c',
  Headphones: 'be123c',
  Smartwatch: 'c2410c',
  Monitor: '0369a1',
  TV: '1e293b',
  Camera: '854d0e',
  'Smart Home': '15803d',
  Accessory: '6b7280',
};

/** Returns the product's real image, or a category-coloured placeholder with its name. */
export function getProductImage({ image, name, category }) {
  if (image) return image;
  const color = CATEGORY_COLORS[category] ?? '6b7280';
  return `https://placehold.co/400x400/${color}/ffffff/png?text=${encodeURIComponent(name)}&font=roboto`;
}
