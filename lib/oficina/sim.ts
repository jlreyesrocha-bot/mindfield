// Simulación en tiempo real de la oficina. No depende de three.js: se puede probar sin navegador.
import { ANCHO, buscarRuta, caminable, celdaLibreCerca, crearMapa, idx, type Estacion, type Mapa, type Puesto } from './mapa';

export type Area = 'cuentas' | 'creatividad' | 'produccion';
export type RolO = Area | 'ceo';
export const AREAS: Area[] = ['cuentas', 'creatividad', 'produccion'];
export const ROL_NOMBRE: Record<RolO, string> = { cuentas: 'Cuentas', creatividad: 'Creatividad', produccion: 'Producción', ceo: 'CEO' };

/** Segundos reales que dura una hora de juego a velocidad 1x. */
export const SEG_POR_HORA = 10;
export const HORA_ENTRADA = 8.7;
export const HORA_SALIDA = 18;
const VELOCIDAD = 4.3;
export const COSTO_ESCRITORIO = 2500;
export const ALQUILER_DIA = 800;

export type Actividad =
  | 'libre'
  | 'caminando'
  | 'trabajando'
  | 'sin_tarea'
  | 'vendiendo'
  | 'cafe'
  | 'descansando'
  | 'reunion'
  | 'charla'
  | 'fuera';

export type Destino =
  | { tipo: 'puesto'; estacion: string; puesto: number; hacer: Actividad }
  | { tipo: 'punto' }
  | { tipo: 'salir'; motivo: 'jornada' | 'renuncia' | 'licencia' }
  | { tipo: 'persona'; id: string };

export interface Agente {
  id: string;
  nombre: string;
  genero: 'f' | 'm';
  rol: RolO;
  habilidad: number;
  salario: number;
  x: number;
  z: number;
  rot: number;
  sentado: boolean;
  energia: number;
  estres: number;
  animo: number;
  actividad: Actividad;
  ruta: { x: number; z: number }[];
  destino: Destino | null;
  /** Puesto reservado u ocupado ahora mismo */
  lugar: { estacion: string; puesto: number } | null;
  /** Horas en la actividad actual */
  tiempo: number;
  cafes: number;
  /** Hora hasta la que no decide por su cuenta (obedece una orden a disgusto, o espera donde lo dejaste) */
  forzadoHasta: number;
  esperaHasta: number;
  /** Hora en la que entra a la oficina */
  llegaA: number;
  presente: boolean;
  licencia: number;
  seVa: boolean;
  unoAUnoHoy: boolean;
  alineado: boolean;
  aburrido: number;
  avisoFuga: boolean;
  pensamiento: string;
  burbuja: { texto: string; hasta: number } | null;
  charlaCon: string | null;
  /** Lo que hacía antes de que el CEO se acercara a conversar */
  previa: Actividad | null;
  aspecto: { piel: number; pelo: number; largo: boolean };
}

export interface ProyectoO {
  id: string;
  cliente: string;
  nombre: string;
  tam: 'S' | 'M' | 'L';
  pago: number;
  necesita: Record<Area, number>;
  hecho: Record<Area, number>;
  diaLimite: number;
}

export interface Oferta extends Omit<ProyectoO, 'hecho' | 'diaLimite'> {
  dias: number;
  expiraDia: number;
}

export interface Candidato {
  id: string;
  nombre: string;
  genero: 'f' | 'm';
  rol: Area;
  habilidad: number;
  salario: number;
  aspecto: Agente['aspecto'];
}

export interface Evento {
  tipo: 'bueno' | 'malo' | 'neutro';
  texto: string;
}

export interface Efecto {
  x: number;
  z: number;
  texto: string;
  tono: 'bueno' | 'malo';
}

export interface Sim {
  mapa: Mapa;
  dia: number;
  hora: number;
  fase: 'jornada' | 'salida' | 'noche';
  nocheHasta: number;
  reloj: number;
  caja: number;
  reputacion: number;
  agentes: Agente[];
  proyectos: ProyectoO[];
  ofertas: Oferta[];
  candidatos: Candidato[];
  proximaOferta: number;
  eventos: Evento[];
  efectos: Efecto[];
  ingresosDia: number;
  stats: { entregados: number; tarde: number; renuncias: number; facturado: number };
  rng: number;
  contador: number;
  fin: null | 'quiebra';
}

// ------------------------------- utilidades --------------------------------

function azar(s: Sim): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (s: Sim, a: number, b: number) => a + azar(s) * (b - a);
const elegir = <T,>(s: Sim, l: readonly T[]): T => l[Math.min(l.length - 1, Math.floor(azar(s) * l.length))];
const lim = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const nuevoId = (s: Sim, p: string) => `${p}${++s.contador}`;

export function soles(n: number): string {
  return `${n < 0 ? '-' : ''}S/ ${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

const NOMBRES: [string, 'f' | 'm'][] = [
  ['Valeria', 'f'], ['Camila', 'f'], ['Lucía', 'f'], ['Andrea', 'f'], ['Daniela', 'f'], ['Fernanda', 'f'], ['Mariana', 'f'],
  ['Paola', 'f'], ['Renata', 'f'], ['Ximena', 'f'], ['Carla', 'f'], ['Rocío', 'f'], ['Natalia', 'f'], ['Sofía', 'f'],
  ['Diego', 'm'], ['Sebastián', 'm'], ['Mateo', 'm'], ['Rodrigo', 'm'], ['Álvaro', 'm'], ['Bruno', 'm'], ['Gonzalo', 'm'],
  ['Renzo', 'm'], ['Joaquín', 'm'], ['Martín', 'm'], ['Nicolás', 'm'], ['Piero', 'm'], ['Franco', 'm'], ['Tomás', 'm'],
];
const APELLIDOS = ['Quispe', 'Rojas', 'Mendoza', 'Salazar', 'Vargas', 'Castillo', 'Paredes', 'Huamán', 'Córdova', 'Aguirre', 'Tapia', 'Zegarra', 'Montoya', 'Carrasco', 'Espinoza', 'Lozano', 'Arce', 'Palacios', 'Chávez', 'Navarro'];
const CLIENTES = ['Andina Móvil', 'Cervecería Altura', 'Banco Litoral', 'Motores Kuntur', 'Lácteos Valle Verde', 'Snacks Qhali', 'Seguros Horizonte', 'Tiendas Mercurio', 'Bebidas Chaski', 'Farmacias Vitalia', 'Cosmética Qori', 'Café Apu', 'Hoteles Mirador', 'Gimnasios Pulso'];
const PROYECTOS: Record<'S' | 'M' | 'L', string[]> = {
  S: ['Sampling en universidades', 'Activación en punto de venta', 'Stand para feria local', 'Desayuno con prensa'],
  M: ['Lanzamiento de producto', 'Activación en centros comerciales', 'Evento para distribuidores', 'Pop-up de marca'],
  L: ['Convención anual de ventas', 'Gira en cinco ciudades', 'Lanzamiento nacional', 'Experiencia en festival'],
};

export function cargoDe(a: Pick<Agente, 'rol' | 'genero' | 'habilidad'>): string {
  const f = a.genero === 'f';
  if (a.rol === 'ceo') return 'CEO';
  if (a.rol === 'cuentas') return a.habilidad >= 8 ? (f ? 'Directora de cuentas' : 'Director de cuentas') : f ? 'Ejecutiva de cuentas' : 'Ejecutivo de cuentas';
  if (a.rol === 'creatividad') return a.habilidad >= 8 ? (f ? 'Directora creativa' : 'Director creativo') : f ? 'Creativa' : 'Creativo';
  return a.habilidad >= 8 ? (f ? 'Jefa de producción' : 'Jefe de producción') : f ? 'Productora' : 'Productor';
}

// ------------------------------ nueva partida -------------------------------

function nombreLibre(s: Sim): [string, 'f' | 'm'] {
  const usados = [...s.agentes.map((a) => a.nombre), ...s.candidatos.map((c) => c.nombre)];
  for (let i = 0; i < 50; i++) {
    const [n, g] = elegir(s, NOMBRES);
    const ap = elegir(s, APELLIDOS);
    if (!usados.some((u) => u.split(' ')[0] === n || u.split(' ')[1] === ap) || i > 40) return [`${n} ${ap}`, g];
  }
  return [`${elegir(s, NOMBRES)[0]} ${elegir(s, APELLIDOS)}`, 'f'];
}

function nuevoCandidato(s: Sim, rol: Area, rango: [number, number]): Candidato {
  const [nombre, genero] = nombreLibre(s);
  const habilidad = Math.round(lim(entre(s, rango[0], rango[1] + 0.49), 1, 10));
  return {
    id: nuevoId(s, 'c'), nombre, genero, rol, habilidad,
    salario: Math.round(((2400 + 650 * habilidad) * entre(s, 0.94, 1.1)) / 50) * 50,
    aspecto: { piel: Math.floor(azar(s) * 5), pelo: Math.floor(azar(s) * 5), largo: genero === 'f' ? azar(s) < 0.75 : azar(s) < 0.1 },
  };
}

function aAgente(s: Sim, c: Candidato | (Omit<Candidato, 'rol'> & { rol: RolO })): Agente {
  return {
    id: nuevoId(s, 'a'), nombre: c.nombre, genero: c.genero, rol: c.rol, habilidad: c.habilidad, salario: c.salario,
    x: s.mapa.fuera.x, z: s.mapa.fuera.z, rot: Math.PI, sentado: false,
    energia: 88, estres: 15, animo: 74,
    actividad: 'fuera', ruta: [], destino: null, lugar: null, tiempo: 0, cafes: 0,
    forzadoHasta: 0, esperaHasta: 0, llegaA: 0, presente: false, licencia: 0, seVa: false,
    unoAUnoHoy: false, alineado: false, aburrido: 0, avisoFuga: false,
    pensamiento: 'Con ganas de empezar.', burbuja: null, charlaCon: null, previa: null, aspecto: c.aspecto,
  };
}

export function nuevaSim(semilla = Date.now()): Sim {
  const s: Sim = {
    mapa: crearMapa(), dia: 1, hora: HORA_ENTRADA, fase: 'jornada', nocheHasta: 0, reloj: 0,
    caja: 60000, reputacion: 10, agentes: [], proyectos: [], ofertas: [], candidatos: [],
    proximaOferta: 9.4, eventos: [], efectos: [], ingresosDia: 0,
    stats: { entregados: 0, tarde: 0, renuncias: 0, facturado: 0 },
    rng: (semilla >>> 0) || 1, contador: 0, fin: null,
  };
  const ceo = aAgente(s, { id: 'x', nombre: 'Tú', genero: 'm', rol: 'ceo', habilidad: 7, salario: 0, aspecto: { piel: 2, pelo: 0, largo: false } });
  ceo.id = 'ceo';
  s.agentes.push(ceo);
  const inicial: [Area, [number, number]][] = [['cuentas', [5, 5]], ['creatividad', [6, 6]], ['produccion', [5, 5]], ['creatividad', [4, 4]]];
  for (const [rol, rango] of inicial) {
    const a = aAgente(s, nuevoCandidato(s, rol, rango));
    s.agentes.push(a);
    asignarEscritorio(s, a);
  }
  s.agentes.forEach((a, i) => {
    a.llegaA = HORA_ENTRADA + i * 0.07;
  });
  s.ofertas.push(generarOferta(s, 'S'), generarOferta(s, 'S'));
  evento(s, 'neutro', 'Día 1. Tu equipo está llegando. Acepta un proyecto para darles trabajo.');
  return s;
}

function asignarEscritorio(s: Sim, a: Agente): boolean {
  const libre = s.mapa.estaciones.find((e) => e.tipo === 'escritorio' && e.activo && !e.dueno);
  if (!libre) return false;
  libre.dueno = a.id;
  return true;
}

export function escritorioDe(s: Sim, a: Agente): Estacion | undefined {
  if (a.rol === 'ceo') return s.mapa.estaciones.find((e) => e.tipo === 'despacho');
  return s.mapa.estaciones.find((e) => e.tipo === 'escritorio' && e.dueno === a.id);
}

export function escritoriosLibres(s: Sim): number {
  return s.mapa.estaciones.filter((e) => e.tipo === 'escritorio' && e.activo && !e.dueno).length;
}

export function costoEscritorio(s: Sim): number {
  const activos = s.mapa.estaciones.filter((e) => e.tipo === 'escritorio' && e.activo).length;
  return COSTO_ESCRITORIO + Math.max(0, activos - 6) * 500;
}

// -------------------------------- eventos -----------------------------------

function evento(s: Sim, tipo: Evento['tipo'], texto: string): void {
  s.eventos.push({ tipo, texto });
}

function decir(s: Sim, a: Agente, texto: string, segundos = 4.5): void {
  a.burbuja = { texto, hasta: s.reloj + segundos };
}

// -------------------------------- ofertas -----------------------------------

function generarOferta(s: Sim, forzar?: 'S' | 'M' | 'L'): Oferta {
  let tam: 'S' | 'M' | 'L' = 'S';
  if (!forzar) {
    const r = azar(s);
    if (s.reputacion >= 34 && r < 0.3) tam = 'L';
    else if (s.reputacion >= 15 && r < 0.7) tam = 'M';
  } else tam = forzar;
  const base = { S: [3.5, 7, 7, 4800, 2], M: [9, 18, 18, 14500, 3], L: [20, 40, 44, 39000, 5] }[tam];
  const v = entre(s, 0.88, 1.15);
  const usados = new Set([...s.ofertas.map((o) => o.cliente), ...s.proyectos.map((p) => p.cliente)]);
  const libres = CLIENTES.filter((c) => !usados.has(c));
  return {
    id: nuevoId(s, 'o'), tam,
    cliente: elegir(s, libres.length ? libres : CLIENTES),
    nombre: elegir(s, PROYECTOS[tam]),
    pago: Math.round((base[3] * v * entre(s, 0.92, 1.12)) / 100) * 100,
    necesita: { cuentas: Math.round(base[0] * v), creatividad: Math.round(base[1] * v), produccion: Math.round(base[2] * v) },
    dias: base[4],
    expiraDia: s.dia + 1,
  };
}

export function aceptarOferta(s: Sim, id: string): string | null {
  const o = s.ofertas.find((x) => x.id === id);
  if (!o) return 'Esa oferta ya no está.';
  if (s.proyectos.length >= 4) return 'Ya tienes cuatro proyectos abiertos. Entrega alguno primero.';
  s.ofertas = s.ofertas.filter((x) => x.id !== id);
  s.proyectos.push({
    id: o.id, cliente: o.cliente, nombre: o.nombre, tam: o.tam, pago: o.pago, necesita: o.necesita,
    hecho: { cuentas: 0, creatividad: 0, produccion: 0 }, diaLimite: s.dia + o.dias - 1,
  });
  evento(s, 'bueno', `Aceptaste ${o.nombre} de ${o.cliente} por ${soles(o.pago)}.`);
  return null;
}

export function rechazarOferta(s: Sim, id: string): void {
  s.ofertas = s.ofertas.filter((x) => x.id !== id);
}

export function avance(p: ProyectoO): number {
  const total = AREAS.reduce((t, a) => t + p.necesita[a], 0);
  const hecho = AREAS.reduce((t, a) => t + Math.min(p.hecho[a], p.necesita[a]), 0);
  return total > 0 ? hecho / total : 1;
}

// ------------------------------ contratación --------------------------------

export function buscarCandidatos(s: Sim, rol: Area): void {
  const techo = lim(5 + s.reputacion / 12, 5, 10);
  s.candidatos = [nuevoCandidato(s, rol, [3, 4]), nuevoCandidato(s, rol, [5, Math.min(7, techo)]), nuevoCandidato(s, rol, [Math.min(7, techo), techo])];
}

export function costoIngreso(c: Candidato): number {
  return Math.round(c.salario * 0.2);
}

export function contratar(s: Sim, id: string): string | null {
  const c = s.candidatos.find((x) => x.id === id);
  if (!c) return 'Ese candidato ya no está disponible.';
  if (escritoriosLibres(s) === 0) return 'No hay escritorio libre. Compra uno primero.';
  const costo = costoIngreso(c);
  if (s.caja < costo) return 'No alcanza la caja para contratar.';
  s.caja -= costo;
  const a = aAgente(s, c);
  s.agentes.push(a);
  asignarEscritorio(s, a);
  a.llegaA = s.hora + 0.05;
  if (s.fase !== 'jornada') a.llegaA = HORA_ENTRADA;
  s.candidatos = [];
  evento(s, 'bueno', `${a.nombre} se suma al equipo como ${cargoDe(a).toLowerCase()}.`);
  return null;
}

export function comprarEscritorio(s: Sim): string | null {
  const sig = s.mapa.estaciones.find((e) => e.tipo === 'escritorio' && !e.activo);
  if (!sig) return 'No queda espacio para más escritorios en este piso.';
  const costo = costoEscritorio(s);
  if (s.caja < costo) return `Necesitas ${soles(costo)} en caja.`;
  s.caja -= costo;
  sig.activo = true;
  s.efectos.push({ x: sig.x, z: sig.z, texto: `-${soles(costo)}`, tono: 'malo' });
  return null;
}

// -------------------------------- movimiento --------------------------------

function celdaDe(s: Sim, a: Agente): [number, number] {
  if (a.lugar) {
    const p = s.mapa.estaciones.find((e) => e.id === a.lugar!.estacion)?.puestos[a.lugar.puesto];
    if (p) return p.acceso;
  }
  const cx = Math.floor(a.x);
  const cz = Math.floor(a.z);
  if (caminable(s.mapa, cx, cz)) return [cx, cz];
  return celdaLibreCerca(s.mapa, a.x, a.z) ?? s.mapa.puerta;
}

function soltarLugar(s: Sim, a: Agente): void {
  if (!a.lugar) return;
  const p = s.mapa.estaciones.find((e) => e.id === a.lugar!.estacion)?.puestos[a.lugar.puesto];
  if (p && p.ocupante === a.id) p.ocupante = null;
  a.lugar = null;
}

function terminarCharla(s: Sim, a: Agente): void {
  if (!a.charlaCon) return;
  const otro = s.agentes.find((x) => x.id === a.charlaCon);
  a.charlaCon = null;
  if (otro && otro.charlaCon === a.id) {
    otro.charlaCon = null;
    if (otro.actividad === 'charla') {
      otro.actividad = otro.previa && otro.previa !== 'caminando' ? otro.previa : 'libre';
      otro.previa = null;
      otro.tiempo = 0;
    }
  }
}

/** Pone a la persona en camino hacia una celda. Devuelve false si no hay ruta. */
function caminarA(s: Sim, a: Agente, celda: [number, number], destino: Destino): boolean {
  const desde = celdaDe(s, a);
  const ruta = buscarRuta(s.mapa, desde, celda);
  if (!ruta) return false;
  terminarCharla(s, a);
  // Si estaba sentado, primero vuelve al centro de su celda de acceso.
  const inicio = { x: desde[0] + 0.5, z: desde[1] + 0.5 };
  const lejos = Math.hypot(a.x - inicio.x, a.z - inicio.z) > 0.05;
  const mismoPuesto = destino.tipo === 'puesto' && a.lugar?.estacion === destino.estacion && a.lugar.puesto === destino.puesto;
  if (!mismoPuesto) soltarLugar(s, a);
  a.ruta = lejos ? [inicio, ...ruta] : ruta;
  if (ruta.length === 0 && !lejos) a.ruta = [inicio];
  a.destino = destino;
  a.actividad = 'caminando';
  a.sentado = false;
  a.tiempo = 0;
  return true;
}

function irAPuesto(s: Sim, a: Agente, e: Estacion, hacer: Actividad): boolean {
  let n = e.puestos.findIndex((p) => p.ocupante === a.id);
  if (n < 0) {
    // El puesto libre más cercano.
    let mejor = Infinity;
    e.puestos.forEach((p, i) => {
      if (p.ocupante) return;
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      if (d < mejor) {
        mejor = d;
        n = i;
      }
    });
  }
  if (n < 0) return false;
  const p = e.puestos[n];
  if (a.lugar && a.lugar.estacion === e.id && a.lugar.puesto === n && a.actividad !== 'caminando') {
    a.actividad = hacer;
    a.tiempo = 0;
    return true;
  }
  if (!caminarA(s, a, p.acceso, { tipo: 'puesto', estacion: e.id, puesto: n, hacer })) return false;
  p.ocupante = a.id;
  a.lugar = { estacion: e.id, puesto: n };
  return true;
}

function estacion(s: Sim, tipo: Estacion['tipo']): Estacion {
  return s.mapa.estaciones.find((e) => e.tipo === tipo)!;
}

function irATrabajar(s: Sim, a: Agente): boolean {
  const e = escritorioDe(s, a);
  if (!e) return false;
  return irAPuesto(s, a, e, a.rol === 'ceo' ? 'vendiendo' : 'trabajando');
}

function salir(s: Sim, a: Agente, motivo: 'jornada' | 'renuncia' | 'licencia'): void {
  if (!a.presente) return;
  if (a.destino?.tipo === 'salir' && a.actividad === 'caminando') return;
  if (!caminarA(s, a, s.mapa.puerta, { tipo: 'salir', motivo })) {
    marcharse(s, a, motivo);
    return;
  }
  a.ruta.push({ ...s.mapa.fuera });
}

function marcharse(s: Sim, a: Agente, motivo: 'jornada' | 'renuncia' | 'licencia'): void {
  soltarLugar(s, a);
  terminarCharla(s, a);
  a.presente = false;
  a.actividad = 'fuera';
  a.ruta = [];
  a.destino = null;
  a.x = s.mapa.fuera.x;
  a.z = s.mapa.fuera.z;
  if (motivo === 'renuncia') {
    const mesa = escritorioDe(s, a);
    if (mesa) mesa.dueno = null;
    s.agentes = s.agentes.filter((x) => x.id !== a.id);
    s.stats.renuncias += 1;
    for (const x of s.agentes) if (x.rol !== 'ceo') x.animo = lim(x.animo - 4);
  }
}

function mover(s: Sim, a: Agente, dt: number): void {
  let resto = VELOCIDAD * dt;
  while (resto > 0 && a.ruta.length) {
    const p = a.ruta[0];
    const dx = p.x - a.x;
    const dz = p.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001) a.rot = Math.atan2(dx, dz);
    if (d <= resto) {
      a.x = p.x;
      a.z = p.z;
      a.ruta.shift();
      resto -= d;
    } else {
      a.x += (dx / d) * resto;
      a.z += (dz / d) * resto;
      resto = 0;
    }
  }
  if (a.ruta.length === 0) llegar(s, a);
}

function llegar(s: Sim, a: Agente): void {
  const d = a.destino;
  a.destino = null;
  a.tiempo = 0;
  if (!d || d.tipo === 'punto') {
    a.actividad = 'libre';
    return;
  }
  if (d.tipo === 'salir') {
    if (d.motivo === 'renuncia') evento(s, 'malo', `${a.nombre} renunció y dejó la oficina.`);
    marcharse(s, a, d.motivo);
    return;
  }
  if (d.tipo === 'persona') {
    const otro = s.agentes.find((x) => x.id === d.id);
    if (!otro || !otro.presente || otro.actividad === 'caminando') {
      a.actividad = 'libre';
      return;
    }
    a.rot = Math.atan2(otro.x - a.x, otro.z - a.z);
    a.actividad = 'charla';
    a.charlaCon = otro.id;
    otro.charlaCon = a.id;
    otro.previa = otro.actividad;
    otro.actividad = 'charla';
    otro.tiempo = 0;
    decir(s, a, '¿Cómo vas? Cuéntame.', 3);
    return;
  }
  const p: Puesto | undefined = s.mapa.estaciones.find((e) => e.id === d.estacion)?.puestos[d.puesto];
  if (!p) {
    a.actividad = 'libre';
    return;
  }
  a.x = p.x;
  a.z = p.z;
  a.rot = p.rot;
  a.sentado = p.sentado;
  a.actividad = d.hacer;
  if (d.hacer === 'cafe') a.cafes += 1;
}

// --------------------------------- órdenes ----------------------------------

export type Orden =
  | { tipo: 'mover'; x: number; z: number }
  | { tipo: 'trabajar' }
  | { tipo: 'cafe' }
  | { tipo: 'descansar' }
  | { tipo: 'reunion' }
  | { tipo: 'charla'; objetivo: string };

/** Orden directa del jugador a una o varias personas. */
export function ordenar(s: Sim, ids: string[], o: Orden): void {
  const lista = ids.map((id) => s.agentes.find((a) => a.id === id)).filter((a): a is Agente => Boolean(a && a.presente && !a.seVa));
  const tomadas = new Set<number>();
  for (const a of lista) {
    a.esperaHasta = 0;
    switch (o.tipo) {
      case 'mover': {
        const c = celdaLibreCerca(s.mapa, o.x, o.z, tomadas);
        if (!c) break;
        tomadas.add(idx(c[0], c[1]));
        if (caminarA(s, a, c, { tipo: 'punto' })) a.esperaHasta = s.hora + 1.2;
        break;
      }
      case 'trabajar': {
        const agotado = a.rol !== 'ceo' && (a.estres >= 80 || a.energia <= 18);
        if (!irATrabajar(s, a)) {
          decir(s, a, 'No tengo escritorio.');
          break;
        }
        if (agotado) {
          a.forzadoHasta = s.hora + 2;
          a.animo = lim(a.animo - 5);
          decir(s, a, elegir(s, ['Está bien… sigo.', 'Si no queda otra.', 'Ok. Voy.']));
        }
        break;
      }
      case 'cafe':
        a.forzadoHasta = 0;
        if (!irAPuesto(s, a, estacion(s, 'cafe'), 'cafe')) decir(s, a, 'La cafetera está llena.');
        break;
      case 'descansar':
        a.forzadoHasta = 0;
        if (!irAPuesto(s, a, estacion(s, 'sofa'), 'descansando')) decir(s, a, 'No hay sitio en los sofás.');
        else if (a.rol !== 'ceo' && a.estres > 55) decir(s, a, elegir(s, ['Gracias, lo necesitaba.', 'Uf. Gracias.']), 3);
        break;
      case 'reunion':
        a.forzadoHasta = 0;
        if (!irAPuesto(s, a, estacion(s, 'reunion'), 'reunion')) decir(s, a, 'La sala está llena.');
        break;
      case 'charla': {
        if (a.rol !== 'ceo') break;
        const otro = s.agentes.find((x) => x.id === o.objetivo);
        if (!otro || !otro.presente || otro.id === a.id) break;
        // La otra persona se queda donde está y te espera.
        if (otro.actividad === 'caminando') {
          otro.ruta = [];
          otro.destino = null;
          otro.actividad = 'libre';
        }
        otro.esperaHasta = s.hora + 1;
        const ocupadas = new Set(s.agentes.filter((x) => x.presente && x.id !== a.id).map((x) => idx(Math.floor(x.x), Math.floor(x.z))));
        const c = celdaLibreCerca(s.mapa, otro.x, otro.z, ocupadas);
        if (c) caminarA(s, a, c, { tipo: 'persona', id: otro.id });
        break;
      }
    }
  }
}

// ------------------------------- pensamientos -------------------------------

function pensar(s: Sim, a: Agente): string {
  if (a.animo < 25) return elegir(s, ['No sé cuánto más me quedo aquí.', 'Anoche actualicé mi LinkedIn.']);
  if (a.estres > 80) return elegir(s, ['No doy más. Necesito parar.', 'Tres entregas encima y ninguna pausa.']);
  if (a.energia < 25) return elegir(s, ['Necesito un café o me duermo.', 'Estoy sin pilas.']);
  if (a.actividad === 'sin_tarea' && a.aburrido > 1) return elegir(s, ['No tengo nada que hacer.', 'Ordené mi escritorio dos veces ya.']);
  if (a.forzadoHasta > s.hora) return 'Sigo porque me lo pidieron, no porque pueda.';
  if (a.actividad === 'descansando') return elegir(s, ['Cinco minutos más y vuelvo.', 'Esto me hacía falta.']);
  if (a.actividad === 'cafe') return elegir(s, ['Un café y sigo.', 'El mejor momento del día.']);
  if (a.actividad === 'reunion') return elegir(s, ['Bien, ahora entiendo hacia dónde vamos.', 'Ojalá esto termine a la hora.']);
  if (a.alineado) return 'Después de la reunión tengo claro qué sigue.';
  if (a.animo > 78) return elegir(s, ['Me gusta cómo está quedando esto.', 'Buen día. Así sí.']);
  return elegir(s, ['Avanzando.', 'Concentrado en lo mío.', 'Todo en orden por ahora.']).replace('Concentrado', a.genero === 'f' ? 'Concentrada' : 'Concentrado');
}

// ------------------------------ ciclo por agente ----------------------------

function proyectoPara(s: Sim, rol: Area): ProyectoO | undefined {
  return [...s.proyectos].sort((a, b) => a.diaLimite - b.diaLimite).find((p) => p.hecho[rol] < p.necesita[rol]);
}

function completar(s: Sim, p: ProyectoO, por: Agente): void {
  const tarde = s.dia > p.diaLimite;
  const pago = Math.round(p.pago * (tarde ? 0.6 : 1));
  s.caja += pago;
  s.ingresosDia += pago;
  s.stats.facturado += pago;
  s.stats.entregados += 1;
  if (tarde) s.stats.tarde += 1;
  s.reputacion = lim(s.reputacion + (tarde ? -3 : { S: 2, M: 4, L: 8 }[p.tam]));
  s.proyectos = s.proyectos.filter((x) => x.id !== p.id);
  s.efectos.push({ x: por.x, z: por.z, texto: `+${soles(pago)}`, tono: 'bueno' });
  evento(s, tarde ? 'neutro' : 'bueno', tarde ? `Entregaste ${p.nombre} tarde: ${p.cliente} pagó solo ${soles(pago)}.` : `Entregaste ${p.nombre} a tiempo. ${p.cliente} pagó ${soles(pago)}.`);
  for (const a of s.agentes) if (a.rol !== 'ceo' && a.presente) a.animo = lim(a.animo + (tarde ? 1 : 5));
  decir(s, por, tarde ? 'Entregado. Tarde, pero entregado.' : '¡Entregado!', 3.5);
}

function presionHoy(s: Sim, rol: Area): boolean {
  return s.proyectos.some((p) => p.diaLimite <= s.dia && p.hecho[rol] < p.necesita[rol] * 0.75);
}

function vivir(s: Sim, a: Agente, h: number): void {
  a.tiempo += h;
  const empleado = a.rol !== 'ceo';
  let dEnergia = 0;
  let dEstres = 0;
  let dAnimo = (62 - a.animo) * 0.03;

  switch (a.actividad) {
    case 'trabajando': {
      const p = proyectoPara(s, a.rol as Area);
      if (!p) {
        a.actividad = 'sin_tarea';
        a.tiempo = 0;
        break;
      }
      const ritmo = (0.8 + a.habilidad * 0.16) * (0.55 + 0.45 * (a.energia / 100)) * (0.65 + 0.35 * (a.animo / 100)) * (a.alineado ? 1.15 : 1);
      p.hecho[a.rol as Area] += ritmo * h;
      a.aburrido = 0;
      dEnergia = -6.5;
      dEstres = 4.5 + (presionHoy(s, a.rol as Area) ? 3 : 0);
      if (avance(p) >= 0.999 && AREAS.every((r) => p.hecho[r] >= p.necesita[r] - 0.001)) completar(s, p, a);
      break;
    }
    case 'sin_tarea':
      if (empleado && proyectoPara(s, a.rol as Area) && a.lugar && s.mapa.estaciones.find((e) => e.id === a.lugar!.estacion)?.tipo === 'escritorio') {
        a.actividad = 'trabajando';
        a.tiempo = 0;
        break;
      }
      a.aburrido += h;
      dEnergia = -2.5;
      dEstres = -3;
      if (a.aburrido > 1.5) dAnimo -= 2.5;
      break;
    case 'vendiendo':
      dEnergia = -4;
      break;
    case 'caminando':
      dEnergia = -3;
      break;
    case 'cafe':
      if (a.tiempo >= 0.35) {
        const ganancia = [26, 17, 9, 4][Math.min(3, a.cafes - 1)];
        a.energia = lim(a.energia + ganancia);
        a.estres = lim(a.estres - 5);
        a.actividad = 'libre';
        a.tiempo = 0;
        soltarLugar(s, a);
      }
      break;
    case 'descansando':
      dEnergia = 9;
      dEstres = -30;
      dAnimo += 3;
      break;
    case 'reunion': {
      dEstres = -4;
      // Una reunión solo sirve si hay alguien más en la sala.
      const acompanado = s.agentes.some((x) => x.id !== a.id && x.actividad === 'reunion');
      if (empleado && acompanado) a.alineado = true;
      if (a.tiempo >= 0.9) {
        const conCeo = s.agentes.some((x) => x.rol === 'ceo' && x.actividad === 'reunion');
        if (empleado) a.animo = lim(a.animo + (a.alineado ? 6 : 1) + (conCeo ? 4 : 0));
        a.actividad = 'libre';
        a.tiempo = 0;
        soltarLugar(s, a);
        a.sentado = false;
      }
      break;
    }
    case 'charla':
      if (a.tiempo >= 0.45) {
        if (a.rol === 'ceo') {
          const otro = s.agentes.find((x) => x.id === a.charlaCon);
          if (otro) {
            const primera = !otro.unoAUnoHoy;
            otro.animo = lim(otro.animo + (primera ? 12 : 3));
            otro.estres = lim(otro.estres - (primera ? 10 : 2));
            otro.unoAUnoHoy = true;
            otro.avisoFuga = false;
            otro.pensamiento = pensar(s, otro);
            decir(s, otro, otro.pensamiento, 5);
          }
          terminarCharla(s, a);
          a.actividad = 'libre';
          a.tiempo = 0;
        }
      } else if (a.rol !== 'ceo' && !a.charlaCon) {
        a.actividad = a.previa && a.previa !== 'caminando' ? a.previa : 'libre';
        a.previa = null;
      }
      break;
    default:
      dEnergia = -1.5;
  }

  if (!empleado) {
    a.energia = lim(a.energia + dEnergia * h, 30, 100);
    return;
  }
  if (a.estres > 75) dAnimo -= 5;
  if (a.energia < 20) dAnimo -= 3;
  if (a.forzadoHasta > s.hora) dAnimo -= 2;
  a.energia = lim(a.energia + dEnergia * h);
  a.estres = lim(a.estres + dEstres * h);
  a.animo = lim(a.animo + dAnimo * h);
}

function decidir(s: Sim, a: Agente): void {
  if (a.rol === 'ceo' || a.seVa) return;
  // Quiebres: no dependen de lo que el jugador haya ordenado.
  if (a.estres >= 100) {
    a.seVa = true;
    a.licencia = 1;
    decir(s, a, 'No puedo más. Me voy a casa.', 5);
    evento(s, 'malo', `${a.nombre} colapsó por estrés y se fue a casa. Mañana no viene.`);
    salir(s, a, 'licencia');
    return;
  }
  if (a.animo <= 8) {
    a.seVa = true;
    decir(s, a, 'Hasta aquí llegué. Renuncio.', 6);
    salir(s, a, 'renuncia');
    return;
  }
  if (a.animo <= 24 && !a.avisoFuga) {
    a.avisoFuga = true;
    decir(s, a, 'Estoy pensando en irme.', 5);
    evento(s, 'malo', `${a.nombre} está pensando en renunciar. Una conversación contigo puede cambiarlo.`);
  }
  if (a.actividad === 'caminando' || a.actividad === 'charla' || a.actividad === 'cafe' || a.actividad === 'reunion') return;
  const forzado = a.forzadoHasta > s.hora;
  if (a.actividad === 'descansando') {
    if (a.estres < 38 && a.tiempo > 0.4) irATrabajar(s, a);
    return;
  }
  if (!forzado && a.estres >= 84) {
    if (irAPuesto(s, a, estacion(s, 'sofa'), 'descansando')) decir(s, a, elegir(s, ['Necesito parar un rato.', 'Me tomo un respiro.']), 3.5);
    return;
  }
  if (!forzado && a.energia <= 24 && a.cafes < 3) {
    if (irAPuesto(s, a, estacion(s, 'cafe'), 'cafe')) decir(s, a, 'Voy por un café.', 3);
    return;
  }
  if (a.actividad === 'libre' && a.esperaHasta <= s.hora) irATrabajar(s, a);
}

// ---------------------------------- ciclo -----------------------------------

function cerrarDia(s: Sim): void {
  const empleados = s.agentes.filter((a) => a.rol !== 'ceo');
  const sueldos = Math.round(empleados.reduce((t, a) => t + a.salario / 15, 0));
  const gastos = sueldos + ALQUILER_DIA;
  s.caja -= gastos;
  const neto = s.ingresosDia - gastos;
  evento(s, neto >= 0 ? 'bueno' : 'malo', `Cierre del día ${s.dia}: ingresos ${soles(s.ingresosDia)}, sueldos y alquiler ${soles(gastos)}. Resultado ${neto >= 0 ? '+' : ''}${soles(neto)}.`);
  for (const p of [...s.proyectos]) {
    if (s.dia === p.diaLimite) evento(s, 'malo', `${p.nombre} de ${p.cliente} venció hoy. Si lo entregas tarde cobrarás el 60%.`);
    if (s.dia >= p.diaLimite + 2) {
      s.proyectos = s.proyectos.filter((x) => x.id !== p.id);
      s.reputacion = lim(s.reputacion - 5);
      evento(s, 'malo', `${p.cliente} canceló ${p.nombre} por el atraso.`);
    }
  }
  s.ofertas = s.ofertas.filter((o) => o.expiraDia > s.dia);
  s.ingresosDia = 0;
  if (s.caja < -15000) {
    s.fin = 'quiebra';
    evento(s, 'malo', 'La caja no aguantó. La agencia cierra.');
  }
  s.fase = 'noche';
  s.nocheHasta = s.reloj + 2.4;
}

function amanecer(s: Sim): void {
  s.dia += 1;
  s.hora = HORA_ENTRADA;
  s.fase = 'jornada';
  s.proximaOferta = HORA_ENTRADA + 0.6;
  let i = 0;
  for (const a of s.agentes) {
    a.energia = lim(a.energia + 58);
    a.estres = lim(a.estres - 22);
    a.cafes = 0;
    a.unoAUnoHoy = false;
    a.alineado = false;
    a.aburrido = 0;
    a.forzadoHasta = 0;
    a.esperaHasta = 0;
    a.seVa = false;
    a.burbuja = null;
    if (a.licencia > 0) {
      a.licencia -= 1;
      a.llegaA = 99;
      continue;
    }
    a.llegaA = HORA_ENTRADA + i * 0.07;
    i += 1;
  }
  evento(s, 'neutro', `Día ${s.dia}. Buenos días.`);
}

/** Avanza la simulación. `dt` son segundos reales ya multiplicados por la velocidad de juego. */
export function tick(s: Sim, dt: number): void {
  if (s.fin || dt <= 0) return;
  s.reloj += dt;
  if (s.fase === 'noche') {
    if (s.reloj >= s.nocheHasta) amanecer(s);
    return;
  }
  const h = dt / SEG_POR_HORA;
  s.hora += h;

  // Llegadas.
  if (s.fase === 'jornada') {
    for (const a of s.agentes) {
      if (a.presente || a.llegaA > s.hora || a.licencia > 0) continue;
      a.presente = true;
      a.x = s.mapa.fuera.x;
      a.z = s.mapa.fuera.z;
      a.actividad = 'libre';
      a.sentado = false;
      a.llegaA = 99;
      const puerta = s.mapa.puerta;
      a.ruta = [{ x: puerta[0] + 0.5, z: puerta[1] + 0.5 }];
      a.actividad = 'caminando';
      a.destino = { tipo: 'punto' };
      a.esperaHasta = 0;
    }
  }

  for (const a of [...s.agentes]) {
    if (!a.presente) continue;
    if (a.burbuja && a.burbuja.hasta < s.reloj) a.burbuja = null;
    if (a.actividad === 'caminando') mover(s, a, dt);
    if (!a.presente) continue;
    vivir(s, a, h);
    decidir(s, a);
    if (a.rol === 'ceo' && a.actividad === 'libre' && a.esperaHasta <= s.hora && s.fase === 'jornada' && s.hora < HORA_ENTRADA + 0.8 && a.tiempo < 0.02) irATrabajar(s, a);
  }

  // Pensamientos espontáneos: de vez en cuando alguien dice lo que le pasa.
  if (azar(s) < dt * 0.09) {
    const presentes = s.agentes.filter((a) => a.presente && a.rol !== 'ceo' && !a.burbuja && a.actividad !== 'caminando');
    if (presentes.length) {
      const a = elegir(s, presentes);
      a.pensamiento = pensar(s, a);
      if (a.estres > 70 || a.energia < 30 || a.animo < 35 || azar(s) < 0.35) decir(s, a, a.pensamiento, 4);
    }
  }

  // Ofertas nuevas: llegan más seguido si estás vendiendo desde tu despacho.
  if (s.fase === 'jornada' && s.hora >= s.proximaOferta) {
    const vendiendo = s.agentes.some((a) => a.rol === 'ceo' && a.actividad === 'vendiendo');
    if (s.ofertas.length < 3) {
      s.ofertas.push(generarOferta(s));
      evento(s, 'neutro', `Nueva oportunidad: ${s.ofertas[s.ofertas.length - 1].nombre} de ${s.ofertas[s.ofertas.length - 1].cliente}.`);
    }
    s.proximaOferta = s.hora + entre(s, 2.4, 3.6) / (vendiendo ? 1.7 : 1) / (1 + s.reputacion / 120);
  }

  // Fin de la jornada.
  if (s.fase === 'jornada' && s.hora >= HORA_SALIDA) {
    s.fase = 'salida';
    for (const a of s.agentes) if (a.presente) salir(s, a, 'jornada');
  }
  if (s.fase === 'salida' && (s.agentes.every((a) => !a.presente) || s.hora >= HORA_SALIDA + 1.6)) {
    for (const a of [...s.agentes]) if (a.presente) marcharse(s, a, a.destino?.tipo === 'salir' ? a.destino.motivo : 'jornada');
    cerrarDia(s);
  }
}

export function horaTexto(hora: number): string {
  const h = Math.floor(hora);
  const m = Math.floor((hora - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const ACTIVIDAD_TEXTO: Record<Actividad, string> = {
  libre: 'Esperando', caminando: 'Caminando', trabajando: 'Trabajando', sin_tarea: 'Sin tarea', vendiendo: 'Buscando clientes',
  cafe: 'Tomando café', descansando: 'Descansando', reunion: 'En reunión', charla: 'Conversando', fuera: 'Fuera de la oficina',
};

export { ANCHO };
