import type { ReactNode } from 'react';

// Der Klassen-Panda und die "Lehrerinnen-Korrektur" — nachgezeichnet nach den
// Arbeitsblaettern: lila Haekchen und ein gemalter Panda mit "Super!".

const INK = '#9333ea';   // lila Korrekturstift

export const PandaFace = ({ size = 48 }: { size?: number }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="panda-face">
    <circle cx="22" cy="24" r="14" fill="#1f2937" />
    <circle cx="78" cy="24" r="14" fill="#1f2937" />
    <circle cx="50" cy="56" r="38" fill="#fff" stroke="#1f2937" strokeWidth="3" />
    <ellipse cx="34" cy="51" rx="10" ry="13" fill="#1f2937" transform="rotate(-25 34 51)" />
    <ellipse cx="66" cy="51" rx="10" ry="13" fill="#1f2937" transform="rotate(25 66 51)" />
    <circle cx="36" cy="49" r="4" fill="#fff" />
    <circle cx="64" cy="49" r="4" fill="#fff" />
    <ellipse cx="50" cy="66" rx="7" ry="5" fill="#1f2937" />
    <path d="M42 76 q8 7 16 0" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

// Wie der Stempel auf dem Blatt: Panda und ein handschriftliches Wort, leicht schief.
export const PandaStamp = ({ text }: { text: string }) => (
  <div className="panda-stamp">
    <PandaFace size={58} />
    <span>{text}</span>
  </div>
);

export const TeacherCheck = ({ size = 34 }: { size?: number }) => (
  <svg className="teacher-mark" viewBox="0 0 40 32" width={size} height={size * 0.8} aria-label="richtig">
    <path d="M4 17 C8 19 11 23 14 28 C20 16 28 8 37 3" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export const TeacherCross = ({ size = 30 }: { size?: number }) => (
  <svg className="teacher-mark" viewBox="0 0 32 32" width={size} height={size} aria-label="falsch">
    <path d="M6 6 L26 26 M26 6 L6 26" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
  </svg>
);

// Tipp als Sprechblase vom Panda
export const PandaTip = ({ children }: { children: ReactNode }) => (
  <div className="panda-tip">
    <PandaFace size={44} />
    <div className="panda-bubble">{children}</div>
  </div>
);
