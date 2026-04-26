import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchEngine, SearchResult } from '@/lib/docs/searchIndex';
import { useDebounce } from '@/hooks/use-debounce';

interface Props {
  onResultClick: (id: string) => void;
}

export const DocsSearch = ({ onResultClick }: Props) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const engineRef = useRef(new SearchEngine());
  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      setResults(engineRef.current.search(debouncedQuery, 12));
      setOpen(true);
    } else {
      setResults([]);
      setOpen(false);
    }
  }, [debouncedQuery]);

  const handleClick = (r: SearchResult) => {
    onResultClick(r.parentSection || r.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the docs…"
          className="pl-10 pr-10 h-9 bg-white/5 border-white/10 text-foreground placeholder:text-foreground/40 rounded-xl"
        />
        {query && (
          <Button
            variant="ghost" size="icon"
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-foreground/50 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/80 backdrop-blur-[24px] border border-white/10 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-white/10 text-xs text-foreground/60">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
          {results.map((r, i) => (
            <button
              key={`${r.id}-${i}`}
              onClick={() => handleClick(r)}
              className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
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
