import {
  colorTable,
  pixels,
  type FrameView,
  type ColorMap,
  type Run,
} from '@/lib/model';
import { projectedFrame } from './store';
import { downsample } from './raster';
type Options = {
  view: FrameView;
  maxSide: number;
  fps: number;
  colormap: ColorMap;
  min: number;
  max: number;
};
export async function renderAnimation(
  run: Run,
  format: 'gif' | 'mp4',
  options: Options,
  progress: (value: number) => void,
) {
  const { fps, colormap, min, max, maxSide } = options;
  const frame = (n: number) =>
    downsample(projectedFrame(run, n, options.view), maxSide);
  const first = frame(0),
    { nx, ny } = first;
  if (format === 'gif') {
    const { GIFEncoder } = await import('gifenc');
    const gif = GIFEncoder(),
      palette = colorTable(colormap);
    for (let n = 0; n < run.frames; n++) {
      const plane = n === 0 ? first : frame(n);
      const indices = Uint8Array.from({ length: nx * ny }, (_, k) => {
        const value = plane.data[(ny - 1 - Math.floor(k / nx)) * nx + (k % nx)];
        return max === min
          ? 128
          : Math.round(255 * Math.min(1, Math.max(0, (value - min) / (max - min))));
      });
      gif.writeFrame(indices, nx, ny, {
        palette: n === 0 ? palette : undefined,
        delay: 10 * (Math.round(((n + 1) * 100) / fps) - Math.round((n * 100) / fps)),
      });
      progress((n + 1) / run.frames);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }
  const {
    BufferTarget,
    CanvasSource,
    getFirstEncodableVideoCodec,
    Mp4OutputFormat,
    Output,
  } = await import('mediabunny');
  const canvas = document.createElement('canvas');
  // H.264 uses even dimensions. Pad only the outermost edge of odd grids.
  canvas.width = 2 * Math.ceil(nx / 2);
  canvas.height = 2 * Math.ceil(ny / 2);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');
  const bitrate = Math.max(200000, canvas.width * canvas.height * fps);
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9'], {
    width: canvas.width,
    height: canvas.height,
    bitrate,
  });
  if (!codec)
    throw new Error(
      'This browser cannot encode mock MP4 files. Use GIF or connect to the backend.',
    );
  const target = new BufferTarget(),
    output = new Output({ format: new Mp4OutputFormat(), target });
  const source = new CanvasSource(canvas, { codec, bitrate });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  try {
    for (let n = 0; n < run.frames; n++) {
      const rgba = pixels(n === 0 ? first : frame(n), colormap, min, max);
      ctx.putImageData(new ImageData(rgba, nx, ny), 0, 0);
      await source.add(n / fps, 1 / fps);
      progress((n + 1) / run.frames);
    }
    await output.finalize();
    return new Blob([target.buffer!], { type: 'video/mp4' });
  } catch (e) {
    await output.cancel();
    throw e;
  }
}
