import { useEffect, useRef } from "react";

export function HalftoneSphere({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const color = getComputedStyle(c).color;
    let raf = 0;
    let burstAt = 0;
    const N = 2600;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(t) * r, y, Math.sin(t) * r] as [number, number, number];
    });
    const light: [number, number, number] = [0.6, -0.5, 0.62];
    const launch = () => { burstAt = performance.now(); };
    window.addEventListener("jarsig:launch", launch);
    const draw = (time: number) => {
      const dpr = window.devicePixelRatio || 1;
      const s = c.clientWidth;
      if (c.width !== s * dpr) { c.width = s * dpr; c.height = s * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = color;
      const a = time * 0.00008, R = s * 0.46, cx = s / 2;
      const burst = burstAt ? Math.min(1, (time - burstAt) / 1050) : 0;
      if (burst >= 1) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const ca = Math.cos(a), sa = Math.sin(a);
      pts.forEach(([x, y, z], i) => {
        const rx = x * ca + z * sa, rz = -x * sa + z * ca;
        if (rz < 0 && burst === 0) return;
        const l = Math.max(0, rx * light[0] + y * light[1] + rz * light[2]);
        const size = Math.max(0.2, (0.25 + l * 1.9) * (s / 520) * (0.4 + rz * 0.6));
        const scatter = burst * (s * (0.55 + (i % 19) / 38));
        const angle = Math.atan2(y, rx) + Math.sin(i * 12.9898) * burst * 0.18;
        ctx.globalAlpha = 1 - burst;
        ctx.beginPath();
        ctx.arc(cx + rx * R + Math.cos(angle) * scatter, cx + y * R + Math.sin(angle) * scatter, size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("jarsig:launch", launch);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className={`aspect-square text-foreground ${className ?? ""}`} />;
}
