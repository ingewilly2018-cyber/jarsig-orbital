import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const TILE_BASE = "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm";
const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform float uYaw;
  uniform float uPitch;
  uniform float uAspect;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    float cy = cos(uYaw), sy = sin(uYaw);
    vec3 p = vec3(cy * aPosition.x + sy * aPosition.z, aPosition.y, -sy * aPosition.x + cy * aPosition.z);
    float cp = cos(uPitch), sp = sin(uPitch);
    p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
    gl_Position = vec4(p.x * 0.88 / uAspect, p.y * 0.88, p.z * 0.08, 1.0);
    vNormal = p;
    vUv = aUv;
  }
`;
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uTexture;
  uniform vec2 uPoint;
  uniform float uShowPoint;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 base = texture2D(uTexture, vUv).rgb;
    float light = 0.20 + 0.80 * max(dot(normalize(vNormal), normalize(vec3(-0.45, 0.18, 1.0))), 0.0);
    float dx = abs(fract(vUv.x - uPoint.x + 0.5) - 0.5);
    float dy = abs(vUv.y - uPoint.y);
    float marker = 1.0 - smoothstep(0.008, 0.014, length(vec2(dx, dy)));
    vec3 color = mix(base * light, vec3(1.0, 0.88, 0.48), marker * uShowPoint);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error("WebGL shader could not be created.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "WebGL shader compilation failed.");
  return shader;
}

function globeVertices() {
  const points: number[] = [];
  const rows = 40, columns = 64;
  const push = (row: number, column: number) => {
    const lat = Math.PI * (row / rows - 0.5);
    const lon = 2 * Math.PI * (column / columns - 0.5);
    points.push(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon), column / columns, 1 - row / rows);
  };
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    push(row, column); push(row + 1, column); push(row, column + 1);
    push(row, column + 1); push(row + 1, column); push(row + 1, column + 1);
  }
  return new Float32Array(points);
}

function loadMoonTexture(gl: WebGLRenderingContext, texture: WebGLTexture, onReady: () => void, onError: () => void) {
  let disposed = false;
  const jobs = Array.from({ length: 8 }, (_, index) => new Promise<{ row: number; column: number; image: HTMLImageElement }>((resolve, reject) => {
    const row = Math.floor(index / 4), column = index % 4;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve({ row, column, image });
    image.onerror = () => reject(new Error("NASA lunar image tile unavailable."));
    image.src = `${TILE_BASE}/1/${row}/${column}.jpg`;
  }));

  void Promise.all(jobs).then((tiles) => {
    if (disposed) return;
    const mosaic = document.createElement("canvas");
    mosaic.width = 1024; mosaic.height = 512;
    const context = mosaic.getContext("2d");
    if (!context) throw new Error("Moon texture canvas unavailable.");
    context.fillStyle = "#242a32"; context.fillRect(0, 0, mosaic.width, mosaic.height);
    for (const tile of tiles) context.drawImage(tile.image, tile.column * 256, tile.row * 256, 256, 256);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mosaic);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    onReady();
  }).catch(() => { if (!disposed) onError(); });

  return () => { disposed = true; };
}

export function NasaMoonGlobe({ className = "", selectedPoint }: { className?: string; selectedPoint: { latitude: number; longitude: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedPointRef = useRef(selectedPoint);
  const rotation = useRef({ yaw: 0, pitch: -0.18, dragX: 0, dragY: 0, active: false });
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => { selectedPointRef.current = selectedPoint; }, [selectedPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: false, antialias: true });
    if (!canvas || !gl) { setStatus("fallback"); return; }
    let frame = 0;
    let start = 0;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) { setStatus("fallback"); return; }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { setStatus("fallback"); return; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) { setStatus("fallback"); return; }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const vertices = globeVertices();
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(program, "aPosition");
    const uv = gl.getAttribLocation(program, "aUv");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([86, 90, 96, 255]));
    gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);
    gl.enable(gl.DEPTH_TEST); gl.clearColor(0.025, 0.035, 0.055, 1);
    const stopTexture = loadMoonTexture(gl, texture, () => setStatus("ready"), () => setStatus("fallback"));

    const draw = (time: number) => {
      if (!start) start = time;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const motion = rotation.current;
      const yaw = motion.yaw + (motion.active ? 0 : (time - start) * 0.00012);
      gl.uniform1f(gl.getUniformLocation(program, "uYaw"), yaw);
      gl.uniform1f(gl.getUniformLocation(program, "uPitch"), motion.pitch);
      gl.uniform1f(gl.getUniformLocation(program, "uAspect"), width / height);
      gl.uniform2f(gl.getUniformLocation(program, "uPoint"), (selectedPointRef.current.longitude + 180) / 360, (selectedPointRef.current.latitude + 90) / 180);
      gl.uniform1f(gl.getUniformLocation(program, "uShowPoint"), 1);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); stopTexture(); gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); };
  }, []);

  function startDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    rotation.current.active = true;
    rotation.current.dragX = event.clientX;
    rotation.current.dragY = event.clientY;
  }
  function moveDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    const state = rotation.current;
    if (!state.active) return;
    state.yaw += (event.clientX - state.dragX) * 0.009;
    state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch + (event.clientY - state.dragY) * 0.008));
    state.dragX = event.clientX; state.dragY = event.clientY;
  }
  function endDrag() { rotation.current.active = false; }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas ref={canvasRef} role="img" aria-label="Interactive three-dimensional Moon globe textured with NASA LRO imagery" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="h-full w-full touch-none cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-4 left-4 border border-white/20 bg-black/60 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white">NASA / JPL · LRO WAC 3D {status === "loading" ? "· Loading texture" : status === "fallback" ? "· Reduced texture" : "· Live WMTS tiles"}</div>
    </div>
  );
}
