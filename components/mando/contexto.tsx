'use client';

import { createContext, useContext } from 'react';
import type { Juego } from '@/lib/mando/types';
import type { Sonido } from './sonido';

export type ModalEstado =
  | { tipo: 'situacion'; uid: string }
  | { tipo: 'persona'; id: string }
  | { tipo: 'pitch'; id: string }
  | { tipo: 'contratar' }
  | { tipo: 'resumen' }
  | { tipo: 'fin' }
  | { tipo: 'ayuda' }
  | null;

export interface Api {
  g: Juego;
  /** Aplica una acción sobre una copia de la partida. Devuelve false si la acción fue rechazada. */
  hacer: (fn: (d: Juego) => string | null | void, sonido?: Sonido) => boolean;
  abrir: (m: ModalEstado) => void;
  avisar: (mensaje: string) => void;
  iaDisponible: boolean;
}

export const Ctx = createContext<Api | null>(null);

export function useMando(): Api {
  const api = useContext(Ctx);
  if (!api) throw new Error('useMando fuera del proveedor');
  return api;
}
