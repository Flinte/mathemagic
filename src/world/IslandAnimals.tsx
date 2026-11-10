import type { Place } from '../iso/IsoScene';
import type { TownId } from './towns';
import { ANIMALS } from './islands';

// Die freigespielten Tiere, die auf dieser Insel wohnen.
export const IslandAnimals = ({ place, town, stickers }: { place: Place; town: TownId; stickers: number }) => (
  <>
    {ANIMALS.filter(a => a.town === town && stickers >= a.threshold).map(a => {
      const { left, top, scale } = place(a.c, a.r, 0);
      return (
        <span key={a.emoji} className="iso-animal" style={{ left, top, fontSize: Math.max(16, 150 * scale) }}>
          {a.emoji}
        </span>
      );
    })}
  </>
);
