import * as React from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { docsNavItems } from './docs-nav-items';

export const DocsMobileDrawer = () => {
  const [open, setOpen] = React.useState(false);

  const handleNavClick = (href: string) => {
    const el = document.getElementById(href.replace('#', ''));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="p-2 rounded-xl bg-white/5 border-white/10 hover:bg-white/10"
        >
          <Menu className="h-5 w-5 text-foreground/80" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] p-0 bg-black/80 backdrop-blur-[24px] border-white/10">
        <div className="h-full flex flex-col">
          <div className="px-6 pt-6 pb-3">
            <h2 className="text-foreground font-semibold text-lg">Docs Navigation</h2>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-1">
            {docsNavItems.map((item) => (
              <button
                key={item.title}
                onClick={() => handleNavClick(item.href)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors text-left"
              >
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex-shrink-0">
                  <item.icon className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-foreground font-medium text-sm">{item.title}</span>
              </button>
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
};
