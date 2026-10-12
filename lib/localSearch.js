/**
 * Keyword-based recommender used when Gemini is unavailable. It understands
 * product types, brands, budgets and a few common needs (kids, gaming, travel…)
 * so typical shopping prompts still get sensible results without the AI.
 */

const MAX_RESULTS = 8;


const CATEGORY_TERMS = {
  Phone: { strong: ['phone', 'smartphone', 'mobile', 'cellphone'], weak: ['iphone', 'android', 'galaxy', 'pixel'] },
  Laptop: { strong: ['laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook'], weak: [] },
  Desktop: { strong: ['desktop', 'pc', 'tower', 'imac', 'mac mini', 'all-in-one', 'mini pc'], weak: ['computer'] },
  Tablet: { strong: ['tablet', 'ipad', 'e-reader', 'ereader', 'kindle'], weak: [] },
  'Gaming Console': {
    strong: ['console', 'controller', 'dualsense', 'vr headset', 'handheld'],
    weak: ['playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch', 'steam deck'],
  },
  'PlayStation Game': { strong: ['game', 'video game'], weak: [] },
  Headphones: { strong: ['headphone', 'earbud', 'earphone', 'headset', 'airpods'], weak: [] },
  Smartwatch: { strong: ['smartwatch', 'watch', 'fitness tracker', 'tracker'], weak: [] },
  Monitor: { strong: ['monitor'], weak: ['display', 'screen'] },
  TV: { strong: ['tv', 'television'], weak: [] },
  Camera: { strong: ['dslr', 'mirrorless', 'gopro', 'action camera', 'drone'], weak: ['camera'] },
  'Smart Home': { strong: ['smart speaker', 'smart home', 'alexa', 'doorbell', 'homepod', 'echo'], weak: ['speaker'] },
  Accessory: {
    strong: ['accessory', 'charger', 'case', 'mouse', 'keyboard', 'ssd', 'power bank', 'battery pack', 'selfie stick'],
    weak: [],
  },
};

const DEVICE_CATEGORIES = ['Phone', 'Laptop', 'Desktop', 'Tablet', 'Gaming Console'];

// Terms that merely name a category; they select it but shouldn't affect ranking.
const GENERIC_TERMS = new Set([
  'phone', 'smartphone', 'mobile', 'cellphone', 'laptop', 'notebook', 'desktop', 'pc', 'computer', 'tower',
  'tablet', 'console', 'game', 'video game', 'headphone', 'earphone', 'earbud', 'headset', 'smartwatch',
  'watch', 'tracker', 'monitor', 'display', 'screen', 'tv', 'television', 'camera', 'speaker', 'smart home',
  'accessory',
]);

// Everyday words mapped to the wording used in product descriptions.
const SYNONYMS = {
  kid: ['kid', 'famil', 'everyone', 'e10'],
  child: ['kid', 'famil', 'everyone', 'e10'],
  children: ['kid', 'famil', 'everyone', 'e10'],
  family: ['kid', 'famil', 'everyone', 'e10', 'co-op'],
  student: ['student', 'school', 'college', 'study', 'budget'],
  college: ['student', 'school', 'college', 'study'],
  school: ['student', 'school', 'college', 'study'],
  gaming: ['gaming', 'rtx', 'console'],
  gamer: ['gaming', 'rtx', 'console'],
  travel: ['travel', 'lightweight', 'compact', 'portable', 'noise', 'battery'],
  flight: ['travel', 'noise', 'battery'],
  office: ['office', 'work', 'business'],
  work: ['office', 'work', 'business'],
  photo: ['camera', 'photo'],
  photography: ['camera', 'photo'],
  selfie: ['selfie', 'front camera'],
  light: ['lightweight', 'thin', 'compact', 'portable'],
  lightweight: ['lightweight', 'thin', 'compact', 'portable'],
  portable: ['lightweight', 'compact', 'portable', 'handheld'],
  battery: ['battery'],
  multiplayer: ['co-op', 'multiplayer', 'online', 'player'],
  coop: ['co-op', 'multiplayer'],
  scary: ['horror'],
  football: ['football', 'soccer'],
  soccer: ['football', 'soccer'],
  editing: ['editing', 'creative', 'creator', 'pro'],
  creative: ['creative', 'creator', 'design', 'editing'],
  drawing: ['drawing', 'pencil', 'pen', 'artist'],
  running: ['running', 'runner', 'gps'],
  runner: ['running', 'runner', 'gps'],
  fitness: ['fitness', 'health', 'heart-rate', 'running'],
};

const BUDGET_WORDS = new Set(['cheap', 'cheapest', 'budget', 'affordable', 'inexpensive', 'low-cost']);
const QUALITY_WORDS = new Set(['best', 'top', 'premium', 'flagship', 'high-end', 'highest']);

const STOPWORDS = new Set(
  `a an the i im i'm me my we you your want wants need needs looking look for find show give get some any
   good great nice new with without and or of to in on at by is are be that this it its which what who
   please recommend recommendation suggest suitable ideal perfect something thing things product products item items buy
   like love would could should can will just also very really more most less than under below over above
   around about between from up upto within max maximum min minimum least budget price cost dollars dollar usd`
    .split(/\s+/)
    .filter(Boolean),
);

const NUMBER = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?k?)`;
// Skip numbers that are clearly not prices: "under 13 years", "27 inch", "144hz"…
const NOT_PRICE = String.raw`(?![\d,.k]|\s*(?:\+|years?|yrs?|yo\b|inch|in\b|"|hz|gb|tb|mp|mah|w\b|players?))`;
// Without a "$", small numbers are more likely ages or counts ("kids under 13").
const MIN_UNMARKED_PRICE = 20;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRegex = (term) => new RegExp(`\\b${escapeRegExp(term)}(?:s|es)?\\b`, 'i');
const parseAmount = (raw) => {
  const value = parseFloat(raw.replace(/,/g, ''));
  return raw.toLowerCase().endsWith('k') ? value * 1000 : value;
};
const formatPrice = (value) => `$${Math.round(value).toLocaleString('en-US')}`;

function amountFrom(match) {
  if (!match) return null;
  const value = parseAmount(match[1]);
  return match[0].includes('$') || value >= MIN_UNMARKED_PRICE ? value : null;
}

function parsePriceRange(text) {
  const between = text.match(
    new RegExp(String.raw`(?:between|from)\s*${NUMBER}\s*(?:and|to|-)\s*${NUMBER}${NOT_PRICE}`, 'i'),
  );
  if (between) return { min: parseAmount(between[1]), max: parseAmount(between[2]) };

  const dashed = text.match(/\$\s*(\d[\d,]*k?)\s*(?:-|to)\s*\$?\s*(\d[\d,]*k?)/i);
  if (dashed) return { min: parseAmount(dashed[1]), max: parseAmount(dashed[2]) };

  const range = {};
  const max = amountFrom(
    text.match(
      new RegExp(
        String.raw`(?:under|below|less than|cheaper than|no more than|not more than|max(?:imum)?|up ?to|within|budget(?: of| is)?|<=?)\s*${NUMBER}${NOT_PRICE}`,
        'i',
      ),
    ),
  );
  if (max != null) range.max = max;

  const min = amountFrom(
    text.match(
      new RegExp(String.raw`(?:over|above|more than|at least|min(?:imum)?|starting at|>=?)\s*${NUMBER}${NOT_PRICE}`, 'i'),
    ),
  );
  if (min != null) range.min = min;

  const around = amountFrom(
    text.match(new RegExp(String.raw`(?:around|about|roughly|approx(?:imately)?)\s*${NUMBER}${NOT_PRICE}`, 'i')),
  );
  if (around != null && max == null && min == null) {
    return { min: around * 0.8, max: around * 1.2 };
  }

  // A bare "$500" with no qualifier is treated as a budget ceiling.
  if (max == null && min == null) {
    const bare = text.match(/\$\s*(\d[\d,]*k?)/);
    if (bare) range.max = parseAmount(bare[1]);
  }
  return range;
}

function detectCategories(text) {
  const strong = new Set();
  const weak = new Set();
  for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
    if (terms.strong.some((term) => termRegex(term).test(text))) strong.add(category);
    else if (terms.weak.some((term) => termRegex(term).test(text))) weak.add(category);
  }
  const categories = strong.size > 0 ? strong : weak;

  // "laptop charger", "iphone case": the accessory is what they want.
  if (categories.has('Accessory')) DEVICE_CATEGORIES.forEach((c) => categories.delete(c));
  return categories;
}

function detectBrands(text, products) {
  const brands = [...new Set(products.map((p) => p.brand))];
  return new Set(brands.filter((brand) => termRegex(brand.toLowerCase()).test(text)));
}

/**
 * Descriptive words left after removing stopwords, prices and the terms that
 * already selected a category or brand. Terms of categories that were *not*
 * selected stay, e.g. "camera" in "phone with a good camera".
 */
function extractKeywords(text, consumedTerms) {
  const stripped = consumedTerms
    .sort((a, b) => b.length - a.length)
    .reduce((acc, term) => acc.replace(new RegExp(termRegex(term).source, 'gi'), ' '), text);

  return stripped
    .replace(/(?<![a-z0-9])\$?\d[\d,]*(?:\.\d+)?k?(?![a-z0-9])/g, ' ')
    .split(/[^a-z0-9-]+/)
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

export function parseQuery(query, products) {
  const text = query.toLowerCase();
  const categories = detectCategories(text);
  const brands = detectBrands(text, products);
  const consumedTerms = [
    ...[...categories].flatMap((c) => [...CATEGORY_TERMS[c].strong, ...CATEGORY_TERMS[c].weak]),
    ...[...brands].map((b) => b.toLowerCase()),
  ];
  const keywords = extractKeywords(text, consumedTerms);
  return {
    categories,
    brands,
    // Specific terms such as "controller" or "kindle" rank exact matches higher.
    boostTerms: consumedTerms.filter((term) => !GENERIC_TERMS.has(term) && termRegex(term).test(text)),
    price: parsePriceRange(text),
    keywords: keywords.filter((word) => !BUDGET_WORDS.has(word) && !QUALITY_WORDS.has(word)),
    wantsCheap: keywords.some((word) => BUDGET_WORDS.has(word)),
    wantsBest: keywords.some((word) => QUALITY_WORDS.has(word)),
  };
}

const productText = (product) =>
  `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();

// Match at the start of a word, so "kid" finds "kids" but "tell" doesn't find "stellar".
const containsWordStartingWith = (text, stem) => new RegExp(`\\b${escapeRegExp(stem)}`).test(text);

function matchedKeywords(text, keywords) {
  return keywords.filter((keyword) =>
    (SYNONYMS[keyword] ?? [keyword]).some((stem) => containsWordStartingWith(text, stem)),
  );
}

/** Round-robin across categories so broad prompts ("gaming setup") get variety. */
function diversify(sorted) {
  const groups = new Map();
  for (const item of sorted) {
    const key = item.product.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const queues = [...groups.values()];
  const result = [];
  while (result.length < sorted.length) {
    for (const queue of queues) if (queue.length) result.push(queue.shift());
  }
  return result;
}

function describeCriteria({ categories, brands, price }) {
  const parts = [];
  if (brands.size) parts.push([...brands].join('/'));
  parts.push(categories.size ? [...categories].join(' and ') : 'products');
  if (price.min != null && price.max != null) parts.push(`between ${formatPrice(price.min)} and ${formatPrice(price.max)}`);
  else if (price.max != null) parts.push(`under ${formatPrice(price.max)}`);
  else if (price.min != null) parts.push(`over ${formatPrice(price.min)}`);
  return parts.join(' ');
}

function buildReason(product, { price }, hits) {
  const parts = [`${product.category} from ${product.brand}`];
  if (price.max != null) parts.push(`${formatPrice(product.price)} fits your ${formatPrice(price.max)} budget`);
  else parts.push(formatPrice(product.price));
  parts.push(`rated ${product.rating.toFixed(1)}★`);
  if (hits.length) parts.push(`matches “${hits.join('”, “')}”`);
  return `${parts.join(' · ')}.`;
}

/**
 * @returns {{summary: string, recommendations: {id: number, reason: string}[]}}
 */
export function searchProducts(query, products) {
  const criteria = parseQuery(query, products);
  const { categories, brands, price, keywords, boostTerms, wantsCheap, wantsBest } = criteria;
  const hasFilters = categories.size > 0 || brands.size > 0 || price.min != null || price.max != null;

  const candidates = products
    .filter((p) => categories.size === 0 || categories.has(p.category))
    .filter((p) => brands.size === 0 || brands.has(p.brand))
    .filter((p) => (price.max == null || p.price <= price.max) && (price.min == null || p.price >= price.min))
    .map((product) => {
      const text = productText(product);
      return {
        product,
        hits: matchedKeywords(text, keywords),
        boost: boostTerms.filter((term) => containsWordStartingWith(text, term)).length,
      };
    });

  // Prefer products that match the descriptive keywords; with only keywords
  // (no category/brand/price), a keyword match is required to count as related.
  const withHits = candidates.filter((c) => c.hits.length > 0);
  const pool = withHits.length > 0 || !hasFilters ? withHits : candidates;

  if (pool.length === 0) {
    return {
      summary: hasFilters
        ? `No ${describeCriteria(criteria)} found in our catalog. Try a different budget or product type.`
        : "That doesn't look like a product search. Try mentioning a product type, brand or budget — e.g. \"a phone under $500\" or \"PS5 games for kids\".",
      recommendations: [],
    };
  }

  pool.sort(
    (a, b) =>
      b.hits.length - a.hits.length ||
      b.boost - a.boost ||
      (wantsCheap && !wantsBest ? a.product.price - b.product.price : 0) ||
      b.product.rating - a.product.rating ||
      a.product.price - b.product.price,
  );

  const ranked = categories.size === 0 ? diversify(pool) : pool;
  const top = ranked.slice(0, MAX_RESULTS);
  const matching = keywords.length && withHits.length ? ` matching “${keywords.join(' ')}”` : '';
  return {
    summary: `Top picks: ${describeCriteria(criteria)}${matching}.`,
    recommendations: top.map(({ product, hits }) => ({ id: product.id, reason: buildReason(product, criteria, hits) })),
  };
}
