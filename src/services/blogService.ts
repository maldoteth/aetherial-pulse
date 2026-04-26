import { supabase } from '@/integrations/supabase/client';

export interface BlogPost {
  id: string;
  post_number?: number;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  featured: boolean;
  published: boolean;
  image_url?: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  read_time_minutes: number;
  created_at: string;
  updated_at: string;
}

export const blogService = {
  async getAllPosts(): Promise<BlogPost[]> {
    const { data, error } = await supabase
      .from('blog_posts').select('*').eq('published', true)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return (data || []) as BlogPost[];
  },

  async getPostByIdOrNumber(identifier: string): Promise<BlogPost | null> {
    const n = parseInt(identifier);
    if (!isNaN(n) && n > 0) {
      const { data } = await supabase.rpc('get_post_by_number', { p_post_number: n }).maybeSingle();
      return (data as BlogPost) || null;
    }
    const { data } = await supabase.from('blog_posts').select('*').eq('id', identifier).eq('published', true).maybeSingle();
    return (data as BlogPost) || null;
  },

  async incrementViewCount(postId: string) {
    await supabase.rpc('increment_blog_post_views', { post_id: postId });
  },

  async searchPosts(query: string): Promise<BlogPost[]> {
    const { data } = await supabase.from('blog_posts').select('*')
      .eq('published', true)
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
      .order('created_at', { ascending: false });
    return (data || []) as BlogPost[];
  },

  async getPostsByCategory(category: string): Promise<BlogPost[]> {
    if (category === 'All') return this.getAllPosts();
    const { data } = await supabase.from('blog_posts').select('*')
      .eq('published', true).eq('category', category)
      .order('created_at', { ascending: false });
    return (data || []) as BlogPost[];
  },
};
