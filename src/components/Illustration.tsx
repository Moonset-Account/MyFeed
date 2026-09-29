/** 离线内联 SVG 示意图，按 key 渲染，避免任何外部图片请求。 */
export function Illustration({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 320 200',
    role: 'img' as const,
    'aria-label': name,
    className: 'illustration',
  };
  switch (name) {
    case 'layout':
      return (
        <svg {...common}>
          <rect x="10" y="10" width="300" height="180" rx="8" fill="#f4f1ea" stroke="#c9c2b4" />
          <rect x="30" y="40" width="18" height="120" rx="3" fill="#c89b6d" />
          <rect x="56" y="40" width="18" height="120" rx="3" fill="#c89b6d" />
          <rect x="90" y="40" width="110" height="16" rx="3" fill="#d9b489" />
          <rect x="90" y="64" width="110" height="16" rx="3" fill="#d9b489" />
          <rect x="90" y="88" width="100" height="12" rx="3" fill="#e3c9a4" />
          <rect x="90" y="108" width="100" height="12" rx="3" fill="#e3c9a4" />
          <rect x="90" y="132" width="120" height="34" rx="3" fill="#efe6d6" stroke="#c9c2b4" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={236 + (i % 3) * 22} cy={60 + Math.floor(i / 3) * 22} r="7" fill="#8a8f98" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={236 + i * 22} cy={120} r="6" fill="#b0875a" />
          ))}
          <text x="30" y="180" fontSize="12" fill="#7a7264">分组摆放 · 对照清单</text>
        </svg>
      );
    case 'frame':
      return (
        <svg {...common}>
          <rect x="10" y="10" width="300" height="180" rx="8" fill="#f4f1ea" stroke="#c9c2b4" />
          <rect x="80" y="30" width="20" height="140" rx="3" fill="#c89b6d" />
          <rect x="220" y="30" width="20" height="140" rx="3" fill="#c89b6d" />
          <rect x="80" y="30" width="160" height="18" rx="3" fill="#d9b489" />
          <rect x="80" y="152" width="160" height="18" rx="3" fill="#d9b489" />
          <line x1="100" y1="48" x2="220" y2="152" stroke="#b0875a" strokeDasharray="5 4" />
          <line x1="220" y1="48" x2="100" y2="152" stroke="#b0875a" strokeDasharray="5 4" />
          <circle cx="110" cy="39" r="5" fill="#8a8f98" />
          <circle cx="210" cy="39" r="5" fill="#8a8f98" />
          <circle cx="110" cy="161" r="5" fill="#8a8f98" />
          <circle cx="210" cy="161" r="5" fill="#8a8f98" />
          <text x="92" y="190" fontSize="12" fill="#7a7264">对角线误差 ≤ 3mm</text>
        </svg>
      );
    case 'shelf':
      return (
        <svg {...common}>
          <rect x="10" y="10" width="300" height="180" rx="8" fill="#f4f1ea" stroke="#c9c2b4" />
          <rect x="80" y="30" width="18" height="140" rx="3" fill="#c89b6d" />
          <rect x="222" y="30" width="18" height="140" rx="3" fill="#c89b6d" />
          <rect x="98" y="80" width="124" height="12" rx="3" fill="#e3c9a4" />
          <rect x="98" y="128" width="124" height="12" rx="3" fill="#e3c9a4" />
          {[80, 128].map((y) => (
            <g key={y}>
              <circle cx="104" cy={y - 4} r="4" fill="#8a8f98" />
              <circle cx="216" cy={y - 4} r="4" fill="#8a8f98" />
            </g>
          ))}
          <text x="96" y="190" fontSize="12" fill="#7a7264">层板托同一高度</text>
        </svg>
      );
    case 'back':
      return (
        <svg {...common}>
          <rect x="10" y="10" width="300" height="180" rx="8" fill="#f4f1ea" stroke="#c9c2b4" />
          <rect x="90" y="26" width="140" height="148" rx="3" fill="#efe6d6" stroke="#b0875a" strokeWidth="2" />
          {[
            [100, 36], [220, 36], [100, 164], [220, 164],
            [160, 36], [160, 164], [100, 100], [220, 100],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#8a8f98" />
          ))}
          <text x="96" y="192" fontSize="12" fill="#7a7264">先四角定位，再补边缘</text>
        </svg>
      );
    case 'anchor':
      return (
        <svg {...common}>
          <rect x="10" y="10" width="300" height="180" rx="8" fill="#f4f1ea" stroke="#c9c2b4" />
          <rect x="40" y="20" width="10" height="170" fill="#c9c2b4" />
          <rect x="90" y="50" width="120" height="120" rx="4" fill="#d9b489" />
          <rect x="90" y="50" width="120" height="14" fill="#c89b6d" />
          <path d="M50 44 L90 58 L90 70 L50 56 Z" fill="#8a8f98" />
          <circle cx="160" cy="30" r="14" fill="#fff" stroke="#5a8f5a" strokeWidth="2" />
          <circle cx="160" cy="30" r="4" fill="#5a8f5a" />
          <line x1="146" y1="30" x2="174" y2="30" stroke="#5a8f5a" strokeWidth="2" />
          <text x="86" y="190" fontSize="12" fill="#7a7264">贴墙调平 · 防倒支架</text>
        </svg>
      );
    case 'done':
    default:
      return (
        <svg {...common}>
          <rect x="10" y="10" width="300" height="180" rx="8" fill="#f4f1ea" stroke="#c9c2b4" />
          <rect x="100" y="30" width="120" height="140" rx="4" fill="#d9b489" />
          <rect x="100" y="30" width="120" height="14" fill="#c89b6d" />
          <rect x="108" y="76" width="104" height="8" fill="#c89b6d" />
          <rect x="108" y="120" width="104" height="8" fill="#c89b6d" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={116 + i * 22} y={54 - 4} width="14" height="26" rx="2" fill={['#7a9cc6', '#c67a7a', '#8fb87a'][i]} />
          ))}
          {[0, 1].map((i) => (
            <rect key={i} x={120 + i * 26} y={96} width="16" height="24" rx="2" fill={['#c6a47a', '#7ab8c6'][i]} />
          ))}
          <circle cx="262" cy="46" r="18" fill="#5a8f5a" />
          <path d="M253 46 l7 7 l12 -14" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
          <text x="106" y="190" fontSize="12" fill="#7a7264">摇晃测试通过 · 完工</text>
        </svg>
      );
  }
}
