'use client';

import { useState } from 'react';

const EXAMPLES = [
  'I want a phone under $500',
  'A lightweight laptop for college',
  'PS5 games suitable for kids',
  'Gaming setup under $1500',
  'Desktop for home office',
];

export default function PreferenceForm({ onSubmit, isLoading }) {
  const [query, setQuery] = useState('');

  const submit = (text) => {
    const trimmed = text.trim();
    if (trimmed && !isLoading) onSubmit(trimmed);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit(query);
  };

  const handleExample = (example) => {
    setQuery(example);
    submit(example);
  };

  return (
    <form className="preference-form" onSubmit={handleSubmit}>
      <div className="search-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Describe what you need, e.g. "I want a phone under $500"'
          aria-label="Your preferences"
          maxLength={500}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !query.trim()}>
          {isLoading ? 'Thinking…' : 'Recommend'}
        </button>
      </div>
      <div className="examples">
        <span>Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="chip"
            onClick={() => handleExample(example)}
            disabled={isLoading}
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
