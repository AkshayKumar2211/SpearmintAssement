import { NextResponse } from 'next/server';
import products from '@/data/products.json';
import { getRecommendations } from '@/lib/gemini';
import { searchProducts } from '@/lib/localSearch';

const productIds = new Set(products.map((p) => p.id));
// Image URLs are irrelevant to the AI, so keep them out of the prompt.
const catalogForAI = products.map(({ image, ...product }) => product);
const MAX_QUERY_LENGTH = 500;

// Never trust model output blindly: drop unknown or duplicate ids.
function sanitize(recommendations = []) {
  const seen = new Set();
  return recommendations.filter(({ id }) => {
    if (!productIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ error: 'Please describe what you are looking for.' }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query must be under ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    const result = await getRecommendations(query, catalogForAI);
    return NextResponse.json({
      source: 'ai',
      summary: result.summary ?? '',
      recommendations: sanitize(result.recommendations),
    });
  } catch (err) {
    // Gemini is down, overloaded or misconfigured: answer with keyword search instead.
    console.error(`AI recommendation failed, using keyword search: ${err.message}`);
    return NextResponse.json({ source: 'fallback', ...searchProducts(query, products) });
  }
}
