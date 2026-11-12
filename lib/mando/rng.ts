import type { Juego } from './types';

/** Hash de texto a entero de 32 bits (para convertir una semilla en estado). */
export function hashSemilla(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

/** Aleatorio determinista (mulberry32). El estado vive dentro de la partida. */
export function rnd(g: Juego): number {
  g.rngEstado = (g.rngEstado + 0x6d2b79f5) >>> 0;
  let t = g.rngEstado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const rndDe = (g: Juego) => () => rnd(g);

export function entre(r: () => number, min: number, max: number): number {
  return min + r() * (max - min);
}

export function entero(r: () => number, min: number, max: number): number {
  return Math.floor(entre(r, min, max + 1));
}

export function elegir<T>(r: () => number, lista: readonly T[]): T {
  return lista[Math.min(lista.length - 1, Math.floor(r() * lista.length))];
}

export function prob(r: () => number, p: number): boolean {
  return r() < p;
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function nuevoId(g: Juego, prefijo: string): string {
  g.contador += 1;
  return `${prefijo}${g.contador}`;
}
