import type { ReactElement } from 'react';

const box = { width: 160, height: 110 } as const;

function frame(children: ReactElement | ReactElement[], bg = '#f4f1ea') {
  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      width={box.width}
      height={box.height}
      role="img"
      aria-hidden="true"
    >
      <rect width={box.width} height={box.height} rx="8" fill={bg} />
      {children}
    </svg>
  );
}

const wood = '#c89b6d';
const woodDark = '#a87b4f';
const metal = '#8a8f98';
const accent = '#3f7d5d';

const illustrations: Record<string, ReactElement> = {
  unbox: frame([
    <rect key="b" x="30" y="45" width="100" height="50" rx="4" fill={wood} />,
    <path key="l1" d="M30 45 L55 25 L155 25 L130 45 Z" fill={woodDark} />,
    <rect key="i1" x="45" y="55" width="30" height="8" rx="2" fill="#fff" opacity="0.7" />,
    <rect key="i2" x="45" y="70" width="50" height="8" rx="2" fill="#fff" opacity="0.5" />,
    <circle key="c" cx="118" cy="72" r="12" fill={accent} />,
    <path key="ck" d="M112 72 l4 4 l8 -9" stroke="#fff" strokeWidth="3" fill="none" />,
  ]),
  dowel: frame([
    <rect key="p" x="20" y="70" width="120" height="22" rx="3" fill={wood} />,
    <rect key="d1" x="40" y="48" width="8" height="24" rx="3" fill={woodDark} />,
    <rect key="d2" x="76" y="48" width="8" height="24" rx="3" fill={woodDark} />,
    <rect key="d3" x="112" y="48" width="8" height="24" rx="3" fill={woodDark} />,
    <rect key="h" x="60" y="14" width="40" height="14" rx="4" fill={metal} />,
    <rect key="hh" x="76" y="26" width="8" height="16" rx="2" fill={woodDark} />,
  ]),
  shelf: frame([
    <rect key="l" x="25" y="15" width="14" height="80" rx="2" fill={woodDark} />,
    <rect key="r" x="121" y="15" width="14" height="80" rx="2" fill={woodDark} />,
    <rect key="s1" x="39" y="30" width="82" height="9" rx="2" fill={wood} />,
    <rect key="s2" x="39" y="55" width="82" height="9" rx="2" fill={wood} />,
    <rect key="s3" x="39" y="80" width="82" height="9" rx="2" fill={wood} />,
  ]),
  camlock: frame([
    <rect key="t" x="25" y="20" width="110" height="14" rx="2" fill={wood} />,
    <rect key="l" x="30" y="34" width="12" height="60" rx="2" fill={woodDark} />,
    <rect key="r" x="118" y="34" width="12" height="60" rx="2" fill={woodDark} />,
    <circle key="c1" cx="36" cy="27" r="7" fill={metal} />,
    <circle key="c2" cx="124" cy="27" r="7" fill={metal} />,
    <path key="a" d="M70 60 q10 -14 20 0" stroke={accent} strokeWidth="4" fill="none" markerEnd="url(#arr)" />,
    <defs key="def">
      <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0 0 L6 3 L0 6 Z" fill={accent} />
      </marker>
    </defs>,
  ]),
  screws: frame([
    <rect key="p" x="20" y="20" width="16" height="75" rx="2" fill={woodDark} />,
    <rect key="s" x="36" y="40" width="90" height="10" rx="2" fill={wood} />,
    <circle key="h1" x="28" y="38" r="5" fill={metal} />,
    <circle key="h2" x="28" y="58" r="5" fill={metal} />,
    <path key="x1" d="M25 35 l6 6 M31 35 l-6 6" stroke="#fff" strokeWidth="1.6" />,
    <path key="x2" d="M25 55 l6 6 M31 55 l-6 6" stroke="#fff" strokeWidth="1.6" />,
    <rect key="dr" x="60" y="70" width="44" height="10" rx="4" fill={accent} />,
    <rect key="dt" x="56" y="72" width="8" height="6" rx="2" fill={metal} />,
  ]),
  backpanel: frame([
    <rect key="f" x="30" y="15" width="100" height="80" rx="3" fill={woodDark} />,
    <rect key="b" x="38" y="23" width="84" height="64" rx="2" fill="#e8dcc8" />,
    <circle key="n1" cx="46" cy="31" r="3" fill={metal} />,
    <circle key="n2" cx="114" cy="31" r="3" fill={metal} />,
    <circle key="n3" cx="46" cy="79" r="3" fill={metal} />,
    <circle key="n4" cx="114" cy="79" r="3" fill={metal} />,
    <path key="dg" d="M42 27 L118 83 M118 27 L42 83" stroke={accent} strokeWidth="1.6" strokeDasharray="4 3" />,
  ]),
  pads: frame([
    <rect key="l" x="35" y="15" width="14" height="70" rx="2" fill={woodDark} />,
    <rect key="r" x="111" y="15" width="14" height="70" rx="2" fill={woodDark} />,
    <rect key="s" x="35" y="30" width="90" height="9" rx="2" fill={wood} />,
    <circle key="p1" cx="42" cy="92" r="7" fill={accent} />,
    <circle key="p2" cx="118" cy="92" r="7" fill={accent} />,
  ]),
  done: frame([
    <rect key="l" x="35" y="12" width="12" height="80" rx="2" fill={woodDark} />,
    <rect key="r" x="113" y="12" width="12" height="80" rx="2" fill={woodDark} />,
    <rect key="s1" x="35" y="26" width="90" height="7" rx="2" fill={wood} />,
    <rect key="s2" x="35" y="46" width="90" height="7" rx="2" fill={wood} />,
    <rect key="s3" x="35" y="66" width="90" height="7" rx="2" fill={wood} />,
    <rect key="lv" x="62" y="2" width="36" height="10" rx="3" fill={metal} />,
    <circle key="bb" cx="80" cy="7" r="3" fill={accent} />,
    <path key="ck" d="M66 100 l6 6 l14 -16" stroke={accent} strokeWidth="4" fill="none" />,
  ]),
  generic: frame([
    <rect key="p" x="30" y="30" width="100" height="50" rx="4" fill={wood} />,
    <path key="q" d="M72 48 a8 8 0 1 1 8 8 l0 6" stroke="#fff" strokeWidth="4" fill="none" />,
    <circle key="qd" cx="80" cy="70" r="2.6" fill="#fff" />,
  ]),
};

export const illustrationKeys = Object.keys(illustrations);

export function Illustration({ imageKey, alt }: { imageKey: string; alt: string }) {
  const svg = illustrations[imageKey] ?? illustrations.generic;
  return (
    <figure className="illustration">
      {svg}
      <figcaption>{alt}</figcaption>
    </figure>
  );
}
