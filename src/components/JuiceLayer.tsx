import { useEffect, useRef } from "react";
import { mountJuice } from "../lib/juice";

// One fixed, click-through overlay that hosts every juice effect.
export function JuiceLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !layerRef.current) return;
    return mountJuice(canvasRef.current, layerRef.current);
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div ref={layerRef} className="absolute inset-0" />
    </div>
  );
}
