import { useEffect, useRef, useState } from 'react';
import { Map, Marker, type CanvasSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, checked, decodeGrid, message } from '@/lib/api';
import type { Plane } from '@/lib/model';
import { gridCorners, type Nowcast } from '@/lib/sky';

export function cloudPixels({ nx, ny, data }: Plane) {
  const pixels = new Uint8ClampedArray(nx * ny * 4);
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const k = (y * nx + x) * 4;
      const cover = data[(ny - 1 - y) * nx + x];
      pixels[k] = pixels[k + 1] = pixels[k + 2] = 250;
      pixels[k + 3] = Math.round(205 * Math.max(0, Math.min(1, cover)));
    }
  return new ImageData(pixels, nx, ny);
}

export default function CloudMap({
  mapKey,
  grid,
  lat,
  lon,
  peers,
  runId,
  n,
  present,
}: {
  mapKey: string;
  grid: Nowcast['grid'];
  lat: number;
  lon: number;
  peers: Set<Map>;
  runId: string;
  n: number;
  present: (id: string, n: number) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<{ canvas: HTMLCanvasElement; map: Map }>();
  const [error, setError] = useState(''),
    [attempt, retry] = useState(0);
  const { lat0, lon0, dx_m, dy_m, nx, ny } = grid;
  useEffect(() => {
    const coordinates = gridCorners({ lat0, lon0, dx_m, dy_m, nx, ny });
    const canvas = document.createElement('canvas');
    canvas.width = nx;
    canvas.height = ny;
    let m: Map | undefined, marker: Marker | undefined;
    try {
      const map = new Map({
        container: node.current!,
        style:
          'https://api.maptiler.com/maps/streets-v2/style.json?key=' +
          encodeURIComponent(mapKey),
        bounds: [coordinates[3], coordinates[1]],
        fitBoundsOptions: { padding: 8 },
      });
      m = map;
      const camera = (peer: Map) => ({
        center: peer.getCenter(),
        zoom: peer.getZoom(),
        bearing: peer.getBearing(),
        pitch: peer.getPitch(),
      });
      const first = peers.values().next().value;
      if (first) map.jumpTo(camera(first));
      peers.add(map);
      map.on('move', (e) => {
        if ('synced' in e && e.synced) return;
        for (const other of peers)
          if (other !== map) other.jumpTo(camera(map), { synced: true });
      });
      map.on('error', () =>
        setError(
          'Terrain map unavailable. Check the map key or switch to cloud frames.',
        ),
      );
      const dot = document.createElement('span');
      dot.className = 'key-marker';
      dot.setAttribute('aria-label', 'Observing site');
      marker = new Marker({ element: dot }).setLngLat([lon, lat]).addTo(map);
      map.on('load', () => {
        map.addSource('terrain', {
          type: 'raster-dem',
          url:
            'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=' +
            encodeURIComponent(mapKey),
        });
        map.addLayer({ id: 'terrain-relief', source: 'terrain', type: 'hillshade' });
        map.addSource('cloud', { type: 'canvas', canvas, coordinates, animate: false });
        map.addLayer({
          id: 'cloud-cover',
          source: 'cloud',
          type: 'raster',
          paint: { 'raster-fade-duration': 0 },
        });
        setSurface({ canvas, map });
      });
    } catch {
      // MapLibre reports unavailable WebGL synchronously during construction.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Terrain map unavailable in this browser. Switch to cloud frames.');
    }
    return () => {
      if (m) {
        peers.delete(m);
        marker?.remove();
        m.remove();
      }
    };
  }, [mapKey, peers, lat0, lon0, dx_m, dy_m, nx, ny, lat, lon]);
  const [frameError, setFrameError] = useState('');
  useEffect(() => {
    if (!surface) return;
    const ctrl = new AbortController();
    async function paint({ canvas, map }: NonNullable<typeof surface>) {
      const response = await api.GET('/runs/{runId}/frames/{n}/values', {
        params: { path: { runId, n } },
        parseAs: 'arrayBuffer',
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      const plane = decodeGrid(checked(response), response.response.headers);
      if (plane.nx !== nx || plane.ny !== ny)
        throw new Error('Frame dimensions differ from the nowcast grid.');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cloud overlay unavailable in this browser.');
      ctx.putImageData(cloudPixels(plane), 0, 0);
      const source = map.getSource<CanvasSource>('cloud')!;
      source.play();
      source.pause();
      setFrameError('');
      present(runId, n);
    }
    paint(surface).catch((e) => {
      if (!ctrl.signal.aborted) setFrameError(message(e));
    });
    return () => ctrl.abort();
  }, [surface, n, runId, present, nx, ny, attempt]);
  return (
    <>
      <div className="cloud-map" ref={node} />
      {error && <p role="alert">{error}</p>}
      {frameError && (
        <p role="alert">
          {frameError} <button onClick={() => retry((v) => v + 1)}>Retry frame</button>
        </p>
      )}
    </>
  );
}
