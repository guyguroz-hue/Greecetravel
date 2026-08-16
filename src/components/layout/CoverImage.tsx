'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Destination covers are drawn, not fetched — the app stays fully offline and
 * every trip gets a distinctive header without a stock-photo dependency.
 */

export const COVER_PRESETS = [
  { key: 'greece', label: 'יוון' },
  { key: 'coast', label: 'חוף' },
  { key: 'mountain', label: 'הרים' },
  { key: 'city', label: 'עיר' },
  { key: 'desert', label: 'מדבר' },
  { key: 'tropic', label: 'טרופי' },
] as const;

export type CoverKey = (typeof COVER_PRESETS)[number]['key'];

const GRADIENTS: Record<string, string> = {
  greece: 'linear-gradient(135deg,#1e63c9 0%,#2b8fd6 45%,#7ec8e3 100%)',
  coast: 'linear-gradient(135deg,#0a7ea4 0%,#12a4a4 50%,#7fd6c0 100%)',
  mountain: 'linear-gradient(135deg,#2f4858 0%,#33658a 55%,#86bbd8 100%)',
  city: 'linear-gradient(135deg,#3a2f5b 0%,#6a4c93 55%,#c56cb0 100%)',
  desert: 'linear-gradient(135deg,#a14b1d 0%,#db8629 55%,#eabd66 100%)',
  tropic: 'linear-gradient(135deg,#0b6e4f 0%,#11916b 50%,#8ed99f 100%)',
};

function Scene({ variant }: { variant: string }) {
  switch (variant) {
    case 'coast':
    case 'tropic':
      return (
        <>
          <circle cx="322" cy="46" r="20" fill="#fff" opacity="0.5" />
          <path d="M0 128 Q60 108 120 122 T240 118 T400 126 V180 H0Z" fill="#fff" opacity="0.16" />
          <path d="M0 146 Q80 130 160 142 T320 140 T400 148 V180 H0Z" fill="#fff" opacity="0.22" />
        </>
      );
    case 'mountain':
      return (
        <>
          <circle cx="330" cy="42" r="17" fill="#fff" opacity="0.45" />
          <path d="M0 180 L96 74 L150 128 L214 58 L300 180Z" fill="#fff" opacity="0.2" />
          <path d="M214 58 L246 92 L214 100 L188 84Z" fill="#fff" opacity="0.4" />
          <path d="M240 180 L322 96 L400 180Z" fill="#fff" opacity="0.14" />
        </>
      );
    case 'city':
      return (
        <>
          <circle cx="60" cy="44" r="16" fill="#fff" opacity="0.4" />
          <g fill="#fff" opacity="0.19">
            <rect x="30" y="112" width="46" height="68" rx="3" />
            <rect x="86" y="86" width="38" height="94" rx="3" />
            <rect x="134" y="122" width="52" height="58" rx="3" />
            <rect x="196" y="72" width="42" height="108" rx="3" />
            <rect x="248" y="104" width="48" height="76" rx="3" />
            <rect x="306" y="88" width="40" height="92" rx="3" />
          </g>
          <g fill="#fff" opacity="0.35">
            <rect x="98" y="100" width="6" height="8" />
            <rect x="110" y="100" width="6" height="8" />
            <rect x="208" y="88" width="6" height="8" />
            <rect x="220" y="88" width="6" height="8" />
            <rect x="318" y="104" width="6" height="8" />
          </g>
        </>
      );
    case 'desert':
      return (
        <>
          <circle cx="308" cy="52" r="22" fill="#fff" opacity="0.42" />
          <path d="M0 150 Q70 112 150 146 T290 138 T400 158 V180 H0Z" fill="#fff" opacity="0.18" />
          <path d="M0 170 Q100 142 200 168 T400 166 V180 H0Z" fill="#fff" opacity="0.26" />
        </>
      );
    case 'greece':
    default:
      return (
        <>
          <circle cx="332" cy="44" r="18" fill="#fff" opacity="0.45" />
          {/* whitewashed houses with domes */}
          <g fill="#fff" opacity="0.22">
            <rect x="42" y="118" width="54" height="62" rx="4" />
            <rect x="104" y="132" width="42" height="48" rx="4" />
            <rect x="238" y="126" width="48" height="54" rx="4" />
            <rect x="296" y="140" width="38" height="40" rx="4" />
          </g>
          <g fill="#fff" opacity="0.38">
            <path d="M156 130 a30 26 0 0 1 60 0 z" />
            <rect x="182" y="104" width="4" height="16" rx="2" />
            <rect x="156" y="130" width="60" height="50" rx="3" />
          </g>
          {/* sea */}
          <path d="M0 158 Q70 146 140 156 T280 154 T400 162 V180 H0Z" fill="#fff" opacity="0.16" />
          <path d="M0 170 Q90 160 180 170 T400 172 V180 H0Z" fill="#fff" opacity="0.24" />
        </>
      );
  }
}

export function CoverImage({
  variant = 'greece',
  className,
  children,
  rounded = true,
}: {
  variant?: string;
  className?: string;
  children?: React.ReactNode;
  rounded?: boolean;
}) {
  const key = variant in GRADIENTS ? variant : 'greece';
  return (
    <div
      className={cn('relative overflow-hidden', rounded && 'rounded-2xl', className)}
      style={{ background: GRADIENTS[key] }}
    >
      <svg
        viewBox="0 0 400 180"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <Scene variant={key} />
      </svg>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgb(0 0 0 / 0.55), transparent 62%)' }}
        aria-hidden
      />
      {children && <div className="relative">{children}</div>}
    </div>
  );
}
