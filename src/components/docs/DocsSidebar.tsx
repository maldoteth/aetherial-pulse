import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Mail, FileText, Folder } from 'lucide-react';
import { docsNavItems } from './docs-nav-items';

const externalLinks = [
  { title: 'Brand Guidelines', icon: FileText, href: 'https://drive.google.com/file/d/1tK9XY6iaO6AIVuNpEReJLmu69dBk_wpV/view?usp=sharing' },
  { title: 'Brand Assets', icon: Folder, href: 'https://drive.google.com/drive/folders/140cGmRSqmgwZBbHePLxufWhFL-NKSeVT?usp=sharing' },
  { title: 'help@fan.site', icon: Mail, href: 'mailto:help@fan.site' },
];

export function DocsSidebar() {
  const handleNavClick = (href: string) => {
    const el = document.getElementById(href.replace('#', ''));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Sidebar className="border-r border-white/10 bg-black/60 backdrop-blur-[24px]">
      <SidebarContent className="pt-4 scrollbar-hide overflow-y-auto">
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground/50">Documentation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {docsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => handleNavClick(item.href)}
                    className="cursor-pointer text-foreground/80 hover:bg-white/10 hover:text-foreground border border-transparent hover:border-white/10 rounded-lg transition-all duration-200"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground/50">Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {externalLinks.map((link) => (
                <SidebarMenuItem key={link.title}>
                  <SidebarMenuButton asChild className="cursor-pointer text-foreground/80 hover:bg-white/10 hover:text-foreground border border-transparent hover:border-white/10 rounded-lg transition-all duration-200">
                    <a href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                      <link.icon className="h-4 w-4" />
                      <span>{link.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
