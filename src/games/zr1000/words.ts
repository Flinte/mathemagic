// Zahlwoerter bis 1000, so wie sie in der Grundschule geschrieben werden:
// klein und zusammen ("dreihundertvierundzwanzig").

const ONES = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const TEENS = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

const below100 = (n: number): string => {
  if (n === 0) return '';
  if (n === 1) return 'eins';          // am Ende: "hunderteins", nicht "hundertein"
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  return o === 0 ? TENS[t] : `${ONES[o]}und${TENS[t]}`;
};

export const numberWord = (n: number): string => {
  if (n === 0) return 'null';
  if (n === 1000) return 'eintausend';
  const h = Math.floor(n / 100);
  return (h > 0 ? `${ONES[h]}hundert` : '') + below100(n % 100);
};
