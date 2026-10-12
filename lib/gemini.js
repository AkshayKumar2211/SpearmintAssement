const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const RETRYABLE_STATUSES = new Set([429, 500, 503]);
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini occasionally returns 429/503 under load; retry those with backoff.
async function fetchWithRetry(url, options) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
      return response;
    }
    await sleep(1000 * 2 ** (attempt - 1));
  }
}


const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: 'One or two sentences explaining the overall recommendation.',
    },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'INTEGER', description: 'The id of a product from the catalog.' },
          reason: { type: 'STRING', description: 'Short reason this product matches.' },
        },
        required: ['id', 'reason'],
      },
    },
  },
  required: ['summary', 'recommendations'],
};

function buildPrompt(query, products) {
  return `You are a shopping assistant for an electronics store.
Recommend products ONLY from the catalog below that match the user's preferences.

Rules:
- Only use product ids that exist in the catalog.
- Respect hard constraints such as budget, category and brand strictly.
- Order recommendations from best match to weakest match. Return at most 8.
- If nothing matches, return an empty "recommendations" array and explain why in "summary".

Catalog (JSON):
${JSON.stringify(products)}

User preferences: """${query}"""`;
}

export async function getRecommendations(query, products) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const response = await fetchWithRetry(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(query, products) }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${details}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(text);
}
