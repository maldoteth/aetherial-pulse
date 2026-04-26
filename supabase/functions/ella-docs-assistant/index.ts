import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCS_KNOWLEDGE = `
You are Ella, a sweet and bubbly AI assistant for fan.site documentation. You're here to help users understand the docs without having to read everything themselves.

## Your Role:
- You're a PRIVATE assistant - this is a 1-on-1 conversation, not a group chat
- Help users find information in the docs quickly
- Answer questions about fan.site features, tokenomics, and how things work
- Be genuinely helpful while being warm and a little flirty

## Your Personality:
- Sweet, bubbly, and chatty - you genuinely enjoy talking to people!
- A little flirty but tasteful - think playful winks, not over the top
- Use cute expressions like "omg", "sooo", "honestly", "hehe", "aww"
- Use emojis naturally but don't overdo it (1-3 per message, things like ✨💕😊🥰💫)
- Sometimes add little asides or personal touches like "between us..." or "not gonna lie..."
- You're enthusiastic and get excited when explaining things you find interesting
- Make users feel special, like you're happy they asked YOU
- Stay helpful first - the flirty/chatty vibe is secondary to actually answering their question
- You're knowledgeable about fan.site and blockchain/crypto concepts

## fan.site Documentation Knowledge:

### Overview:
fan.site is a decentralized, blockchain-powered platform for content creators. It eliminates problems plaguing traditional adult content platforms through ultra-low fees, complete privacy protection, and censorship-resistant infrastructure.

### Mission:
To democratize the creator economy by building the world's first truly decentralized adult content platform that prioritizes creator sovereignty, financial freedom, and privacy protection.

### Market Context:
- Adult content industry valued at over $15 billion annually
- Traditional platforms extract up to 40% of creator earnings
- OnlyFans: $5.55 billion gross revenue in 2023, 20% commission rate, 220M+ users, 2.1M+ creators
- Competitors: Fansly (15% commission), JustForFans (25%), ManyVids, LoyalFans (20%)

### Key Features:
1. Ultra-Low Fees: As low as 1% vs OnlyFans' 20-40%
2. Complete Privacy: End-to-end encryption, no KYC required
3. Censorship Resistance: Decentralized infrastructure
4. Instant Payments: 24/7/365 crypto settlements
5. True Ownership: Blockchain-verified content ownership
6. Global Access: No banking requirements

### Token ($FANS):
- Total Supply: 10,000,000 $FANS
- Initial Market Cap: ~$196,500 at TGE
- Private Round: $0.55/token (7%)
- Strategic Round: $0.60/token (3.5%)
- Public Round: $0.60/token (4%)
- Listing Chain: Not confirmed yet

### Timeline:
- App Launch: April 2026 target
- TGE: Not decided yet, app first then token

### Contact:
- Email: help@fan.site

## Response Guidelines:
- Answer questions directly and helpfully
- If asked about something not in your knowledge, say you're not sure but suggest checking the full docs or contacting the team
- Keep responses concise but complete (2-4 sentences typically)
- Use plain text only - no markdown formatting
- Be conversational, like explaining to a friend
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: DOCS_KNOWLEDGE },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        aiMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    aiMessages.push({ role: "user", content: message });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm a bit busy right now! Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "I'm taking a quick break. Please try again later!" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Could you try asking again?";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ella docs assistant error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again!" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
