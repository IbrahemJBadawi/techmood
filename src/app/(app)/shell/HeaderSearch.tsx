'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function HeaderSearch({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);

  return (
    <form
      className="header-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const term = query.trim();
        if (term.length > 0) router.push(`/search?q=${encodeURIComponent(term)}`);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث في المسارات، المنتورز، الفرق، الفرص…"
        aria-label="بحث"
      />
    </form>
  );
}
