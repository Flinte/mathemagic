import { useEffect, useState } from 'react';
import { GAMES, isPlayable, type Category } from './games';
import { TOWNS, townOf, type TownId } from './towns';

// Jede Ansicht hat eine eigene Adresse (#/dorf/mal, #/spiel/plus, …). Dadurch
// fuehrt die Zurueck-Taste von Handy und Browser eine Ebene hoeher statt aus
// dem Spiel hinaus, und ein Neuladen bleibt, wo man war.
export type Route =
  | { screen: 'world' }
  | { screen: 'school' }
  | { screen: 'town'; town: TownId }
  | { screen: 'game'; game: Category };

const toHash = (r: Route) =>
  r.screen === 'world' ? '#/'
  : r.screen === 'school' ? '#/schule'
  : r.screen === 'town' ? `#/dorf/${r.town}`
  : `#/spiel/${r.game}`;

const parse = (hash: string): Route => {
  const [kind, id] = hash.replace(/^#\/?/, '').split('/');
  if (kind === 'schule') return { screen: 'school' };
  if (kind === 'dorf' && TOWNS.some(t => t.id === id)) return { screen: 'town', town: id as TownId };
  if (kind === 'spiel' && id in GAMES && isPlayable(id as Category)) return { screen: 'game', game: id as Category };
  return { screen: 'world' };
};

// Wohin "zurueck" fuehrt, wenn es keinen eigenen Verlauf gibt — etwa nach dem
// Oeffnen eines Lesezeichens direkt auf ein Spiel.
const parentOf = (r: Route): Route => {
  if (r.screen === 'game') {
    const town = townOf(r.game);
    return town ? { screen: 'town', town: town.id } : { screen: 'world' };
  }
  return { screen: 'world' };
};

// Wie tief man innerhalb der App navigiert hat. Steht im History-Eintrag, damit
// "zurueck" nur dann history.back() nutzt, wenn davor auch eine App-Seite liegt.
const depth = (): number => (window.history.state as { depth?: number } | null)?.depth ?? 0;

export const useRoute = () => {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.hash));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = (r: Route) => {
    window.history.pushState({ depth: depth() + 1 }, '', toHash(r));
    setRoute(r);
  };

  const back = () => {
    if (depth() > 0) { window.history.back(); return; }
    const p = parentOf(route);
    window.history.replaceState({ depth: 0 }, '', toHash(p));
    setRoute(p);
  };

  return { route, go, back };
};
