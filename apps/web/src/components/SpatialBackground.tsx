/**
 * The two background planes, mounted once for the whole app.
 *
 * Three things move, at three different rates, and that difference is the
 * only reason any of this reads as depth: clouds on the furthest plane drift
 * on a CSS timer, stars on three nearer planes answer the pointer and the
 * scroll, and the panels in front lean a degree or two. Move them all by the
 * same amount and the screen is a flat picture being slid about.
 *
 * On the evidence page none of it moves. That page asks a reviewer to check
 * arithmetic by hand, and motion behind a table of z-scores works against the
 * one thing that page is for.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

type Star = {
  /* kept as fractions of the viewport so a resize does not scatter them */
  x: number;
  y: number;
  r: number;
  /* 0 is furthest, 2 is nearest. Drives size, brightness and parallax. */
  depth: number;
  drift: number;
  phase: number;
};

const DEPTHS = [
  { parallax: 6, speed: 0.004, alpha: 0.35, size: 0.7 },
  { parallax: 16, speed: 0.009, alpha: 0.6, size: 1.1 },
  { parallax: 34, speed: 0.016, alpha: 0.9, size: 1.7 },
];

function makeStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const depth = i % 3;
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r: (0.4 + Math.random() * 1.1) * DEPTHS[depth].size,
      depth,
      drift: (Math.random() - 0.5) * 0.00006,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

export function SpatialBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const location = useLocation();

  // the evidence screen is the one place that stays still
  const quiet = location.pathname.endsWith("/evidence");

  useEffect(() => {
    document.body.classList.toggle("quiet", quiet);
    return () => document.body.classList.remove("quiet");
  }, [quiet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still =
      quiet || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];

    // where the pointer is, as -1 to 1 from the centre of the screen
    let aimX = 0;
    let aimY = 0;
    // what is actually drawn, which chases the aim rather than snapping to it
    let atX = 0;
    let atY = 0;
    let scrolled = 0;

    function resize() {
      // capping the ratio matters on a 3x phone, where the honest number
      // costs nine times the fill for no visible gain
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * ratio);
      canvas!.height = Math.floor(height * ratio);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);

      // density by area, so a laptop and a phone look equally populated
      const count = Math.max(60, Math.min(240, Math.round((width * height) / 9000)));
      if (stars.length !== count) stars = makeStars(count);
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, width, height);

      // ease toward the pointer. A straight assignment tracks the mouse
      // exactly and feels mechanical; this lags slightly and feels like mass.
      atX += (aimX - atX) * 0.06;
      atY += (aimY - atY) * 0.06;

      for (const star of stars) {
        const plane = DEPTHS[star.depth];

        if (!still) {
          star.x += star.drift;
          if (star.x < -0.02) star.x = 1.02;
          if (star.x > 1.02) star.x = -0.02;
        }

        const x = star.x * width + atX * plane.parallax;
        const y =
          star.y * height + atY * plane.parallax - scrolled * plane.speed * 10;

        // wrap vertically so scrolling never empties the top of the screen
        const wrapped = ((y % (height + 80)) + height + 80) % (height + 80) - 40;

        const twinkle = still ? 1 : 0.75 + 0.25 * Math.sin(time * 0.0012 + star.phase);

        ctx!.globalAlpha = plane.alpha * twinkle;
        ctx!.beginPath();
        ctx!.arc(x, wrapped, star.r, 0, Math.PI * 2);
        ctx!.fillStyle = star.depth === 2 ? "#cfe0ff" : "#8ea4d8";
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;
    }

    let frame = 0;

    function loop(time: number) {
      draw(time);
      frame = requestAnimationFrame(loop);
    }

    function onPointer(event: PointerEvent) {
      aimX = (event.clientX / window.innerWidth) * 2 - 1;
      aimY = (event.clientY / window.innerHeight) * 2 - 1;
      // the panels read these two, so the lean and the stars share one source
      const root = document.documentElement;
      root.style.setProperty("--tilt-x", aimX.toFixed(3));
      root.style.setProperty("--tilt-y", aimY.toFixed(3));
    }

    function onScroll() {
      scrolled = window.scrollY;
    }

    function onVisibility() {
      // a hidden tab still gets frames in some browsers, and this one is
      // pure waste when nobody is looking at it
      cancelAnimationFrame(frame);
      if (!document.hidden && !still) frame = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    if (still) {
      // one frame, so the sky is there but nothing in it moves
      draw(0);
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [quiet]);

  return (
    <>
      <div className="layer aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <canvas className="layer starfield" ref={canvasRef} aria-hidden="true" />
    </>
  );
}
