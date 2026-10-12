import { NextResponse } from 'next/server';
import products from '@/data/products.json';
import { getRecommendations } from '@/lib/gemini';

const productIds = new Set(products.map((p) => p.id));
// Image URLs are irrelevant to the AI, so keep them out of the prompt.
const catalogForAI = products.map(({ image, ...product }) => product);
const MAX_QUERY_LENGTH = 500;

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

    // Never trust model output blindly: drop unknown or duplicate ids.
    const seen = new Set();
    const recommendations = (result.recommendations ?? []).filter(({ id }) => {
      if (!productIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return NextResponse.json({ summary: result.summary ?? '', recommendations });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Could not get recommendations from the AI. Please try again.' },
      { status: 502 },
    );
  }
}
