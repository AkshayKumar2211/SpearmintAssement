# AI Product Recommender

A small Next.js (React) app that shows a product catalog and uses **Google Gemini** to recommend products based on preferences you type in plain English, such as *"I want a phone under $500"*.

## Quick start

Requires **Node.js 20.9+**.

```bash
npm install
cp .env.example .env        # then paste your Gemini key into .env
npm run dev
```

Open http://localhost:3000. You can get a Gemini API key at https://aistudio.google.com/apikey.

## How it works

```
React UI ──POST /api/recommend { query }──► Next.js route handler ──► Gemini generateContent
   ▲                                              │  (catalog + query in prompt,
   │                                              │   JSON schema enforced)
   └──── { summary, recommendations:[{id,reason}] } ◄── validated ids only
```

1. The user types their preferences, or clicks one of the example prompts.
2. The route handler (`app/api/recommend/route.js`) sends Gemini the whole product catalog and the user's query. It uses Gemini's **structured output** (`responseMimeType: application/json` plus a `responseSchema`), so the model must reply with a list of product ids, a reason for each, and a summary.
3. The server drops any id that isn't in the catalog, along with duplicates, so the model can't invent products.
4. The client maps the ids back to full product objects, keeps the AI's ranking order, and shows each recommendation with its reason.

### When Gemini fails

The app always answers a product search, even if Gemini is down:

1. **Model fallback.** Each Gemini request has a 15 s timeout. If a model is overloaded (429/503), unavailable (404) or slow, the next model in `GEMINI_FALLBACK_MODELS` is tried, within a 25 s overall budget.
2. **Keyword search fallback.** If no model answers, `lib/localSearch.js` parses the prompt for category ("phone", "PS5 games"), brand, budget ("under $500", "between $800 and $1500") and needs ("kids", "lightweight", "co-op") and ranks matching products by relevance and rating. The UI shows a notice that the results come from keyword search.
3. **Unrelated prompts.** If the prompt isn't about products (e.g. "tell me a joke"), the user gets a hint on how to phrase a product search instead of an error.
4. **Browser fallback.** If the API itself can't be reached, the same keyword search runs in the browser.

The Gemini API key is only read on the server, in the route handler, so it never reaches the browser.

## Project structure

```
app/
  layout.jsx                    Root layout and metadata
  page.jsx                      Server component: loads the catalog, renders the UI
  globals.css                   Styles
  api/recommend/route.js        POST /api/recommend: input + output validation
components/
  ProductRecommender.jsx        Client component: all products vs. recommendations
  PreferenceForm.jsx            Text input + example prompt chips
  ProductGrid.jsx               Responsive grid
  ProductCard.jsx               Product details, rank and AI reason
hooks/useRecommendations.js     Loading/error state, maps ids to products
lib/
  gemini.js                     Prompt building, Gemini REST call with JSON schema, model fallback
  localSearch.js                Keyword search used when Gemini is unavailable
  fetchRecommendations.js       Client-side fetch wrapper for /api/recommend
data/products.json              Product catalog
```

## Configuration (`.env`)

| Variable         | Required | Default            |
| ---------------- | -------- | ------------------ |
| `GEMINI_API_KEY` | yes      | none               |
| `GEMINI_MODEL`   | no       | `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODELS` | no | `gemini-3.5-flash,gemini-flash-latest` |

## Possible improvements

- Use embeddings and vector search for large catalogs, which wouldn't fit in a single prompt.
- Cache responses for repeated queries.
- Add unit tests for the id validation and the hook, plus an e2e test with a mocked Gemini response.
