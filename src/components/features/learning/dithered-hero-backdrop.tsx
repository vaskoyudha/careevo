"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Dithered hero backdrop.
 *
 * Ports the "bit animation" treatment: a source is drawn through a Bayer
 * ordered-dither + posterisation pass, so the artwork resolves into a fixed
 * grid of hard colour levels rather than a photographic gradient.
 *
 * Two details carry the effect and are easy to lose when reimplementing:
 *
 *  1. The dither grid is anchored to CANVAS pixels, not to the source. The
 *     texture scrolls underneath a stationary dot pattern, which reads as
 *     printed matter instead of "video with a filter on top".
 *  2. Quantisation is ordered (`color + (threshold - 0.5) * step`, then
 *     round to the step), not plain rounding. That is what produces the
 *     characteristic stipple in the midtones instead of banding.
 *
 * The source is either a looping video or a procedural field, so the hero
 * has motion on first paint with no binary asset required. Drop in a video
 * via `videoSrc` and it takes over automatically.
 */

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;

uniform sampler2D uSource;
uniform sampler2D uBayer;
uniform vec2  uResolution;
uniform vec2  uSourceResolution;
uniform float uBayerSize;
uniform float uDitherScale;
uniform float uLevels;
uniform float uZoom;
uniform float uFocusY;
uniform float uPanY;
uniform float uUseVideo;
uniform float uTime;
uniform vec3  uDeep;
uniform vec3  uMid;
uniform vec3  uAccent;

float blob(vec2 uv, vec2 c, float r) {
  float d = length(uv - c) / r;
  return exp(-d * d * 1.7);
}

/* Slow-drifting colour field used when no video is supplied. Deterministic
   per time value, so a paused/reduced-motion frame is stable. */
vec3 proceduralField(vec2 uv, float t) {
  vec3 c = mix(uMid, uDeep, smoothstep(0.0, 1.0, uv.y));

  float a1 = blob(uv, vec2(0.24 + 0.10 * sin(t * 0.09), 0.34 + 0.08 * cos(t * 0.07)), 0.55);
  float a2 = blob(uv, vec2(0.78 + 0.08 * cos(t * 0.11), 0.44 + 0.09 * sin(t * 0.10)), 0.50);
  float a3 = blob(uv, vec2(0.55 + 0.12 * sin(t * 0.06), 0.84 + 0.06 * cos(t * 0.12)), 0.62);

  c = mix(c, uAccent, clamp(a1 * 0.55 + a2 * 0.45, 0.0, 0.85));
  c = mix(c, uMid, clamp(a3 * 0.50, 0.0, 0.70));
  return c;
}

void main() {
  // vUv.y runs bottom-up on the canvas; flip so the maths below is top-down.
  vec2 canvasPx = vec2(vUv.x, 1.0 - vUv.y) * uResolution;

  vec3 color;

  if (uUseVideo > 0.5) {
    // object-cover mapping into the source texture.
    float scale = max(uResolution.x / uSourceResolution.x,
                      uResolution.y / uSourceResolution.y) * uZoom;
    vec2 drawnSize = uSourceResolution * scale;
    vec2 offset = vec2((drawnSize.x - uResolution.x) * 0.5,
                       (drawnSize.y - uResolution.y) * uFocusY);
    vec2 sourceUv = (canvasPx + offset) / drawnSize;
    sourceUv.y += uPanY;
    color = texture2D(uSource, sourceUv).rgb;
  } else {
    color = proceduralField(vec2(vUv.x, 1.0 - vUv.y), uTime);
  }

  // Ordered dither, keyed to canvas pixels so the grid stays screen-locked.
  vec2 bayerUv = mod(floor(canvasPx / uDitherScale), uBayerSize) / uBayerSize;
  float threshold = texture2D(uBayer, bayerUv).r;

  float step = 1.0 / (uLevels - 1.0);
  vec3 dithered = color + (threshold - 0.5) * step;
  vec3 quantized = floor(dithered / step + 0.5) * step;

  gl_FragColor = vec4(clamp(quantized, 0.0, 1.0), 1.0);
}
`;

/** Recursive Bayer matrix, normalised to 0..1. */
function buildBayer(size: number): number[][] {
  let matrix: number[][] = [[0]];
  let n = 1;

  while (n < size) {
    const next = n * 2;
    const grown: number[][] = Array.from({ length: next }, () => new Array(next).fill(0));

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = matrix[y][x];
        grown[y][x] = 4 * v + 0;
        grown[y][x + n] = 4 * v + 2;
        grown[y + n][x] = 4 * v + 3;
        grown[y + n][x + n] = 4 * v + 1;
      }
    }

    matrix = grown;
    n = next;
  }

  const max = size * size;
  return matrix.map((row) => row.map((v) => v / max));
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const int = Number.parseInt(full, 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

export interface DitheredHeroBackdropProps {
  /** Optional looping video used as the source texture. */
  videoSrc?: string;
  /** Posterisation levels per channel. 4 is the reference look. */
  levels?: number;
  /** Bayer cell size in CSS px. 2 is the reference look. */
  ditherScale?: number;
  /** Extra zoom applied to a video source. */
  zoom?: number;
  /** Vertical anchor for the video crop: 0 = top, 1 = bottom. */
  focusY?: number;
  /** Emulated vertical pan, in source-UV units. */
  panY?: number;
  /** Colour ramp for the procedural field. */
  deep?: string;
  mid?: string;
  accent?: string;
  className?: string;
}

export function DitheredHeroBackdrop({
  videoSrc,
  levels = 4,
  ditherScale = 2,
  zoom = 1,
  focusY = 0.5,
  panY = 0,
  deep = "#06263A",
  mid = "#12507E",
  accent = "#2EC4B6",
  className,
}: DitheredHeroBackdropProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const video = videoRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const gl =
      (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        // preserveDrawingBuffer:false discards the buffer after every
        // composite. The animation loop re-draws each frame so that is
        // invisible, but reduced motion paints ONE frame and stops — the
        // buffer would be composited once and then read back, and displayed,
        // as empty (measured: 0 non-zero px of 657800). Keep the buffer only
        // in that mode; it costs nothing for users who asked for no motion.
        preserveDrawingBuffer: reduceMotion,
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    // No WebGL: leave the canvas transparent so the CSS ground shows through.
    if (!gl) return;

    const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Bayer lookup texture.
    const bayerSize = 16;
    const bayerMatrix = buildBayer(bayerSize);
    const bayerData = new Uint8Array(bayerSize * bayerSize);
    for (let y = 0; y < bayerSize; y++) {
      for (let x = 0; x < bayerSize; x++) {
        bayerData[y * bayerSize + x] = Math.round(bayerMatrix[y][x] * 255);
      }
    }

    const bayerTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bayerTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      bayerSize,
      bayerSize,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      bayerData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const uniforms = {
      source: gl.getUniformLocation(program, "uSource"),
      bayer: gl.getUniformLocation(program, "uBayer"),
      resolution: gl.getUniformLocation(program, "uResolution"),
      sourceResolution: gl.getUniformLocation(program, "uSourceResolution"),
      bayerSize: gl.getUniformLocation(program, "uBayerSize"),
      ditherScale: gl.getUniformLocation(program, "uDitherScale"),
      levels: gl.getUniformLocation(program, "uLevels"),
      zoom: gl.getUniformLocation(program, "uZoom"),
      focusY: gl.getUniformLocation(program, "uFocusY"),
      panY: gl.getUniformLocation(program, "uPanY"),
      useVideo: gl.getUniformLocation(program, "uUseVideo"),
      time: gl.getUniformLocation(program, "uTime"),
      deep: gl.getUniformLocation(program, "uDeep"),
      mid: gl.getUniformLocation(program, "uMid"),
      accent: gl.getUniformLocation(program, "uAccent"),
    };

    gl.uniform1f(uniforms.bayerSize, bayerSize);
    gl.uniform1f(uniforms.ditherScale, ditherScale);
    gl.uniform1f(uniforms.levels, levels);
    gl.uniform1f(uniforms.zoom, zoom);
    gl.uniform1f(uniforms.focusY, focusY);
    gl.uniform1f(uniforms.panY, panY);
    gl.uniform3fv(uniforms.deep, hexToRgb(deep));
    gl.uniform3fv(uniforms.mid, hexToRgb(mid));
    gl.uniform3fv(uniforms.accent, hexToRgb(accent));
    gl.uniform1i(uniforms.source, 0);
    gl.uniform1i(uniforms.bayer, 1);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bayerTexture);

    let disposed = false;
    let inView = true;
    let videoReady = false;
    let frameHandle = 0;
    const startedAt = performance.now();
    let lastPaint = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (time: number) => {
      resize();

      if (videoReady && video) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
        gl.uniform1f(uniforms.useVideo, 1);
        gl.uniform2f(uniforms.sourceResolution, video.videoWidth, video.videoHeight);
      } else {
        gl.uniform1f(uniforms.useVideo, 0);
        gl.uniform2f(uniforms.sourceResolution, 1, 1);
      }

      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, (time - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const tick = (time: number) => {
      if (disposed) return;
      if (inView) {
        // Cap at ~30fps: this is a slow ambient field, not a game loop.
        if (time - lastPaint >= 1000 / 30) {
          lastPaint = time;
          draw(time);
        }
        frameHandle = requestAnimationFrame(tick);
      }
    };

    const start = () => {
      if (disposed || frameHandle) return;
      frameHandle = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frameHandle) {
        cancelAnimationFrame(frameHandle);
        frameHandle = 0;
      }
    };

    const syncPlayback = () => {
      if (reduceMotion) {
        // Honour the preference: never advance the source. The single static
        // frame painted at setup (and again on loadeddata) is the whole
        // animation budget in this mode.
        stop();
        if (video && !video.paused) video.pause();
        return;
      }
      const shouldRun = inView && document.visibilityState === "visible";
      if (shouldRun) {
        if (video && videoReady && video.paused) {
          void video.play().catch(() => {
            /* Autoplay refused: the procedural field still animates. */
          });
        }
        start();
      } else {
        stop();
        if (video && !video.paused) video.pause();
      }
    };

    const onVideoReady = () => {
      videoReady = true;
      draw(performance.now());
      syncPlayback();
    };

    if (video) {
      if (video.readyState >= 2) onVideoReady();
      video.addEventListener("loadeddata", onVideoReady);
    }

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              inView = entry.isIntersecting;
              syncPlayback();
            },
            { rootMargin: "200px" },
          )
        : null;
    observer?.observe(canvas);

    const onVisibility = () => syncPlayback();
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(() => draw(performance.now())) : null;
    if (resizeObserver) resizeObserver.observe(wrap);
    else window.addEventListener("resize", resize);

    // Reduced motion: paint one static dithered frame and leave it there.
    if (reduceMotion) {
      draw(performance.now());
    } else {
      syncPlayback();
    }

    return () => {
      disposed = true;
      stop();
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      if (video) {
        video.removeEventListener("loadeddata", onVideoReady);
        if (!video.paused) video.pause();
      }
      gl.deleteTexture(bayerTexture);
      gl.deleteTexture(sourceTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [videoSrc, levels, ditherScale, zoom, focusY, panY, deep, mid, accent]);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 size-px overflow-hidden opacity-0"
        />
      ) : null}
    </div>
  );
}
