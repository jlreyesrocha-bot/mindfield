// Motor de MANDO: crea la partida, aplica las acciones del CEO y resuelve cada semana.
// Todas las funciones mutan la partida que reciben; la UI trabaja sobre una copia.
import { AREAS, COSTO_PROCESOS, ETAPAS, MEJORAS, OFICINAS, RANGOS, TIERS } from './datos';
import {
  animo,
  animoTodos,
  caja,
  candidatoAPersona,
  capacidadArea,
  cargoDe,
  cliente,
  demandaArea,
  emitirFactura,
  energia,
  estres,
  estresCeo,
  feesActivos,
  generarCandidato,
  generarOportunidad,
  iniciarProyecto,
  liquidacion,
  nominaSemanal,
  noticia,
  persona,
  porCobrar,
  primerNombre,
  proyectosActivos,
  recordar,
  rendimiento,
  rep,
  sacarPersona,
  salarioMercado,
  sat,
  soles,
} from './efectos';
import { clamp, entre, hashSemilla, nuevoId, rnd, rndDe } from './rng';
import { DIFERIDOS, SITUACIONES } from './situaciones';
import type {
  Area,
  Ctx,
  Eje,
  Juego,
  Oportunidad,
  Persona,
  Proyecto,
  ResumenSemana,
  Rol,
  SituacionActiva,
  SituacionDef,
} from './types';
import { pensamiento } from './voz';

export const VERSION = 1;
export const COSTO_FREELANCE = 1900;
export const COSTO_CAPACITACION = 2500;
export const INTERES_SEMANAL = 0.006;

type Res = string | null;

// ------------------------------- selectores --------------------------------

export function animoPromedio(g: Juego): number {
  if (!g.personas.length) return 50;
  return g.personas.reduce((s, p) => s + p.animo, 0) / g.personas.length;
}

export function facturado12(g: Juego): number {
  return g.facturadoSemanal.slice(-12).reduce((s, n) => s + n, 0);
}

/** Ritmo anual de facturación, medido sobre 24 semanas para que una sola factura no lo dispare. */
export function ritmoAnual(g: Juego): number {
  return g.facturadoSemanal.slice(-24).reduce((s, n) => s + n, 0) * (52 / 24);
}

export function valoracion(g: Juego): number {
  const anual = ritmoAnual(g);
  const feeAnual = feesActivos(g).reduce((s, p) => s + p.presupuesto, 0) * 13;
  const parteFee = anual > 0 ? clamp(feeAnual / anual, 0, 1) : 0;
  const multiplo = 0.3 + (g.reputacion / 100) * 0.8 + parteFee * 0.3;
  const salud = 0.7 + (animoPromedio(g) / 100) * 0.5;
  const neto = g.caja - g.deuda + porCobrar(g) * 0.85;
  return Math.round(Math.max(0, neto + anual * multiplo * salud));
}

/** Lo que vale tu parte: el puntaje del juego. */
export function patrimonio(g: Juego): number {
  // cobradoVenta: lo que cobraste en lo personal si vendiste parte de la empresa.
  const castigo = g.fin?.motivo === 'quiebra' ? 0.1 : 1; // en una quiebra casi nada se recupera
  return Math.round(valoracion(g) * g.participacion * castigo + (g.banderas.cobradoVenta ?? 0));
}

/** Los umbrales están pensados para 52 semanas; en una partida corta se escalan. */
export function rangoDe(puntaje: number, semanasMax = 52) {
  const escala = semanasMax <= 26 ? 0.45 : 1;
  return RANGOS.find((r) => puntaje >= r.min * escala) ?? RANGOS[RANGOS.length - 1];
}

export function costoFijoSemanal(g: Juego): number {
  return OFICINAS[g.oficina].costoSemanal + 150 * g.personas.length;
}

export function gastoSemanal(g: Juego): number {
  const free = AREAS.reduce((s, a) => s + g.freelances[a], 0) * COSTO_FREELANCE;
  return nominaSemanal(g) + costoFijoSemanal(g) + free + g.deuda * INTERES_SEMANAL;
}

/** Semanas de vida con la caja actual si no entrara nada. */
export function runway(g: Juego): number {
  const gasto = gastoSemanal(g);
  if (gasto <= 0) return 99;
  return Math.max(0, g.caja / gasto);
}

export function lideres(g: Juego): number {
  return g.personas.filter((p) => p.lider).length;
}

export function capacidadGestion(g: Juego): number {
  const ops = g.personas.filter((p) => p.rol === 'operaciones').length;
  return 6 + g.procesos * 4 + lideres(g) * 3 + ops * 2;
}

/** Personas por encima de lo que tu estructura puede coordinar. */
export function caos(g: Juego): number {
  return Math.max(0, g.personas.length - capacidadGestion(g));
}

export function cargaArea(g: Juego, area: Area): number {
  const cap = capacidadArea(g, area);
  const dem = demandaArea(g, area);
  if (dem <= 0) return 0;
  return cap > 0 ? dem / cap : 9;
}

/** El banco presta contra lo que facturas y lo que te deben. */
export function limiteCredito(g: Juego): number {
  return Math.max(15000, Math.round((facturado12(g) * 0.25 + porCobrar(g) * 0.5) / 1000) * 1000);
}

export function requisitosEtapa(g: Juego) {
  const sig = ETAPAS[g.etapa];
  if (!sig) return null;
  const f12 = facturado12(g);
  const fees = feesActivos(g).length;
  return {
    etapa: sig,
    items: [
      { nombre: 'Personas', actual: g.personas.length, meta: sig.personas, ok: g.personas.length >= sig.personas },
      { nombre: 'Reputación', actual: Math.round(g.reputacion), meta: sig.reputacion, ok: g.reputacion >= sig.reputacion },
      { nombre: 'Facturado en 12 semanas', actual: f12, meta: sig.facturado12, ok: f12 >= sig.facturado12, dinero: true },
      ...(sig.fees > 0 ? [{ nombre: 'Fees mensuales activos', actual: fees, meta: sig.fees, ok: fees >= sig.fees }] : []),
    ],
  };
}

export function focoMaximo(g: Juego): number {
  if (g.ceoFuera > 0) return 0;
  let f = 3;
  if (g.personas.some((p) => p.rol === 'operaciones' && p.habilidad >= 7)) f += 1;
  if (g.etapa >= 3 && lideres(g) >= 2) f += 1;
  if (g.estresCeo >= 80) f -= 1;
  return f;
}

export function calidadProyecto(p: Proyecto): number {
  if (p.calidadSemanas === 0) return 0;
  return clamp(p.calidadSuma / p.calidadSemanas + p.ajusteCalidad, 5, 100);
}

export function calidadEsperada(exigencia: number): number {
  return 60 + exigencia * 5;
}

// ------------------------------ nueva partida -------------------------------

export function semillaReto(fecha = new Date()): string {
  // Semana ISO: la misma semilla para todos durante la semana.
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
  return `reto-${d.getUTCFullYear()}-S${String(semana).padStart(2, '0')}`;
}

export function nuevoJuego(o: { empresa: string; ceo: string; modo: Juego['modo']; semilla?: string }): Juego {
  const semilla = o.semilla ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const g: Juego = {
    version: VERSION,
    semilla,
    modo: o.modo,
    semanasMax: o.modo === 'sprint' ? 26 : 52,
    semana: 1,
    empresa: o.empresa.trim() || 'Tu agencia',
    ceo: o.ceo.trim() || 'CEO',
    rngEstado: hashSemilla(semilla),
    contador: 0,
    caja: 60000,
    deuda: 0,
    reputacion: 12,
    participacion: 1,
    etapa: 1,
    foco: 3,
    focoMax: 3,
    estresCeo: 20,
    ceoFuera: 0,
    procesos: 0,
    oficina: 0,
    mejoras: [],
    personas: [],
    clientes: [],
    proyectos: [],
    facturas: [],
    oportunidades: [],
    candidatos: [],
    candidatosRol: null,
    freelances: { cuentas: 0, creatividad: 0, produccion: 0 },
    ceoApoyo: null,
    prospeccion: 0,
    situaciones: [],
    situacionesVistas: [],
    colaSituaciones: [],
    diferidos: [],
    noticias: [],
    historial: [],
    facturadoSemanal: [0],
    flujo: { cobros: 0, nomina: 0, fijos: 0, terceros: 0, otros: 0 },
    estilo: { personas: 0, resultados: 0, integridad: 0, vision: 0, audacia: 0, delegacion: 0 },
    decisiones: [],
    logros: [],
    racha: 0,
    mejorRacha: 0,
    stats: {
      facturado: 0, entregas: 0, entregasTarde: 0, renuncias: 0, despidos: 0, pitchesGanados: 0,
      pitchesPerdidos: 0, contrataciones: 0, unoAUno: 0, mejorCalidad: 0, semanasEnRojo: 0,
    },
    banderas: {},
    resumen: null,
    fin: null,
  };
  const r = rndDe(g);
  // Tus dos primeros compañeros: llegaron contigo, sin periodo de adaptación.
  const creativo = candidatoAPersona(g, generarCandidato(g, r, 'creatividad', [6, 6]), 0);
  const productor = candidatoAPersona(g, generarCandidato(g, r, 'produccion', [5, 5]), 0);
  for (const p of [creativo, productor]) {
    p.salario = Math.round((p.salarioMercado * 0.95) / 50) * 50;
    p.animo = 78;
    p.memoria = [`Dejé mi trabajo anterior para fundar ${g.empresa} con ${g.ceo}.`];
    p.semanaIngreso = -8; // vienen trabajando contigo desde antes de abrir
    g.personas.push(p);
  }
  creativo.pensamiento = 'Renuncié a un sueldo fijo por esto. Tiene que salir bien.';
  productor.pensamiento = 'Somos tres y una idea. Me gusta cómo suena.';
  // Semana 1: un primer cliente que ya confía en ti y una oportunidad abierta.
  g.oportunidades.push(generarOportunidad(g, r, { tier: 'S', tipo: 'proyecto', directo: true }));
  g.oportunidades.push(generarOportunidad(g, r, { tier: 'S', tipo: 'proyecto' }));
  for (const op of g.oportunidades) op.expira = 3;
  noticia(g, 'neutro', `Nace ${g.empresa}. Tienes ${soles(g.caja)} en caja, dos compañeros y todo por demostrar.`);
  g.historial.push(puntoHistorial(g));
  return g;
}

function puntoHistorial(g: Juego) {
  return {
    semana: g.semana,
    caja: Math.round(g.caja),
    valor: valoracion(g),
    reputacion: Math.round(g.reputacion),
    animo: Math.round(animoPromedio(g)),
    personas: g.personas.length,
  };
}

// --------------------------- acciones del CEO --------------------------------

function gastarFoco(g: Juego, n = 1): Res {
  if (g.ceoFuera > 0) return 'Estás fuera por agotamiento. Esta semana el equipo sigue sin ti.';
  if (g.foco < n) return 'No te queda foco esta semana.';
  g.foco -= n;
  return null;
}

/** Inicia (o continúa) el 1:1 de la semana con una persona. Cuesta 1 de foco la primera vez. */
export function abrir1a1(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  if (p.ultima1a1 === g.semana) return null;
  const e = gastarFoco(g);
  if (e) return e;
  const semanasSin = p.ultima1a1 === 0 ? 99 : g.semana - p.ultima1a1;
  animo(p, semanasSin >= 6 ? 5 : 3);
  estres(p, -4);
  const n = (g.banderas[`n1a1_${pid}`] ?? 0) + 1;
  g.banderas[`n1a1_${pid}`] = n;
  if (n >= 2 || p.animo >= 60) p.motivadorRevelado = true;
  p.ultima1a1 = g.semana;
  recordar(p, `${g.ceo} se sentó a conversar conmigo en la semana ${g.semana}.`);
  g.stats.unoAUno += 1;
  return null;
}

export function registrarChat(g: Juego, pid: string, de: 'ceo' | 'persona', texto: string): void {
  const p = persona(g, pid);
  if (!p) return;
  p.chat.push({ de, texto, semana: g.semana });
  if (p.chat.length > 40) p.chat = p.chat.slice(-40);
}

/** Aplica el efecto de lo que dijiste en el 1:1, con tope semanal para que no se pueda abusar. */
export function efectoChat(g: Juego, pid: string, dAnimo: number, dEstres: number, revela: boolean): void {
  const p = persona(g, pid);
  if (!p) return;
  const kSem = `chatSem_${pid}`;
  const kAcc = `chatAcc_${pid}`;
  if (g.banderas[kSem] !== g.semana) {
    g.banderas[kSem] = g.semana;
    g.banderas[kAcc] = 0;
  }
  const acc = g.banderas[kAcc] ?? 0;
  const d = clamp(dAnimo, -6, 6);
  const permitido = d >= 0 ? Math.min(d, 8 - Math.max(0, acc)) : Math.max(d, -10 - Math.min(0, acc));
  if (permitido !== 0) {
    animo(p, permitido);
    g.banderas[kAcc] = acc + permitido;
  }
  estres(p, clamp(dEstres, -5, 5));
  if (revela) p.motivadorRevelado = true;
}

export function reconocer(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  const e = gastarFoco(g);
  if (e) return e;
  const reciente = g.semana - p.ultimoReconocimiento < 3;
  const d = reciente ? 1 : p.motivador === 'reconocimiento' ? 10 : 5;
  animo(p, d, reciente ? undefined : `${g.ceo} reconoció mi trabajo frente a todo el equipo.`);
  p.ultimoReconocimiento = g.semana;
  return null;
}

export function darBono(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  const costo = Math.round(p.salario * 0.5);
  if (g.caja < costo) return `No alcanza la caja para un bono de ${soles(costo)}.`;
  if (g.banderas[`bono_${pid}`] && g.semana - g.banderas[`bono_${pid}`] < 8) return 'Ya recibió un bono hace poco.';
  caja(g, -costo, 'nomina');
  g.banderas[`bono_${pid}`] = g.semana;
  animo(p, p.motivador === 'dinero' ? 12 : 7, `Recibí un bono de ${soles(costo)}.`);
  return null;
}

export function darAumento(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  if (g.banderas[`aum_${pid}`] && g.semana - g.banderas[`aum_${pid}`] < 8) return 'Ya recibió un aumento hace poco.';
  p.salario = Math.round((p.salario * 1.1) / 50) * 50;
  g.banderas[`aum_${pid}`] = g.semana;
  animo(p, p.motivador === 'dinero' ? 11 : 6, `Me subieron el sueldo a ${soles(p.salario)}.`);
  return null;
}

export function capacitar(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  if (g.caja < COSTO_CAPACITACION) return 'No alcanza la caja para la capacitación.';
  if (g.semana - p.ultimaCapacitacion < 6 && p.ultimaCapacitacion !== p.semanaIngreso) return 'Todavía está aplicando lo de su última capacitación.';
  caja(g, -COSTO_CAPACITACION);
  p.habilidad = Math.min(10, p.habilidad + 0.6);
  p.ultimaCapacitacion = g.semana;
  animo(p, p.motivador === 'crecimiento' ? 9 : 3, 'La empresa pagó una capacitación para mí.');
  return null;
}

export function darDescanso(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  if (p.fuera > 0) return 'Ya está fuera esta semana.';
  p.fuera = 1;
  energia(p, 20);
  estres(p, -14);
  animo(p, p.motivador === 'equilibrio' ? 7 : 3, `${g.ceo} me dio la semana libre para recuperarme.`);
  return null;
}

export function promover(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  if (p.lider) return 'Ya lidera su área.';
  if (g.etapa < 2) return 'Todavía son muy pocos para tener líderes de área.';
  if (g.personas.some((x) => x.lider && x.rol === p.rol)) return 'Esa área ya tiene líder.';
  const e = gastarFoco(g);
  if (e) return e;
  p.lider = true;
  p.salario = Math.round((p.salario * 1.15) / 50) * 50;
  p.cargo = `Líder de ${p.rol === 'produccion' ? 'producción' : p.rol}`;
  animo(p, p.motivador === 'crecimiento' || p.motivador === 'reconocimiento' ? 14 : 8, 'Me nombraron líder de mi área.');
  const encaja = p.rasgo === 'mentor' || p.rasgo === 'directo' || p.rasgo === 'optimista' || p.habilidad >= 8;
  for (const x of g.personas) {
    if (x.id !== p.id && x.rol === p.rol) animo(x, encaja ? 3 : -3, encaja ? `${primerNombre(p)} ahora lidera el área y se nota para bien.` : `${primerNombre(p)} ahora lidera el área. No sé si era la persona.`);
  }
  noticia(g, 'neutro', `${p.nombre} asume el liderazgo de ${p.rol === 'produccion' ? 'producción' : p.rol}.`);
  return null;
}

export function despedir(g: Juego, pid: string): Res {
  const p = persona(g, pid);
  if (!p) return 'Esa persona ya no está en el equipo.';
  const costo = liquidacion(p);
  const e = gastarFoco(g);
  if (e) return e;
  caja(g, -costo, 'nomina');
  const bajo = rendimiento(p) < 0.75 || p.animo < 30;
  sacarPersona(g, p, 'despido');
  animoTodos(g, bajo ? -1 : -5, bajo ? `Despidieron a ${primerNombre(p)}. Se veía venir.` : `Despidieron a ${primerNombre(p)}. Nadie lo esperaba.`);
  noticia(g, 'neutro', `Desvinculaste a ${p.nombre}. Liquidación: ${soles(costo)}.`);
  return null;
}

export function abrirBusqueda(g: Juego, rol: Rol): Res {
  if (g.personas.length >= OFICINAS[g.oficina].cupo) return `En ${OFICINAS[g.oficina].nombre.toLowerCase()} no entra nadie más. Múdate primero.`;
  const e = gastarFoco(g);
  if (e) return e;
  const r = rndDe(g);
  const techo = clamp(4 + g.reputacion / 14, 5, 10);
  g.candidatos = [
    generarCandidato(g, r, rol, [2, 4]),
    generarCandidato(g, r, rol, [4, Math.min(7, techo)]),
    generarCandidato(g, r, rol, [Math.min(6, techo), techo]),
  ];
  g.candidatosRol = rol;
  return null;
}

export function contratar(g: Juego, cid: string): Res {
  const c = g.candidatos.find((x) => x.id === cid);
  if (!c) return 'Ese candidato ya no está disponible.';
  if (g.personas.length >= OFICINAS[g.oficina].cupo) return 'No hay espacio en la oficina.';
  const costo = Math.round(c.salario * 0.25);
  if (g.caja < costo) return `No alcanza la caja para el costo de ingreso (${soles(costo)}).`;
  caja(g, -costo);
  const p = candidatoAPersona(g, c);
  p.pensamiento = pensamiento(g, p, rndDe(g));
  g.personas.push(p);
  g.candidatos = [];
  g.candidatosRol = null;
  g.stats.contrataciones += 1;
  noticia(g, 'bueno', `${p.nombre} se suma como ${p.cargo}.`);
  return null;
}

export function cerrarBusqueda(g: Juego): void {
  g.candidatos = [];
  g.candidatosRol = null;
}

export function ajustarFreelance(g: Juego, area: Area, delta: number): Res {
  const n = g.freelances[area] + delta;
  if (n < 0) return null;
  if (n > 4) return 'Máximo cuatro freelances por área.';
  g.freelances[area] = n;
  return null;
}

export function apoyarArea(g: Juego, area: Area): Res {
  if (g.ceoApoyo) return 'Ya estás metiendo las manos en un área esta semana.';
  const e = gastarFoco(g);
  if (e) return e;
  g.ceoApoyo = area;
  estresCeo(g, 8);
  return null;
}

export function prospectar(g: Juego): Res {
  const e = gastarFoco(g);
  if (e) return e;
  g.prospeccion += 1.3;
  return null;
}

export function descansar(g: Juego): Res {
  const e = gastarFoco(g);
  if (e) return e;
  estresCeo(g, -16);
  return null;
}

export function costoIntegracion(g: Juego): number {
  return 600 + 350 * g.personas.length;
}

export function integracion(g: Juego): Res {
  if (g.banderas.integracion && g.semana - g.banderas.integracion < 6) return 'Hicieron una integración hace poco. Dale unas semanas.';
  const costo = costoIntegracion(g);
  if (g.caja < costo) return 'No alcanza la caja para la integración.';
  const e = gastarFoco(g);
  if (e) return e;
  caja(g, -costo);
  g.banderas.integracion = g.semana;
  for (const p of g.personas) {
    animo(p, 5, 'Tuvimos un día de integración con todo el equipo.');
    estres(p, -5);
  }
  return null;
}

export function apurarCobro(g: Juego, fid: string): Res {
  const f = g.facturas.find((x) => x.id === fid);
  if (!f) return 'Esa factura ya se cobró.';
  if (f.apurada) return 'Ya insististe con esta factura.';
  if (f.semanaCobro <= g.semana + 1) return 'Esa factura ya está por cobrarse.';
  const e = gastarFoco(g);
  if (e) return e;
  f.apurada = true;
  f.semanaCobro = Math.max(g.semana + 1, f.semanaCobro - 2);
  const c = cliente(g, f.clienteId);
  if (c) sat(c, -3);
  return null;
}

export function mejorarProcesos(g: Juego): Res {
  const costo = COSTO_PROCESOS[g.procesos];
  if (costo === undefined) return 'Tus procesos ya están en el nivel máximo.';
  if (g.caja < costo) return `Necesitas ${soles(costo)} en caja.`;
  const e = gastarFoco(g);
  if (e) return e;
  caja(g, -costo);
  g.procesos += 1;
  noticia(g, 'bueno', `Procesos nivel ${g.procesos}: ahora puedes coordinar hasta ${capacidadGestion(g)} personas sin desorden.`);
  return null;
}

export function mudarOficina(g: Juego): Res {
  const sig = OFICINAS[g.oficina + 1];
  if (!sig) return 'Ya estás en la sede más grande.';
  if (g.caja < sig.precio) return `Necesitas ${soles(sig.precio)} en caja para la mudanza.`;
  caja(g, -sig.precio);
  g.oficina += 1;
  animoTodos(g, 3, `Nos mudamos a ${sig.nombre.toLowerCase()}.`);
  noticia(g, 'bueno', `Mudanza a ${sig.nombre.toLowerCase()}: hay espacio para ${sig.cupo} personas.`);
  return null;
}

export function comprarMejora(g: Juego, id: string): Res {
  const m = MEJORAS.find((x) => x.id === id);
  if (!m) return 'Mejora desconocida.';
  if (g.mejoras.includes(id)) return 'Ya la tienes.';
  if (g.etapa < m.etapa) return `Disponible desde la etapa ${ETAPAS[m.etapa - 1].nombre}.`;
  if (g.caja < m.precio) return `Necesitas ${soles(m.precio)} en caja.`;
  caja(g, -m.precio);
  g.mejoras.push(id);
  if (id === 'casos') rep(g, 6);
  noticia(g, 'bueno', `Nueva capacidad: ${m.nombre}.`);
  return null;
}

export function pedirPrestamo(g: Juego, monto: number): Res {
  const disponible = limiteCredito(g) - g.deuda;
  if (monto <= 0) return null;
  if (monto > disponible) return `El banco solo te presta ${soles(Math.max(0, disponible))} más.`;
  g.deuda += monto;
  caja(g, monto);
  return null;
}

export function pagarDeuda(g: Juego, monto: number): Res {
  const m = Math.min(monto, g.deuda);
  if (m <= 0) return null;
  if (g.caja < m) return 'No alcanza la caja.';
  g.deuda -= m;
  caja(g, -m);
  return null;
}

// --------------------------------- pitch -----------------------------------

export type Precio = 'agresivo' | 'justo' | 'premium';
export const FACTOR_PRECIO: Record<Precio, number> = { agresivo: 0.85, justo: 1, premium: 1.15 };

export function costoPitch(op: Oportunidad): number {
  if (op.directo || op.tier === 'S') return 0;
  const base = op.tipo === 'fee' ? op.presupuesto * 3 : op.presupuesto;
  return Math.round((base * 0.008) / 100) * 100;
}

export function probPitch(g: Juego, op: Oportunidad, precio: Precio, liderar: boolean): number {
  if (op.directo) return precio === 'premium' ? 0.72 : precio === 'justo' ? 0.96 : 1;
  const cre = g.personas.filter((p) => p.rol === 'creatividad');
  const skill = cre.length ? cre.reduce((s, p) => s + p.habilidad, 0) / cre.length : 4;
  const com = g.personas.filter((p) => p.rol === 'comercial').reduce((s, p) => s + rendimiento(p), 0);
  let pr = 0.5 + (g.reputacion - TIERS[op.tier].repMin - 8) * 0.012 + (skill - 5) * 0.045;
  pr += precio === 'agresivo' ? 0.17 : precio === 'premium' ? -0.2 : 0;
  if (liderar) pr += 0.14;
  pr += Math.min(0.1, com * 0.04);
  const c = cliente(g, op.clienteId);
  if (c && !op.clienteNuevo) pr += (c.satisfaccion - 55) * 0.006;
  return clamp(pr, 0.06, 0.95);
}

export function pitch(
  g: Juego,
  opId: string,
  precio: Precio,
  liderar: boolean,
): { error?: string; ganado?: boolean; prob?: number; proyecto?: Proyecto } {
  const op = g.oportunidades.find((o) => o.id === opId);
  if (!op) return { error: 'Esa oportunidad ya no está.' };
  const costo = costoPitch(op);
  if (g.caja < costo) return { error: `Preparar este pitch cuesta ${soles(costo)} y no alcanza la caja.` };
  if (liderar) {
    const e = gastarFoco(g);
    if (e) return { error: e };
  }
  if (costo) caja(g, -costo);
  const pr = probPitch(g, op, precio, liderar);
  const ganado = rnd(g) < pr;
  g.oportunidades = g.oportunidades.filter((o) => o.id !== opId);
  if (!ganado) {
    g.stats.pitchesPerdidos += 1;
    noticia(g, 'malo', `Perdiste ${op.nombre} de ${op.clienteNombre}.`);
    return { ganado, prob: pr };
  }
  const proyecto = iniciarProyecto(g, op, FACTOR_PRECIO[precio]);
  g.stats.pitchesGanados += 1;
  animoTodos(g, 2);
  noticia(g, 'bueno', `Ganaste ${op.nombre} de ${op.clienteNombre} por ${soles(proyecto.presupuesto)}${op.tipo === 'fee' ? ' al mes' : ''}.`);
  ganarLogro(g, 'primera_venta');
  if (op.tipo === 'fee') ganarLogro(g, 'primer_fee');
  return { ganado, prob: pr, proyecto };
}

export function pasar(g: Juego, opId: string): void {
  g.oportunidades = g.oportunidades.filter((o) => o.id !== opId);
}

// ------------------------------- situaciones --------------------------------

export function defSituacion(id: string): SituacionDef | undefined {
  return SITUACIONES.find((s) => s.id === id);
}

function ctxDe(g: Juego, s: Pick<SituacionActiva, 'personaId' | 'persona2Id' | 'clienteId' | 'proyectoId' | 'facturaId'>): Ctx {
  return {
    g,
    p: persona(g, s.personaId),
    p2: persona(g, s.persona2Id),
    c: cliente(g, s.clienteId),
    proy: g.proyectos.find((x) => x.id === s.proyectoId),
    f: g.facturas.find((x) => x.id === s.facturaId),
    rnd: rndDe(g),
  };
}

function ctxCompleto(x: Ctx, s: Pick<SituacionActiva, 'personaId' | 'persona2Id' | 'clienteId' | 'proyectoId' | 'facturaId'>): boolean {
  return !((s.personaId && !x.p) || (s.persona2Id && !x.p2) || (s.clienteId && !x.c) || (s.proyectoId && !x.proy) || (s.facturaId && !x.f));
}

export function bloqueosDe(g: Juego, s: SituacionActiva): (string | null)[] {
  const def = defSituacion(s.id);
  if (!def) return [];
  const x = ctxDe(g, s);
  // Evaluar bloqueos no debe consumir azar.
  x.rnd = () => 0.5;
  return def.opciones.map((o) => (o.bloqueo ? o.bloqueo(x) : null));
}

export function resolverSituacion(g: Juego, uid: string, idx: number): Res {
  const s = g.situaciones.find((x) => x.uid === uid);
  if (!s || s.resuelta) return 'Esa situación ya está resuelta.';
  const def = defSituacion(s.id);
  if (!def) {
    s.resuelta = { opcion: idx, resultado: 'La situación se resolvió sola.' };
    return null;
  }
  const x = ctxDe(g, s);
  if (!ctxCompleto(x, s)) {
    s.resuelta = { opcion: -1, resultado: 'Las circunstancias cambiaron y esto ya no requiere una decisión.' };
    return null;
  }
  const op = def.opciones[idx];
  if (!op) return 'Opción inválida.';
  const bloqueo = op.bloqueo?.(x);
  if (bloqueo) return bloqueo;
  const resultado = op.aplicar(x);
  for (const [eje, v] of Object.entries(op.estilo)) g.estilo[eje as Eje] += v ?? 0;
  s.resuelta = { opcion: idx, resultado };
  g.decisiones.push({ semana: g.semana, situacion: def.id, titulo: def.titulo, opcion: op.texto });
  return null;
}

function activarSituacion(g: Juego, def: SituacionDef, ids: Omit<SituacionActiva, 'uid' | 'texto' | 'id'>): void {
  const base = { id: def.id, ...ids };
  const x = ctxDe(g, base);
  g.situaciones.push({ ...base, uid: nuevoId(g, 's'), texto: def.texto(x) });
  if (!g.situacionesVistas.includes(def.id)) g.situacionesVistas.push(def.id);
}

function sortearSituaciones(g: Juego): void {
  g.situaciones = [];
  const r = rndDe(g);
  // 1. Las que venían en cola (renuncias, crisis, seguimientos).
  const pendientes: Juego['colaSituaciones'] = [];
  for (const q of g.colaSituaciones) {
    const def = defSituacion(q.id);
    if (!def) continue;
    if (g.situaciones.length >= 3) {
      pendientes.push(q);
      continue;
    }
    if (!ctxCompleto(ctxDe(g, q), q)) continue;
    activarSituacion(g, def, {
      personaId: q.personaId,
      persona2Id: q.persona2Id,
      clienteId: q.clienteId,
      proyectoId: q.proyectoId,
      facturaId: q.facturaId,
    });
  }
  g.colaSituaciones = pendientes;
  if (g.semana < 2 || g.ceoFuera > 0) return;
  // 2. Las del mazo.
  const cuantas = 1 + (g.etapa >= 2 && r() < 0.35 ? 1 : 0);
  const ultimaCat = g.banderas.ultimaCat ?? -1;
  for (let i = 0; i < cuantas && g.situaciones.length < 3; i++) {
    const candidatas: { def: SituacionDef; ids: Omit<SituacionActiva, 'uid' | 'texto' | 'id'>; peso: number }[] = [];
    for (const def of SITUACIONES) {
      if ((def.peso ?? 1) <= 0) continue;
      if (g.etapa < def.etapas[0] || g.etapa > def.etapas[1]) continue;
      if (!def.repetible && g.situacionesVistas.includes(def.id)) continue;
      if (g.situaciones.some((s) => s.id === def.id)) continue;
      if (def.repetible && g.banderas[`sit_${def.id}`] && g.semana - g.banderas[`sit_${def.id}`] < 8) continue;
      const suj = def.elegir ? def.elegir(g, r) : {};
      if (!suj) continue;
      let peso = def.peso ?? 1;
      if (CATEGORIAS.indexOf(def.categoria) === ultimaCat) peso *= 0.4;
      candidatas.push({
        def,
        peso,
        ids: { personaId: suj.p?.id, persona2Id: suj.p2?.id, clienteId: suj.c?.id, proyectoId: suj.proy?.id, facturaId: suj.f?.id },
      });
    }
    if (!candidatas.length) break;
    const total = candidatas.reduce((s, c) => s + c.peso, 0);
    let t = r() * total;
    const elegida = candidatas.find((c) => (t -= c.peso) <= 0) ?? candidatas[0];
    activarSituacion(g, elegida.def, elegida.ids);
    g.banderas[`sit_${elegida.def.id}`] = g.semana;
    g.banderas.ultimaCat = CATEGORIAS.indexOf(elegida.def.categoria);
  }
}

const CATEGORIAS = ['personas', 'clientes', 'finanzas', 'operaciones', 'etica', 'estrategia', 'crisis'];

/**
 * Pone una situación concreta en la bandeja (para pruebas y depuración).
 * Usa los sujetos que la situación elegiría; si no aplica ahora, intenta con los primeros disponibles.
 */
export function forzarSituacion(g: Juego, id: string): string | null {
  const def = defSituacion(id);
  if (!def) return null;
  const suj = def.elegir?.(g, rndDe(g)) ?? {
    p: g.personas[0],
    p2: g.personas[1],
    c: g.clientes.find((c) => proyectosActivos(g).some((y) => y.clienteId === c.id)) ?? g.clientes[0],
    proy: proyectosActivos(g)[0],
    f: g.facturas[0],
  };
  activarSituacion(g, def, {
    personaId: suj.p?.id,
    persona2Id: suj.p2?.id,
    clienteId: suj.c?.id,
    proyectoId: suj.proy?.id,
    facturaId: suj.f?.id,
  });
  return g.situaciones[g.situaciones.length - 1].uid;
}

export function situacionesPendientes(g: Juego): number {
  return g.situaciones.filter((s) => !s.resuelta).length;
}

// --------------------------------- logros ----------------------------------

function ganarLogro(g: Juego, id: string): void {
  if (!g.logros.includes(id)) g.logros.push(id);
}

function revisarLogros(g: Juego): void {
  if (g.proyectos.length > 0) ganarLogro(g, 'primera_venta');
  if (g.proyectos.some((p) => p.tipo === 'fee')) ganarLogro(g, 'primer_fee');
  if (g.personas.length >= 10) ganarLogro(g, 'equipo_10');
  if (g.personas.length >= 20) ganarLogro(g, 'equipo_20');
  if (g.stats.unoAUno >= 10) ganarLogro(g, 'escucha');
  if (g.caja >= 300000) ganarLogro(g, 'caja_300k');
  const v = valoracion(g);
  if (v >= 1_000_000) ganarLogro(g, 'valor_1m');
  if (v >= 5_000_000) ganarLogro(g, 'valor_5m');
  if (g.reputacion >= 70) ganarLogro(g, 'rep_70');
  if (g.racha >= 5) ganarLogro(g, 'racha_5');
  if (g.racha >= 10) ganarLogro(g, 'racha_10');
  const desde = Math.max(g.banderas.ultimaRenuncia ?? 0, g.banderas.seisPersonasDesde ?? g.semana);
  if (g.personas.length >= 6) {
    if (!g.banderas.seisPersonasDesde) g.banderas.seisPersonasDesde = g.semana;
    if (g.semana - desde >= 20) ganarLogro(g, 'cero_fugas');
  } else {
    g.banderas.seisPersonasDesde = 0;
  }
}

// ----------------------------- cierre de semana ------------------------------

function entregar(g: Juego, p: Proyecto, cargas: Record<Area, number>): void {
  const c = cliente(g, p.clienteId);
  const calidad = calidadProyecto(p);
  const tarde = Math.max(0, g.semana - p.semanaLimite);
  p.estado = 'entregado';
  caja(g, -Math.round(p.presupuesto * p.costoTerceros * 0.5), 'terceros');
  emitirFactura(g, p.clienteId, p.nombre, p.presupuesto);
  g.stats.entregas += 1;
  g.stats.mejorCalidad = Math.max(g.stats.mejorCalidad, Math.round(calidad));
  ganarLogro(g, 'primera_entrega');
  const peso = TIERS[p.tier].peso;
  const esperado = calidadEsperada(c?.exigencia ?? 2);
  const freno = clamp(1.1 - g.reputacion / 85, 0.15, 1.1);
  if (tarde > 0) {
    g.stats.entregasTarde += 1;
    g.racha = 0;
    rep(g, -peso * (1 + tarde * 0.5));
    if (c) sat(c, (calidad - esperado) * 0.6 - 8 * tarde);
    noticia(g, 'malo', `Entregaste ${p.nombre} para ${c?.nombre ?? 'el cliente'} con ${tarde} semana${tarde > 1 ? 's' : ''} de atraso. Calidad ${Math.round(calidad)}.`);
  } else {
    g.racha += 1;
    g.mejorRacha = Math.max(g.mejorRacha, g.racha);
    const bonoRacha = 1 + Math.min(g.racha, 10) * 0.04;
    rep(g, (peso * 1.9 + ((calidad - 62) / 5) * peso) * freno * bonoRacha);
    if (c) sat(c, (calidad - esperado) * 0.8 + 3);
    noticia(g, calidad >= esperado ? 'bueno' : 'neutro', `Entregaste ${p.nombre} para ${c?.nombre ?? 'el cliente'} a tiempo. Calidad ${Math.round(calidad)}${calidad >= esperado ? '' : `, bajo lo que esperaban (${esperado})`}.`);
  }
  if (c) c.entregas += 1;
  if (calidad >= 90) ganarLogro(g, 'calidad_alta');
  g.banderas.ultimaEntrega = g.semana;
  g.banderas.calidadReciente = Math.round(((g.banderas.calidadReciente ?? calidad) * 2 + calidad) / 3);
  for (const x of g.personas) {
    if (!AREAS.includes(x.rol as Area)) continue;
    if (calidad >= 80 && tarde === 0) animo(x, 3, `Entregamos ${p.nombre} y quedó muy bien.`);
    else if (tarde > 0 && cargas[x.rol as Area] > 1.1) animo(x, -2, `Entregamos ${p.nombre} tarde y con todos al límite.`);
  }
}

function cicloFee(g: Juego, p: Proyecto): void {
  const c = cliente(g, p.clienteId);
  const cobertura = clamp(p.avance / 4, 0, 1);
  const calidad = calidadProyecto(p) * (0.5 + 0.5 * cobertura);
  emitirFactura(g, p.clienteId, `${p.nombre} (mes)`, p.presupuesto);
  caja(g, -Math.round(p.presupuesto * p.costoTerceros), 'terceros');
  const esperado = calidadEsperada(c?.exigencia ?? 2);
  if (c) {
    sat(c, (calidad - esperado) * 0.6 + 1);
    const freno = clamp(1.1 - g.reputacion / 85, 0.15, 1.1);
    rep(g, (TIERS[p.tier].peso * 1.2 + ((calidad - 62) / 8) * TIERS[p.tier].peso) * freno);
    if (c.satisfaccion < 30) {
      p.estado = 'cancelado';
      rep(g, -2);
      noticia(g, 'malo', `${c.nombre} canceló su fee mensual. La satisfacción llegó a ${Math.round(c.satisfaccion)}.`);
      animoTodos(g, -2);
    } else {
      noticia(g, 'neutro', `Facturaste el mes de ${c.nombre}: ${soles(p.presupuesto)}. Satisfacción ${Math.round(c.satisfaccion)}.`);
    }
  }
  g.banderas.calidadReciente = Math.round(((g.banderas.calidadReciente ?? calidad) * 2 + calidad) / 3);
  p.avance = 0;
  p.calidadSuma = 0;
  p.calidadSemanas = 0;
  p.ajusteCalidad = 0;
}

function dinamicaPersona(g: Juego, p: Persona, cargas: Record<Area, number>, nivelCaos: number, r: () => number): void {
  const esArea = AREAS.includes(p.rol as Area);
  const L = esArea ? cargas[p.rol as Area] : 0.8;
  const bienestar = g.mejoras.includes('bienestar');
  const factorEstres = p.rasgo === 'ansioso' ? 1.25 : p.rasgo === 'optimista' ? 0.85 : 1;

  if (p.fuera > 0) {
    estres(p, -12);
    energia(p, 16);
  } else if (L > 1) {
    const exceso = Math.min(L - 1, 1);
    estres(p, (5 + 14 * exceso) * factorEstres);
    energia(p, -(4 + 10 * exceso));
  } else if (L >= 0.6) {
    estres(p, -1.5);
    energia(p, 2);
  } else {
    estres(p, -5);
    energia(p, 6);
  }
  if (bienestar) {
    estres(p, -1.5);
    energia(p, 2);
  }
  if (nivelCaos > 0) estres(p, Math.min(4, nivelCaos * 0.6));

  let d = ((p.rasgo === 'optimista' ? 68 : 62) - p.animo) * 0.05;
  if (p.estres > 75) d -= 3;
  else if (p.estres > 55) d -= 1.2;
  else if (p.estres < 30) d += 0.8;
  if (p.energia < 30) d -= 1.5;
  const ratio = p.salario / p.salarioMercado;
  if (ratio < 0.92) d -= p.motivador === 'dinero' ? 2.4 : 1.1;
  else if (ratio > 1.1) d += 0.5;
  const carrera = g.mejoras.includes('carrera');
  if (p.motivador === 'equilibrio' && L > 1.05) d -= 1.5;
  if (p.motivador === 'crecimiento' && g.semana - p.ultimaCapacitacion > 12) d -= carrera ? 0.4 : 1;
  if (p.motivador === 'reconocimiento' && g.semana - p.ultimoReconocimiento > 8) d -= 1.2;
  if (p.motivador === 'proposito') d += clamp(((g.banderas.calidadReciente ?? 68) - 68) / 20, -1, 1);
  if (esArea && L < 0.3 && (p.rasgo === 'ambicioso' || p.motivador === 'crecimiento') && g.semana - p.semanaIngreso > 3) d -= 1;
  if (p.rasgo === 'perfeccionista' && L > 1.15) d -= 1;
  if (g.caja < 0) d -= 1.5;
  if (nivelCaos > 0) d -= Math.min(2, nivelCaos * 0.25);
  animo(p, d);

  if (p.fuera === 0 && L > 0.4) p.habilidad = Math.min(10, p.habilidad + 0.02);
  p.salarioMercado = salarioMercado(g, Math.round(p.habilidad), p.rol);
  if (p.rampa > 0) p.rampa -= 1;
  if (p.fuera > 0) p.fuera -= 1;

  let riesgo = (58 - p.animo) * 1.7 + Math.max(0, p.estres - 65) * 0.7;
  if (ratio < 0.92) riesgo += 14;
  if (p.rasgo === 'ambicioso') riesgo += 6;
  if (p.rasgo === 'leal') riesgo -= 14;
  if (carrera) riesgo -= 8;
  if (g.semana - p.semanaIngreso < 4) riesgo -= 20;
  p.riesgoFuga = clamp(riesgo);
  void r;
}

export function cerrarSemana(g: Juego): ResumenSemana | null {
  if (g.fin) return null;
  if (situacionesPendientes(g) > 0) return null;
  const r = rndDe(g);
  const antes = {
    caja: g.caja,
    valor: valoracion(g),
    reputacion: g.reputacion,
    animo: animoPromedio(g),
    noticias: g.noticias.length,
    logros: [...g.logros],
    etapa: g.etapa,
  };
  // El flujo de la semana incluye lo que ya gastaste con tus acciones.
  const semanaCerrada = g.semana;

  // 1. Trabajo: capacidad contra demanda por área.
  const nivelCaos = caos(g);
  const cargas = {} as Record<Area, number>;
  const fraccion = {} as Record<Area, number>;
  const calidadArea = {} as Record<Area, number>;
  for (const a of AREAS) {
    const cap = capacidadArea(g, a);
    const dem = demandaArea(g, a);
    cargas[a] = dem <= 0 ? 0 : cap > 0 ? dem / cap : 9;
    // El equipo absorbe hasta 25% de sobrecarga con horas extra (y lo paga en estrés).
    fraccion[a] = dem <= 0 ? 1 : clamp((cap * 1.25) / dem, 0, 1);
    const gente = g.personas.filter((p) => p.rol === a && p.fuera === 0);
    let pesoTotal = 0;
    let skill = 0;
    let animoSuma = 0;
    for (const p of gente) {
      const w = rendimiento(p);
      pesoTotal += w;
      skill += p.habilidad * w;
      animoSuma += p.animo * w;
    }
    const free = g.freelances[a] * 0.95;
    pesoTotal += free;
    skill += 5 * free;
    animoSuma += 60 * free;
    const ceo = (a === 'cuentas' && g.etapa <= 2 && g.ceoFuera === 0 ? (g.etapa === 1 ? 0.6 : 0.35) : 0) + (g.ceoApoyo === a ? 0.8 : 0);
    pesoTotal += ceo;
    skill += 6.5 * ceo;
    animoSuma += 70 * ceo;
    if (pesoTotal <= 0) {
      calidadArea[a] = 30;
      continue;
    }
    const skillProm = skill / pesoTotal;
    const animoProm = animoSuma / pesoTotal;
    calidadArea[a] =
      27 + 6.6 * skillProm + g.procesos * 1.5 - nivelCaos * 1.2 - (cargas[a] > 1 ? 18 * Math.min(cargas[a] - 1, 1) : 0) +
      (gente.some((p) => p.lider) ? 3 : 0) + (animoProm - 60) * 0.1;
  }

  for (const p of proyectosActivos(g)) {
    const total = AREAS.reduce((s, a) => s + p.demanda[a], 0) || 1;
    let avance = 0;
    let calidad = 0;
    for (const a of AREAS) {
      const w = p.demanda[a] / total;
      avance += w * fraccion[a];
      calidad += w * calidadArea[a];
    }
    p.avance += avance;
    p.calidadSuma += calidad + entre(r, -4, 4);
    p.calidadSemanas += 1;
    if (p.tipo === 'proyecto') {
      if (p.avance >= p.duracion - 0.001) {
        entregar(g, p, cargas);
      } else if (g.semana >= p.semanaLimite) {
        const c = cliente(g, p.clienteId);
        const atraso = g.semana - p.semanaLimite + 1;
        if (c) sat(c, -5);
        if (atraso === 1) noticia(g, 'malo', `${p.nombre} de ${c?.nombre ?? 'un cliente'} no llegó a la fecha. Falta ${Math.round((1 - p.avance / p.duracion) * 100)}% del trabajo.`);
        if (atraso >= 4) {
          p.estado = 'cancelado';
          g.racha = 0;
          g.stats.entregasTarde += 1;
          rep(g, -TIERS[p.tier].peso * 3);
          if (c) sat(c, -30);
          emitirFactura(g, p.clienteId, `${p.nombre} (parcial)`, p.presupuesto * 0.3);
          noticia(g, 'malo', `${c?.nombre ?? 'El cliente'} canceló ${p.nombre} por el atraso. Solo reconocen el 30%.`);
          animoTodos(g, -4, `Perdimos ${p.nombre} por no llegar a tiempo.`);
        }
      }
    } else if ((g.semana - p.semanaInicio + 1) % 4 === 0) {
      cicloFee(g, p);
    }
  }

  // 2. Cobros.
  const ops = g.personas.filter((p) => p.rol === 'operaciones').length;
  const probDemora = clamp(0.14 - (g.mejoras.includes('crm') ? 0.07 : 0) - ops * 0.03, 0.02, 0.2);
  const pendientes = [];
  for (const f of g.facturas) {
    if (f.semanaCobro > g.semana) {
      pendientes.push(f);
      continue;
    }
    if ((f.demoras ?? 0) < 1 && r() < probDemora) {
      f.demoras = 1;
      f.semanaCobro = g.semana + 2;
      pendientes.push(f);
      noticia(g, 'malo', `${cliente(g, f.clienteId)?.nombre ?? 'Un cliente'} atrasó el pago de ${soles(f.monto)}. Dicen que sale en dos semanas.`);
      continue;
    }
    caja(g, f.monto, 'cobros');
  }
  g.facturas = pendientes;

  // 3. Costos de la semana.
  caja(g, -Math.round(nominaSemanal(g)), 'nomina');
  caja(g, -costoFijoSemanal(g), 'fijos');
  const nFree = AREAS.reduce((s, a) => s + g.freelances[a], 0);
  if (nFree) caja(g, -nFree * COSTO_FREELANCE, 'terceros');
  if (g.deuda > 0) caja(g, -Math.round(g.deuda * INTERES_SEMANAL), 'otros');

  // 4. Personas.
  for (const p of g.personas) dinamicaPersona(g, p, cargas, nivelCaos, r);
  let renunciaEncolada = false;
  let agotamientoEncolado = false;
  for (const p of g.personas) {
    const enCola = g.colaSituaciones.some((q) => q.personaId === p.id);
    if (enCola) continue;
    if (!renunciaEncolada && p.riesgoFuga >= 55 && r() < (p.riesgoFuga - 45) / 220) {
      g.colaSituaciones.push({ id: 'renuncia', personaId: p.id });
      renunciaEncolada = true;
      continue;
    }
    const kAg = `agot_${p.id}`;
    if (!agotamientoEncolado && p.estres >= 88 && p.fuera === 0 && (!g.banderas[kAg] || g.semana - g.banderas[kAg] >= 6)) {
      g.colaSituaciones.push({ id: 'agotamiento', personaId: p.id });
      g.banderas[kAg] = g.semana;
      agotamientoEncolado = true;
    }
  }

  // 5. Tú.
  const focoUsado = g.focoMax - g.foco;
  // Cada punto de foco que usas te desgasta, y una empresa más grande pesa más
  // salvo que tengas líderes en quienes apoyarte.
  const pesoEmpresa = Math.max(0, g.personas.length * 0.25 - lideres(g) * 0.8);
  estresCeo(g, focoUsado * 4 - 5 + pesoEmpresa + Math.min(6, nivelCaos) + (g.caja < 0 ? 6 : 0));
  if (g.ceoFuera > 0) {
    g.ceoFuera -= 1;
    estresCeo(g, -15);
  } else if (g.estresCeo >= 100) {
    g.ceoFuera = 2;
    g.estresCeo = 60;
    animoTodos(g, -4, `${g.ceo} colapsó y estará fuera dos semanas.`);
    noticia(g, 'malo', 'Tu cuerpo dijo basta. Estarás dos semanas fuera y el equipo decide sin ti.');
  }

  // 6. Caja y reputación.
  if (g.caja < 0) {
    // El sobregiro entra solo mientras quede línea de crédito. Sale caro, pero evita el rojo.
    const disponible = limiteCredito(g) - g.deuda;
    if (disponible > 0) {
      const toma = Math.min(disponible, Math.ceil(-g.caja / 1000) * 1000 + 2000);
      g.deuda += toma;
      caja(g, toma);
      noticia(g, 'malo', `La caja no alcanzó y el banco cubrió ${soles(toma)} con tu línea de crédito. Tu deuda sube a ${soles(g.deuda)}.`);
    }
  }
  if (g.caja < 0) {
    g.banderas.rojo = (g.banderas.rojo ?? 0) + 1;
    g.stats.semanasEnRojo += 1;
    if (!g.banderas.cajaCritica || g.semana - g.banderas.cajaCritica >= 3) {
      g.colaSituaciones.push({ id: 'caja_critica' });
      g.banderas.cajaCritica = g.semana;
    }
  } else {
    g.banderas.rojo = 0;
  }
  if (!g.mejoras.includes('casos')) rep(g, -0.1);
  if (g.semana - (g.banderas.ultimaEntrega ?? 0) > 6 && feesActivos(g).length === 0) rep(g, -0.3);

  // 7. Avanza el calendario.
  g.semana += 1;
  g.facturadoSemanal.push(0);
  const vencidos = g.diferidos.filter((d) => d.semana <= g.semana);
  g.diferidos = g.diferidos.filter((d) => d.semana > g.semana);
  for (const d of vencidos) DIFERIDOS[d.clave]?.(g, d.datos, r);

  // 8. Etapa.
  let etapaNueva: number | null = null;
  const req = requisitosEtapa(g);
  if (req && req.items.every((i) => i.ok)) {
    g.etapa += 1;
    etapaNueva = g.etapa;
    rep(g, 2);
    animoTodos(g, 4, `${g.empresa} ya es ${ETAPAS[g.etapa - 1].nombre.toLowerCase()}.`);
    ganarLogro(g, `etapa_${g.etapa}`);
    noticia(g, 'bueno', `Nueva etapa: ${ETAPAS[g.etapa - 1].nombre}. ${ETAPAS[g.etapa - 1].lema}`);
  }
  revisarLogros(g);

  // 9. Fin de la partida.
  const limiteQuiebra = -(nominaSemanal(g) * 8 + 40000);
  if ((g.banderas.rojo ?? 0) >= 4 || g.caja < limiteQuiebra) {
    g.fin = { motivo: 'quiebra', semana: semanaCerrada };
    noticia(g, 'malo', 'La caja no aguantó. La empresa cierra.');
  } else if (g.semana > g.semanasMax) {
    g.fin = { motivo: 'tiempo', semana: semanaCerrada };
  }

  const flujo = { ...g.flujo };
  const resumen: ResumenSemana = {
    semana: semanaCerrada,
    flujo,
    cajaAntes: g.caja - (flujo.cobros + flujo.nomina + flujo.fijos + flujo.terceros + flujo.otros),
    cajaDespues: g.caja,
    valorAntes: antes.valor,
    valorDespues: valoracion(g),
    reputacionAntes: antes.reputacion,
    reputacionDespues: g.reputacion,
    animoAntes: antes.animo,
    animoDespues: animoPromedio(g),
    noticias: g.noticias.slice(0, g.noticias.length - antes.noticias),
    logrosNuevos: g.logros.filter((l) => !antes.logros.includes(l)),
    etapaNueva,
    racha: g.racha,
  };
  g.resumen = resumen;
  g.historial.push(puntoHistorial(g));
  g.flujo = { cobros: 0, nomina: 0, fijos: 0, terceros: 0, otros: 0 };

  if (!g.fin) iniciarSemana(g);
  return resumen;
}

function iniciarSemana(g: Juego): void {
  const r = rndDe(g);
  g.freelances = { cuentas: 0, creatividad: 0, produccion: 0 };
  g.ceoApoyo = null;
  g.candidatos = [];
  g.candidatosRol = null;
  g.focoMax = focoMaximo(g);
  g.foco = g.focoMax;

  // Oportunidades: caducan las viejas y llegan nuevas según reputación y gestión comercial.
  g.oportunidades = g.oportunidades.filter((o) => o.expira > g.semana);
  // Los prospectos que nunca llegaron a ser clientes salen de la lista.
  g.clientes = g.clientes.filter(
    (c) =>
      c.entregas > 0 ||
      g.proyectos.some((p) => p.clienteId === c.id) ||
      g.oportunidades.some((o) => o.clienteId === c.id) ||
      g.facturas.some((f) => f.clienteId === c.id),
  );
  const comercial = g.personas.filter((p) => p.rol === 'comercial').reduce((s, p) => s + rendimiento(p), 0);
  const esperadas = 0.7 + g.reputacion / 40 + g.prospeccion + comercial * 0.7 + (g.mejoras.includes('crm') ? 0.25 : 0);
  g.prospeccion = 0;
  let n = Math.floor(esperadas) + (r() < esperadas % 1 ? 1 : 0);
  n = Math.min(n, 6 - g.oportunidades.length);
  for (let i = 0; i < n; i++) g.oportunidades.push(generarOportunidad(g, r));
  // Los clientes contentos vuelven solos.
  for (const c of g.clientes) {
    if (g.oportunidades.length >= 6) break;
    if (c.entregas === 0 || c.satisfaccion < 68) continue;
    if (proyectosActivos(g).some((p) => p.clienteId === c.id)) continue;
    if (g.oportunidades.some((o) => o.clienteId === c.id)) continue;
    if (r() < 0.1 + (c.satisfaccion - 68) * 0.006) {
      const op = generarOportunidad(g, r, { clienteId: c.id, directo: true });
      g.oportunidades.push(op);
      noticia(g, 'bueno', `${c.nombre} quedó contento y te busca de nuevo: ${op.nombre}.`);
    }
  }

  for (const p of g.personas) {
    p.pensamiento = pensamiento(g, p, r);
    p.cargo = p.lider ? p.cargo : cargoDe(p.rol, Math.round(p.habilidad), p.genero);
  }
  sortearSituaciones(g);
}

// ------------------------------ fin de partida -------------------------------

export interface Perfil {
  arquetipo: string;
  descripcion: string;
  fuerte: Eje;
  ciego: Eje;
  ejes: { eje: Eje; valor: number }[];
}

const ARQUETIPOS: Record<Eje, { nombre: string; desc: string }> = {
  personas: { nombre: 'Capitán de personas', desc: 'Tu primera pregunta es cómo queda tu gente. Eso construye lealtad; cuida que no te impida tomar decisiones duras a tiempo.' },
  resultados: { nombre: 'Operador implacable', desc: 'Proteges el número y la entrega por encima de todo. La empresa avanza; revisa cuánto le está costando al equipo.' },
  integridad: { nombre: 'Brújula firme', desc: 'No negocias lo correcto. Eso te cuesta negocios hoy y te da una reputación que no se compra.' },
  vision: { nombre: 'Arquitecto de largo plazo', desc: 'Sacrificas el alivio inmediato por la empresa que quieres en tres años. Vigila que la caja de hoy alcance para llegar.' },
  audacia: { nombre: 'Apostador calculado', desc: 'Cuando el premio lo vale, vas. Así se crece rápido; así también se pierde rápido.' },
  delegacion: { nombre: 'Formador de líderes', desc: 'Sueltas el control y haces crecer a otros. Es lo que permite escalar; asegúrate de no soltar también el seguimiento.' },
};

export function perfil(g: Juego): Perfil {
  const ejes = (Object.keys(g.estilo) as Eje[]).map((eje) => ({ eje, valor: g.estilo[eje] }));
  const orden = [...ejes].sort((a, b) => b.valor - a.valor);
  const fuerte = orden[0].eje;
  const ciego = orden[orden.length - 1].eje;
  const a = ARQUETIPOS[fuerte];
  return { arquetipo: a.nombre, descripcion: a.desc, fuerte, ciego, ejes };
}

/** Devolución sin IA: lee los números de la partida y señala lo que más pesó. */
export function devolucionLocal(g: Juego): string[] {
  const out: string[] = [];
  const s = g.stats;
  if (g.fin?.motivo === 'quiebra') out.push('La empresa no murió por falta de ventas sino de caja: en este negocio pagas proveedores y planilla semanas antes de cobrar. Revisa en qué momento el crecimiento superó tu colchón.');
  if (s.renuncias >= 3) out.push(`Se fueron ${s.renuncias} personas. Cada renuncia te costó capacidad, calidad y el ánimo de quienes se quedaron. Las señales estaban en sus pensamientos semanas antes.`);
  else if (s.renuncias === 0 && g.personas.length >= 5) out.push('Nadie renunció. Leer el estado de tu equipo y actuar antes del quiebre es la habilidad más rentable que mostraste.');
  if (s.unoAUno < Math.max(4, g.semana / 5)) out.push('Tuviste pocas conversaciones 1:1. Sin ellas decides a ciegas: no sabes qué mueve a cada persona ni quién está por irse.');
  if (s.entregas > 0 && s.entregasTarde / s.entregas > 0.25) out.push('Una de cada cuatro entregas llegó tarde. Aceptar más trabajo del que el equipo puede sacar se paga dos veces: en reputación y en desgaste.');
  if (s.pitchesGanados + s.pitchesPerdidos > 4 && s.pitchesGanados / (s.pitchesGanados + s.pitchesPerdidos) < 0.4) out.push('Perdiste la mayoría de tus pitches. Competir por cuentas para las que todavía no tienes reputación quema dinero y energía creativa.');
  if (g.deuda > facturado12(g) * 0.25 && g.deuda > 20000) out.push('Terminas con deuda alta frente a lo que facturas. El crédito compra tiempo, no resuelve un margen que no alcanza.');
  if (g.participacion < 0.7) out.push(`Te quedaste con ${Math.round(g.participacion * 100)}% de la empresa. El capital ajeno acelera, pero cada punto cedido temprano es el más caro.`);
  if (g.mejorRacha >= 6) out.push(`Tu mejor racha fue de ${g.mejorRacha} entregas a tiempo. La consistencia operativa es lo que convierte clientes en ingresos recurrentes.`);
  if (feesActivos(g).length >= 2) out.push('Construiste ingresos recurrentes. Los fees mensuales son los que te permiten planificar contrataciones sin apostar la caja.');
  if (!out.length) out.push('Partida equilibrada, sin un error dominante. Para subir de rango, busca el siguiente cuello de botella: casi siempre es capacidad de gestión o concentración en pocos clientes.');
  return out.slice(0, 4);
}
