import { WebGLRenderer, Scene, PerspectiveCamera } from "three";

export type StageContext = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
};

let resizeObserver: ResizeObserver | null = null;
let contextLostHandler: ((e: Event) => void) | null = null;
let boundCanvas: HTMLCanvasElement | null = null;
let boundRenderer: WebGLRenderer | null = null;

function applySize(ctx: StageContext, width: number, height: number) {
  if (width <= 0 || height <= 0) return;
  ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
}

export const stage = {
  /** null = WebGLRenderer construction failed (blocklisted GPU, OOM). Caller bails silently. */
  init(canvas: HTMLCanvasElement, onContextLost: () => void): StageContext | null {
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true, // load-bearing: without it the canvas paints opaque black over .hero::before
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      return null;
    }
    renderer.setClearAlpha(0);

    const scene = new Scene();
    const parent = canvas.parentElement ?? canvas;
    const rect = parent.getBoundingClientRect();
    const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
    const camera = new PerspectiveCamera(35, aspect, 0.1, 100);
    camera.position.z = 6;

    const ctx: StageContext = { renderer, scene, camera };
    applySize(ctx, rect.width, rect.height);

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        applySize(ctx, width, height);
      }
    });
    resizeObserver.observe(parent);

    contextLostHandler = () => onContextLost();
    canvas.addEventListener("webglcontextlost", contextLostHandler);
    // Deliberately no preventDefault(): no restoration attempted, the CSS
    // crosshatch fallback (.hero::before) is already on screen.

    boundCanvas = canvas;
    boundRenderer = renderer;

    return ctx;
  },

  destroy(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (boundCanvas && contextLostHandler) {
      boundCanvas.removeEventListener("webglcontextlost", contextLostHandler);
    }
    contextLostHandler = null;
    boundCanvas = null;

    boundRenderer?.dispose();
    boundRenderer?.forceContextLoss();
    boundRenderer = null;
  },
};
