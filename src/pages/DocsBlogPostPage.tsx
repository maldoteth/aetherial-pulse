import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Eye, Heart, MessageCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { blogService, type BlogPost } from '@/services/blogService';

const DocsBlogPostPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const p = await blogService.getPostByIdOrNumber(id);
      setPost(p);
      if (p) await blogService.incrementViewCount(p.id);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-foreground/60">Loading…</div>;
  if (!post) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <h1 className="text-2xl font-bold text-foreground">Article not found</h1>
      <Button onClick={() => navigate('/docs/blog')} variant="outline" className="bg-white/5 border-white/10">
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Blog
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="bg-black/60 backdrop-blur-[24px] border-b border-white/10 sticky top-0 z-40 h-[60px] md:h-[73px]">
        <div className="px-4 py-3 md:py-4 flex items-center gap-4 h-full max-w-4xl mx-auto">
          <Link to="/" className="flex items-center gap-2 text-foreground/70 hover:text-foreground text-sm">
            <Home className="h-4 w-4" /><span className="hidden sm:inline">Home</span>
          </Link>
          <Link to="/docs/blog" className="flex items-center gap-2 text-foreground/70 hover:text-foreground text-sm">
            <ArrowLeft className="h-4 w-4" /><span>Back to Blog</span>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <article className="bg-black/60 backdrop-blur-[24px] border border-white/10 rounded-3xl overflow-hidden">
          {post.image_url && (
            <div className="relative aspect-[16/9]">
              <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
              {post.featured && (
                <Badge className="absolute top-4 left-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">Featured</Badge>
              )}
            </div>
          )}
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-foreground/60">
              <Badge variant="outline" className="border-white/20 text-foreground/80">{post.category}</Badge>
              <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(post.created_at).toLocaleDateString()}</div>
              <div className="flex items-center gap-1"><Clock className="w-4 h-4" />{post.read_time_minutes} min read</div>
              <div className="flex items-center gap-1"><Eye className="w-4 h-4" />{post.views_count} views</div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{post.title}</h1>
            <p className="text-lg text-foreground/80 mb-6">{post.excerpt}</p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {post.tags.map((t) => <Badge key={t} variant="secondary" className="bg-white/10 text-foreground/80">#{t}</Badge>)}
              </div>
            )}
            <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-line border-t border-white/10 pt-6">
              {post.content}
            </div>
            <div className="flex items-center justify-center gap-8 pt-6 mt-6 border-t border-white/10 text-foreground/60">
              <span className="flex items-center gap-2"><Eye className="w-5 h-5" />{post.views_count}</span>
              <span className="flex items-center gap-2"><Heart className="w-5 h-5" />{post.likes_count}</span>
              <span className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />{post.comments_count}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};

export default DocsBlogPostPage;
