import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Sky } from '@/components/sky/Sky';
import { LayerMovies } from '@/components/sky/LayerMovies';
import {
  loadMapKey,
  storeMapKey,
  gridCorners,
  type Nowcast,
  type SiteSample,
} from '@/lib/sky';
import { createNowcast } from '@/mocks/nowcasts';
import { simulation } from './fixtures/simulation';

class MockMap {
  static instances: MockMap[] = [];
  events = new Map<string, (e: object) => void>();
  addSource = vi.fn();
  addLayer = vi.fn();
  remove = vi.fn();
  setCenter = vi.fn();
  source = { play: vi.fn(), pause: vi.fn() };
  getSource = () => this.source;
  getZoom = () => 8;
  getCenter = () => ({ lat: 42, lng: 12 });
  getBearing = () => 12;
  getPitch = () => 24;
  jumpTo = vi.fn((_camera: unknown, event = {}) => this.events.get('move')?.(event));
  constructor(readonly options: { style: string }) {
    MockMap.instances.push(this);
  }
  on(event: string, fn: (e: object) => void) {
    this.events.set(event, fn);
    if (event === 'load') queueMicrotask(() => fn({}));
  }
}
class MockMarker {
  static instances: MockMarker[] = [];
  constructor(readonly options: object) {
    MockMarker.instances.push(this);
  }
  setLngLat = vi.fn(() => this);
  addTo = vi.fn(() => this);
  remove = vi.fn();
  getLngLat = () => ({ lat: 37.25, lng: 181 });
  drag?: () => void;
  on(_event: string, fn: () => void) {
    this.drag = fn;
  }
}
vi.mock('maplibre-gl', () => ({ Map: MockMap, Marker: MockMarker }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  MockMap.instances.length = 0;
  MockMarker.instances.length = 0;
});

it('keeps maps off without a key, searches with the visitor key, applies places and dragged pins, and revokes the key', async () => {
  const fetch = vi.fn(async (input: Request | URL) => {
    const url = input instanceof Request ? new URL(input.url) : input;
    if (url.hostname === 'api.maptiler.com') {
      expect(url.pathname).toBe('/geocoding/Mont%20Blanc.json');
      expect(url.searchParams.get('key')).toBe('visitor-key');
      return Response.json({
        features: [
          { id: 'place.1', center: [6.865, 45.832], place_name: 'Mont Blanc, France' },
        ],
      });
    }
    expect(url.href).not.toContain('visitor-key');
    if (input instanceof Request && input.method === 'POST') {
      expect(await input.json()).toEqual(
        expect.objectContaining({ lat: 37.25, lon: -179, window: 'tonight' }),
      );
      expect(input.headers.get('Authorization')).toBeNull();
      return Response.json({ detail: 'Test submission' }, { status: 422 });
    }
    return Response.json({ items: [], next_cursor: null });
  });
  vi.stubGlobal('fetch', fetch);
  render(<Sky online />);
  expect(screen.queryByLabelText('Address or place')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Choose on map' })).toBeNull();
  expect(MockMap.instances).toHaveLength(0);
  expect(
    fetch.mock.calls.every(
      ([input]) => input instanceof Request && !input.url.includes('maptiler'),
    ),
  ).toBe(true);
  fireEvent.click(screen.getByText('Map key'));
  const input = screen.getByLabelText('MapTiler API key');
  fireEvent.change(input, { target: { value: ' visitor-key ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(loadMapKey()).toBe('visitor-key');
  fireEvent.change(screen.getByLabelText('Address or place'), {
    target: { value: 'Mont Blanc' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Mont Blanc, France' }));
  expect(screen.getByLabelText('Latitude (°)')).toHaveValue(45.832);
  expect(screen.getByLabelText('Longitude (°)')).toHaveValue(6.865);
  fireEvent.click(screen.getByRole('button', { name: 'Choose on map' }));
  await waitFor(() => expect(MockMarker.instances).toHaveLength(1));
  expect(MockMap.instances[0].options.style).toContain('key=visitor-key');
  expect(MockMarker.instances[0].options).toMatchObject({ draggable: true });
  act(() => MockMarker.instances[0].drag!());
  expect(screen.getByLabelText('Latitude (°)')).toHaveValue(37.25);
  expect(screen.getByLabelText('Longitude (°)')).toHaveValue(-179);
  fireEvent.click(screen.getByRole('button', { name: 'Run nowcast' }));
  await screen.findByText('Test submission');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(MockMap.instances[0].remove).toHaveBeenCalledOnce();
  expect(loadMapKey()).toBe('');
  expect(screen.queryByLabelText('Address or place')).toBeNull();
});
it('keeps the key session usable when browser storage is blocked', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(loadMapKey()).toBe('');
  expect(storeMapKey('example')).toBe(false);
  render(<Sky online={false} />);
  fireEvent.click(screen.getByText('Map key'));
  fireEvent.change(screen.getByLabelText('MapTiler API key'), {
    target: { value: 'example' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(screen.getByText(/applies to this visit/)).toBeVisible();
  expect(screen.getByLabelText('Address or place')).toBeVisible();
});
it('drapes north-up translucent cover on three bounded hillshade maps, synchronises their cameras and updates all frames', async () => {
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        readonly data: Uint8ClampedArray,
        readonly width: number,
        readonly height: number,
      ) {}
    },
  );
  const putImageData = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    putImageData,
  } as unknown as CanvasRenderingContext2D);
  const fetch = vi.fn(async (input: Request) => {
    expect(input.url).not.toContain('visitor-key');
    return new Response(new Float32Array([0, 0.5, 1, 0.25]).buffer, {
      headers: { 'X-Nx': '2', 'X-Ny': '2' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  const layers: Nowcast['layers'] = [
    { layer: 'low', pressure_hpa: 850, run_id: 'low' },
    { layer: 'mid', pressure_hpa: 500, run_id: 'mid' },
    { layer: 'high', pressure_hpa: 300, run_id: 'high' },
  ];
  const grid = { lat0: 45, lon0: 179, dx_m: 100000, dy_m: 100000, nx: 2, ny: 2 };
  const record = {
    ...createNowcast({ lat: 45.4, lon: 179.6 }),
    grid,
    layers,
    site: [
      { time: '2026-11-01T00:00:00Z' },
      { time: '2026-11-01T00:10:00Z' },
    ] as SiteSample[],
  };
  const { unmount } = render(
    <LayerMovies
      mapKey="visitor-key"
      record={record}
      runs={layers.map((l) => simulation({ id: l.run_id, frames: 2 }))}
    />,
  );
  await waitFor(() => expect(putImageData).toHaveBeenCalledTimes(3));
  const corners = gridCorners(grid);
  expect(corners[1][0]).toBeGreaterThan(180);
  expect(corners[0][0]).toBeCloseTo(178.36, 2);
  expect(corners[0][1]).toBeCloseTo(46.349, 3);
  expect(corners[2][1]).toBeCloseTo(44.5503, 3);
  for (const m of MockMap.instances) {
    expect(m.addSource).toHaveBeenCalledWith(
      'terrain',
      expect.objectContaining({ type: 'raster-dem' }),
    );
    expect(m.addSource).toHaveBeenCalledWith(
      'cloud',
      expect.objectContaining({ coordinates: corners }),
    );
    expect(m.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'hillshade' }),
    );
    expect(m.source.pause).toHaveBeenCalledOnce();
    m.jumpTo.mockClear();
  }
  const image = putImageData.mock.calls[0][0] as ImageData;
  expect(Array.from(image.data).filter((_, i) => i % 4 === 3)).toEqual([
    205, 51, 0, 103,
  ]);
  act(() => MockMap.instances[2].events.get('move')!({}));
  for (const m of MockMap.instances.slice(0, 2)) {
    expect(m.jumpTo).toHaveBeenCalledExactlyOnceWith(
      { center: { lat: 42, lng: 12 }, zoom: 8, bearing: 12, pitch: 24 },
      { synced: true },
    );
  }
  expect(MockMap.instances[2].jumpTo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next frame' }));
  await waitFor(() => expect(putImageData).toHaveBeenCalledTimes(6));
  expect(
    fetch.mock.calls.slice(3).every(([r]) => r.url.includes('/frames/1/values')),
  ).toBe(true);
  unmount();
  for (const map of MockMap.instances) expect(map.remove).toHaveBeenCalledOnce();
});
