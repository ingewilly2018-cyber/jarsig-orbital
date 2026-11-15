import { useEffect, useRef } from "react";

type Star = { x: number; y: number; startX: number; startY: number; targetX: number; targetY: number; vx: number; vy: number; radius: number; opacity: number; phase: number };

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let stars: Star[] = [];
    let startedAt = 0;
    let previousTime = 0;
    let frame = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const launch = (event: Event) => {
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail;
      const originX = (detail?.x ?? 0.72) * window.innerWidth;
      const originY = (detail?.y ?? 0.5) * window.innerHeight;
      stars = Array.from({ length: 190 }, () => {
        return {
          x: originX,
          y: originY,
          startX: originX,
          startY: originY,
          targetX: Math.random() * window.innerWidth,
          targetY: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 14,
          radius: 0.5 + Math.random() * 1.4,
          opacity: 0.35 + Math.random() * 0.65,
          phase: Math.random() * Math.PI * 2,
        };
      });
      startedAt = performance.now();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("jarsig:launch", launch);
    const draw = (time: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
      previousTime = time;
      context.clearRect(0, 0, width, height);

      if (stars.length) {
        const age = (time - startedAt) / 1000;
        for (const star of stars) {
          if (age < 1.7) {
            const progress = Math.min(1, age / 1.7);
            const eased = 1 - (1 - progress) ** 3;
            star.x = star.startX + (star.targetX - star.startX) * eased;
            star.y = star.startY + (star.targetY - star.startY) * eased;
          } else {
            star.x += (star.vx + Math.sin(time * 0.0002 + star.phase) * 2) * dt;
            star.y += (star.vy + Math.cos(time * 0.00017 + star.phase) * 2) * dt;
          }
          if (star.x < -8) star.x = width + 8;
          if (star.x > width + 8) star.x = -8;
          if (star.y < -8) star.y = height + 8;
          if (star.y > height + 8) star.y = -8;
          const twinkle = 0.66 + Math.sin(time * 0.0015 + star.phase) * 0.22;
          const burstFade = age < 0.75 ? 0.5 + age * 0.65 : 1;
          context.beginPath();
          context.fillStyle = `rgba(255,255,255,${star.opacity * twinkle * burstFade * 0.58})`;
          context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("jarsig:launch", launch);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
