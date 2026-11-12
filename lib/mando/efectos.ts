// Mutadores y generadores compartidos por el motor y las situaciones.
import {
  APELLIDOS,
  CLIENTES_BASE,
  NOMBRES,
  NOMBRES_FEE,
  NOMBRES_PROYECTO,
  ROL_INFO,
  TIERS,
  TIERS_FEE,
} from './datos';
import { clamp, elegir, entero, entre, nuevoId } from './rng';
import type {
  Area,
  Candidato,
  Cliente,
  Factura,
  Flujo,
  Genero,
  Juego,
  Motivador,
  Oportunidad,
  Persona,
  Proyecto,
  Rasgo,
  Rol,
  Tier,
} from './types';

// ------------------------------- formato -----------------------------------

export function soles(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? '-' : ''}S/ ${abs.toLocaleString('en-US')}`;
}

export function solesCorto(n: number): string {
  const abs = Math.abs(n);
  const signo = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${signo}S/ ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${signo}S/ ${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${signo}S/ ${(abs / 1000).toFixed(1)}k`;
  return `${signo}S/ ${Math.round(abs)}`;
}

/** Concordancia de género: gen(p, 'cansado', 'cansada') */
export function gen(p: { genero: Genero }, masculino: string, femenino: string): string {
  return p.genero === 'f' ? femenino : masculino;
}

export function primerNombre(p: { nombre: string }): string {
  return p.nombre.split(' ')[0];
}

// ------------------------------- mutadores ---------------------------------

export function caja(g: Juego, monto: number, rubro: keyof Flujo = 'otros'): void {
  g.caja += monto;
  g.flujo[rubro] += monto;
}

export function noticia(g: Juego, tipo: 'bueno' | 'malo' | 'neutro', texto: string): void {
  g.noticias.unshift({ semana: g.semana, tipo, texto });
  if (g.noticias.length > 80) g.noticias.length = 80;
}

export function recordar(p: Persona, hecho: string): void {
  p.memoria.unshift(hecho);
  if (p.memoria.length > 6) p.memoria.length = 6;
}

export function animo(p: Persona, d: number, hecho?: string): void {
  p.animo = clamp(p.animo + d);
  if (hecho) recordar(p, hecho);
}

export function estres(p: Persona, d: number): void {
  p.estres = clamp(p.estres + d);
}

export function energia(p: Persona, d: number): void {
  p.energia = clamp(p.energia + d);
}

export function animoTodos(g: Juego, d: number, hecho?: string, excepto?: string): void {
  for (const p of g.personas) if (p.id !== excepto) animo(p, d, hecho);
}

export function estresTodos(g: Juego, d: number): void {
  for (const p of g.personas) estres(p, d);
}

export function estresArea(g: Juego, area: Rol, d: number): void {
  for (const p of g.personas) if (p.rol === area) estres(p, d);
}

export function rep(g: Juego, d: number): void {
  g.reputacion = clamp(g.reputacion + d);
}

export function sat(c: Cliente, d: number): void {
  c.satisfaccion = clamp(c.satisfaccion + d);
}

export function estresCeo(g: Juego, d: number): void {
  g.estresCeo = clamp(g.estresCeo + d);
}

export function diferir(
  g: Juego,
  semanas: number,
  clave: string,
  datos: Record<string, string | number | boolean> = {},
): void {
  g.diferidos.push({ semana: g.semana + semanas, clave, datos });
}

export function nominaSemanal(g: Juego): number {
  return g.personas.reduce((s, p) => s + p.salario / 4, 0);
}

/** Saca a una persona del equipo. No aplica efectos de moral: eso lo decide quien llama. */
export function sacarPersona(g: Juego, p: Persona, motivo: 'renuncia' | 'despido'): void {
  g.personas = g.personas.filter((x) => x.id !== p.id);
  if (motivo === 'renuncia') {
    g.stats.renuncias += 1;
    g.banderas.ultimaRenuncia = g.semana;
  } else {
    g.stats.despidos += 1;
  }
}

/** Costo de una liquidación al despedir: un mes y medio de sueldo. */
export function liquidacion(p: Persona): number {
  return Math.round(p.salario * 1.5);
}

// ------------------------------ selectores ---------------------------------

export function persona(g: Juego, id?: string): Persona | undefined {
  return id ? g.personas.find((p) => p.id === id) : undefined;
}

export function cliente(g: Juego, id?: string): Cliente | undefined {
  return id ? g.clientes.find((c) => c.id === id) : undefined;
}

export function proyectosActivos(g: Juego): Proyecto[] {
  return g.proyectos.filter((p) => p.estado === 'activo');
}

export function feesActivos(g: Juego): Proyecto[] {
  return g.proyectos.filter((p) => p.estado === 'activo' && p.tipo === 'fee');
}

export function clientesActivos(g: Juego): Cliente[] {
  const ids = new Set(proyectosActivos(g).map((p) => p.clienteId));
  return g.clientes.filter((c) => ids.has(c.id));
}

/** Rendimiento individual: cuánto trabajo saca por semana (1.0 = una persona promedio). */
export function rendimiento(p: Persona): number {
  if (p.fuera > 0) return 0;
  const base = 0.5 + p.habilidad / 10;
  const fEnergia = 0.6 + (0.4 * p.energia) / 100;
  const fAnimo = 0.7 + (0.3 * p.animo) / 100;
  const fRampa = p.rampa > 0 ? 0.6 : 1;
  return base * fEnergia * fAnimo * fRampa;
}

export function mejorPersona(g: Juego, filtro?: (p: Persona) => boolean): Persona | undefined {
  const lista = g.personas.filter((p) => !filtro || filtro(p));
  return lista.sort((a, b) => b.habilidad - a.habilidad)[0];
}

export function peorPersona(g: Juego, filtro?: (p: Persona) => boolean): Persona | undefined {
  const lista = g.personas.filter((p) => !filtro || filtro(p));
  return lista.sort((a, b) => rendimiento(a) - rendimiento(b))[0];
}

export function personaAlAzar(
  g: Juego,
  r: () => number,
  filtro?: (p: Persona) => boolean,
): Persona | undefined {
  const lista = g.personas.filter((p) => !filtro || filtro(p));
  return lista.length ? elegir(r, lista) : undefined;
}

// ------------------------------ generadores --------------------------------

const RASGOS: Rasgo[] = ['ambicioso', 'perfeccionista', 'leal', 'reservado', 'directo', 'optimista', 'ansioso', 'mentor'];
const MOTIVADORES: Motivador[] = ['dinero', 'reconocimiento', 'crecimiento', 'equilibrio', 'proposito'];

export function salarioMercado(g: Juego, habilidad: number, rol: Rol): number {
  const base = 2400 + 650 * habilidad;
  const porRol = rol === 'comercial' || rol === 'operaciones' ? 1.08 : 1;
  const porEtapa = 1 + 0.04 * (g.etapa - 1);
  return Math.round((base * porRol * porEtapa) / 50) * 50;
}

export function cargoDe(rol: Rol, habilidad: number, genero: Genero): string {
  const nivel = habilidad >= 8 ? 2 : habilidad >= 5 ? 1 : 0;
  return ROL_INFO[rol].cargos[nivel][genero === 'f' ? 1 : 0];
}

function nombreLibre(g: Juego, r: () => number): { nombre: string; genero: Genero } {
  const usados = [...g.personas.map((p) => p.nombre), ...g.candidatos.map((c) => c.nombre)];
  // Evita repetir nombre o apellido mientras queden combinaciones libres.
  for (let i = 0; i < 60; i++) {
    const n = elegir(r, NOMBRES);
    const apellido = elegir(r, APELLIDOS);
    const nombre = `${n.n} ${apellido}`;
    const choca = usados.some((u) => u.split(' ')[0] === n.n || u.split(' ')[1] === apellido);
    if (!usados.includes(nombre) && (!choca || i > 45)) return { nombre, genero: n.g };
  }
  const n = elegir(r, NOMBRES);
  return { nombre: `${n.n} ${elegir(r, APELLIDOS)} ${g.contador}`, genero: n.g };
}

export function generarCandidato(
  g: Juego,
  r: () => number,
  rol: Rol,
  rango?: [number, number],
): Candidato {
  const techo = clamp(4 + g.reputacion / 14 + (g.mejoras.includes('casos') ? 0.5 : 0), 5, 10);
  const [min, max] = rango ?? [2, techo];
  const habilidad = Math.round(clamp(entre(r, min, max + 0.49), 1, 10));
  const { nombre, genero } = nombreLibre(g, r);
  const mercado = salarioMercado(g, habilidad, rol);
  return {
    id: nuevoId(g, 'c'),
    nombre,
    genero,
    rol,
    cargo: cargoDe(rol, habilidad, genero),
    habilidad,
    salario: Math.round((mercado * entre(r, 0.93, 1.14)) / 50) * 50,
    salarioMercado: mercado,
    rasgo: elegir(r, RASGOS),
    motivador: elegir(r, MOTIVADORES),
  };
}

export function candidatoAPersona(g: Juego, c: Candidato, rampa = 2): Persona {
  return {
    id: nuevoId(g, 'p'),
    nombre: c.nombre,
    genero: c.genero,
    rol: c.rol,
    cargo: c.cargo,
    habilidad: c.habilidad,
    salario: c.salario,
    salarioMercado: c.salarioMercado,
    rasgo: c.rasgo,
    motivador: c.motivador,
    motivadorRevelado: false,
    animo: 72,
    estres: 22,
    energia: 85,
    riesgoFuga: 0,
    semanaIngreso: g.semana,
    rampa,
    ultima1a1: 0,
    ultimoReconocimiento: g.semana,
    ultimaCapacitacion: g.semana,
    fuera: 0,
    memoria: [`Entré a ${g.empresa} en la semana ${g.semana}.`],
    pensamiento: 'Primeras semanas. Quiero demostrar por qué me eligieron.',
    lider: false,
    chat: [],
  };
}

function nuevoCliente(g: Juego, r: () => number, tier: Tier): Cliente {
  const usados = new Set(g.clientes.map((c) => c.nombre));
  const libres = CLIENTES_BASE.filter((c) => !usados.has(c.nombre));
  const base = libres.length ? elegir(r, libres) : { nombre: `Grupo ${elegir(r, APELLIDOS)} ${g.contador}`, rubro: 'Corporativo' };
  const plazos: Record<Tier, number[]> = { S: [4, 4, 6], M: [4, 6, 8], L: [8, 8, 10], XL: [8, 10, 12] };
  const c: Cliente = {
    id: nuevoId(g, 'k'),
    nombre: base.nombre,
    rubro: base.rubro,
    exigencia: tier === 'S' ? entero(r, 1, 2) : tier === 'M' ? entero(r, 1, 3) : entero(r, 2, 3),
    plazoPago: elegir(r, plazos[tier]),
    satisfaccion: 60,
    entregas: 0,
    activo: false,
  };
  return c;
}

/** Qué tamaños de proyecto te buscan según tu reputación. */
function sortearTier(g: Juego, r: () => number): Tier {
  const pesos: [Tier, number][] = (['S', 'M', 'L', 'XL'] as Tier[]).map((t) => {
    const d = g.reputacion - TIERS[t].repMin;
    if (d < -6) return [t, 0];
    const w = t === 'S' ? Math.max(0.15, 1.2 - g.reputacion / 45) : clamp((d + 8) / 22, 0.05, 1);
    return [t, w];
  });
  const total = pesos.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [t, w] of pesos) {
    x -= w;
    if (x <= 0) return t;
  }
  return 'S';
}

export function generarOportunidad(
  g: Juego,
  r: () => number,
  forzar: Partial<{ tier: Tier; tipo: 'proyecto' | 'fee'; clienteId: string; directo: boolean; factorPrecio: number }> = {},
): Oportunidad {
  const tier = forzar.tier ?? sortearTier(g, r);
  const probFee = g.etapa === 1 ? 0.1 : 0.24;
  const tipo = forzar.tipo ?? (r() < probFee ? 'fee' : 'proyecto');
  let c = forzar.clienteId ? cliente(g, forzar.clienteId) : undefined;
  let clienteNuevo = false;
  if (!c) {
    c = nuevoCliente(g, r, tier);
    g.clientes.push(c);
    clienteNuevo = true;
  }
  const esFee = tipo === 'fee';
  const rango = esFee ? TIERS_FEE[tier].presupuesto : TIERS[tier].presupuesto;
  const presupuesto = Math.round((entre(r, rango[0], rango[1]) * (forzar.factorPrecio ?? 1)) / 500) * 500;
  const demandaBase = esFee ? TIERS_FEE[tier].demanda : TIERS[tier].demanda;
  const variacion = entre(r, 0.9, 1.15);
  const demanda = {
    cuentas: +(demandaBase.cuentas * variacion).toFixed(2),
    creatividad: +(demandaBase.creatividad * variacion).toFixed(2),
    produccion: +(demandaBase.produccion * variacion).toFixed(2),
  };
  return {
    id: nuevoId(g, 'o'),
    clienteId: c.id,
    clienteNombre: c.nombre,
    clienteNuevo,
    rubro: c.rubro,
    nombre: esFee ? NOMBRES_FEE[tier] : elegir(r, NOMBRES_PROYECTO[tier]),
    tipo,
    tier,
    presupuesto,
    costoTerceros: esFee ? +entre(r, 0.08, 0.15).toFixed(2) : +entre(r, 0.36, 0.52).toFixed(2),
    demanda,
    duracion: esFee ? 0 : TIERS[tier].duracion + (r() < 0.25 ? 1 : 0),
    plazoPago: c.plazoPago,
    exigencia: c.exigencia,
    expira: g.semana + 2,
    directo: forzar.directo ?? false,
  };
}

/** Convierte una oportunidad ganada en proyecto activo. */
export function iniciarProyecto(g: Juego, op: Oportunidad, factorPrecio = 1): Proyecto {
  const c = cliente(g, op.clienteId);
  if (c) c.activo = true;
  const presupuesto = Math.round((op.presupuesto * factorPrecio) / 100) * 100;
  // El costo de proveedores no baja cuando das descuento: sale de tu margen.
  const costoTerceros = +((op.presupuesto * op.costoTerceros) / presupuesto).toFixed(3);
  const p: Proyecto = {
    id: nuevoId(g, 'y'),
    clienteId: op.clienteId,
    nombre: op.nombre,
    tipo: op.tipo,
    tier: op.tier,
    presupuesto,
    costoTerceros,
    demanda: { ...op.demanda },
    duracion: op.duracion,
    semanaInicio: g.semana,
    semanaLimite: op.tipo === 'fee' ? 0 : g.semana + op.duracion,
    avance: 0,
    calidadSuma: 0,
    calidadSemanas: 0,
    ajusteCalidad: 0,
    estado: 'activo',
  };
  g.proyectos.push(p);
  // Adelanto a proveedores: la mitad al arrancar (solo proyectos).
  if (p.tipo === 'proyecto') caja(g, -Math.round(p.presupuesto * p.costoTerceros * 0.5), 'terceros');
  return p;
}

/** Atajo para que una situación cree un proyecto directo. */
export function crearProyecto(
  g: Juego,
  r: () => number,
  o: { tier: Tier; tipo?: 'proyecto' | 'fee'; clienteId?: string; factorPrecio?: number },
): Proyecto {
  const op = generarOportunidad(g, r, { tier: o.tier, tipo: o.tipo ?? 'proyecto', clienteId: o.clienteId, directo: true });
  return iniciarProyecto(g, op, o.factorPrecio ?? 1);
}

export function emitirFactura(g: Juego, clienteId: string, concepto: string, monto: number): Factura {
  const c = cliente(g, clienteId);
  const plazo = Math.max(1, (c?.plazoPago ?? 4) - (g.mejoras.includes('crm') ? 1 : 0));
  const f: Factura = {
    id: nuevoId(g, 'f'),
    clienteId,
    concepto,
    monto: Math.round(monto),
    semanaEmision: g.semana,
    semanaCobro: g.semana + plazo,
  };
  g.facturas.push(f);
  g.stats.facturado += f.monto;
  g.facturadoSemanal[g.facturadoSemanal.length - 1] += f.monto;
  return f;
}

export function porCobrar(g: Juego): number {
  return g.facturas.reduce((s, f) => s + f.monto, 0);
}

export function capacidadArea(g: Juego, area: Area): number {
  let cap = g.personas.filter((p) => p.rol === area).reduce((s, p) => s + rendimiento(p), 0);
  cap += g.freelances[area] * 0.95;
  if (area === 'cuentas' && g.etapa <= 2 && g.ceoFuera === 0) cap += g.etapa === 1 ? 0.6 : 0.35;
  if (g.ceoApoyo === area) cap += 0.8;
  return cap;
}

export function demandaArea(g: Juego, area: Area): number {
  return proyectosActivos(g).reduce((s, p) => s + p.demanda[area], 0);
}
