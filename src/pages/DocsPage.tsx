import { Suspense, lazy } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsMobileDrawer } from '@/components/docs/DocsMobileDrawer';
import { DocsSearch } from '@/components/docs/DocsSearch';
import { DocsContent } from '@/components/docs/docs-content';
import { Home } from 'lucide-react';

const EllaDocsChat = lazy(() => import('@/components/docs/EllaDocsChat'));
const DocsBlogPage = lazy(() => import('./DocsBlogPage'));

const DocsHome = () => {
  const isMobile = useIsMobile();

  const handleSearchResultClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-primary/50', 'rounded-lg');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/50', 'rounded-lg'), 2000);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {!isMobile && <DocsSidebar />}

        <main className="flex-1 w-full min-w-0 overflow-hidden">
          {/* Header */}
          <div className="bg-black/60 backdrop-blur-[24px] border-b border-white/10 sticky top-0 z-40 w-full h-[60px] md:h-[73px]">
            <div className="w-full px-3 md:px-4 py-3 md:py-4 flex items-center justify-between h-full gap-3">
              <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                {!isMobile && <SidebarTrigger className="mr-1" />}
                <Link
                  to="/"
                  className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors text-sm"
                >
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Home</span>
                </Link>
                <div className="flex-1 max-w-md">
                  <DocsSearch onResultClick={handleSearchResultClick} />
                </div>
              </div>
              <div className="md:hidden flex-shrink-0">
                <DocsMobileDrawer />
              </div>
            </div>
          </div>

          <div className="w-full px-3 md:px-6 lg:px-8 py-6 md:py-10">
            <div className="max-w-4xl mx-auto">
              <div className="bg-black/60 backdrop-blur-[24px] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl">
                <DocsContent />
              </div>
            </div>
          </div>
        </main>

        <Suspense fallback={null}>
          <EllaDocsChat />
        </Suspense>
      </div>
    </SidebarProvider>
  );
};

const DocsPage = () => (
  <Routes>
    <Route path="/blog" element={<Suspense fallback={null}><DocsBlogPage /></Suspense>} />
    <Route path="*" element={<DocsHome />} />
  </Routes>
);

export default DocsPage;
