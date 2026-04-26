/**
 * Long-form docs content. Uses semantic tokens for the dark liquid-glass theme.
 * Section IDs are used by the sidebar navigation and search index.
 */
export const DocsContent = () => {
  return (
    <div className="prose prose-sm md:prose-lg max-w-none break-words text-foreground/80">
      <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-4 md:mb-8 pb-2 md:pb-4 border-b border-white/10 break-words">
        Fan Site
      </h1>

      <h2 id="overview" className="text-lg md:text-2xl font-semibold text-foreground mt-4 md:mt-8 mb-2 md:mb-4">
        Overview
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        Fan Site represents a paradigm shift in the creator economy, offering a decentralized,
        blockchain-powered platform that eliminates the systemic problems plaguing traditional adult
        content platforms. Our approach combines ultra-low fees, complete privacy protection, and
        censorship-resistant infrastructure to create the first truly creator-owned platform in the
        industry.
      </p>

      <h2 id="mission-statement" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Mission Statement
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        To democratize the creator economy by building the world's first truly decentralized adult
        content platform that prioritizes creator sovereignty, financial freedom, and privacy
        protection.
      </p>

      <h2 id="executive-summary" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Executive Summary
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        The adult content industry, valued at over $15 billion annually, suffers from fundamental
        structural problems that exploit creators. Traditional platforms extract up to 40% of
        creator earnings, implement arbitrary censorship, violate user privacy, and create financial
        transparency risks. Fan Site addresses these systemic issues through blockchain technology,
        offering ultra-low fees (as low as 1%), complete privacy, censorship resistance, and global
        accessibility without traditional banking requirements.
      </p>

      <h2 id="market-analysis" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Market Analysis
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        The fan economy has experienced unprecedented growth, largely driven by mainstream adoption
        of subscription-based platforms. Total addressable market estimates exceed $15 billion
        annually as of 2024, with OnlyFans dominating at $5.55 billion gross revenue in 2023, 220M+
        registered users and 2.1M+ creators.
      </p>

      <h3 className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        Competitive Landscape
      </h3>
      <ul className="list-disc list-inside text-foreground/80 mb-3 md:mb-6 text-sm md:text-base space-y-1">
        <li><strong>OnlyFans:</strong> 73% market share by revenue, 20% commission rate</li>
        <li><strong>Fansly:</strong> ~$200M annual GMV, 15% commission, growing 40% YoY</li>
        <li><strong>JustForFans:</strong> ~$50M annual GMV, 25% commission</li>
        <li><strong>ManyVids:</strong> Hybrid marketplace, ~$150M annual GMV</li>
        <li><strong>LoyalFans:</strong> 20% commission, ~$75M annual GMV</li>
      </ul>

      <h2 id="creator-economics-income-distribution" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Creator Economics &amp; Income Distribution
      </h2>
      <ul className="list-disc list-inside text-foreground/80 mb-3 md:mb-6 text-sm md:text-base space-y-1">
        <li>Top 1% of creators earn over $100,000 annually; top performers exceed $1M/year</li>
        <li>Median: 50% of creators earn less than $180/month</li>
        <li>Average revenue per paying subscriber: ~$31.50/month</li>
        <li>Creator retention: only 30% remain active beyond 12 months</li>
        <li>~12% of creators reach full-time income (&gt;$50,000/year)</li>
      </ul>

      <h2 id="problems-adult-creators-face" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Problems Adult Creators Face
      </h2>
      <h3 className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        1. Excessive Fee Structure
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-4 text-sm md:text-base">
        A combined ~40% fee structure (deposit + withdrawal) turns a $100 fan payment into only $60
        in actual creator earnings.
      </p>
      <h3 className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        2. Censorship &amp; Content Restrictions
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-4 text-sm md:text-base">
        Arbitrary policy changes, kink discrimination, algorithmic suppression, and payment
        processor pressure limit creative expression and earning potential.
      </p>
      <h3 className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        3. Data Privacy Vulnerabilities
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-4 text-sm md:text-base">
        Centralized platforms grant admin access to private messages, perform extensive data mining,
        and are vulnerable to government data requests and high-profile breaches.
      </p>
      <h3 className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        4. Banking &amp; Financial Transparency
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Platform names appearing on bank statements creates employment, relationship, and licensing
        risks. 67% of adult creators report difficulties opening business bank accounts.
      </p>

      <h2 id="fansite-proposition" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        The fan.site Proposition
      </h2>
      <h3 id="ultra-low-fees" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        1. Ultra-Low Fees: 1% for Top Tier Users
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Fees as low as 1% for top-tier users, rewarding loyalty and high-volume activity.
      </p>
      <h3 id="decentralized-privacy" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        2. Decentralized, Private &amp; Secure
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        End-to-end encryption ensures no third party — including platform administrators — can
        access your private messages or content.
      </p>
      <h3 id="global-accessibility" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        3. No KYC or Bank Required
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Operates entirely on cryptocurrency rails, accessible to every corner of the world
        regardless of banking status.
      </p>
      <h3 id="data-ownership" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        4. Own Your Data, Monetize Without Limits
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Full data ownership through blockchain-verified content ownership and decentralized storage.
      </p>
      <h3 id="instant-settlement" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        5. Insta-Pay: 24/7/365 Settlement
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Instant settlement of all transactions, available immediately for withdrawal or trading.
      </p>
      <h3 id="censorship-resistance" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        6. Never Get Deplatformed
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Decentralized architecture makes censorship technically impossible.
      </p>
      <h3 id="profit-buyback" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        7. 100% Profit Buyback
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        100% of platform profits used for token buybacks, redistributed to stakeholders.
      </p>
      <h3 id="public-leaderboards" className="text-base md:text-xl font-semibold text-foreground/90 mb-2 md:mb-3">
        8. Public Leaderboards
      </h3>
      <p className="text-foreground/80 leading-relaxed mb-4 md:mb-6 text-sm md:text-base">
        Transparent public leaderboards tracking activity and earnings — merit-based discovery.
      </p>

      <h2 id="tokenomics" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Tokenomics
      </h2>
      <h3 className="text-lg md:text-xl font-semibold text-foreground/90 mb-4">Distribution</h3>
      <div className="overflow-x-auto my-6 md:my-8">
        <table className="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg backdrop-blur-sm bg-white/5">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">Allocation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">%</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">Tokens</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">Cliff / Vesting</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-sm text-foreground/80">
            <tr><td className="px-4 py-3">Treasury Reserve</td><td className="px-4 py-3">17.5%</td><td className="px-4 py-3">1,750,000</td><td className="px-4 py-3">3 month cliff, daily linear 48 months</td></tr>
            <tr><td className="px-4 py-3">Marketing &amp; Partnerships</td><td className="px-4 py-3">15%</td><td className="px-4 py-3">1,500,000</td><td className="px-4 py-3">1 month cliff, daily linear 48 months</td></tr>
            <tr><td className="px-4 py-3">Ecosystem Rewards</td><td className="px-4 py-3">15%</td><td className="px-4 py-3">1,500,000</td><td className="px-4 py-3">3 month cliff, daily linear 48 months</td></tr>
            <tr><td className="px-4 py-3">Liquidity</td><td className="px-4 py-3">13%</td><td className="px-4 py-3">1,300,000</td><td className="px-4 py-3">50% TGE, daily linear 2 months</td></tr>
            <tr><td className="px-4 py-3">Team &amp; Recruitment</td><td className="px-4 py-3">12%</td><td className="px-4 py-3">1,200,000</td><td className="px-4 py-3">6 month cliff, daily linear 24 months</td></tr>
            <tr><td className="px-4 py-3">Staking Incentives</td><td className="px-4 py-3">10%</td><td className="px-4 py-3">1,000,000</td><td className="px-4 py-3">1 month cliff, daily linear 48 months</td></tr>
            <tr><td className="px-4 py-3">Private Round</td><td className="px-4 py-3">7%</td><td className="px-4 py-3">700,000</td><td className="px-4 py-3">20% TGE, daily linear 6 months</td></tr>
            <tr><td className="px-4 py-3">Public Round</td><td className="px-4 py-3">4%</td><td className="px-4 py-3">400,000</td><td className="px-4 py-3">25% TGE, daily linear 4 months</td></tr>
            <tr><td className="px-4 py-3">Strategic Round</td><td className="px-4 py-3">3.5%</td><td className="px-4 py-3">350,000</td><td className="px-4 py-3">25% TGE, daily linear 4 months</td></tr>
            <tr><td className="px-4 py-3">Advisory</td><td className="px-4 py-3">3%</td><td className="px-4 py-3">300,000</td><td className="px-4 py-3">6 month cliff, daily linear 24 months</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg md:text-xl font-semibold text-foreground/90 mb-4">Summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6 md:my-8">
        <SummaryCard label="Total Supply" value="10,000,000 $FANS" />
        <SummaryCard label="Initial Circulating Supply" value="327,500 $FANS" />
        <SummaryCard label="Launch Price" value="$0.6" />
        <SummaryCard label="Initial Market Cap" value="$196,500" />
        <SummaryCard label="Fully Diluted Valuation" value="$6,000,000" />
        <SummaryCard label="TGE Date" value="TBD" />
      </div>

      <h2 id="utility" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Utility
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        Every user-owned and decentralized app requires a token for true network ownership and
        governance. $FANS powers the entire fan.site ecosystem.
      </p>
      <ul className="list-disc list-inside text-foreground/80 mb-3 md:mb-6 text-sm md:text-base space-y-2">
        <li>In-app currency for tipping, content purchases, usernames, profiles &amp; products</li>
        <li>Unlock enhanced app features, verification badges &amp; climb leaderboards</li>
        <li>Vote in governance proposals to enhance the network</li>
        <li>Rewards from content uploads and unique campaigns</li>
        <li>Access instant, direct 24/7 customer support</li>
        <li>Premium features and exclusive creator clubs</li>
        <li>Moderate content and earn from community bounties</li>
        <li>Free airdrops &amp; mints within the ecosystem</li>
        <li>Revenue share for stakeholders and early adopters</li>
      </ul>

      <h2 id="ranking-badges" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Ranking Badges
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        The badge system is the next generation of permissionless verifications and doubles as a
        loyalty system where higher ranks unlock lower fees, enhanced features, early access, and
        more revenue share. Holding requirements per ranking change with weekly average price, but
        once unlocked, badges are yours forever.
      </p>

      <h2 id="technology-stack" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Technology Stack
      </h2>
      <ul className="list-disc list-inside text-foreground/80 mb-3 md:mb-6 text-sm md:text-base space-y-2">
        <li><strong>Frontend:</strong> React 18 with TypeScript</li>
        <li><strong>Styling:</strong> Tailwind CSS with custom design system and Shadcn UI</li>
        <li><strong>Build Tool:</strong> Vite</li>
        <li><strong>Backend:</strong> Lovable Cloud (PostgreSQL, Auth, Storage, Edge Functions)</li>
        <li><strong>Blockchain:</strong> Multi-chain smart contract integration</li>
        <li><strong>Security:</strong> End-to-end encryption, decentralized storage</li>
      </ul>

      <h2 id="governance" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Governance
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        $FANS holders vote on platform improvement proposals, fee changes, new features, and
        treasury allocation through a transparent on-chain governance system.
      </p>

      <h2 id="roadmap" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Roadmap
      </h2>
      <ul className="list-disc list-inside text-foreground/80 mb-3 md:mb-6 text-sm md:text-base space-y-2">
        <li><strong>Phase 1:</strong> Platform launch — core features, payments, profiles</li>
        <li><strong>Phase 2:</strong> Token Generation Event &amp; staking activation</li>
        <li><strong>Phase 3:</strong> DePIN rollout &amp; community-run infrastructure</li>
        <li><strong>Phase 4:</strong> Cross-chain expansion &amp; full DAO governance</li>
      </ul>

      <h2 id="risk-analysis" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Risk Analysis
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        Risks include regulatory shifts in adult content jurisdictions, smart contract
        vulnerabilities, market volatility of the underlying token, and infrastructure scaling
        during rapid growth. Mitigations include audited contracts, multi-chain redundancy, and a
        phased rollout strategy.
      </p>

      <h2 id="legal-compliance" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Legal &amp; Compliance
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-3 md:mb-6 text-sm md:text-base">
        The platform operates within legal frameworks for adult content, with age verification,
        consent verification, and DMCA compliance built into the protocol. Token issuance follows
        applicable securities guidance in supported jurisdictions.
      </p>

      <h2 id="conclusion" className="text-lg md:text-2xl font-semibold text-foreground mt-6 md:mt-12 mb-2 md:mb-4">
        Conclusion
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-6 md:mb-8 text-sm md:text-base">
        Fan Site delivers a censorship-resistant, creator-owned alternative to extractive
        centralized platforms. By combining ultra-low fees, true privacy, instant settlement, and
        community-run infrastructure, it sets a new standard for the creator economy.
      </p>
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-lg p-4">
    <h4 className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2">{label}</h4>
    <p className="text-lg font-bold text-foreground">{value}</p>
  </div>
);
