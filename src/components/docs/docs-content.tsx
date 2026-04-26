// Full fan.site whitepaper content — dark liquid-glass themed.
// Ported 1:1 from the fansite project (src/pages/Docs.tsx).
// Headings preserve their `id` attributes so the sidebar / search anchor links work.

export const DocsContent = () => {
  return (
    <div id="docs-root" className="prose prose-sm md:prose-lg max-w-none break-words prose-invert
      prose-headings:text-foreground prose-p:text-foreground/80 prose-strong:text-foreground
      prose-li:text-foreground/80 prose-a:text-purple-300 hover:prose-a:text-purple-200">

      <h1 className="text-3xl md:text-5xl font-bold mb-6 pb-4 border-b border-white/10
        bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
        fan.site Whitepaper
      </h1>

      <h2 id="overview" className="text-xl md:text-2xl font-semibold mt-8 mb-4">Overview</h2>
      <p>fan.site represents a paradigm shift in the creator economy, offering a decentralized, blockchain-powered platform that eliminates the systemic problems plaguing traditional adult content platforms. Our revolutionary approach combines ultra-low fees, complete privacy protection, and censorship-resistant infrastructure to create the first truly creator-owned platform in the industry.</p>

      <h2 id="mission-statement" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Mission Statement</h2>
      <p>To democratize the creator economy by building the world's first truly decentralized adult content platform that prioritizes creator sovereignty, financial freedom, and privacy protection. We aim to eliminate the exploitative practices of centralized platforms and create a sustainable ecosystem where creators retain full control over their content, data, and earnings.</p>

      <h2 id="executive-summary" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Executive Summary</h2>
      <p>The adult content industry, valued at over $15 billion annually, suffers from fundamental structural problems that exploit creators and limit innovation. Traditional platforms extract up to 40% of creator earnings through excessive fee structures, implement arbitrary censorship policies, violate user privacy, and create significant financial transparency risks. fan.site addresses these systemic issues through blockchain technology, offering ultra-low fees (as low as 1%), complete privacy protection, censorship resistance, and global accessibility without traditional banking requirements.</p>

      <h2 id="market-analysis" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Market Analysis</h2>
      <p>The fan economy has experienced unprecedented growth over the past five years, largely driven by the mainstream adoption of subscription-based platforms like OnlyFans. This market represents one of the most lucrative and rapidly expanding segments of the digital economy, with TAM estimates exceeding $15 billion annually as of 2024.</p>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">OnlyFans Market Dominance and Financial Performance</h3>
      <ul>
        <li><strong>Revenue Growth:</strong> OnlyFans reported $5.55 billion in gross revenue for 2023 (+19% YoY).</li>
        <li><strong>Creator Payouts:</strong> ~$4.4 billion paid to creators in 2023.</li>
        <li><strong>Platform Commission:</strong> 20% commission generating ~$1.1 billion in platform revenue.</li>
        <li><strong>User Base:</strong> 220M+ registered users and 2.1M+ creators (Dec 2023).</li>
        <li><strong>Transaction Volume:</strong> Average monthly transactions exceed $500M, peaking at $700M.</li>
      </ul>

      <h2 id="creator-economics-income-distribution" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Creator Economics and Income Distribution</h2>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Income Statistics</h3>
      <ul>
        <li><strong>Top Earners:</strong> Top 1% of creators earn over $100,000 annually; top performers $1M+/year.</li>
        <li><strong>Median:</strong> 50% of creators earn less than $180/month.</li>
        <li><strong>ARPU:</strong> ~$31.50 per paying subscriber per month.</li>
        <li><strong>Retention:</strong> Only 30% of creators remain active beyond 12 months.</li>
      </ul>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Competitors</h3>
      <ul>
        <li><strong>Fansly:</strong> $200M+ GMV, 15% commission, +40% YoY.</li>
        <li><strong>JustForFans:</strong> $50M+ GMV, 25% commission.</li>
        <li><strong>ManyVids:</strong> $150M+ GMV (hybrid).</li>
        <li><strong>LoyalFans:</strong> 20% commission, $75M+ GMV.</li>
      </ul>

      <h2 id="problems-adult-creators-face" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Problems Adult Creators Face</h2>
      <p>Creators face systemic challenges baked into the centralized platform model — barriers to earning potential, privacy, and long-term sustainability.</p>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">1. Excessive Fee Structure: 40% Total Loss</h3>
      <ul>
        <li><strong>User Deposit Fees:</strong> 20% on fan top-ups.</li>
        <li><strong>Creator Withdrawal Fees:</strong> Additional 20% on payout.</li>
        <li><strong>Combined Impact:</strong> $100 fan payment → $60 creator earnings.</li>
        <li><strong>Hidden Costs:</strong> Processor fees, FX charges, tax withholding.</li>
      </ul>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">2. Censorship and "Kink Jailing"</h3>
      <ul>
        <li>Arbitrary policy changes that retroactively ban approved content.</li>
        <li>Algorithmic suppression of legal adult content.</li>
        <li>Pressure from Visa/Mastercard restricting categories.</li>
        <li>Geographic restrictions limiting global reach.</li>
      </ul>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">3. Data Privacy Vulnerabilities</h3>
      <ul>
        <li>Admin access to all private messages and content.</li>
        <li>Data mining and behavioral profiling.</li>
        <li>Government data requests and subpoenas.</li>
        <li>High-profile breaches exposing millions of users.</li>
      </ul>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">4. Banking Transparency Issues</h3>
      <ul>
        <li>Platform names visible on bank statements.</li>
        <li>Employment & licensing discrimination risks.</li>
        <li>Mortgage and loan application complications.</li>
      </ul>

      <h2 id="fansite-proposition" className="text-xl md:text-2xl font-semibold mt-12 mb-4">The fan.site Proposition</h2>
      <p>Eight core value propositions that redefine creator/fan interaction:</p>
      <h3 id="ultra-low-fees" className="text-lg md:text-xl font-semibold mt-6 mb-3">1. Ultra-Low Fees: 1% for Top Tier</h3>
      <p>Tier-based fees as low as 1% for top stakeholders, vs 20–25% on legacy platforms.</p>
      <h3 id="decentralized-privacy" className="text-lg md:text-xl font-semibold mt-6 mb-3">2. Decentralized, Private & Secure</h3>
      <p>End-to-end encryption and distributed storage. No admin access to your content.</p>
      <h3 id="global-accessibility" className="text-lg md:text-xl font-semibold mt-6 mb-3">3. No KYC or Bank Required</h3>
      <p>Crypto rails enable global access regardless of banking status.</p>
      <h3 id="data-ownership" className="text-lg md:text-xl font-semibold mt-6 mb-3">4. Own Your Data, Monetize Without Limits</h3>
      <p>Blockchain-verified ownership; unlimited monetization streams (subs, tips, NFTs, PPV, custom).</p>
      <h3 id="instant-settlement" className="text-lg md:text-xl font-semibold mt-6 mb-3">5. Insta-Pay: 24/7/365 Settlement</h3>
      <p>Instant on-chain settlement — no holding periods.</p>
      <h3 id="censorship-resistance" className="text-lg md:text-xl font-semibold mt-6 mb-3">6. Never Get Deplatformed</h3>
      <p>Immutable blockchain content storage means no entity can delete your work.</p>
      <h3 id="profit-buyback" className="text-lg md:text-xl font-semibold mt-6 mb-3">7. 100% Profit Buyback & Revenue Sharing</h3>
      <p>Platform profits buy back $FANS and redistribute to stakeholders.</p>
      <h3 id="public-leaderboards" className="text-lg md:text-xl font-semibold mt-6 mb-3">8. Public Leaderboards</h3>
      <p>Transparent merit-based discovery powered by verified metrics.</p>

      <h2 id="tokenomics" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Tokenomics</h2>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Distribution</h3>
      <div className="overflow-x-auto my-6">
        <table className="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg bg-white/5">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase border-r border-white/10">Allocation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase border-r border-white/10">%</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase border-r border-white/10">Tokens</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase">Cliff / Vesting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {[
              ['Treasury Reserve', '17.5%', '1,750,000', '3 month cliff, daily linear 48 months'],
              ['Marketing & Partnerships', '15%', '1,500,000', '1 month cliff, daily linear 48 months'],
              ['Ecosystem Rewards', '15%', '1,500,000', '3 month cliff, daily linear 48 months'],
              ['Liquidity', '13%', '1,300,000', '50% at TGE, daily linear for 2 months'],
              ['Team & Recruitment', '12%', '1,200,000', '6 month cliff, daily linear 24 months'],
              ['Staking Incentives', '10%', '1,000,000', '1 month cliff, daily linear 48 months'],
              ['Private Round', '7%', '700,000', '20% at TGE, daily linear for 6 months'],
              ['Public Round', '4%', '400,000', '25% TGE, daily linear for 4 months'],
              ['Strategic Round', '3.5%', '350,000', '25% TGE, daily linear for 4 months'],
              ['Advisory', '3%', '300,000', '6 month cliff, daily linear 24 months'],
            ].map((row) => (
              <tr key={row[0]} className="hover:bg-white/5">
                {row.map((cell, i) => (
                  <td key={i} className={`px-4 py-3 text-sm text-foreground/80 ${i < row.length - 1 ? 'border-r border-white/10' : ''} ${i === 0 ? 'font-medium text-foreground' : ''}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">IDOs & Sales</h3>
      <div className="overflow-x-auto my-6">
        <table className="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg bg-white/5">
          <thead className="bg-white/5">
            <tr>
              {['Round', 'Price', '%', 'Tokens', 'Total', 'FDV', 'Vesting'].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-medium text-foreground/70 uppercase border-r border-white/10 last:border-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {[
              ['Private', '$0.5500', '7.00%', '700,000', '$385,000', '$5,500,000', '20% TGE, 6mo linear'],
              ['Strategic', '$0.600', '3.50%', '350,000', '$210,000', '$6,000,000', '25% TGE, 4mo linear'],
              ['Public', '$0.600', '4.00%', '400,000', '$240,000', '$6,000,000', '25% TGE, 4mo linear'],
            ].map((row) => (
              <tr key={row[0]} className="hover:bg-white/5">
                {row.map((c, i) => (
                  <td key={i} className={`px-3 py-3 text-sm text-foreground/80 ${i < row.length - 1 ? 'border-r border-white/10' : ''} ${i === 0 ? 'font-medium text-foreground' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
        {[
          ['Total Supply', '10,000,000 $FANS'],
          ['Initial Circulating Supply', '327,500 $FANS'],
          ['Launch Price', '$0.60'],
          ['Initial Market Cap', '$196,500'],
          ['Fully Diluted Valuation', '$6,000,000'],
          ['TGE Date', 'Post App Launch (TBC)'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2">{label}</h4>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <h2 id="utility" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Utility</h2>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Why does fan.site need a token?</h3>
      <p>Every user-owned and decentralized app requires a token for true network ownership & governance. Native chain tokens have their own incentives and direction — to truly reward, engage and monetize a consumer base, a network needs its own.</p>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">$FANS utility includes:</h3>
      <ul>
        <li>In-app currency for tipping, content, usernames, profiles & products.</li>
        <li>Unlock enhanced features, verification badges & climb leaderboards.</li>
        <li>Vote in fair improvement proposals.</li>
        <li>Rewards from content uploads and campaigns.</li>
        <li>Instant 24/7 customer support access.</li>
        <li>Access to premium features and exclusive creator clubs.</li>
        <li>Moderation and community bounties.</li>
        <li>Free airdrops & mints within the network.</li>
        <li>Premium virtual experiences and events.</li>
        <li>Revenue share for stakeholders and early adopters.</li>
      </ul>

      <h2 id="ranking-badges" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Ranking Badges</h2>
      <p>The badge system is the next generation of permissionless verification — harder to exploit, easier for victims to avoid. It doubles as a loyalty system: higher ranks unlock lower fees, enhanced features, early access and revenue share.</p>
      <p>Badges are interchangeable once unlocked and always owned by users. Holding requirements per ranking change with weekly average price, but once unlocked the badge is yours forever.</p>
      <div className="space-y-1 my-4 text-foreground/80">
        {[50000, 25000, 10000, 4000, 3000, 2000, 1000, 400, 200, 100, 50, 10, 1].map((amt, i) => (
          <p key={i}>{i + 1}) TBC — {amt.toLocaleString()} $FANS</p>
        ))}
      </div>
      <p>Public leaderboards on the home page track $FANS holdings, followers, earnings, views, likes and tips — filterable daily/weekly/monthly/yearly.</p>

      <h2 id="technology-stack" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Technology Stack</h2>
      <ul>
        <li><strong>Frontend:</strong> React 18 + TypeScript</li>
        <li><strong>Styling:</strong> Tailwind CSS + shadcn/ui</li>
        <li><strong>Build:</strong> Vite</li>
        <li><strong>Backend:</strong> Lovable Cloud (PostgreSQL, Auth, Storage, Edge Functions)</li>
        <li><strong>Blockchain:</strong> Base + BNB networks</li>
        <li><strong>State:</strong> React Context + TanStack Query</li>
        <li><strong>Routing:</strong> React Router</li>
        <li><strong>Security:</strong> Cloudflare Turnstile</li>
      </ul>

      <h2 id="depin" className="text-xl md:text-2xl font-semibold mt-12 mb-4">DePIN</h2>
      <p>The only sustainable way to scale and disrupt this industry is via a network of shared computing power to host, transcode and deliver content. Mine globally from as little as a mobile phone.</p>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Core Components</h3>
      <ul>
        <li><strong>Contributors (Miners):</strong> Phones, PCs, dedicated servers.</li>
        <li><strong>DePIN Coordinator:</strong> Encryption + smart contracts manage rewards & task distribution.</li>
        <li><strong>fan.site App:</strong> Requests and delivers data via the DePIN.</li>
        <li><strong>Clients:</strong> End users consuming content.</li>
      </ul>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Minimum Hardware</h3>
      <div className="overflow-x-auto my-6">
        <table className="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg bg-white/5">
          <thead className="bg-white/5"><tr>
            {['Device', 'Min Specs', 'Tasks', 'Stake'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase border-r border-white/10 last:border-0">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/10">
            {[
              ['Mobile', 'Quad-core, 4GB RAM', 'Hosting', '420 $FANS'],
              ['PC/Laptop', '4-core, 8GB RAM, GPU', 'Transcoding, Hosting, Delivery', '6,900 $FANS'],
              ['Dedicated Server', '8-core, 16GB RAM, SSD', 'High-volume Hosting & Delivery', '18,000 $FANS'],
            ].map((row) => (
              <tr key={row[0]} className="hover:bg-white/5">
                {row.map((c, i) => (
                  <td key={i} className={`px-4 py-3 text-sm text-foreground/80 ${i < row.length - 1 ? 'border-r border-white/10' : ''} ${i === 0 ? 'font-medium text-foreground' : ''}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-lg md:text-xl font-semibold mt-6 mb-3">Reward Formula</h3>
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg my-4 font-mono text-sm text-foreground">
        Reward = Task Weight × Resource Score × Revenue Pool Share
      </div>

      <h2 id="governance" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Governance</h2>
      <p>$FANS holders govern the protocol. Proposals span fee adjustments, feature roadmaps, treasury allocation, and partnerships — voted on transparently with weighted voting power based on holdings + stake.</p>

      <h2 id="roadmap" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Roadmap</h2>
      <ul>
        <li><strong>Q1 2026:</strong> Closed beta — invite-only creator onboarding.</li>
        <li><strong>April 2026:</strong> App public launch (iOS, Android, Web).</li>
        <li><strong>Q2 2026:</strong> Token Generation Event ($FANS).</li>
        <li><strong>Q3 2026:</strong> DePIN miner client release.</li>
        <li><strong>Q4 2026:</strong> Governance v1, fractional NFT marketplace.</li>
        <li><strong>2027+:</strong> VR/AR experiences, AI-assisted creator tools, multi-chain expansion.</li>
      </ul>

      <h2 id="risk-analysis" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Risk Analysis</h2>
      <ul>
        <li><strong>Regulatory:</strong> Adult content regulation varies by jurisdiction. Decentralized infrastructure mitigates platform-level shutdown risk.</li>
        <li><strong>Market:</strong> Crypto volatility may affect token-denominated earnings; stablecoin settlement options will be available.</li>
        <li><strong>Adoption:</strong> Network effects matter — early creator incentives are designed to bootstrap supply-side.</li>
        <li><strong>Technical:</strong> Smart contracts will be audited prior to mainnet deployment.</li>
      </ul>

      <h2 id="legal-compliance" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Legal & Compliance</h2>
      <p>fan.site enforces creator age verification (18+), content moderation policies aligned with international law (CSAM zero-tolerance), and DMCA takedown procedures. Token sales comply with applicable jurisdictional securities frameworks; non-US, non-restricted jurisdictions only for public sale participation.</p>

      <h2 id="conclusion" className="text-xl md:text-2xl font-semibold mt-12 mb-4">Conclusion</h2>
      <p>The proposed system enables truly decentralized, censorship-resistant, limitlessly scalable, and cost-efficient infrastructure for fan.site. By leveraging shared computing power and rewarding miners directly from revenue, the model avoids inflation and ensures long-term sustainability. To disrupt this industry, you need either billionaire backing or true innovation — fan.site delivers the latter.</p>
      <p className="italic text-foreground/60">*The full code will be open-sourced upon completion. Contact: help@fan.site</p>
    </div>
  );
};
