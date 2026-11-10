import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ANCHOR_X, ANCHOR_Y, HALF_H, HALF_W, LIFT, TILE_H, TILE_W, project, tileUrl } from './tiles';

export interface Piece { tile: string; c: number; r: number; z: number; }

// Rechnet einen Gitterpunkt in Pixel innerhalb des Szenen-Rahmens um — fuer
// Schilder und Klickflaechen, die ueber der Szene liegen.
export type Place = (c: number, r: number, z: number) => { left: number; top: number; scale: number };

interface Props {
  pieces: Piece[];
  // Groesster Zoom. Ohne Grenze wird eine kleine Insel auf dem Tablet riesig.
  maxScale?: number;
  className?: string;
  overlay?: (place: Place) => React.ReactNode;
  onClick?: () => void;
  // Meldet den Tipp; `at(z)` rechnet ihn in das Gitterfeld auf Hoehe z um —
  // so kann jede Stadt auf ihrer eigenen Hoehe geprueft werden.
  onPick?: (at: (z: number) => [number, number]) => void;
  // Grosse Szenen (die Landkarte hat ueber 3000 Kacheln) werden einmal in ein
  // <canvas> gezeichnet statt als einzelne Bilder — sonst ruckeln aeltere Tablets.
  canvas?: boolean;
}

// Jedes Kachelbild wird nur einmal geladen und dann fuer alle Szenen benutzt.
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (url: string) => {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
};

// Zeichnet die Kacheln von hinten nach vorn und skaliert die ganze Szene so,
// dass sie in den Rahmen passt. Schilder liegen in einer eigenen, nicht
// skalierten Ebene — sonst wuerde ihre Schrift auf dem Handy unlesbar klein.
export const IsoScene = ({ pieces, maxScale = 0.6, className = '', overlay, onClick, onPick, canvas = false }: Props) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { sorted, bounds } = useMemo(() => {
    // Weiter hinten (kleineres c+r) zuerst, auf gleicher Hoehe von unten nach oben.
    const sorted = [...pieces].sort((a, b) => (a.c + a.r) - (b.c + b.r) || a.z - b.z || a.c - b.c);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of sorted) {
      const { x, y } = project(p.c, p.r, p.z);
      // Nur der sichtbare Teil der Kachel zaehlt: die Bilder haben oben ~115 px
      // und seitlich ~12 px leeren Rand.
      x0 = Math.min(x0, x - ANCHOR_X + 12); x1 = Math.max(x1, x - ANCHOR_X + TILE_W - 12);
      y0 = Math.min(y0, y - ANCHOR_Y + 110); y1 = Math.max(y1, y - ANCHOR_Y + TILE_H - 4);
    }
    return { sorted, bounds: { x0, y0, w: x1 - x0, h: y1 - y0 } };
  }, [pieces]);

  const scale = box.w && box.h ? Math.min(box.w / bounds.w, box.h / bounds.h, maxScale) : 0;
  const offX = (box.w - bounds.w * scale) / 2;
  const offY = (box.h - bounds.h * scale) / 2;

  const place: Place = (c, r, z) => {
    const { x, y } = project(c, r, z);
    return { left: offX + (x - bounds.x0) * scale, top: offY + (y - bounds.y0) * scale, scale };
  };

  // ── Canvas: neu zeichnen, wenn sich Kacheln oder Groesse aendern ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!canvas || !scale) return;
    let cancelled = false;
    const urls = [...new Set(sorted.map(p => tileUrl(p.tile)))];
    Promise.all(urls.map(loadImage)).then(imgs => {
      const el = canvasRef.current;
      if (cancelled || !el) return;
      const byUrl = new Map(urls.map((u, i) => [u, imgs[i]]));
      // Schaerfe passend zum Bildschirm, aber hoechstens ~8 Mio. Pixel Speicher.
      const w = bounds.w * scale, h = bounds.h * scale;
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8e6 / (w * h)));
      el.width = Math.round(w * ratio);
      el.height = Math.round(h * ratio);
      const ctx = el.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      for (const p of sorted) {
        const { x, y } = project(p.c, p.r, p.z);
        ctx.drawImage(byUrl.get(tileUrl(p.tile))!, x - ANCHOR_X - bounds.x0, y - ANCHOR_Y - bounds.y0);
      }
      setDrawn(true);
    });
    return () => { cancelled = true; };
  }, [canvas, sorted, bounds, scale]);

  // Umkehrung von `project`.
  const pick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.();
    if (!onPick || !scale) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - offX) / scale + bounds.x0;
    const y0 = (e.clientY - rect.top - offY) / scale + bounds.y0;
    onPick(z => {
      const a = x / HALF_W, b = (y0 + z * LIFT) / HALF_H;   // a = c − r, b = c + r
      return [Math.round((a + b) / 2), Math.round((b - a) / 2)];
    });
  };

  return (
    <div ref={boxRef} className={`iso-scene ${className}`} onClick={pick}>
      {scale > 0 && (
        <>
          {canvas ? (
            <canvas
              ref={canvasRef}
              className={`iso-canvas ${drawn ? 'ready' : ''}`}
              style={{ left: offX, top: offY, width: bounds.w * scale, height: bounds.h * scale }}
            />
          ) : (
          <div
            className="iso-world"
            style={{ width: bounds.w, height: bounds.h, transform: `translate(${offX}px, ${offY}px) scale(${scale})` }}
          >
            {sorted.map((p, i) => {
              const { x, y } = project(p.c, p.r, p.z);
              return (
                <img
                  key={i}
                  src={tileUrl(p.tile)}
                  alt=""
                  draggable={false}
                  style={{ left: x - ANCHOR_X - bounds.x0, top: y - ANCHOR_Y - bounds.y0 }}
                />
              );
            })}
          </div>
          )}
          {overlay && <div className="iso-overlay">{overlay(place)}</div>}
        </>
      )}
    </div>
  );
};
