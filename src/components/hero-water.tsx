"use client";

import { useEffect, useRef } from "react";
import styles from "./home-hero.module.css";

const vertex = `attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D photo;
uniform vec2 size;
uniform vec2 imageSize;
uniform float focusX;
uniform sampler2D surface;
void main() {
  vec2 point = vec2(uv.x, 1. - uv.y) * size;
  vec2 slope = (texture2D(surface, vec2(uv.x, 1. - uv.y)).rg - vec2(128. / 255.)) * 2.;
  vec2 offset = slope * (imageSize * max(size.x / imageSize.x, size.y / imageSize.y)) * .04;
  float light = pow(max(0., dot(slope, normalize(vec2(-.6, 1.)))), 4.);
  float scale = max(size.x / imageSize.x, size.y / imageSize.y);
  vec2 crop = imageSize * scale - size;
  vec2 samplePoint = (point + offset + vec2(crop.x * focusX, 0.)) / (imageSize * scale);
  gl_FragColor = vec4(texture2D(photo, clamp(samplePoint, .001, .999)).rgb + light, 1.);
}`;

/** Decorative refraction layer; the accessible Next image remains underneath. */
export default function HeroWater() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.closest("section");
    if (!canvas || !host) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false });
    if (!gl) return;
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) return;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type);
      if (!shader) continue;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach(shader => gl.deleteShader(shader));
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(["size", "imageSize", "focusX", "surface"].map(name => [name, gl.getUniformLocation(program, name)]));
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Height and velocity propagate both click rings and lighter movement ripples.
    const surfaceTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, surfaceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniforms.surface, 1);
    gl.activeTexture(gl.TEXTURE0);
    let columns = 0;
    let rows = 0;
    let height = new Float32Array(0);
    let velocity = new Float32Array(0);
    let nextHeight = new Float32Array(0);
    let pixels = new Uint8Array(0);
    let frame = 0;
    let lastDrop = -100;
    let lastStep = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextColumns = Math.max(2, Math.round(512 * rect.width / Math.max(rect.width, rect.height)));
      const nextRows = Math.max(2, Math.round(nextColumns * rect.height / Math.max(rect.width, 1)));
      if (columns !== nextColumns || rows !== nextRows) {
        columns = nextColumns;
        rows = nextRows;
        height = new Float32Array(columns * rows);
        velocity = new Float32Array(columns * rows);
        nextHeight = new Float32Array(columns * rows);
        pixels = new Uint8Array(columns * rows * 4);
      }
      return rect;
    };
    const step = () => {
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < columns - 1; x++) {
          const i = y * columns + x;
          const average = (height[i - 1] + height[i + 1] + height[i - columns] + height[i + columns]) * .25;
          velocity[i] = (velocity[i] + (average - height[i]) * 2) * .995;
          nextHeight[i] = height[i] + velocity[i];
        }
      }
      [height, nextHeight] = [nextHeight, height];
    };
    let ready = false;
    let visible = true;
    let disposed = false;
    const image = new window.Image();
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.style.opacity = "0";
      height.fill(0);
      velocity.fill(0);
      nextHeight.fill(0);
    };
    const draw = () => {
      frame = 0;
      const now = performance.now() / 1000;
      if (!ready || !visible || document.hidden || motion.matches || now - lastDrop > 8) { stop(); return; }
      const rect = resize();
      if (!lastStep) lastStep = now;
      const steps = Math.min(3, Math.floor((now - lastStep) * 60));
      for (let i = 0; i < steps; i++) step();
      if (steps) lastStep += steps / 60;
      if (now - lastStep > .1) lastStep = now;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const i = y * columns + x;
          const dx = (height[i] - height[y * columns + Math.min(columns - 1, x + 1)]) * 512;
          const dy = (height[i] - height[Math.min(rows - 1, y + 1) * columns + x]) * 512;
          const length = Math.hypot(dx, dy, 1);
          pixels[i * 4] = Math.round(128 + dx / length * 127);
          pixels[i * 4 + 1] = Math.round(128 + dy / length * 127);
          pixels[i * 4 + 3] = 255;
        }
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, surfaceTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, columns, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.activeTexture(gl.TEXTURE0);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(rect.width * ratio);
      const canvasHeight = Math.round(rect.height * ratio);
      if (canvas.width !== width || canvas.height !== canvasHeight) { canvas.width = width; canvas.height = canvasHeight; }
      gl.viewport(0, 0, width, canvasHeight);
      gl.uniform2f(uniforms.size, rect.width, rect.height);
      gl.uniform2f(uniforms.imageSize, image.naturalWidth, image.naturalHeight);
      gl.uniform1f(uniforms.focusX, window.matchMedia("(max-width: 640px)").matches ? .82 : .5);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.style.opacity = "1";
      frame = requestAnimationFrame(draw);
    };
    const disturb = (event: PointerEvent) => {
      if (!ready || motion.matches || !visible || document.hidden) return;
      const now = performance.now() / 1000;
      const rect = resize();
      const x = (event.clientX - rect.left) / rect.width * columns;
      const y = (event.clientY - rect.top) / rect.height * rows;
      if (x < 0 || y < 0 || x >= columns || y >= rows) return;
      if (event.target instanceof Element && event.target.closest("a, button")) return;
      const click = event.type === "pointerdown";
      const radius = (click ? 30 : 20) * columns / rect.width;
      const strength = click ? .14 : .01;
      // One soft circular impulse per pointer event, as in the reference.
      // Avoid painting an interpolated trench along the drag path.
      for (let sy = Math.max(1, Math.floor(y - radius)); sy <= Math.min(rows - 2, Math.ceil(y + radius)); sy++) {
        for (let sx = Math.max(1, Math.floor(x - radius)); sx <= Math.min(columns - 2, Math.ceil(x + radius)); sx++) {
          const d = Math.hypot(sx - x, sy - y) / radius;
          if (d < 1) height[sy * columns + sx] += (Math.cos(d * Math.PI) + 1) * .5 * strength;
        }
      }
      lastDrop = now;
      if (!frame) { lastStep = now; frame = requestAnimationFrame(draw); }
    };
    image.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      ready = true;
    };
    image.src = "/images/hero-butterfly-v2.jpg";
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible) stop(); });
    observer.observe(host);
    host.addEventListener("pointermove", disturb, { passive: true });
    host.addEventListener("pointerdown", disturb, { passive: true });
    motion.addEventListener("change", stop);
    document.addEventListener("visibilitychange", stop);
    canvas.addEventListener("webglcontextlost", stop);
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      host.removeEventListener("pointermove", disturb);
      host.removeEventListener("pointerdown", disturb);
      motion.removeEventListener("change", stop);
      document.removeEventListener("visibilitychange", stop);
      canvas.removeEventListener("webglcontextlost", stop);
      image.onload = null;
      gl.deleteTexture(texture);
      gl.deleteTexture(surfaceTexture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
    };
  }, []);

  return <canvas ref={ref} className={`${styles.photo} ${styles.water}`} aria-hidden="true" />;
}
