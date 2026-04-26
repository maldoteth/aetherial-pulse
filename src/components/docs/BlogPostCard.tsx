import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Eye, Heart, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BlogPost } from '@/services/blogService';

interface Props { post: BlogPost; featured?: boolean; }

export const BlogPostCard = ({ post, featured = false }: Props) => {
  const navigate = useNavigate();
  const formatDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const formatNum = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toString();
  const handleClick = () => navigate(`/docs/blog/${post.post_number || post.id}`);

  return (
    <Card
      className="group relative overflow-hidden bg-black/60 backdrop-blur-[24px] border border-white/10 shadow-2xl hover:border-white/20 transition-all duration-300 cursor-pointer rounded-2xl"
      onClick={handleClick}
    >
      {post.image_url && (
        <div className="relative overflow-hidden aspect-[16/9]">
          <img src={post.image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {featured && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
              Featured
            </Badge>
          )}
        </div>
      )}
      <CardContent className="p-5">
        <div className="flex items-center gap-3 text-xs text-foreground/60 mb-3">
          <Badge variant="outline" className="border-white/20 text-foreground/80 text-xs">{post.category}</Badge>
          <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(post.created_at)}</div>
          <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.read_time_minutes}min</div>
        </div>
        <h3 className={`font-bold text-foreground mb-2 line-clamp-2 ${featured ? 'text-xl' : 'text-lg'}`}>{post.title}</h3>
        <p className="text-foreground/70 text-sm line-clamp-3 mb-4">{post.excerpt}</p>
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="flex items-center gap-3 text-xs text-foreground/60">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNum(post.views_count)}</span>
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNum(post.likes_count)}</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatNum(post.comments_count)}</span>
          </div>
          <Button size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-xs h-7">Read</Button>
        </div>
      </CardContent>
    </Card>
  );
};
