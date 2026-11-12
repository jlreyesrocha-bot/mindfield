'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Persona } from '@/lib/mando/types';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';

export function Boton({
  variante = 'secundario',
  tam,
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tam?: 'sm' | 'lg' }) {
  return (
    <button
      type="button"
      {...p}
      className={cx('m-btn', `m-btn-${variante}`, tam && `m-btn-${tam}`, className)}
    />
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('m-eyebrow', className)}>{children}</div>;
}

/** Color de una métrica 0-100: alto es bueno salvo que sea invertida (estrés). */
export function colorNivel(valor: number, invertida = false): string {
  const v = invertida ? 100 - valor : valor;
  if (v >= 60) return 'var(--m-ok)';
  if (v >= 38) return 'var(--m-alerta)';
  return 'var(--m-mal)';
}

export function Barra({ valor, color, invertida, alto = 6 }: { valor: number; color?: string; invertida?: boolean; alto?: number }) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div className="m-barra" style={{ height: alto }} role="presentation">
      <span style={{ width: `${v}%`, background: color ?? colorNivel(v, invertida) }} />
    </div>
  );
}

export function Medidor({ etiqueta, valor, invertida, icono }: { etiqueta: string; valor: number; invertida?: boolean; icono?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 m-tenue">{icono}{etiqueta}</span>
        <span className="m-num" style={{ color: colorNivel(valor, invertida) }}>{Math.round(valor)}</span>
      </div>
      <Barra valor={valor} invertida={invertida} />
    </div>
  );
}

/** Número que cuenta hasta su valor: la recompensa visible de cada semana. */
export function Contador({ valor, formato, duracion = 700 }: { valor: number; formato?: (n: number) => string; duracion?: number }) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  useEffect(() => {
    const inicio = desde.current;
    if (inicio === valor) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = reduce ? 1 : duracion;
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const actual = inicio + (valor - inicio) * e;
      desde.current = actual;
      setMostrado(actual);
      if (k < 1) raf = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, duracion]);
  return <span className="m-num">{formato ? formato(mostrado) : Math.round(mostrado)}</span>;
}

export function Modal({
  children,
  onCerrar,
  ancho = 640,
  etiqueta,
}: {
  children: ReactNode;
  onCerrar?: () => void;
  ancho?: number;
  etiqueta: string;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCerrar) onCerrar();
    };
    window.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [onCerrar]);
  return (
    <div className="m-velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div className="m-modal" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={etiqueta}>
        {onCerrar && (
          <div className="sticky top-0 z-10 flex justify-end h-0">
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="m-btn m-btn-fantasma m-3 !p-2" style={{ background: 'rgba(19,8,51,.85)' }}>
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function iniciales(nombre: string): string {
  const [a, b] = nombre.split(' ');
  return `${a?.[0] ?? ''}${b?.[0] ?? ''}`.toUpperCase();
}

export function Avatar({ p, tam = 44 }: { p: Pick<Persona, 'nombre' | 'animo' | 'fuera'>; tam?: number }) {
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
      style={{
        width: tam,
        height: tam,
        fontSize: tam * 0.36,
        background: 'var(--pp-purpura-deep)',
        boxShadow: `0 0 0 2px #130833, 0 0 0 4px ${colorNivel(p.animo)}`,
        opacity: p.fuera > 0 ? 0.45 : 1,
      }}
      aria-hidden
    >
      {iniciales(p.nombre)}
    </div>
  );
}

export function Toast({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return <div className="m-toast" role="status">{mensaje}</div>;
}

/** Línea de tendencia mínima, sin ejes: solo la forma. */
export function Tendencia({ datos, color = 'var(--pp-lavanda)', alto = 44 }: { datos: number[]; color?: string; alto?: number }) {
  if (datos.length < 2) return <div style={{ height: alto }} />;
  const min = Math.min(...datos);
  const max = Math.max(...datos);
  const rango = max - min || 1;
  const ancho = 200;
  const pts = datos.map((d, i) => `${(i / (datos.length - 1)) * ancho},${alto - 4 - ((d - min) / rango) * (alto - 8)}`);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" style={{ width: '100%', height: alto }} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
