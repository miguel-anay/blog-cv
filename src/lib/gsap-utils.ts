import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// ---------------------------------------------------------------------------
// whenFontsReady
// Resolves when the browser has finished loading all fonts.
// ---------------------------------------------------------------------------
export function whenFontsReady(): Promise<void> {
  return document.fonts.ready.then(() => undefined);
}

// ---------------------------------------------------------------------------
// registerPlugins
// Idempotent — safe to call from multiple page scripts.
// gsap.registerPlugin() is a no-op if the plugin is already registered.
// ---------------------------------------------------------------------------
export function registerPlugins(): void {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

// ---------------------------------------------------------------------------
// splitWords
// Awaits fonts before splitting so web-font glyphs are measured correctly.
// Always goes through whenFontsReady() — never call SplitText.create() directly.
// ---------------------------------------------------------------------------
export async function splitWords(el: HTMLElement): Promise<SplitText> {
  await whenFontsReady();
  return SplitText.create(el, {
    type: "words",
    autoSplit: true,
    mask: "words",
  });
}

// ---------------------------------------------------------------------------
// makeMagnetic
// Adds a subtle magnetic hover effect using gsap.quickTo() for performance.
// Returns a cleanup function that removes the event listener.
// Gate this behind (pointer: fine) before calling — not handled internally.
// ---------------------------------------------------------------------------
export function makeMagnetic(
  el: HTMLElement,
  strength: number = 0.4
): () => void {
  const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
  const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

  function onMove(e: PointerEvent) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    xTo((e.clientX - cx) * strength);
    yTo((e.clientY - cy) * strength);
  }

  function onLeave() {
    xTo(0);
    yTo(0);
  }

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);

  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    gsap.set(el, { x: 0, y: 0 });
  };
}
