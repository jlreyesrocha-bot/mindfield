// Persistencia local: partida en curso, ranking y perfil del jugador.
import { VERSION } from './motor';
import type { Juego } from './types';

const K_PARTIDA = 'mando:partida';
const K_RANKING = 'mando:ranking';
const K_PERFIL = 'mando:perfil';

export interface EntradaRanking {
  ceo: string;
  empresa: string;
  puntaje: number;
  rango: string;
  etapa: number;
  semanas: number;
  modo: Juego['modo'];
  semilla: string;
  motivo: string;
  fecha: string;
}

function leer<T>(k: string, defecto: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : defecto;
  } catch {
    return defecto;
  }
}

function escribir(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

export function guardarPartida(g: Juego): void {
  escribir(K_PARTIDA, g);
}

export function cargarPartida(): Juego | null {
  const g = leer<Juego | null>(K_PARTIDA, null);
  if (!g || g.version !== VERSION || g.fin) return null;
  return g;
}

export function borrarPartida(): void {
  try {
    localStorage.removeItem(K_PARTIDA);
  } catch {}
}

export function ranking(): EntradaRanking[] {
  return leer<EntradaRanking[]>(K_RANKING, []);
}

export function registrarEnRanking(e: EntradaRanking): { lista: EntradaRanking[]; posicion: number; record: boolean } {
  const previa = ranking();
  const record = previa.every((x) => e.puntaje > x.puntaje);
  const lista = [...previa, e].sort((a, b) => b.puntaje - a.puntaje).slice(0, 20);
  escribir(K_RANKING, lista);
  return { lista, posicion: lista.indexOf(e) + 1, record };
}

export function perfilGuardado(): { ceo: string; empresa: string } {
  return leer(K_PERFIL, { ceo: '', empresa: '' });
}

export function guardarPerfil(p: { ceo: string; empresa: string }): void {
  escribir(K_PERFIL, p);
}
