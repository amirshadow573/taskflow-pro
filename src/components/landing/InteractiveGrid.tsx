import { useEffect, useRef } from "react";

/**
 * Interactive infinite-grid background — adapted to the site's light pastel
 * theme (very light gray lines, soft blue/violet cursor illumination).
 *
 * Behavior:
 *  - The grid layer is oversized (±32px) and tiles every 48px, so the
 *    mouse-driven parallax shift (max ±18px) never exposes an edge — the
 *    grid feels infinite.
 *  - The cursor glow follows the pointer through a lerped rAF loop
 *    (no React re-renders; transform-only → GPU friendly).
 *  - The rAF loop parks itself when the motion settles.
 *  - Disabled for touch-only devices and prefers-reduced-motion users.
 */
export function InteractiveGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Mobile (<768px): this layer is fully hidden by CSS (flat #F3F4F6
    // canvas) — don't run the loop against invisible elements.
    const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
    if (reduced || !canHover || isMobile) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { x: target.x, y: target.y };
    let raf = 0;
    let running = true;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    // When the cursor leaves the window, let the glow drift back to center.
    const onLeave = () => {
      target.x = window.innerWidth / 2;
      target.y = window.innerHeight * 0.4;
    };

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.06;
      pos.y += (target.y - pos.y) * 0.06;

      // Subtle perspective: grid leans away from the cursor.
      const nx = (pos.x / window.innerWidth) * 2 - 1; // -1..1
      const ny = (pos.y / window.innerHeight) * 2 - 1;
      if (gridRef.current) {
        gridRef.current.style.transform = `translate3d(${(nx * -18).toFixed(2)}px, ${(ny * -14).toFixed(2)}px, 0)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${(pos.x - 300).toFixed(1)}px, ${(pos.y - 300).toFixed(1)}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${(pos.x - 120).toFixed(1)}px, ${(pos.y - 120).toFixed(1)}px, 0)`;
      }

      // Park the loop once motion has settled.
      if (Math.abs(target.x - pos.x) < 0.3 && Math.abs(target.y - pos.y) < 0.3) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="landing-decor pointer-events-none absolute inset-0 overflow-hidden">
      {/* Oversized interactive grid layer */}
      <div ref={gridRef} className="grid-lines absolute -inset-8 will-change-transform" />

      {/* Soft cursor illumination — blue field with violet edge (light, not a flashlight) */}
      <div
        ref={glowRef}
        className="absolute size-[600px] rounded-full opacity-70 will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.05) 45%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />
      {/* Tight inner highlight */}
      <div
        ref={ringRef}
        className="absolute size-[240px] rounded-full will-change-transform"
        style={{
          background: "radial-gradient(circle, rgba(96,165,250,0.14) 0%, transparent 65%)",
          filter: "blur(12px)",
        }}
      />
    </div>
  );
}
