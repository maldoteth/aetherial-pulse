import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Mail, FileText, Folder } from 'lucide-react';
import { docsNavItems } from './docs-nav-items';

const externalLinks = [
  { title: 'Brand Guidelines', icon: FileText, href: 'https://drive.google.com/file/d/1tK9XY6iaO6AIVuNpEReJLmu69dBk_wpV/view?usp=sharing' },
  { title: 'Brand Assets', icon: Folder, href: 'https://drive.google.com/drive/folders/140cGmRSqmgwZBbHePLxufWhFL-NKSeVT?usp=sharing' },
  { title: 'help@fan.site', icon: Mail, href: 'mailto:help@fan.site' },
];

export const DocsMobileDrawer = () => {
  const [open, setOpen] = useState(false);

  const handleNavClick = (href: string) => {
    const el = document.getElementById(href.replace('#', ''));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="p-2 rounded-xl bg-white/5 border-white/10 hover:bg-white/10">
          <Menu className="h-5 w-5 text-foreground/80" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] p-0 border-0 bg-black/80 backdrop-blur-[24px] border-t border-white/10 rounded-t-3xl">
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 pt-6 pb-4 px-6 border-b border-white/10">
            <h2 className="text-foreground font-semibold text-lg">Navigation</h2>
          </div>
          <div className="flex-1 px-4 py-4 overflow-y-auto">
            <div className="mb-2 px-2 text-xs uppercase tracking-wider text-foreground/50">Documentation</div>
            <div className="space-y-1 mb-6">
              {docsNavItems.map((item) => (
                <button
                  key={item.title}
                  onClick={() => handleNavClick(item.href)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors text-left"
                >
                  <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex-shrink-0">
                    <item.icon className="h-4 w-4 text-foreground/80" />
                  </div>
                  <span className="text-foreground text-sm font-medium">{item.title}</span>
                </button>
              ))}
            </div>
            <div className="mb-2 px-2 text-xs uppercase tracking-wider text-foreground/50">Resources</div>
            <div className="space-y-1">
              {externalLinks.map((link) => (
                <a
                  key={link.title}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex-shrink-0">
                    <link.icon className="h-4 w-4 text-foreground/80" />
                  </div>
                  <span className="text-foreground text-sm font-medium">{link.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
