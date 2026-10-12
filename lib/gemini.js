const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_FALLBACK_MODELS = 'gemini-3.5-flash,gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 15_000;
// Overall time we're willing to spend on Gemini before the caller falls back.
const TOTAL_BUDGET_MS = 25_000;
const MIN_ATTEMPT_MS = 3_000;
// Bad request or bad key: switching models won't help.
const FATAL_STATUSES = new Set([400, 401, 403]);

class GeminiError extends Error {
  constructor(message, { fatal = false } = {}) {
    super(message);
    this.fatal = fatal;
  }
}

function getModels() {
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS)
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
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

async function callModel(model, apiKey, body, timeoutMs) {
  let response;
  try {
    response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Timeouts and network failures: another model (or later attempt) may work.
    throw new GeminiError(`Request to ${model} failed: ${err.cause?.code ?? err.name}`);
  }

  if (!response.ok) {
    const details = await response.text();
    throw new GeminiError(`Gemini API error from ${model} (${response.status}): ${details}`, {
      fatal: FATAL_STATUSES.has(response.status),
    });
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiError(`${model} returned an empty response.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError(`${model} returned invalid JSON.`);
  }
}

/**
 * Asks Gemini for recommendations, trying each configured model in turn when
 * one is overloaded, unavailable or too slow. Throws if none succeed in time.
 */
export async function getRecommendations(query, products) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError('GEMINI_API_KEY is not set. Add it to your .env file.', { fatal: true });
  }

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(query, products) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError;
  for (const model of getModels()) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    try {
      return await callModel(model, apiKey, body, Math.min(REQUEST_TIMEOUT_MS, remaining));
    } catch (err) {
      lastError = err;
      console.warn(err.message);
      if (err.fatal) break;
    }
  }
  throw lastError ?? new GeminiError('Gemini did not respond in time.');
}
