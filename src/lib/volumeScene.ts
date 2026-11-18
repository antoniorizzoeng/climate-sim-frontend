import {
  BackSide,
  BoxGeometry,
  ClampToEdgeWrapping,
  Data3DTexture,
  DataTexture,
  EdgesGeometry,
  FloatType,
  GLSL3,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  RawShaderMaterial,
  RedFormat,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { colorTable, type ColorMap, type Volume } from './model';
import { WEBGL_UNAVAILABLE } from './webgl';

export function volumeTexture(
  volume: Volume,
  gl: Pick<WebGL2RenderingContext, 'getExtension'>,
) {
  const texture = new Data3DTexture(volume.data, volume.nx, volume.ny, volume.nz);
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.internalFormat = 'R32F';
  const linear = gl.getExtension('OES_texture_float_linear');
  texture.minFilter = texture.magFilter = linear ? LinearFilter : NearestFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const vertexShader = `
  in vec3 position;
  uniform mat4 modelViewMatrix, projectionMatrix;
  out vec3 surface;
  void main() {
    surface = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }`;
const fragmentShader = `
  precision highp float;
  precision highp sampler3D;
  in vec3 surface;
  uniform vec3 eye, extent;
  uniform vec2 limits;
  uniform sampler3D field;
  uniform sampler2D palette;
  uniform float opacity, threshold, samples;
  out vec4 result;
  void main() {
    vec3 direction = normalize(surface-eye);
    // Intersect the ray with the box in grid coordinates [-0.5, 0.5].
    vec3 inv = 1. / (sign(direction + vec3(1e-10)) * max(abs(direction), vec3(1e-8)));
    vec3 a = (-0.5-eye)*inv, b = (0.5-eye)*inv;
    vec3 nearFace = min(a,b), farFace = max(a,b);
    float start = max(0.,max(nearFace.x,max(nearFace.y,nearFace.z)));
    float end = min(farFace.x,min(farFace.y,farFace.z));
    if (end <= start) discard;
    float stepSize = (end-start)/samples;
    float distanceStep = length(direction*extent)*stepSize;
    vec4 acc = vec4(0.);
    for (int i=0; i<256; i++) {
      if (float(i)>=samples || acc.a>0.985) break;
      vec3 uvw = eye + direction*(start+(float(i)+0.5)*stepSize) + 0.5;
      float value = texture(field,uvw).r;
      float t = limits.x == limits.y ? 0.5 : clamp((value-limits.x)/(limits.y-limits.x),0.,1.);
      if (t > threshold) {
        float alpha = 1.-exp(-distanceStep*opacity*32.*t);
        vec3 color = texture(palette,vec2((t*255.+0.5)/256.,0.5)).rgb;
        acc.rgb += (1.-acc.a)*alpha*color;
        acc.a += (1.-acc.a)*alpha;
      }
    }
    if (acc.a < 0.001) discard;
    result = vec4(acc.rgb/acc.a,acc.a);
  }`;

export function createVolumeScene(host: HTMLDivElement, dimensions: number[]) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) throw new Error(WEBGL_UNAVAILABLE);
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.01, 20);
  camera.up.set(0, 0, 1);
  camera.position.set(1.35, -1.85, 1.2);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  canvas.tabIndex = 0;
  controls.listenToKeyEvents(canvas);
  controls.keyRotateSpeed = 5;
  canvas.title = 'Drag or use Ctrl + arrow keys to orbit. Scroll or pinch to zoom.';
  controls.minDistance = 1.05;
  controls.maxDistance = 6;
  controls.update();
  const extent = new Vector3(...dimensions).divideScalar(Math.max(...dimensions));
  const geometry = new BoxGeometry(1, 1, 1);
  const paletteBytes = new Uint8Array(256 * 4);
  const palette = new DataTexture(paletteBytes, 256, 1);
  palette.minFilter = palette.magFilter = LinearFilter;
  const uniforms = {
    eye: { value: new Vector3() },
    extent: { value: extent },
    limits: { value: new Vector2(0, 1) },
    field: { value: null as Data3DTexture | null },
    palette: { value: palette },
    opacity: { value: 0.65 },
    threshold: { value: 0.05 },
    samples: { value: 128 },
  };
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    side: BackSide,
    transparent: true,
    depthWrite: false,
  });
  const box = new Mesh(geometry, material);
  box.scale.copy(extent);
  box.visible = false;
  scene.add(box);
  const edges = new EdgesGeometry(geometry);
  const lineMaterial = new LineBasicMaterial({
    color: 0x807571,
    transparent: true,
    opacity: 0.7,
  });
  const lines = new LineSegments(edges, lineMaterial);
  lines.scale.copy(extent);
  scene.add(lines);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Simulation volume');
  host.append(canvas);
  const labels = ['X', 'Y', 'Z'].map((axis, i) => {
    const label = document.createElement('span');
    label.className = 'volume-axis';
    label.textContent = axis;
    host.append(label);
    const pos = new Vector3(-0.54, -0.54, -0.54).setComponent(i, 0.58).multiply(extent);
    return { label, pos };
  });
  function draw() {
    uniforms.eye.value.copy(camera.position).divide(extent);
    renderer.render(scene, camera);
    for (const { label, pos } of labels) {
      const v = pos.clone().project(camera);
      label.style.left = (v.x + 1) * 50 + '%';
      label.style.top = (1 - v.y) * 50 + '%';
    }
  }
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  }
  controls.addEventListener('change', draw);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    frame(volume: Volume) {
      uniforms.field.value?.dispose();
      uniforms.field.value = volumeTexture(volume, context);
      uniforms.samples.value = Math.min(
        256,
        Math.max(64, Math.ceil(Math.hypot(volume.nx, volume.ny, volume.nz) * 1.5)),
      );
      box.visible = true;
      draw();
    },
    appearance(
      map: ColorMap,
      min: number,
      max: number,
      opacity: number,
      threshold: number,
    ) {
      colorTable(map).forEach((rgb, i) => paletteBytes.set([...rgb, 255], i * 4));
      palette.needsUpdate = true;
      uniforms.limits.value.set(min, max);
      uniforms.opacity.value = opacity;
      uniforms.threshold.value = threshold;
      draw();
    },
    dispose() {
      observer.disconnect();
      controls.removeEventListener('change', draw);
      controls.dispose();
      geometry.dispose();
      edges.dispose();
      lineMaterial.dispose();
      material.dispose();
      palette.dispose();
      uniforms.field.value?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      host.replaceChildren();
    },
  };
}
