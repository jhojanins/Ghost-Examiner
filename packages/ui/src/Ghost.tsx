import { kitMessages, type GhostPose, type Locale, type Viseme } from '@ghost-examiner/core';
import { useId, type Ref } from 'react';
import './Ghost.css';

export interface GhostProps {
  pose: GhostPose;
  locale: Locale;
  /** From `useGhostPose`, which animates blink and mouth through it. */
  ref?: Ref<SVGSVGElement>;
}

// Palette (design §5.3, Req 3.11). No purple anywhere.
const INK = '#0b1020'; // eyes, brows, mouth, outlines
const GLASSES = '#e8a13a';
const BOWTIE = '#e8892f';
const MINT = '#e3fbf4';
const MINT_DARK = '#a9e8d6';
const WHITE = '#ffffff';

/**
 * One pre-drawn path per viseme; only the active one is visible (no path morphing).
 * None of them curves up at the corners: the examiner never smiles.
 */
const MOUTHS: Record<Viseme, { d: string; filled: boolean }> = {
  rest: { d: 'M108,149 Q120,146.5 132,149', filled: false }, // flat, a touch serious
  A: { d: 'M112,146.5 C112,141.5 128,141.5 128,146.5 C128,154.5 124,159 120,159 C116,159 112,154.5 112,146.5 Z', filled: true }, // open, rounded corners
  O: { d: 'M113.5,150 A6.5,7.5 0 1,0 126.5,150 A6.5,7.5 0 1,0 113.5,150 Z', filled: true },
  MBP: { d: 'M113,148.5 Q120,144 127,148.5 Q120,153 113,148.5 Z', filled: true }, // lips pressed together
};

/** Round frames, bridge and temples; drawn twice so the orange gets a 2 px dark edge. */
function GlassesFrame({ color, width }: { color: string; width: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
      <circle cx="95" cy="108" r="19" />
      <circle cx="145" cy="108" r="19" />
      <path d="M114,106 Q120,100 126,106" />
      <path d="M76,104 L58,98" />
      <path d="M164,104 L182,98" />
    </g>
  );
}

/**
 * The ghost examiner (design §5.3): a pure SVG view of a GhostPose. Expression and blink are
 * exposed as data attributes; Ghost.css turns them into transforms on <g> elements.
 */
export function Ghost({ pose, locale, ref }: GhostProps) {
  const gradientId = `ge-body-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const label = kitMessages[locale][`ghost.label.${pose.expression}`];

  return (
    <svg
      ref={ref}
      className="ge-ghost"
      viewBox="0 0 240 280"
      role="img"
      aria-label={label}
      data-expression={pose.expression}
      data-activity={pose.activity}
      data-blink={pose.blink}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={WHITE} />
          <stop offset="0.6" stopColor={MINT} />
          <stop offset="1" stopColor={MINT_DARK} />
        </linearGradient>
      </defs>

      {/* Rounded top and a three-lobe hem. */}
      <path
        data-part="body"
        fill={`url(#${gradientId})`}
        d="M45,250 L45,110 C45,62 80,30 120,30 C160,30 195,62 195,110 L195,250 Q170,278 145,250 Q120,278 95,250 Q70,278 45,250 Z"
      />

      <g data-part="brows" stroke={INK} strokeWidth="4" strokeLinecap="round">
        <g className="ge-brow ge-brow-left">
          <path d="M83,76 L107,76" />
        </g>
        <g className="ge-brow ge-brow-right">
          <path d="M133,76 L157,76" />
        </g>
      </g>

      <g data-part="eye-left" className="ge-eye">
        <g className="ge-eye-lid">
          <ellipse cx="95" cy="108" rx="6" ry="8" fill={INK} />
        </g>
      </g>
      <g data-part="eye-right" className="ge-eye">
        <g className="ge-eye-lid">
          <ellipse cx="145" cy="108" rx="6" ry="8" fill={INK} />
        </g>
      </g>

      <g data-part="glasses">
        <GlassesFrame color={INK} width={8} />
        <GlassesFrame color={GLASSES} width={4} />
      </g>

      <g data-part="mouth" className="ge-mouth">
        {(Object.keys(MOUTHS) as Viseme[]).map((viseme) => {
          const { d, filled } = MOUTHS[viseme];
          return (
            <path
              key={viseme}
              data-viseme={viseme}
              d={d}
              visibility={viseme === pose.viseme ? 'visible' : 'hidden'}
              fill={filled ? INK : 'none'}
              stroke={INK}
              strokeWidth={filled ? '2' : '3.5'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>

      <g data-part="bowtie" fill={BOWTIE} stroke={INK} strokeWidth="2" strokeLinejoin="round">
        <path d="M120,182 L96,170 L96,194 Z" />
        <path d="M120,182 L144,170 L144,194 Z" />
        <rect x="113" y="175" width="14" height="14" rx="3" />
      </g>

      {/* Held at the lower right, tilted a little; it reaches past the body onto the scene. */}
      <g data-part="clipboard" transform="rotate(-6 186 188)" stroke={INK} strokeLinejoin="round">
        <rect x="158" y="150" width="56" height="76" rx="5" fill={MINT_DARK} strokeWidth="2" />
        <rect x="164" y="160" width="44" height="60" rx="2" fill={WHITE} strokeWidth="1" />
        <path d="M170,174 H202 M170,184 H202 M170,194 H196 M170,204 H200" fill="none" strokeWidth="1.2" />
        <rect x="176" y="144" width="20" height="10" rx="2" fill={GLASSES} strokeWidth="2" />
      </g>

      <g data-part="hands" fill={MINT} stroke={INK} strokeWidth="1.5">
        <ellipse cx="164" cy="214" rx="10" ry="7" />
        <ellipse cx="214" cy="172" rx="7" ry="9" />
      </g>
    </svg>
  );
}
