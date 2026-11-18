import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function SiteMap({
  mapKey,
  lat,
  lon,
  choose,
}: {
  mapKey: string;
  lat: number | null;
  lon: number | null;
  choose: (lat: number, lon: number) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const initial = useRef({ lat, lon });
  const map = useRef<Map | null>(null),
    marker = useRef<Marker | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const { lat, lon } = initial.current;
    const center: [number, number] = [lon ?? 0, lat ?? 0];
    try {
      const m = new Map({
        container: node.current!,
        style:
          'https://api.maptiler.com/maps/streets-v2/style.json?key=' +
          encodeURIComponent(mapKey),
        center,
        zoom: lat === null ? 1 : 9,
      });
      map.current = m;
      const pin = new Marker({ draggable: true }).setLngLat(center).addTo(m);
      marker.current = pin;
      const select = (lat: number, lng: number) =>
        choose(
          +lat.toFixed(6),
          +(((((lng + 180) % 360) + 360) % 360) - 180).toFixed(6),
        );
      pin.on('dragend', () => {
        const p = pin.getLngLat();
        select(p.lat, p.lng);
      });
      m.on('click', (e) => select(e.lngLat.lat, e.lngLat.lng));
      m.on('error', () =>
        setError('Map unavailable. Check your map key and connection.'),
      );
    } catch {
      // MapLibre reports unavailable WebGL synchronously during construction.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Map unavailable in this browser. Enter coordinates below.');
    }
    return () => {
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [mapKey, choose]);
  useEffect(() => {
    if (lat === null || lon === null) return;
    marker.current?.setLngLat([lon, lat]);
    map.current?.setCenter([lon, lat]);
  }, [lat, lon]);
  return (
    <>
      <div ref={node} className="sky-site-map" aria-label="Observing site map" />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
