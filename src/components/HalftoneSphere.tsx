import { useEffect, useRef } from "react";

export function HalftoneSphere({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const color = getComputedStyle(c).color;
    let raf = 0;
    const N = 2600;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(t) * r, y, Math.sin(t) * r];
    });
    const light = [0.6, -0.5, 0.62];
    const draw = (time: number) => {
      const dpr = window.devicePixelRatio || 1;
      const s = c.clientWidth;
      if (c.width !== s * dpr) { c.width = s * dpr; c.height = s * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = color;
      const a = time * 0.00008, R = s * 0.46, cx = s / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (const [x, y, z] of pts) {
        const rx = x * ca + z * sa, rz = -x * sa + z * ca;
        if (rz < 0) continue;
        const l = Math.max(0, rx * light[0] + y * light[1] + rz * light[2]);
        const size = (0.25 + l * 1.9) * (s / 520) * (0.4 + rz * 0.6);
        ctx.beginPath();
        ctx.arc(cx + rx * R, cx + y * R, size, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className={`aspect-square text-foreground ${className ?? ""}`} />;
}
