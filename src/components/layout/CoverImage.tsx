'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Destination covers are drawn, not fetched — the app stays fully offline and
 * every trip gets a distinctive header without a stock-photo dependency.
 */

/**
 * Moods, not places. The first used to be labelled "יוון", which read as a
 * country sitting among "חוף" and "מדבר" — the keys stay as they are so trips
 * already saved keep the cover they were given.
 */
export const COVER_PRESETS = [
  { key: 'greece', label: 'ים' },
  { key: 'coast', label: 'חוף' },
  { key: 'mountain', label: 'הרים' },
  { key: 'city', label: 'עיר' },
  { key: 'desert', label: 'מדבר' },
  { key: 'tropic', label: 'טרופי' },
] as const;

export type CoverKey = (typeof COVER_PRESETS)[number]['key'];

/**
 * Each cover is a deep base with a warm low sun burnt into one corner. The
 * light-weight display type sits on these, so they run dark and let the sand
 * glow supply the warmth rather than lightening the whole field.
 */
const SUN = 'radial-gradient(120% 90% at 78% 8%, #f2d89e 0%, rgba(242,216,158,0) 52%)';

const GRADIENTS: Record<string, string> = {
  greece: `${SUN}, linear-gradient(168deg,#1d67f0 0%,#1a3c8c 46%,#142655 100%)`,
  coast: `${SUN}, linear-gradient(168deg,#0f8fae 0%,#0d5f7f 48%,#0a3348 100%)`,
  mountain: `${SUN}, linear-gradient(168deg,#42678a 0%,#2f4858 50%,#1a2733 100%)`,
  city: `${SUN}, linear-gradient(168deg,#6a4c93 0%,#3f2f66 50%,#221a38 100%)`,
  desert: `${SUN}, linear-gradient(168deg,#db8629 0%,#a14b1d 50%,#5c2a12 100%)`,
  tropic: `${SUN}, linear-gradient(168deg,#11916b 0%,#0b6e4f 50%,#053626 100%)`,
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
      // Layered headlands rather than buildings: the horizon reads at any
      // height, and stays calm behind a long trip name.
      return (
        <>
          <path
            d="M0 116 C 62 96 94 108 136 96 C 184 82 208 104 254 92 C 302 80 346 100 400 90 L400 180 L0 180Z"
            fill="#0f2149"
            opacity="0.5"
          />
          <path
            d="M0 140 C 68 124 114 136 162 124 C 220 110 260 130 306 122 C 348 114 376 126 400 122 L400 180 L0 180Z"
            fill="#0a1631"
            opacity="0.66"
          />
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
        style={{
          background:
            'linear-gradient(to top, rgb(8 14 30 / 0.72) 0%, rgb(8 14 30 / 0.28) 38%, transparent 70%)',
        }}
        aria-hidden
      />
      {children && <div className="relative">{children}</div>}
    </div>
  );
}
