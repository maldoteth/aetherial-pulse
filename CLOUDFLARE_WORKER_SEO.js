/**
 * Cloudflare Worker for Fansite Dynamic SEO/SSR
 *
 * This worker intercepts requests to profiles and posts and:
 * 1. Checks if the user agent is a bot/crawler.
 * 2. If it is a bot, fetches meta tags from the Supabase Edge Function.
 * 3. If it is NOT a bot, it passes the request through to the main application.
 */

const SUPABASE_FUNCTION_URL = 'https://sukqmkvncogkfnthvfnv.supabase.co/functions/v1/ssr-seo';
const BRAND_LOGO_URL = 'https://sukqmkvncogkfnthvfnv.supabase.co/storage/v1/object/public/logo/Screenshot%202026-04-27%20082812.png';
const DEFAULT_LOVABLE_SITE_URL = 'https://fansiteapp.com';

const BOT_AGENTS = [
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'slackbot',
  'discordbot',
  'googlebot',
  'bingbot',
  'crawler',
  'spider',
  'bot',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const lovableBaseUrl = (env?.LOVABLE_SITE_URL || DEFAULT_LOVABLE_SITE_URL).replace(/\/$/, '');
    const upstreamUrl = `${lovableBaseUrl}${url.pathname}${url.search}`;
    const userAgent = request.headers.get('User-Agent') || '';
    const isBot = BOT_AGENTS.some(bot => userAgent.toLowerCase().includes(bot));

    // Define paths that need dynamic SEO
    const isRootPath = url.pathname === '/';
    const isProfilePath = url.pathname.length > 1 && !url.pathname.includes('.') && !url.pathname.startsWith('/app/') && !['explore', 'notifications', 'messages'].some(p => url.pathname.startsWith('/' + p));
    const isPostPath = url.pathname.includes('/post/') || url.pathname.includes('/video/');

    if (isBot && (isRootPath || isProfilePath || isPostPath)) {
      // Fetch from Supabase SSR function
      const fullPathWithQuery = `${url.pathname}${url.search}`;
      const ssrUrl = `${SUPABASE_FUNCTION_URL}?path=${encodeURIComponent(fullPathWithQuery)}&original_url=${encodeURIComponent(url.toString())}&brand_logo=${encodeURIComponent(BRAND_LOGO_URL)}`;
      
      try {
        const response = await fetch(ssrUrl, {
          headers: {
            'User-Agent': 'Fansite-Worker-Proxy',
            'X-Is-Bot': '1',
          }
        });
        
        // Set the Content-Type to text/html because Supabase defaults to text/plain
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Content-Type", "text/html; charset=utf-8");
        
        return newResponse;
      } catch (error) {
        console.error('Error fetching from SSR function:', error);
      }
    }

    // Default: Continue to Lovable-hosted SPA origin
    const upstreamRequest = new Request(upstreamUrl, request);
    return fetch(upstreamRequest);
  },
};
