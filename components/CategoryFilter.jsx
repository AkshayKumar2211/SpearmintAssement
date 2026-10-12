export const ALL_CATEGORIES = 'All';

export default function CategoryFilter({ categories, selected, onSelect }) {
  return (
    <div className="category-filter" role="group" aria-label="Filter by category">
      {[ALL_CATEGORIES, ...categories].map((category) => (
        <button
          key={category}
          type="button"
          className={`chip${category === selected ? ' active' : ''}`}
          aria-pressed={category === selected}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
