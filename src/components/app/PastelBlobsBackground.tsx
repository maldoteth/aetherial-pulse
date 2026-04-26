import { memo } from 'react';

/**
 * PastelBlobsBackground
 * ---------------------
 * Fixed full-viewport pastel gradient blobs over a black base.
 * Colors pulled from the brand palette: magenta/pink, purple/indigo,
 * orange and yellow. Renders behind all page content (z-0) and is
 * pointer-events-none so it never interferes with interactions.
 */
const PastelBlobsBackground = memo(() => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-black"
    >
      {/* Top-left magenta/pink blob */}
      <div
        className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full blur-[120px] opacity-40 animate-pulse"
        style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }}
      />
      {/* Top-right indigo/purple blob */}
      <div
        className="absolute -top-32 -right-40 w-[36rem] h-[36rem] rounded-full blur-[120px] opacity-35 animate-pulse"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', animationDelay: '1.2s' }}
      />
      {/* Center purple wash */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[44rem] h-[44rem] rounded-full blur-[140px] opacity-25 animate-pulse"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)', animationDelay: '0.6s' }}
      />
      {/* Bottom-left orange blob */}
      <div
        className="absolute -bottom-40 -left-32 w-[38rem] h-[38rem] rounded-full blur-[120px] opacity-30 animate-pulse"
        style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)', animationDelay: '1.8s' }}
      />
      {/* Bottom-right yellow blob */}
      <div
        className="absolute -bottom-32 -right-40 w-[34rem] h-[34rem] rounded-full blur-[120px] opacity-25 animate-pulse"
        style={{ background: 'radial-gradient(circle, #facc15 0%, transparent 70%)', animationDelay: '2.4s' }}
      />
    </div>
  );
});

PastelBlobsBackground.displayName = 'PastelBlobsBackground';

export default PastelBlobsBackground;
