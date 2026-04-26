import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { blogService, type BlogPost } from '@/services/blogService';
import { BlogPostCard } from '@/components/docs/BlogPostCard';

const categories = ['All', 'Announcements', 'Technology', 'Community', 'Business', 'Creator Tips', 'Industry News'];

const DocsBlogPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [filtered, setFiltered] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await blogService.getAllPosts();
      setPosts(data); setFiltered(data); setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let result = posts;
      if (category !== 'All') result = await blogService.getPostsByCategory(category);
      if (query.trim()) result = await blogService.searchPosts(query);
      setFiltered(result);
    })();
  }, [query, category, posts]);

  const featured = filtered.find((p) => p.featured);
  const rest = filtered.filter((p) => !p.featured);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="bg-black/60 backdrop-blur-[24px] border-b border-white/10 sticky top-0 z-40 h-[60px] md:h-[73px]">
        <div className="px-4 py-3 md:py-4 flex items-center justify-between h-full max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-foreground/70 hover:text-foreground text-sm">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Link to="/docs" className="flex items-center gap-2 text-foreground/70 hover:text-foreground text-sm">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Docs</span>
            </Link>
          </div>
          <h1 className="text-foreground font-semibold">Blog</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="bg-black/60 backdrop-blur-[24px] border border-white/10 rounded-3xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-1">fan.site Blog</h2>
          <p className="text-foreground/60 mb-4">Insights, stories, and updates from our community</p>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <Input
              placeholder="Search articles…" value={query} onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-foreground placeholder:text-foreground/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Button
                key={c} variant={category === c ? 'default' : 'outline'} size="sm"
                onClick={() => setCategory(c)}
                className={category === c ? '' : 'bg-white/5 border-white/10 hover:bg-white/10 text-foreground/80'}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-foreground/60 py-12">Loading articles…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-foreground/60">No posts found.</div>
        ) : (
          <>
            {featured && <div className="mb-6"><BlogPostCard post={featured} featured /></div>}
            <div className={`grid gap-6 ${rest.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
              {rest.map((p) => <BlogPostCard key={p.id} post={p} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocsBlogPage;
