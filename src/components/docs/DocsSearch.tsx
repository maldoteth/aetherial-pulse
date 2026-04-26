import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/use-debounce';
import { docsNavItems } from './docs-nav-items';

interface DocsSearchProps {
  onResultClick: (elementId: string) => void;
}

interface SearchHit {
  id: string;
  title: string;
  context: string;
}

/**
 * Lightweight DOM-based search over rendered docs content.
 * Indexes headings + paragraphs/lists under each section and ranks by term frequency.
 */
export const DocsSearch = ({ onResultClick }: DocsSearchProps) => {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(query, 200);

  const sectionIds = useMemo(() => docsNavItems.map((i) => i.href.replace('#', '')).concat(['overview']), []);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    const hits: SearchHit[] = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const title = el.textContent?.trim() || id;
      // Collect content until next H2/H3
      let body = '';
      let next = el.nextElementSibling;
      while (next && !['H1', 'H2'].includes(next.tagName)) {
        body += ' ' + (next.textContent || '');
        next = next.nextElementSibling;
      }
      const haystack = (title + ' ' + body).toLowerCase();
      if (!haystack.includes(q)) return;
      const idx = haystack.indexOf(q);
      const start = Math.max(0, idx - 50);
      const context = (start > 0 ? '…' : '') + haystack.slice(start, start + 140) + '…';
      hits.push({ id, title, context });
    });
    setResults(hits.slice(0, 10));
  }, [debounced, sectionIds]);

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setExpanded(true)}
        className="h-8 w-8 text-foreground/60 hover:text-foreground"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              setExpanded(false);
            }
          }}
          placeholder="Search documentation…"
          className="pl-10 pr-10 h-10 bg-white/5 border-white/10 text-foreground placeholder:text-foreground/40"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setQuery('');
            setExpanded(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-foreground/60"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/80 backdrop-blur-[24px] border border-white/10 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onResultClick(r.id);
                setQuery('');
                setExpanded(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
            >
              <div className="font-medium text-foreground text-sm mb-1">{r.title}</div>
              <div className="text-xs text-foreground/60 line-clamp-2">{r.context}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
