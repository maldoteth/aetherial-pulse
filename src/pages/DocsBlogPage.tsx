import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: number;
  tags: string[];
}

const POSTS: BlogPost[] = [
  {
    slug: 'launch-update-april-2026',
    title: 'Launch Update — April 2026',
    excerpt:
      'Fansite is a working fork of the open-source DeHub stack, tailored for adult creators. The upstream rebuild integration is fully complete and stable.',
    category: 'Updates',
    date: 'April 2026',
    readTime: 4,
    tags: ['launch', 'roadmap'],
  },
  {
    slug: 'why-decentralized-creator-platforms',
    title: 'Why Decentralized Creator Platforms Matter',
    excerpt:
      'Traditional platforms extract up to 40% of creator earnings. Here is how blockchain-based alternatives flip the economics back in favor of the creator.',
    category: 'Insights',
    date: 'March 2026',
    readTime: 6,
    tags: ['economics', 'web3'],
  },
  {
    slug: 'tokenomics-explained',
    title: '$FANS Tokenomics Explained',
    excerpt:
      'A breakdown of supply, distribution, vesting, and how the 100% profit buyback model rewards long-term stakeholders.',
    category: 'Tokenomics',
    date: 'February 2026',
    readTime: 8,
    tags: ['$FANS', 'token'],
  },
];

const DocsBlogPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-black/60 backdrop-blur-[24px] border-b border-white/10 sticky top-0 z-40 h-[60px] md:h-[73px] flex items-center px-4 md:px-6">
        <Link to="/docs" className="inline-flex items-center gap-2 text-foreground/70 hover:text-foreground text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Docs
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <header className="mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">Blog</h1>
          <p className="text-foreground/60 text-base md:text-lg">
            Updates, insights, and stories from the Fansite team.
          </p>
        </header>

        <div className="space-y-4 md:space-y-6">
          {POSTS.map((post) => (
            <article
              key={post.slug}
              className="bg-black/60 backdrop-blur-[24px] border border-white/10 rounded-xl p-5 md:p-6 hover:border-white/20 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-foreground/60">
                <Badge variant="outline" className="border-white/20 text-foreground/80">
                  {post.category}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {post.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {post.readTime} min read
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-2">{post.title}</h2>
              <p className="text-foreground/70 text-sm md:text-base mb-4">{post.excerpt}</p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-md bg-white/5 text-foreground/60 border border-white/10">
                    #{t}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="outline" className="bg-white/5 border-white/10">
            <Link to="/docs">Read the full documentation</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocsBlogPage;
