import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Star } from 'lucide-react';

// --- Sound Engine ---
// Ein einziger AudioContext für die ganze App — Browser erlauben nur eine Handvoll
// gleichzeitig, und jeder neue kostet spürbar Zeit beim Anlegen.
let audioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
};

const playSound = (type: 'correct' | 'wrong') => {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) { console.error('Audio error', e); }
};

// --- Types & Constants ---
type Category =
  | 'plus' | 'minus' | 'verdoppeln-halbieren'
  | 'einmaleins-klein' | 'einmaleins-gross' | 'einmaleins-tafel'
  | 'division' | 'division-zerlegen' | 'tausch-arena' | 'kernaufgaben'
  | 'sachaufgaben' | 'platzhalter'
  | 'zahlen-fabrik' | 'meister-zelt' | 'differenz-jagd' | 'zahlen-mauer';

const STICKERS = ['⭐', '🌟', '🦄', '🚀', '🎨', '🍕', '🐱', '🐶', '🌈', '🍦', '🍩', '🦁', '🦉', '💎', '🍭', '⚙️', '🏆', '🎈', '🏰'];
const ANIMAL_TIERS = [
  { threshold: 5,  emoji: '🐰' },
  { threshold: 10, emoji: '🦌' },
  { threshold: 15, emoji: '🦊' },
  { threshold: 20, emoji: '🐿️' },
  { threshold: 25, emoji: '🦔' },
  { threshold: 30, emoji: '🦄' },
];

// Fixed spots on the map where each tier animal lives
const ANIMAL_SPOTS: { threshold: number; emoji: string; left: string; top: string }[] = [
  { threshold: 5,  emoji: '🐰', left: '17%', top: '90%' },
  { threshold: 10, emoji: '🦌', left: '5%',  top: '57%' },
  { threshold: 15, emoji: '🦊', left: '27%', top: '85%' },
  { threshold: 20, emoji: '🐿️', left: '62%', top: '67%' },
  { threshold: 25, emoji: '🦔', left: '77%', top: '92%' },
  { threshold: 30, emoji: '🦄', left: '50%', top: '88%' },
];

interface PerformanceData { [key: string]: number; }

const DEFAULT_STICKERS: Record<Category, string[]> = {
  plus: [], minus: [], 'verdoppeln-halbieren': [],
  'einmaleins-klein': [], 'einmaleins-gross': [], 'einmaleins-tafel': [],
  division: [], 'division-zerlegen': [], 'tausch-arena': [], kernaufgaben: [],
  sachaufgaben: [], platzhalter: [],
  'zahlen-fabrik': [], 'meister-zelt': [], 'differenz-jagd': [], 'zahlen-mauer': [],
};

const generateProblem = (category: Category, _performance: PerformanceData = {}): any => {
  let a, b;

  if (category === 'platzhalter') {
    const type = Math.floor(Math.random() * 3);
    a = Math.floor(Math.random() * 10) + 2;
    const ans = Math.floor(Math.random() * 10) + 2;
    if (type === 0) return { question: `? + ${a} = ${ans + a}`, answer: ans, key: 'placeholder', type: 'placeholder' };
    if (type === 1) return { question: `${a} + ? = ${ans + a}`, answer: ans, key: 'placeholder', type: 'placeholder' };
    return { question: `? - ${a} = ${ans}`, answer: ans + a, key: 'placeholder', type: 'placeholder' };
  }

  if (category === 'sachaufgaben') {
    const templates = [
      () => { const x = Math.floor(Math.random() * 4) + 2; const y = Math.floor(Math.random() * 3) + 1; const z = Math.floor(Math.random() * 5) + 3; const total = x * y + z; return { question: [`Klaus kauft ${x} Kaugummis für je ${y} €.`, `Dazu eine Schokolade für ${z} €.`, `Reichen seine 20 €? (1=Ja, 0=Nein)`], answer: 20 >= total ? 1 : 0, key: 'story' }; },
      () => { const x = Math.floor(Math.random() * 10) + 10; const y = Math.floor(Math.random() * 8) + 2; return { question: [`Lilly hat ${x} €.`, `Sie gibt ${y} € für Eis aus.`, `Wie viele Euro hat sie noch?`], answer: x - y, key: 'story' }; },
    ];
    return { ...templates[Math.floor(Math.random() * templates.length)](), type: 'story' };
  }

  if (category === 'einmaleins-klein' || category === 'einmaleins-gross') {
    const max = category === 'einmaleins-klein' ? 5 : 10;
    a = Math.floor(Math.random() * (max - 1)) + 2;
    b = Math.floor(Math.random() * 10) + 1;
    return { question: `${a} × ${b}`, answer: a * b, key: `${a}x${b}` };
  }

  if (category === 'division') {
    // Wird nur noch als Fallback genutzt — routing geht zu DivisionGame
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 10) + 1;
    return { question: `${a * b} : ${a}`, answer: b, key: 'div_result' };
  }

  if (category === 'kernaufgaben') {
    const kernRows = [2, 5, 10];
    a = kernRows[Math.floor(Math.random() * kernRows.length)];
    b = Math.floor(Math.random() * 10) + 1;
    if (Math.random() > 0.5) return { question: `${a} × ${b}`, answer: a * b, key: 'kern_mult' };
    return { question: `${a * b} ÷ ${a}`, answer: b, key: 'kern_div' };
  }

  if (category === 'verdoppeln-halbieren') {
    if (Math.random() > 0.5) { a = Math.floor(Math.random() * 10) + 1; return { question: `Doppelt von ${a}`, answer: a * 2, key: 'double' }; }
    a = Math.floor(Math.random() * 10) * 2 + 2;
    return { question: `Hälfte von ${a}`, answer: a / 2, key: 'half' };
  }

  if (category === 'plus') { a = Math.floor(Math.random() * 10) + 5; b = Math.floor(Math.random() * 10) + 5; return { question: `${a} + ${b}`, answer: a + b, key: 'plus' }; }
  if (category === 'minus') { a = Math.floor(Math.random() * 15) + 5; b = Math.floor(Math.random() * a) + 1; return { question: `${a} - ${b}`, answer: a - b, key: 'minus' }; }
  return { question: '?', answer: 0, key: 'unknown' };
};

// ============================================================
// MAP COMPONENTS
// ============================================================

const MapTerrain = () => (
  <svg className="map-terrain" viewBox="0 0 1300 700" preserveAspectRatio="xMidYMid slice">
    <defs>
      <radialGradient id="gGrass" cx="50%" cy="50%" r="80%">
        <stop offset="0%" stopColor="#8fd466" />
        <stop offset="100%" stopColor="#6ab84e" />
      </radialGradient>
      <radialGradient id="gLake" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#74c5f7" />
        <stop offset="100%" stopColor="#3a9fd0" />
      </radialGradient>
      <radialGradient id="gPlaza" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#dcc48a" />
        <stop offset="100%" stopColor="#c8a96e" />
      </radialGradient>
      <filter id="fBlur">
        <feGaussianBlur stdDeviation="10" />
      </filter>
      <filter id="fBlur4">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    {/* Base grass */}
    <rect width="1300" height="700" fill="url(#gGrass)" />

    {/* Zone tints — subtle colour differentiation per area */}
    <ellipse cx="175" cy="480" rx="255" ry="220" fill="#b5e87a" opacity="0.28" filter="url(#fBlur)" />
    <ellipse cx="540" cy="300" rx="285" ry="250" fill="#7ec8a0" opacity="0.22" filter="url(#fBlur)" />
    <ellipse cx="990" cy="390" rx="295" ry="260" fill="#d0e870" opacity="0.18" filter="url(#fBlur)" />

    {/* ── Forest top-left ── */}
    <ellipse cx="72"  cy="158" rx="108" ry="92"  fill="#3a8840" opacity="0.92" />
    <ellipse cx="138" cy="132" rx="82"  ry="72"  fill="#47a84a" />
    <ellipse cx="52"  cy="228" rx="66"  ry="58"  fill="#368838" opacity="0.9" />
    <ellipse cx="185" cy="182" rx="56"  ry="50"  fill="#4caf50" opacity="0.82" />
    <ellipse cx="108" cy="210" rx="44"  ry="40"  fill="#43a047" opacity="0.75" />

    {/* ── Forest top-right ── */}
    <ellipse cx="1248" cy="145" rx="96"  ry="82"  fill="#3a8840" opacity="0.9" />
    <ellipse cx="1185" cy="180" rx="72"  ry="64"  fill="#47a84a" />
    <ellipse cx="1268" cy="218" rx="60"  ry="54"  fill="#368838" opacity="0.88" />
    <ellipse cx="1155" cy="148" rx="50"  ry="45"  fill="#4caf50" opacity="0.8" />

    {/* ── Scattered forest mid ── */}
    <ellipse cx="648" cy="498" rx="52" ry="44" fill="#4a9c4e" opacity="0.55" />
    <ellipse cx="686" cy="472" rx="38" ry="34" fill="#4caf50" opacity="0.55" />

    {/* ── Lake bottom-right ── */}
    <ellipse cx="960" cy="598" rx="218" ry="122" fill="#3a9fd0" />
    <ellipse cx="960" cy="598" rx="198" ry="108" fill="url(#gLake)" />
    <ellipse cx="912" cy="578" rx="62" ry="15" fill="white" opacity="0.17" transform="rotate(-12 912 578)" />
    <ellipse cx="1008" cy="608" rx="44" ry="11" fill="white" opacity="0.13" transform="rotate(7 1008 608)" />
    <ellipse cx="958" cy="622" rx="28" ry="7"  fill="white" opacity="0.1" />

    {/* ── Town plaza (cobblestone) ── */}
    <ellipse cx="155" cy="614" rx="132" ry="88" fill="url(#gPlaza)" opacity="0.55" filter="url(#fBlur4)" />

    {/* ── School yard ── */}
    <rect x="298" y="72" width="392" height="322" rx="24" fill="#a8d5a2" opacity="0.3" filter="url(#fBlur4)" />

    {/* ================================================================
        PATHS — dark edge + sand fill + dashed centre line
        ================================================================ */}

    {/* Main east-west road */}
    <path d="M 0 422 C 88 412, 208 404, 318 408 S 516 422, 676 416 S 896 406, 1072 410 S 1222 404, 1300 400"
          stroke="#9e7a48" strokeWidth="42" fill="none" strokeLinecap="round" />
    <path d="M 0 422 C 88 412, 208 404, 318 408 S 516 422, 676 416 S 896 406, 1072 410 S 1222 404, 1300 400"
          stroke="#d4bc8a" strokeWidth="30" fill="none" strokeLinecap="round" />
    <path d="M 0 422 C 88 412, 208 404, 318 408 S 516 422, 676 416 S 896 406, 1072 410 S 1222 404, 1300 400"
          stroke="#f0e8be" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="22 16" opacity="0.85" />

    {/* Branch: left → town plaza */}
    <path d="M 96 416 C 110 474, 124 538, 146 604"
          stroke="#9e7a48" strokeWidth="28" fill="none" strokeLinecap="round" />
    <path d="M 96 416 C 110 474, 124 538, 146 604"
          stroke="#d4bc8a" strokeWidth="18" fill="none" strokeLinecap="round" />
    <path d="M 96 416 C 110 474, 124 538, 146 604"
          stroke="#f0e8be" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="18 14" opacity="0.8" />

    {/* Branch: main road → school zone (vertical) */}
    <path d="M 482 414 C 478 340, 470 264, 476 184"
          stroke="#9e7a48" strokeWidth="30" fill="none" strokeLinecap="round" />
    <path d="M 482 414 C 478 340, 470 264, 476 184"
          stroke="#d4bc8a" strokeWidth="20" fill="none" strokeLinecap="round" />
    <path d="M 482 414 C 478 340, 470 264, 476 184"
          stroke="#f0e8be" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="18 14" opacity="0.8" />

    {/* Branch: school → east (division / adventure) */}
    <path d="M 542 192 C 624 180, 712 170, 778 176"
          stroke="#9e7a48" strokeWidth="26" fill="none" strokeLinecap="round" />
    <path d="M 542 192 C 624 180, 712 170, 778 176"
          stroke="#d4bc8a" strokeWidth="16" fill="none" strokeLinecap="round" />
    <path d="M 542 192 C 624 180, 712 170, 778 176"
          stroke="#f0e8be" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="18 14" opacity="0.8" />

    {/* Branch: east → adventure zone top */}
    <path d="M 778 176 C 858 172, 928 196, 966 254"
          stroke="#9e7a48" strokeWidth="24" fill="none" strokeLinecap="round" />
    <path d="M 778 176 C 858 172, 928 196, 966 254"
          stroke="#d4bc8a" strokeWidth="14" fill="none" strokeLinecap="round" />
    <path d="M 778 176 C 858 172, 928 196, 966 254"
          stroke="#f0e8be" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="16 12" opacity="0.8" />

    {/* Branch: down right side */}
    <path d="M 966 254 C 984 344, 994 424, 980 508"
          stroke="#9e7a48" strokeWidth="24" fill="none" strokeLinecap="round" />
    <path d="M 966 254 C 984 344, 994 424, 980 508"
          stroke="#d4bc8a" strokeWidth="14" fill="none" strokeLinecap="round" />
    <path d="M 966 254 C 984 344, 994 424, 980 508"
          stroke="#f0e8be" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="16 12" opacity="0.8" />

    {/* Branch: to lake / Differenz-See */}
    <path d="M 980 508 C 970 546, 956 572, 940 592"
          stroke="#9e7a48" strokeWidth="20" fill="none" strokeLinecap="round" />
    <path d="M 980 508 C 970 546, 956 572, 940 592"
          stroke="#d4bc8a" strokeWidth="12" fill="none" strokeLinecap="round" />

    {/* Small connector: side road south */}
    <path d="M 318 408 C 310 480, 298 548, 292 618"
          stroke="#9e7a48" strokeWidth="18" fill="none" strokeLinecap="round" opacity="0.7" />
    <path d="M 318 408 C 310 480, 298 548, 292 618"
          stroke="#d4bc8a" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.7" />

    {/* Crosswalk marks at main junctions */}
    <line x1="468" y1="396" x2="494" y2="396" stroke="white" strokeWidth="3.5" opacity="0.42" strokeLinecap="round" />
    <line x1="468" y1="408" x2="494" y2="408" stroke="white" strokeWidth="3.5" opacity="0.42" strokeLinecap="round" />
    <line x1="306" y1="397" x2="332" y2="397" stroke="white" strokeWidth="3.5" opacity="0.38" strokeLinecap="round" />
    <line x1="306" y1="409" x2="332" y2="409" stroke="white" strokeWidth="3.5" opacity="0.38" strokeLinecap="round" />
    <line x1="958" y1="398" x2="976" y2="398" stroke="white" strokeWidth="3" opacity="0.35" strokeLinecap="round" />
    <line x1="958" y1="410" x2="976" y2="410" stroke="white" strokeWidth="3" opacity="0.35" strokeLinecap="round" />

    {/* Dot path flavour on main road */}
    {[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => {
      const x = t * 1300;
      const y = 422 - Math.sin(t * Math.PI) * 12;
      return <circle key={i} cx={x} cy={y} r="3" fill="#c4a060" opacity="0.4" />;
    })}
  </svg>
);

// Building data
const BUILDINGS: {
  category: Category;
  label: string;
  icon: string;
  color: string;
  roofColor: string;
  left: string;
  top: string;
}[] = [
  // Zone 1 – Rechendorf
  { category: 'plus',                 label: 'Plus-Haus',      icon: '➕', color: '#ef5350', roofColor: '#b71c1c', left: '9%',  top: '60%' },
  { category: 'minus',                label: 'Minus-Turm',     icon: '➖', color: '#42a5f5', roofColor: '#1565c0', left: '19%', top: '55%' },
  { category: 'verdoppeln-halbieren', label: 'Spiegel-Haus',   icon: '🔄', color: '#66bb6a', roofColor: '#2e7d32', left: '13%', top: '79%' },
  // Zone 2 – Malviertel
  { category: 'einmaleins-klein',     label: '1×1 (bis 5)',    icon: '✖️', color: '#ab47bc', roofColor: '#6a1b9a', left: '37%', top: '25%' },
  { category: 'einmaleins-gross',     label: '1×1 (bis 10)',   icon: '✖️', color: '#7b1fa2', roofColor: '#4a148c', left: '48%', top: '17%' },
  { category: 'einmaleins-tafel',     label: '1×1 Tafel',      icon: '📋', color: '#e91e63', roofColor: '#880e4f', left: '43%', top: '41%' },
  { category: 'division',             label: 'Divisions-Haus', icon: '➗', color: '#1e88e5', roofColor: '#0d47a1', left: '58%', top: '22%' },
  { category: 'division-zerlegen',    label: 'Zerlege-Werkstatt', icon: '🧩', color: '#00897b', roofColor: '#004d40', left: '64%', top: '38%' },
  { category: 'kernaufgaben',         label: 'Kern-Trainer',   icon: '🔑', color: '#fb8c00', roofColor: '#e65100', left: '55%', top: '51%' },
  { category: 'tausch-arena',         label: 'Tausch-Arena',   icon: '🏡', color: '#43a047', roofColor: '#1b5e20', left: '45%', top: '62%' },
  // Zone 3 – Abenteuerviertel
  { category: 'sachaufgaben',         label: 'Rechen-Post',    icon: '✉️', color: '#f4511e', roofColor: '#bf360c', left: '70%', top: '17%' },
  { category: 'platzhalter',          label: 'Rätsel-Höhle',   icon: '🔍', color: '#8d6e63', roofColor: '#4e342e', left: '80%', top: '37%' },
  { category: 'zahlen-fabrik',        label: 'Zahlen-Fabrik',  icon: '⚙️', color: '#546e7a', roofColor: '#263238', left: '74%', top: '57%' },
  { category: 'meister-zelt',         label: 'Meister-Zelt',   icon: '🏆', color: '#ffca28', roofColor: '#f57f17', left: '84%', top: '67%' },
  { category: 'differenz-jagd',       label: 'Differenz-See',  icon: '🌊', color: '#29b6f6', roofColor: '#01579b', left: '69%', top: '80%' },
  { category: 'zahlen-mauer',         label: 'Zahlen-Mauer',   icon: '🧱', color: '#a1887f', roofColor: '#4e342e', left: '83%', top: '81%' },
];

const TREES: { left: string; top: string; big?: boolean }[] = [
  { left: '3%',  top: '8%',  big: true }, { left: '7%',  top: '5%' },  { left: '4%',  top: '18%' },
  { left: '11%', top: '11%', big: true }, { left: '15%', top: '7%' },  { left: '8%',  top: '25%', big: true },
  { left: '89%', top: '6%',  big: true }, { left: '94%', top: '9%' },  { left: '91%', top: '18%' },
  { left: '97%', top: '14%', big: true }, { left: '86%', top: '13%' },
  { left: '25%', top: '6%' }, { left: '29%', top: '9%', big: true },   { left: '27%', top: '14%' },
  { left: '63%', top: '68%', big: true }, { left: '66%', top: '64%' },
  { left: '50%', top: '78%' }, { left: '56%', top: '74%', big: true },
  { left: '32%', top: '86%' }, { left: '36%', top: '90%' },
  { left: '2%',  top: '50%' }, { left: '98%', top: '48%' },
];

const ZONE_SIGNS = [
  { label: '🔢 Rechendorf',      left: '8%',  top: '42%' },
  { label: '✖️ Malviertel',       left: '39%', top: '7%'  },
  { label: '🎮 Abenteuerviertel', left: '73%', top: '7%'  },
];

interface MapBuildingProps {
  label: string; icon: string; color: string; roofColor: string;
  stickers: string[]; left: string; top: string; onClick: () => void;
}

const MapBuilding = ({ label, icon, color, roofColor, stickers, left, top, onClick }: MapBuildingProps) => (
  <div className="map-building" style={{ left, top }} onClick={onClick}>
    <div style={{ position: 'relative' }}>
      {stickers.length > 0 && (
        <div className="mb-badge">
          <Star size={9} fill="#f59e0b" stroke="none" />
          {stickers.length}
        </div>
      )}
      <div className="mb-roof" style={{ borderBottomColor: roofColor }} />
      <div className="mb-body" style={{ background: color }}>
        <span className="mb-icon">{icon}</span>
      </div>
    </div>
    <div className="mb-label">{label}</div>
  </div>
);

// ── Shared game UI ──

const GameHeader = ({ category, onBack }: { category: Category; onBack: () => void }) => {
  const b = BUILDINGS.find(b => b.category === category)!;
  return (
    <div className="game-header" style={{ background: b.color }}>
      <button className="back-button-small" onClick={onBack}><ArrowLeft size={20} /></button>
      <span className="game-header-icon">{b.icon}</span>
      <span className="game-header-title">{b.label}</span>
    </div>
  );
};

const StarProgress = ({ solved, total }: { solved: number; total: number }) => (
  <div className="star-progress">
    {Array.from({ length: total }, (_, i) => (
      <Star key={i} size={28}
        fill={i < solved ? '#f59e0b' : 'none'}
        stroke={i < solved ? '#f59e0b' : '#d1d5db'}
        strokeWidth={i < solved ? 0 : 2}
      />
    ))}
  </div>
);

// ============================================================
// GAME COMPONENTS
// ============================================================

const NumberWall = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [wall, setWall] = useState<number[] | null>(null);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [solvedCount, setSolvedCount] = useState(0);

  const generateWall = () => {
    const b1 = Math.floor(Math.random() * 10) + 1;
    const b2 = Math.floor(Math.random() * 10) + 1;
    const b3 = Math.floor(Math.random() * 10) + 1;
    const fullWall = [b1 + b2 + b2 + b3, b1 + b2, b2 + b3, b1, b2, b3];
    const relations: [number, number, number][] = [[0, 1, 2], [1, 3, 4], [2, 4, 5]];
    const isSolvable = (hidden: number[]) => {
      const known = [0, 1, 2, 3, 4, 5].filter(i => !hidden.includes(i));
      let changed = true;
      while (changed) {
        changed = false;
        for (const [s, p1, p2] of relations) {
          const tri = [s, p1, p2];
          if (tri.filter(i => known.includes(i)).length === 2) {
            const m = tri.find(i => !known.includes(i))!;
            if (!known.includes(m)) { known.push(m); changed = true; }
          }
        }
      }
      return known.length === 6;
    };
    let hidden: number[];
    do { hidden = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 3); } while (!isSolvable(hidden));
    setWall(fullWall);
    setInputs(hidden.reduce((acc, idx) => ({ ...acc, [idx]: '' }), {}));
  };

  useEffect(() => generateWall(), []);

  const check = (idx: number, val: string) => {
    const newInputs = { ...inputs, [idx]: val };
    setInputs(newInputs);
    if (parseInt(val) === wall![idx]) {
      playSound('correct');
      if (Object.keys(newInputs).every(k => parseInt(newInputs[+k]) === wall![+k])) {
        setTimeout(() => {
          setSolvedCount(c => c + 1);
          if (solvedCount + 1 >= 3) onWin('🏰');
          else generateWall();
        }, 800);
      }
    }
  };

  if (!wall) return null;
  return (
    <div className="game-page" style={{ background: '#e0f7fa' }}>
      <GameHeader category="zahlen-mauer" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#ff9800', zIndex: 10 } as any}>
        <StarProgress solved={solvedCount} total={3} />
        <div style={{ marginBottom: '20px', fontWeight: 'bold' }}>Zwei Steine unten ergeben den Stein darüber! 🧱</div>
        <div className="wall-grid">
          <div className="wall-row">
            <div className="brick">{inputs[0] !== undefined ? <input type="number" value={inputs[0]} onChange={e => check(0, e.target.value)} className="brick-input" /> : wall[0]}</div>
          </div>
          <div className="wall-row" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-15px' }}>➕</div>
            {[1, 2].map(i => <div key={i} className="brick">{inputs[i] !== undefined ? <input type="number" value={inputs[i]} onChange={e => check(i, e.target.value)} className="brick-input" /> : wall[i]}</div>)}
          </div>
          <div className="wall-row" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-15px', left: '25%' }}>➕</div>
            <div style={{ position: 'absolute', top: '-15px', right: '25%' }}>➕</div>
            {[3, 4, 5].map(i => <div key={i} className="brick">{inputs[i] !== undefined ? <input type="number" value={inputs[i]} onChange={e => check(i, e.target.value)} className="brick-input" /> : wall[i]}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
};

const DifferenceHunt = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [nums, setNums] = useState({ a: 0, b: 0, diff: 0 });
  const [bubbles, setBubbles] = useState<{ id: number; val: number; x: number; y: number; vx: number; vy: number }[]>([]);
  const [solvedCount, setSolvedCount] = useState(0);
  const req = useRef<number | null>(null);

  const spawn = () => {
    const a = Math.floor(Math.random() * 15) + 5;
    const d = Math.floor(Math.random() * 5) + 1;
    const b = Math.random() > 0.5 ? a + d : a - d;
    setNums({ a, b, diff: Math.abs(a - b) });
    const pool = [Math.abs(a - b)];
    while (pool.length < 6) { const v = Math.floor(Math.random() * 15) + 1; if (!pool.includes(v)) pool.push(v); }
    setBubbles(pool.sort(() => Math.random() - 0.5).map(v => ({ id: Math.random(), val: v, x: Math.random() * 80 + 10, y: Math.random() * 60 + 20, vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1 })));
  };
  useEffect(() => spawn(), []);
  const anim = () => { setBubbles(prev => prev.map(b => { let nx = b.x + b.vx, ny = b.y + b.vy, nvx = b.vx, nvy = b.vy; if (nx < 5 || nx > 90) nvx *= -1; if (ny < 15 || ny > 85) nvy *= -1; return { ...b, x: nx, y: ny, vx: nvx, vy: nvy }; })); req.current = requestAnimationFrame(anim); };
  useEffect(() => { req.current = requestAnimationFrame(anim); return () => cancelAnimationFrame(req.current!); }, []);

  return (
    <div className="village lake-landscape" style={{ justifyContent: 'center', paddingTop: '80px' }}>
      <GameHeader category="differenz-jagd" onBack={onBack} />
      <div className="water-waves"></div>
      <div className="textbook-ui" style={{ zIndex: 10 }}>
        <div className="number-box">{nums.a}</div>
        <div className="gap-arrow"><div className="gap-label">Wie viel fehlt?</div><div className="arrow-line"></div></div>
        <div className="number-box">{nums.b}</div>
      </div>
      <div style={{ position: 'relative', width: '100%', height: '45vh', zIndex: 10 }}>
        {bubbles.map(b => (
          <div key={b.id} className="bubble" style={{ left: `${b.x}%`, top: `${b.y}%` }} onClick={() => {
            if (b.val === nums.diff) {
              playSound('correct');
              setSolvedCount(c => c + 1);
              if (solvedCount + 1 >= 3) onWin('🎈');
              else spawn();
            } else { playSound('wrong'); setBubbles(prev => prev.filter(nb => nb.id !== b.id)); }
          }}>{b.val}</div>
        ))}
      </div>
      <div style={{ zIndex: 10 }}><StarProgress solved={solvedCount} total={3} /></div>
    </div>
  );
};

const FactoryGame = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [target, setTarget] = useState(Math.floor(Math.random() * 10) + 10);
  const [grid, setGrid] = useState<({ id: number; val: number } | null)[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [solved, setSolved] = useState(0);
  const fill = (ex: ({ id: number; val: number } | null)[] = []) => { const n = [...ex]; for (let i = 0; i < 25; i++) if (!n[i]) n[i] = { id: Math.random(), val: Math.floor(Math.random() * 9) + 1 }; return n; };
  useEffect(() => setGrid(fill()), []);
  const click = (idx: number) => {
    if (sel.includes(idx)) { setSel(p => p.filter(i => i !== idx)); return; }
    const ns = [...sel, idx]; const sum = ns.reduce((s, i) => s + (grid[i]?.val || 0), 0);
    if (sum === target) {
      playSound('correct');
      const ng = [...grid]; ns.forEach(i => { ng[i] = null; }); setGrid(fill(ng)); setSel([]);
      setSolved(c => c + 1);
      if (solved + 1 >= 5) onWin('⚙️');
      else setTarget(Math.floor(Math.random() * 10) + 10);
    } else if (sum > target) { playSound('wrong'); setSel([]); } else setSel(ns);
  };
  return (
    <div className="game-page" style={{ background: '#1a1a1a' }}>
      <GameHeader category="zahlen-fabrik" onBack={onBack} />
      <div className="factory-terminal">
        <div className="terminal-header"><div className="target-display">ZIEL: {target}</div><div className="current-sum-display">SUMME: {sel.reduce((s, i) => s + (grid[i]?.val || 0), 0)}</div></div>
        <div className="number-grid">{grid.map((n, i) => <div key={n?.id || i} className={`grid-cell ${sel.includes(i) ? 'selected' : ''}`} onClick={() => click(i)}>{n?.val}</div>)}</div>
        <StarProgress solved={solved} total={5} />
      </div>
    </div>
  );
};

const ComparisonGame = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [ops, setOps] = useState<{ q: string; v: number; e: string }[]>([]);
  const [solved, setSolved] = useState(0);
  const animals = ['🐱', '🐶', '🦊', '🦁', '🐼'];
  const gen = () => setOps([0, 1, 2].map(i => { const a = Math.floor(Math.random() * 10) + 1; const b = Math.floor(Math.random() * 10) + 1; return { q: `${a}+${b}`, v: a + b, e: animals[i] }; }));
  useEffect(() => gen(), []);
  const click = (v: number) => {
    if (v === Math.max(...ops.map(o => o.v))) {
      playSound('correct');
      setSolved(c => c + 1);
      if (solved + 1 >= 3) onWin('🏆');
      else gen();
    } else playSound('wrong');
  };
  return (
    <div className="game-page" style={{ background: '#fff9c4' }}>
      <GameHeader category="meister-zelt" onBack={onBack} />
      <div className="game-container">
        <h2>Wer hat das höchste Ergebnis?</h2>
        <div className="comparison-arena">{ops.map((o, i) => <div key={i} className="animal-contestant" onClick={() => click(o.v)}><div className="math-sign">{o.q}</div><div className="contestant-emoji">{o.e}</div></div>)}</div>
        <StarProgress solved={solved} total={3} />
      </div>
    </div>
  );
};

const MultiplicationTafel = ({ grid, onWin, onBack, onMarkCell }: { grid: Record<string, boolean>; onWin: (s: string) => void; onBack: () => void; onMarkCell: (key: string) => void }) => {
  const [solved, setSolved] = useState(0);
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<{ a: number; b: number } | null>(null);
  const nextProblem = (g: Record<string, boolean>) => { const av: { a: number; b: number }[] = []; for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) if (!g[`${a}x${b}`]) av.push({ a, b }); return av.length > 0 ? av[Math.floor(Math.random() * av.length)] : null; };
  useEffect(() => setProblem(nextProblem(grid)), []);
  const check = (val: string) => {
    const n = parseInt(val); if (isNaN(n) || !problem) return;
    if (n === problem.a * problem.b) {
      playSound('correct'); onMarkCell(`${problem.a}x${problem.b}`);
      const ng = { ...grid, [`${problem.a}x${problem.b}`]: true };
      setTimeout(() => {
        setSolved(s => s + 1);
        if (solved + 1 >= 5) onWin('🎨');
        else { setProblem(nextProblem(ng)); setInput(''); }
      }, 600);
    } else if (val.length >= (problem.a * problem.b).toString().length) { playSound('wrong'); setInput(''); }
  };
  const axis = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="game-page" style={{ background: '#fce4ec' }}>
      <GameHeader category="einmaleins-tafel" onBack={onBack} />
      <div className="tafel-layout">
        <div className="tafel-grid">
          <div className="tafel-cell header">×</div>
          {axis.map(x => <div key={`h${x}`} className="tafel-cell header">{x}</div>)}
          {axis.map(y => (<React.Fragment key={`row${y}`}><div className="tafel-cell header">{y}</div>{axis.map(x => (<div key={`${x}x${y}`} className={`tafel-cell ${grid[`${x}x${y}`] ? 'filled' : ''} ${problem?.a === x && problem?.b === y ? 'active' : ''}`}>{grid[`${x}x${y}`] ? x * y : ''}</div>))}</React.Fragment>))}
        </div>
        <div className="game-container tafel-side">
          <h2>Fülle die Tafel! 🎨</h2>
          <div className="task" style={{ fontSize: '4rem' }}>{problem ? `${problem.a} × ${problem.b} = ?` : 'Fertig! 🎉'}</div>
          <input autoFocus className="input-field" type="number" value={input} onChange={e => { setInput(e.target.value); check(e.target.value); }} />
          <StarProgress solved={solved} total={5} />
        </div>
      </div>
    </div>
  );
};

const TauschArena = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [family, setFamily] = useState<{ a: number; b: number; p: number } | null>(null);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState('');
  const [done, setDone] = useState<number[]>([]);
  const [completed, setCompleted] = useState(0);
  const genFamily = () => { const a = Math.floor(Math.random() * 8) + 2; const b = Math.floor(Math.random() * 8) + 2; setFamily({ a, b, p: a * b }); setStep(0); setInput(''); setDone([]); };
  useEffect(() => genFamily(), []);
  const getSteps = (f: { a: number; b: number; p: number }) => [
    { label: `${f.b} × ${f.a} =`, answer: f.p },
    { label: `${f.p} ÷ ${f.a} =`, answer: f.b },
    { label: `${f.p} ÷ ${f.b} =`, answer: f.a },
  ];
  const check = (val: string) => {
    if (!family) return; const n = parseInt(val); if (isNaN(n)) return;
    const steps = getSteps(family);
    if (n === steps[step].answer) {
      playSound('correct'); const nd = [...done, step]; setDone(nd); setInput('');
      setTimeout(() => {
        if (nd.length >= 3) {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('🏠');
          else genFamily();
        } else setStep(s => s + 1);
      }, 600);
    } else if (val.length >= steps[step].answer.toString().length) { playSound('wrong'); setInput(''); }
  };
  if (!family) return null;
  const steps = getSteps(family);
  return (
    <div className="game-page" style={{ background: '#e8f5e9' }}>
      <GameHeader category="tausch-arena" onBack={onBack} />
      <div className="game-container">
        <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Ergänze alle Verwandten!</p>
        <div className="family-card">
          <div className="family-fact given"><span>{family.a} × {family.b} = {family.p}</span><span className="fact-check">✓</span></div>
          {steps.map((s, i) => (
            <div key={i} className={`family-fact ${done.includes(i) ? 'done' : i === step ? 'active-fact' : 'pending'}`}>
              <span>{s.label} {done.includes(i) ? <strong>{s.answer}</strong> : '?'}</span>
              {done.includes(i) && <span className="fact-check">✓</span>}
            </div>
          ))}
        </div>
        <input autoFocus className="input-field" type="number" value={input} onChange={e => { setInput(e.target.value); check(e.target.value); }} style={{ marginTop: '1.5rem' }} />
        <StarProgress solved={completed} total={3} />
      </div>
    </div>
  );
};

// ── Divisions-Spiel: 2 Eingaben pro Aufgabe (Division + denn-Herleitung) ──
const DivisionGame = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [fam, setFam] = useState<{ a: number; b: number; p: number; t: number } | null>(null);
  const [step, setStep] = useState(0);   // 0 = Division eingeben, 1 = denn eingeben
  const [input, setInput] = useState('');
  const [divSolved, setDivSolved] = useState(false);
  const [completed, setCompleted] = useState(0);

  const gen = () => {
    const a = Math.floor(Math.random() * 9) + 2;          // Teiler 2–10
    const b = Math.floor(Math.random() * 10) + 1;         // Ergebnis 1–10
    const t = Math.floor(Math.random() * 3);               // Aufgabentyp
    setFam({ a, b, p: a * b, t });
    setStep(0); setInput(''); setDivSolved(false);
  };
  useEffect(() => gen(), []);
  if (!fam) return null;

  const { a, b, p, t } = fam;

  // Division-Zeile: Frage und Antwort
  const divQ      = t === 0 ? `${p} : ${a} = ?`  : t === 1 ? `${p} : ? = ${b}` : `? : ${a} = ${b}`;
  const divFilled = `${p} : ${a} = ${b}`;          // nach Eingabe: vollständige Gleichung
  const divAns    = t === 0 ? b : t === 1 ? a : p;

  // denn-Zeile: Frage und Antwort (dieselbe fehlende Zahl)
  const dennQ   = t === 0 ? `denn  ? × ${a} = ${p}` : t === 1 ? `denn  ${b} × ? = ${p}` : `denn  ${b} × ${a} = ?`;
  const dennAns = divAns;

  const check = (val: string) => {
    const n = parseInt(val); if (isNaN(n)) return;
    const expected = step === 0 ? divAns : dennAns;
    if (n === expected) {
      playSound('correct'); setInput('');
      if (step === 0) {
        setDivSolved(true);
        setTimeout(() => setStep(1), 500);
      } else {
        setTimeout(() => {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('➗');
          else gen();
        }, 600);
      }
    } else if (val.length >= expected.toString().length) {
      playSound('wrong'); setInput('');
    }
  };

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #1e88e528 0%, #f5f8ff 100%)' }}>
      <GameHeader category="division" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#1e88e5' } as any}>
        <StarProgress solved={completed} total={3} />

        <div className="division-denn">
          {/* Zeile 1: Division */}
          <div className={`div-question ${divSolved ? 'div-line-done' : 'div-line-active'}`}>
            {divSolved ? divFilled : divQ}
            {divSolved && <span className="div-check">✓</span>}
          </div>

          {/* Zeile 2: denn — erscheint erst nach Schritt 1 */}
          {(divSolved || step === 1) && (
            <div className={`div-denn ${step === 1 ? 'div-line-active' : ''}`}>
              {dennQ}
            </div>
          )}
        </div>

        <input
          key={step}       /* remount → autoFocus beim Step-Wechsel */
          autoFocus
          className="input-field"
          type="number"
          value={input}
          onChange={e => { setInput(e.target.value); check(e.target.value); }}
        />

        <p className="div-hint">
          {step === 0 ? '➗ Trage die fehlende Zahl ein' : '× Jetzt die Herleitung ergänzen'}
        </p>
      </div>
    </div>
  );
};

// ── Halbschriftliche Division: Zerlegen in Zehner-Portion + Rest ──
// Zerlegt wird nicht stur bei der Zehnerstelle, sondern so, dass beide Teile ohne
// Rest aufgehen: 91 = 70 + 21 → 10 + 3 = 13. Bei glatten Aufgaben ist das genau
// die Zehner/Einer-Zerlegung (84 = 80 + 4), sonst deutlich mehr Aufgaben-Vielfalt.
interface ZerlegeTask {
  n: number; d: number;     // Aufgabe: n : d
  p1: number; p2: number;   // die beiden Teil-Dividenden (70 / 21)
  a1: number; a2: number;   // die beiden Teil-Ergebnisse  (10 /  3)
}

const ZERLEGE_TASKS: ZerlegeTask[] = (() => {
  const list: ZerlegeTask[] = [];
  // Teiler 8 und 9 bleiben draußen: bei 2-stelligen Dividenden gibt es dafür nur
  // ein bis zwei saubere Zerlegungen — die würden sich ständig wiederholen.
  for (let d = 2; d <= 7; d++) {
    for (let q = 11; q * d <= 99; q++) {
      if (q % 10 === 0) continue;      // sonst wäre die zweite Zeile 0 : d = 0
      const a1 = Math.floor(q / 10) * 10, a2 = q % 10;
      list.push({ n: d * q, d, p1: d * a1, p2: d * a2, a1, a2 });
    }
  }
  return list;
})();

const ZerlegeDivision = ({ onWin, onBack }: { onWin: (s: string) => void; onBack: () => void }) => {
  const [task, setTask] = useState<ZerlegeTask | null>(null);
  const lastIdx = useRef(-1);
  const [vals, setVals] = useState(['', '']);
  const [done, setDone] = useState([false, false]);
  const [wrong, setWrong] = useState([false, false]);
  const [completed, setCompleted] = useState(0);
  const advancing = useRef(false);       // blockt Tippen während der Pause zur nächsten Aufgabe
  const ref0 = useRef<HTMLInputElement>(null);
  const ref1 = useRef<HTMLInputElement>(null);
  const refs = [ref0, ref1];

  const gen = () => {
    let idx = lastIdx.current;
    while (idx === lastIdx.current) idx = Math.floor(Math.random() * ZERLEGE_TASKS.length);
    lastIdx.current = idx;
    setTask(ZERLEGE_TASKS[idx]);
    setVals(['', '']); setDone([false, false]); setWrong([false, false]);
    advancing.current = false;
    setTimeout(() => ref0.current?.focus(), 0);
  };
  useEffect(() => gen(), []);
  if (!task) return null;

  const { n, d, p1, p2 } = task;
  const answers = [task.a1, task.a2];
  const allDone = done[0] && done[1];

  const type = (i: number, val: string) => {
    if (done[i] || advancing.current) return;
    setVals(v => v.map((x, k) => (k === i ? val : x)));

    const num = parseInt(val); if (isNaN(num)) return;

    if (num === answers[i]) {
      playSound('correct');
      const nd = done.map((x, k) => (k === i ? true : x));
      setDone(nd);
      if (nd[0] && nd[1]) {
        advancing.current = true;
        setTimeout(() => {
          setCompleted(c => c + 1);
          if (completed + 1 >= 3) onWin('🧩');
          else gen();
        }, 1400);                              // Zeit, das Ergebnis oben zu sehen
      } else {
        setTimeout(() => refs[1 - i].current?.focus(), 0);
      }
    } else if (val.length >= answers[i].toString().length) {
      // Falsches erst stehen lassen, dann in einem eigenen Tick löschen — ein Reset
      // im selben Event würde von React verschluckt (gleicher Wert wie zuvor).
      playSound('wrong');
      setWrong(w => w.map((x, k) => (k === i ? true : x)));
      setTimeout(() => {
        setVals(v => v.map((x, k) => (k === i ? '' : x)));
        setWrong(w => w.map((x, k) => (k === i ? false : x)));
        refs[i].current?.focus();
      }, 450);
    }
  };

  const row = (i: number, left: number) => (
    <div className={`zl-row ${done[i] ? 'done' : wrong[i] ? 'wrong' : 'active'}`}>
      <span className="zl-calc">{left} : {d} =</span>
      <input
        ref={refs[i]}
        className="zl-input"
        type="number"
        value={vals[i]}
        readOnly={done[i]}
        onChange={e => type(i, e.target.value)}
      />
      {done[i] && <span className="zl-check">✓</span>}
    </div>
  );

  return (
    <div className="game-page" style={{ background: 'linear-gradient(160deg, #00897b28 0%, #f5fffd 100%)' }}>
      <GameHeader category="division-zerlegen" onBack={onBack} />
      <div className="game-container" style={{ '--house-color': '#00897b' } as any}>
        <StarProgress solved={completed} total={3} />

        <div className={`zl-task ${allDone ? 'solved' : ''}`}>
          {n} : {d} = <span className="zl-result">{allDone ? answers[0] + answers[1] : '?'}</span>
        </div>
        <div className="zl-split">Zerlege: {n} = <b>{p1}</b> + <b>{p2}</b></div>

        <div className="zl-rows">
          {row(0, p1)}
          {row(1, p2)}
          <div className={`zl-sum ${allDone ? 'shown' : ''}`}>
            {allDone ? `${answers[0]} + ${answers[1]} = ${answers[0] + answers[1]}` : ' '}
          </div>
        </div>

        <p className="div-hint">
          {allDone
            ? '🎉 Beide Teile stimmen — zusammen ergibt das die Lösung!'
            : `🧩 Teile ${p1} und ${p2} einzeln durch ${d}`}
        </p>
      </div>
    </div>
  );
};

const MathGame = ({ category, performance, onAttempt, onWin, onBack }: { category: Category; performance: PerformanceData; onAttempt: (k: string, c: boolean) => void; onWin: (s: string) => void; onBack: () => void }) => {
  const [problem, setProblem] = useState(generateProblem(category, performance));
  const [input, setInput] = useState('');
  const [solved, setSolved] = useState(0);
  const total = (category === 'sachaufgaben' || category === 'platzhalter') ? 3 : 5;
  const building = BUILDINGS.find(b => b.category === category)!;
  const check = (val: string) => {
    const n = parseInt(val); if (isNaN(n)) return;
    if (n === problem.answer) {
      playSound('correct'); onAttempt(problem.key, true);
      setTimeout(() => {
        setSolved(c => c + 1);
        if (solved + 1 >= total) onWin(STICKERS[Math.floor(Math.random() * STICKERS.length)]);
        else { setProblem(generateProblem(category, performance)); setInput(''); }
      }, 600);
    } else if (val.length >= problem.answer.toString().length) { playSound('wrong'); onAttempt(problem.key, false); setInput(''); }
  };
  return (
    <div className="game-page" style={{ background: `linear-gradient(160deg, ${building.color}28 0%, #f5f8ff 100%)` }}>
      <GameHeader category={category} onBack={onBack} />
      <div className="game-container" style={{ '--house-color': building.color, maxWidth: problem.type === 'story' ? '800px' : '600px' } as any}>
        <StarProgress solved={solved} total={total} />
        {problem.type === 'story'
          ? <div className="story-box">{(problem.question as string[]).map((l: string, i: number) => <p key={i}>{l}</p>)}</div>
          : problem.type === 'division-denn'
            ? <div className="division-denn">
                <div className="div-question">{problem.question}</div>
                <div className="div-denn">denn&nbsp;&nbsp;{problem.denn}</div>
              </div>
            : <div className="task">{problem.question}{problem.type !== 'placeholder' && ' = ?'}</div>
        }
        <input autoFocus className="input-field" type="number" value={input} onChange={e => { setInput(e.target.value); check(e.target.value); }} />
      </div>
    </div>
  );
};

// ============================================================
// APP
// ============================================================
export default function App() {
  const [state, setState] = useState<{
    category: Category | null;
    stickers: Record<Category, string[]>;
    performance: PerformanceData;
    multiplicationGrid: Record<string, boolean>;
  }>(() => {
    const saved = localStorage.getItem('mathemagic-save');
    const defaults = { category: null, stickers: DEFAULT_STICKERS, performance: {}, multiplicationGrid: {} };
    if (!saved) return defaults;
    try { const p = JSON.parse(saved); return { ...defaults, ...p, stickers: { ...DEFAULT_STICKERS, ...(p.stickers || {}) } }; }
    catch { return defaults; }
  });

  const [pendingWin, setPendingWin] = useState<{ sticker: string; category: Category } | null>(null);

  const totalStickers = Object.values(state.stickers).flat().length;
  const currentTier = [...ANIMAL_TIERS].reverse().find(t => totalStickers >= t.threshold);

  useEffect(() => {
    const { category, ...toSave } = state;
    localStorage.setItem('mathemagic-save', JSON.stringify(toSave));
  }, [state]);

  const setCategory = (cat: Category | null) => setState(p => ({ ...p, category: cat }));
  const onBack = () => setCategory(null);
  const onAttempt = (key: string, correct: boolean) => setState(p => ({ ...p, performance: { ...p.performance, [key]: Math.max(1, (p.performance[key] || 10) + (correct ? -2 : 10)) } }));
  const onWin = (sticker: string) => {
    if (!state.category) return;
    setPendingWin({ sticker, category: state.category });
  };
  const saveWin = () => {
    if (!pendingWin) return;
    setState(p => ({ ...p, category: null, stickers: { ...p.stickers, [pendingWin.category]: [...(p.stickers[pendingWin.category] || []), pendingWin.sticker] } }));
    setPendingWin(null);
  };
  const onMarkCell = (key: string) => setState(p => ({ ...p, multiplicationGrid: { ...p.multiplicationGrid, [key]: true } }));
  const reset = () => { if (window.confirm('Spielstand wirklich zurücksetzen?')) { setState({ category: null, stickers: DEFAULT_STICKERS, performance: {}, multiplicationGrid: {} }); localStorage.removeItem('mathemagic-save'); } };

  // ── Win screen ──
  if (pendingWin) {
    const b = BUILDINGS.find(b => b.category === pendingWin.category)!;
    return (
      <div className="win-screen" style={{ background: `linear-gradient(135deg, ${b.color}66 0%, ${b.roofColor}44 100%)` }}>
        <div className="win-card">
          <div className="win-sticker">{pendingWin.sticker}</div>
          <h2 className="win-title">Super gemacht! 🎉</h2>
          <p className="win-subtitle">{b.icon} {b.label}</p>
          <button className="win-btn" onClick={saveWin}>Zur Karte →</button>
        </div>
      </div>
    );
  }

  // ── Game routing ──
  if (state.category === 'division')          return <DivisionGame onWin={onWin} onBack={onBack} />;
  if (state.category === 'division-zerlegen') return <ZerlegeDivision onWin={onWin} onBack={onBack} />;
  if (state.category === 'zahlen-fabrik')    return <FactoryGame onWin={onWin} onBack={onBack} />;
  if (state.category === 'meister-zelt')     return <ComparisonGame onWin={onWin} onBack={onBack} />;
  if (state.category === 'zahlen-mauer')     return <NumberWall onWin={onWin} onBack={onBack} />;
  if (state.category === 'differenz-jagd')   return <DifferenceHunt onWin={onWin} onBack={onBack} />;
  if (state.category === 'einmaleins-tafel') return <MultiplicationTafel grid={state.multiplicationGrid} onWin={onWin} onBack={onBack} onMarkCell={onMarkCell} />;
  if (state.category === 'tausch-arena')     return <TauschArena onWin={onWin} onBack={onBack} />;
  if (state.category)                        return <MathGame category={state.category} performance={state.performance} onAttempt={onAttempt} onWin={onWin} onBack={onBack} />;

  // ── MAP SCREEN ──
  return (
    <div className="map-screen">
      {/* floating clouds */}
      <div className="cloud map-cloud" style={{ top: '4%',  width: '140px', height: '55px', animationDelay: '0s'   }} />
      <div className="cloud map-cloud" style={{ top: '10%', width: '95px',  height: '38px', animationDelay: '-7s'  }} />
      <div className="cloud map-cloud" style={{ top: '6%',  width: '110px', height: '44px', animationDelay: '-14s' }} />

      {/* header */}
      <div className="map-header">
        <h1 className="village-title" style={{ margin: 0, fontSize: '2.2rem', padding: '8px 32px' }}>
          Mathe-Dorf 🏘️
        </h1>
        <div className="map-score-pill">
          {currentTier ? currentTier.emoji : '🐣'}&nbsp;
          <Star size={14} fill="#f59e0b" stroke="none" style={{ verticalAlign: 'middle' }} />
          &nbsp;{totalStickers} Sticker
        </div>
      </div>

      {/* map */}
      <div className="map-viewport">
        <MapTerrain />

        {/* CSS trees */}
        {TREES.map((t, i) => (
          <div key={i} className={`map-tree${t.big ? ' big' : ''}`} style={{ left: t.left, top: t.top }} />
        ))}

        {/* zone signs */}
        {ZONE_SIGNS.map(z => (
          <div key={z.label} className="map-zone-sign" style={{ left: z.left, top: z.top }}>
            {z.label}
          </div>
        ))}

        {/* buildings */}
        {BUILDINGS.map(b => (
          <MapBuilding
            key={b.category}
            label={b.label}
            icon={b.icon}
            color={b.color}
            roofColor={b.roofColor}
            stickers={state.stickers[b.category] || []}
            left={b.left}
            top={b.top}
            onClick={() => setCategory(b.category)}
          />
        ))}

        {/* animal residents — unlock one per tier reached */}
        {ANIMAL_SPOTS.map(spot => {
          const unlocked = totalStickers >= spot.threshold;
          const isCurrent = currentTier?.emoji === spot.emoji;
          return (
            <div
              key={spot.emoji}
              className={`map-animal ${unlocked ? (isCurrent ? 'current' : 'unlocked') : 'locked'}`}
              style={{ left: spot.left, top: spot.top }}
              title={unlocked ? spot.emoji : `🔒 ${spot.threshold} Sticker zum Freischalten`}
            >
              {spot.emoji}
            </div>
          );
        })}

        {/* running animal along the main road */}
        <div className="map-runner">
          <span>{currentTier ? currentTier.emoji : '🐣'}</span>
        </div>
      </div>

      <button className="reset-btn" onClick={reset}><Trash2 size={14} /> Reset</button>
    </div>
  );
}
