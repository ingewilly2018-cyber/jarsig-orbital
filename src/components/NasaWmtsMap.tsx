import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { CountryFootprint } from "@/lib/country-footprints";

type LunarPoint = { latitude: number; longitude: number };
type MapTile = { key: string; url: string; left: number; top: number };

const TILE_SIZE = 256;
const TILE_BASE = "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm";

function wrapLongitude(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function toWorld(point: LunarPoint, zoom: number) {
  const scale = 2 ** zoom;
  return {
    x: ((wrapLongitude(point.longitude) + 180) / 360) * TILE_SIZE * 2 * scale,
    y: ((90 - Math.max(-90, Math.min(90, point.latitude))) / 180) * TILE_SIZE * scale,
  };
}

function fromWorld(x: number, y: number, zoom: number): LunarPoint {
  const scale = 2 ** zoom;
  return {
    latitude: Math.max(-90, Math.min(90, 90 - (y / (TILE_SIZE * scale)) * 180)),
    longitude: wrapLongitude((x / (TILE_SIZE * 2 * scale)) * 360 - 180),
  };
}

function smoothClosedPath(points: { x: number; y: number }[]) {
  if (points.length < 3) return "";
  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = midpoint(points[points.length - 1]!, points[0]!);
  return `M ${start.x} ${start.y} ${points.map((point, index) => {
    const next = midpoint(point, points[(index + 1) % points.length]!);
    return `Q ${point.x} ${point.y} ${next.x} ${next.y}`;
  }).join(" ")} Z`;
}

export function NasaWmtsMap({
  selectedPoint,
  onSelect,
  focusKey,
  footprint = { rings: [], enclosure: [] },
  mapHeightClass = "h-[55svh] min-h-[20rem] sm:h-[28rem]",
  showInstructions = true,
}: {
  selectedPoint: LunarPoint;
  onSelect: (point: LunarPoint) => void;
  focusKey?: string;
  footprint?: CountryFootprint;
  mapHeightClass?: string;
  showInstructions?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [center, setCenter] = useState<LunarPoint>({ latitude: -85, longitude: 0 });
  const [zoom, setZoom] = useState(4);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!focusKey) return;
    setCenter(selectedPoint);
  }, [focusKey]);

  const centerWorld = toWorld(center, zoom);
  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [] as MapTile[];
    const scale = 2 ** zoom;
    const columns = 2 * scale;
    const rows = scale;
    const minCol = Math.floor((centerWorld.x - size.width / 2) / TILE_SIZE) - 1;
    const maxCol = Math.floor((centerWorld.x + size.width / 2) / TILE_SIZE) + 1;
    const minRow = Math.max(0, Math.floor((centerWorld.y - size.height / 2) / TILE_SIZE) - 1);
    const maxRow = Math.min(rows - 1, Math.floor((centerWorld.y + size.height / 2) / TILE_SIZE) + 1);
    const visible: MapTile[] = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const wrappedCol = ((col % columns) + columns) % columns;
        visible.push({
          key: `${zoom}-${row}-${col}`,
          url: `${TILE_BASE}/${zoom}/${row}/${wrappedCol}.jpg`,
          left: col * TILE_SIZE - centerWorld.x + size.width / 2,
          top: row * TILE_SIZE - centerWorld.y + size.height / 2,
        });
      }
    }
    return visible;
  }, [centerWorld.x, centerWorld.y, size.height, size.width, zoom]);

  const selectedWorld = toWorld(selectedPoint, zoom);
  const selectedDx = selectedWorld.x - centerWorld.x;
  const worldWidth = TILE_SIZE * 2 * 2 ** zoom;
  const wrappedDx = selectedDx > worldWidth / 2 ? selectedDx - worldWidth : selectedDx < -worldWidth / 2 ? selectedDx + worldWidth : selectedDx;

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, centerX: centerWorld.x, centerY: centerWorld.y, moved: false };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) active.moved = true;
    if (active.moved) setCenter(fromWorld(active.centerX - dx, active.centerY - dy, zoom));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (!active.moved && size.width && size.height) {
      const localX = event.clientX - event.currentTarget.getBoundingClientRect().left;
      const localY = event.clientY - event.currentTarget.getBoundingClientRect().top;
      onSelect(fromWorld(centerWorld.x + localX - size.width / 2, centerWorld.y + localY - size.height / 2, zoom));
    } else if (active.moved) {
      setCenter(fromWorld(active.centerX - dx, active.centerY - dy, zoom));
    }
    drag.current = null;
  }

  function zoomAtPointer(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((value) => Math.max(1, Math.min(15, value + (event.deltaY < 0 ? 1 : -1))));
  }

  return (
    <section aria-label="NASA LRO lunar surface map" className={mapHeightClass === "h-full" ? "h-full" : undefined}>
      <div
        ref={container}
        className={`relative ${mapHeightClass} w-full touch-none select-none overflow-hidden border border-border bg-[#09090b] ${drag.current?.moved ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={zoomAtPointer}
        role="application"
        aria-label="Drag to pan, scroll to zoom, and click to choose lunar coordinates"
      >
        {tiles.map((tile) => (
          <img key={tile.key} src={tile.url} alt="" draggable={false} onError={() => setTileError(true)} className="pointer-events-none absolute h-64 w-64 max-w-none" style={{ left: tile.left, top: tile.top }} />
        ))}
        {size.width > 0 && size.height > 0 && <svg aria-label="Yellow outline of the selected country placed on the Moon" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-hidden" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none">
          <path d={footprint.enclosure.length ? smoothClosedPath(footprint.enclosure.map((point) => {
            const world = toWorld(point, zoom);
            return { x: size.width / 2 + world.x - centerWorld.x, y: size.height / 2 + world.y - centerWorld.y };
          })) : ""} fill="none" stroke="rgba(255,213,45,.55)" strokeWidth="1.25" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          <path d={footprint.rings.map((ring) => {
            let previousX: number | null = null;
            const points = ring.map((point) => {
              const world = toWorld(point, zoom);
              let x = size.width / 2 + world.x - centerWorld.x;
              if (previousX !== null) {
                while (x - previousX > worldWidth / 2) x -= worldWidth;
                while (previousX - x > worldWidth / 2) x += worldWidth;
              }
              previousX = x;
              return { x, y: size.height / 2 + world.y - centerWorld.y };
            });
            return smoothClosedPath(points);
          }).join(" ")} fill="rgba(255,213,45,.15)" fillRule="evenodd" stroke="#ffd52d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>}
        {selectedDx > -size.width / 2 && selectedDx < size.width / 2 && (() => {
          const dy = selectedWorld.y - centerWorld.y;
          return dy > -size.height / 2 && dy < size.height / 2 ? <div aria-hidden className="pointer-events-none absolute z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-glow shadow-[0_0_16px_rgba(255,255,255,0.9)]" style={{ left: size.width / 2 + wrappedDx, top: size.height / 2 + dy }} /> : null;
        })()}
        <div className="absolute right-3 top-3 z-20 flex flex-col border border-white/30 bg-black/75 text-white">
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((value) => Math.min(15, value + 1))} aria-label="Zoom in" className="px-3 py-2 text-lg leading-none hover:bg-white/15">+</button>
          <span className="border-y border-white/20 px-3 py-1 text-center text-[10px]">{zoom}×</span>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((value) => Math.max(1, value - 1))} aria-label="Zoom out" className="px-3 py-2 text-lg leading-none hover:bg-white/15">−</button>
        </div>
        {tileError && <p className="absolute bottom-3 left-3 z-20 max-w-[75%] border border-white/20 bg-black/90 px-3 py-2 text-xs text-white">Some NASA map tiles did not load. <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer" className="underline underline-offset-2">Open NASA Moon Trek in a new tab</a>.</p>}
        <p className="absolute bottom-3 right-3 z-20 bg-black/75 px-3 py-2 text-[10px] text-white">NASA / JPL · LRO WAC mosaic</p>
      </div>
      {showInstructions && <p className="mt-2 text-xs text-muted-foreground">Drag to pan · Scroll or use +/− to zoom · Click the map to set the latitude and longitude</p>}
    </section>
  );
}
