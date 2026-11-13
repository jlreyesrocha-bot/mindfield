// Plano de la oficina: una grilla de celdas de 1x1. El mundo va de x 0..ANCHO y z 0..ALTO.
// La simulación usa este plano para caminar; la escena 3D lo usa para dibujar.

export const ANCHO = 34;
export const ALTO = 24;

export type TipoEstacion = 'escritorio' | 'cafe' | 'sofa' | 'reunion' | 'despacho';

export interface Puesto {
  /** Celda caminable desde la que se llega al puesto */
  acceso: [number, number];
  /** Posición final del cuerpo y hacia dónde mira (0 = +z, PI = -z, PI/2 = +x) */
  x: number;
  z: number;
  rot: number;
  sentado: boolean;
  ocupante: string | null;
}

export interface Estacion {
  id: string;
  tipo: TipoEstacion;
  nombre: string;
  /** Centro y giro del mueble, para dibujarlo */
  x: number;
  z: number;
  rot: number;
  puestos: Puesto[];
  /** Los escritorios pueden estar sin comprar */
  activo: boolean;
  /** Persona dueña del escritorio */
  dueno: string | null;
}

export interface Muro {
  x: number;
  z: number;
  ancho: number;
  fondo: number;
  vidrio: boolean;
}

export interface Planta {
  x: number;
  z: number;
}

export interface Mapa {
  bloqueado: Uint8Array;
  estaciones: Estacion[];
  muros: Muro[];
  plantas: Planta[];
  /** Celda de la puerta y punto exterior por donde entra y sale la gente */
  puerta: [number, number];
  fuera: { x: number; z: number };
}

export const idx = (cx: number, cz: number) => cz * ANCHO + cx;

export function crearMapa(): Mapa {
  const bloqueado = new Uint8Array(ANCHO * ALTO);
  const muros: Muro[] = [];
  const plantas: Planta[] = [];
  const estaciones: Estacion[] = [];

  const bloquear = (x0: number, z0: number, x1 = x0, z1 = z0) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) bloqueado[idx(x, z)] = 1;
  };
  const muro = (x0: number, z0: number, x1: number, z1: number, vidrio = false) => {
    bloquear(x0, z0, x1, z1);
    muros.push({ x: x0, z: z0, ancho: x1 - x0 + 1, fondo: z1 - z0 + 1, vidrio });
  };

  // Perímetro, con la puerta abajo al centro.
  muro(0, 0, ANCHO - 1, 0);
  muro(0, 1, 0, ALTO - 1);
  muro(ANCHO - 1, 1, ANCHO - 1, ALTO - 1);
  muro(1, ALTO - 1, 15, ALTO - 1);
  muro(18, ALTO - 1, ANCHO - 2, ALTO - 1);

  // Sala de reuniones (arriba a la izquierda), de vidrio.
  muro(10, 1, 10, 7, true);
  muro(1, 8, 4, 8, true);
  muro(7, 8, 10, 8, true);
  bloquear(3, 3, 7, 5);
  const asiento = (cx: number, cz: number, rot: number): Puesto => ({ acceso: [cx, cz], x: cx + 0.5, z: cz + 0.5, rot, sentado: true, ocupante: null });
  estaciones.push({
    id: 'reunion', tipo: 'reunion', nombre: 'Sala de reuniones', x: 5.5, z: 4.5, rot: 0, activo: true, dueno: null,
    puestos: [
      asiento(3, 2, 0), asiento(5, 2, 0), asiento(7, 2, 0),
      asiento(3, 6, Math.PI), asiento(5, 6, Math.PI), asiento(7, 6, Math.PI),
      asiento(2, 4, Math.PI / 2), asiento(8, 4, -Math.PI / 2),
    ],
  });

  // Despacho del CEO (arriba a la derecha).
  muro(23, 1, 23, 7);
  muro(23, 8, 26, 8);
  muro(29, 8, 32, 8);
  bloquear(27, 3, 29, 3);
  estaciones.push({
    id: 'despacho', tipo: 'despacho', nombre: 'Tu despacho', x: 28.5, z: 3.5, rot: 0, activo: true, dueno: 'ceo',
    puestos: [{ acceso: [28, 2], x: 28.5, z: 2.5, rot: 0, sentado: true, ocupante: null }],
  });

  // Escritorios: dos filas enfrentadas con un pasillo central.
  const columnas = [4, 8, 12, 20, 24, 28];
  let n = 0;
  for (const fila of ['A', 'B'] as const) {
    for (const x of columnas) {
      const zMesa = fila === 'A' ? 10 : 14;
      const zSilla = fila === 'A' ? 11 : 13;
      bloquear(x, zMesa, x + 1, zMesa);
      n += 1;
      estaciones.push({
        id: `mesa${n}`, tipo: 'escritorio', nombre: `Escritorio ${n}`, x: x + 1, z: zMesa + 0.5, rot: fila === 'A' ? Math.PI : 0,
        activo: x <= 12, dueno: null,
        puestos: [{ acceso: [x, zSilla], x: x + 1, z: zSilla + 0.5, rot: fila === 'A' ? Math.PI : 0, sentado: true, ocupante: null }],
      });
    }
  }

  // Cocina (abajo a la izquierda): barra con la cafetera.
  bloquear(1, 16, 1, 21);
  bloquear(5, 19, 5, 19);
  estaciones.push({
    id: 'cafe', tipo: 'cafe', nombre: 'Cafetera', x: 1.5, z: 18.5, rot: Math.PI / 2, activo: true, dueno: null,
    puestos: [17, 18, 19, 20].map((z) => ({ acceso: [2, z] as [number, number], x: 2.45, z: z + 0.5, rot: -Math.PI / 2, sentado: false, ocupante: null })),
  });

  // Zona de descanso (abajo a la derecha): dos sofás.
  bloquear(32, 16, 32, 19);
  bloquear(27, 22, 29, 22);
  bloquear(30, 20, 30, 20);
  estaciones.push({
    id: 'sofa', tipo: 'sofa', nombre: 'Zona de descanso', x: 32.5, z: 18, rot: -Math.PI / 2, activo: true, dueno: null,
    puestos: [
      ...[16, 17, 18, 19].map((z) => ({ acceso: [31, z] as [number, number], x: 32.35, z: z + 0.5, rot: -Math.PI / 2, sentado: true, ocupante: null })),
      ...[27, 28, 29].map((x) => ({ acceso: [x, 21] as [number, number], x: x + 0.5, z: 22.35, rot: Math.PI, sentado: true, ocupante: null })),
    ],
  });

  // Plantas.
  for (const [x, z] of [[1, 10], [32, 10], [11, 1], [22, 1], [1, 22], [32, 22], [14, 22], [19, 22], [22, 15], [11, 15]] as [number, number][]) {
    bloquear(x, z);
    plantas.push({ x: x + 0.5, z: z + 0.5 });
  }

  return { bloqueado, estaciones, muros, plantas, puerta: [16, ALTO - 1], fuera: { x: 17, z: ALTO + 2.2 } };
}

export function caminable(m: Mapa, cx: number, cz: number): boolean {
  return cx >= 0 && cz >= 0 && cx < ANCHO && cz < ALTO && m.bloqueado[idx(cx, cz)] === 0;
}

/** Celda caminable más cercana a un punto del mundo (búsqueda en anillos). */
export function celdaLibreCerca(m: Mapa, x: number, z: number, ocupadas?: Set<number>): [number, number] | null {
  const cx = Math.max(0, Math.min(ANCHO - 1, Math.floor(x)));
  const cz = Math.max(0, Math.min(ALTO - 1, Math.floor(z)));
  for (let r = 0; r < 8; r++) {
    let mejor: [number, number] | null = null;
    let mejorD = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (!caminable(m, nx, nz) || ocupadas?.has(idx(nx, nz))) continue;
        const d = (nx + 0.5 - x) ** 2 + (nz + 0.5 - z) ** 2;
        if (d < mejorD) {
          mejorD = d;
          mejor = [nx, nz];
        }
      }
    }
    if (mejor) return mejor;
  }
  return null;
}

const VECINOS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** A* sobre la grilla, sin cortar esquinas. Devuelve los centros de celda del camino (sin el origen). */
export function buscarRuta(m: Mapa, desde: [number, number], hasta: [number, number]): { x: number; z: number }[] | null {
  if (!caminable(m, hasta[0], hasta[1]) || !caminable(m, desde[0], desde[1])) return null;
  const inicio = idx(desde[0], desde[1]);
  const meta = idx(hasta[0], hasta[1]);
  if (inicio === meta) return [];
  const g = new Float32Array(ANCHO * ALTO).fill(Infinity);
  const previo = new Int32Array(ANCHO * ALTO).fill(-1);
  const cerrado = new Uint8Array(ANCHO * ALTO);
  const abiertos: number[] = [inicio];
  const f = new Float32Array(ANCHO * ALTO).fill(Infinity);
  const h = (i: number) => {
    const dx = Math.abs((i % ANCHO) - hasta[0]);
    const dz = Math.abs(Math.floor(i / ANCHO) - hasta[1]);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  g[inicio] = 0;
  f[inicio] = h(inicio);
  while (abiertos.length) {
    let k = 0;
    for (let i = 1; i < abiertos.length; i++) if (f[abiertos[i]] < f[abiertos[k]]) k = i;
    const actual = abiertos.splice(k, 1)[0];
    if (actual === meta) break;
    if (cerrado[actual]) continue;
    cerrado[actual] = 1;
    const cx = actual % ANCHO;
    const cz = Math.floor(actual / ANCHO);
    for (const [dx, dz, costo] of VECINOS) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!caminable(m, nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (!caminable(m, cx + dx, cz) || !caminable(m, cx, cz + dz))) continue;
      const ni = idx(nx, nz);
      if (cerrado[ni]) continue;
      const ng = g[actual] + costo;
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + h(ni);
        previo[ni] = actual;
        abiertos.push(ni);
      }
    }
  }
  if (previo[meta] === -1) return null;
  const celdas: number[] = [];
  for (let i = meta; i !== inicio; i = previo[i]) celdas.push(i);
  celdas.reverse();
  // Quita los puntos intermedios de los tramos rectos para que el andar sea fluido.
  const ruta: { x: number; z: number }[] = [];
  for (let i = 0; i < celdas.length; i++) {
    const a = i === 0 ? inicio : celdas[i - 1];
    const b = celdas[i];
    const c = celdas[i + 1];
    if (c !== undefined && b - a === c - b) continue;
    ruta.push({ x: (b % ANCHO) + 0.5, z: Math.floor(b / ANCHO) + 0.5 });
  }
  return ruta;
}
