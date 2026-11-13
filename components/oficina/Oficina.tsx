'use client';

import { useEffect, useRef } from 'react';

/** Monta la maqueta 3D (three.js, sin framework) dentro de la página. */
export default function Oficina() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let desmontar: (() => void) | undefined;
    let cancelado = false;
    import('@/lib/oficina/juego').then(({ montar }) => {
      if (cancelado || !ref.current) return;
      desmontar = montar(ref.current, {
        fuentes: {
          display: '/mando/fonts/ZalandoSansExpanded-var.woff2',
          cuerpo300: '/mando/fonts/WorkSans-300.woff2',
          cuerpo600: '/mando/fonts/WorkSans-600.woff2',
          mono: '/mando/fonts/JetBrainsMono-400.woff2',
        },
      });
    });
    return () => {
      cancelado = true;
      desmontar?.();
    };
  }, []);

  return <div ref={ref} style={{ position: 'fixed', inset: 0, background: '#0c0420' }} />;
}
