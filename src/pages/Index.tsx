import { SEOHead } from "@/components/SEOHead";
import { FuturisticAlienHero } from "@/components/ui/futuristic-alien-hero";

const Index = () => {
  return (
    <>
      <SEOHead
        title="Open Source Social Media"
        description="Fansite is open source, user owned and censorship resistant media. Join the decentralized future of social."
        url="https://fansite.app"
        jsonLd={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: 'Fansite',
              url: 'https://fansite.app',
              description: 'Open source, user owned and censorship resistant media.',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://fansite.app/explore?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@type': 'Organization',
              name: 'Fansite',
              url: 'https://fansite.app',
              logo: 'https://aigxuutjaqsywioxjefr.supabase.co/storage/v1/object/public/logo/default-icon.png',
              sameAs: ['https://x.com/DeHubApp'],
              description: 'Open source, user owned and censorship resistant social media platform.',
            },
          ],
        }}
      />
      <FuturisticAlienHero />
    </>
  );
};

export default Index;
