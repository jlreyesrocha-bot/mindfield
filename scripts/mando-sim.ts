// Simulación de balance de MANDO: tres bots juegan muchas partidas y se reporta la
// distribución de resultados. Uso: npx tsx scripts/mando-sim.ts [partidas] [semanas]
import { AREAS, COSTO_PROCESOS, OFICINAS } from '../lib/mando/datos';
import { capacidadArea, demandaArea } from '../lib/mando/efectos';
import {
  abrir1a1,
  abrirBusqueda,
  ajustarFreelance,
  bloqueosDe,
  caos,
  capacitar,
  cerrarSemana,
  comprarMejora,
  contratar,
  darAumento,
  descansar,
  gastoSemanal,
  mejorarProcesos,
  mudarOficina,
  nuevoJuego,
  pasar,
  pedirPrestamo,
  limiteCredito,
  patrimonio,
  pitch,
  probPitch,
  promover,
  prospectar,
  rangoDe,
  reconocer,
  resolverSituacion,
} from '../lib/mando/motor';
import type { Area, Juego, Rol } from '../lib/mando/types';

type Bot = 'pasivo' | 'razonable' | 'agresivo';

function azar(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function carga(g: Juego, a: Area, extra = 0): number {
  const cap = capacidadArea(g, a);
  const dem = demandaArea(g, a) + extra;
  return dem <= 0 ? 0 : cap > 0 ? dem / cap : 9;
}

function decidir(g: Juego, r: () => number): void {
  for (const s of g.situaciones) {
    if (s.resuelta) continue;
    const bloqueos = bloqueosDe(g, s);
    const libres = bloqueos.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);
    const idx = libres.length ? libres[Math.floor(r() * libres.length)] : 0;
    const e = resolverSituacion(g, s.uid, idx);
    if (e) {
      // Si la opción resultó bloqueada, prueba las demás.
      for (let i = 0; i < bloqueos.length && !s.resuelta; i++) resolverSituacion(g, s.uid, i);
      if (!s.resuelta) throw new Error(`Situación sin salida: ${s.id} (${e})`);
    }
  }
}

function jugarSemana(g: Juego, bot: Bot, r: () => number): void {
  decidir(g, r);
  if (bot === 'pasivo') {
    for (const o of [...g.oportunidades]) if (o.directo) pitch(g, o.id, 'justo', false);
    return;
  }
  const tope = bot === 'agresivo' ? 1.6 : 1.12;

  // Oportunidades: toma las que caben; recuerda qué área impide tomar la mejor que no cabe.
  let limitante: Area | null = null;
  for (const o of [...g.oportunidades].sort((a, b) => b.presupuesto - a.presupuesto)) {
    const p = probPitch(g, o, 'justo', false);
    const peor = AREAS.map((a) => ({ a, c: carga(g, a, o.demanda[a]) })).sort((x, y) => y.c - x.c)[0];
    if (peor.c > tope) {
      if (!limitante && p >= 0.35) limitante = peor.a;
      continue;
    }
    if (p < 0.25 && bot === 'razonable') {
      pasar(g, o.id);
      continue;
    }
    pitch(g, o.id, p > 0.8 && !o.directo ? 'premium' : 'justo', g.foco > 1 && p < 0.6);
  }

  // Estructura.
  const gasto = gastoSemanal(g);
  if (g.caja < gasto * 2 && limiteCredito(g) - g.deuda >= 10000) pedirPrestamo(g, 10000);
  const colchon = bot === 'agresivo' ? 4 : 8;
  if (caos(g) > 0 && COSTO_PROCESOS[g.procesos] !== undefined && g.caja > COSTO_PROCESOS[g.procesos] + gasto * 4) mejorarProcesos(g);
  if (g.personas.length >= OFICINAS[g.oficina].cupo && OFICINAS[g.oficina + 1] && g.caja > OFICINAS[g.oficina + 1].precio + gasto * colchon) mudarOficina(g);
  for (const m of ['crm', 'bienestar', 'carrera', 'casos', 'pulso']) {
    if (g.caja > gasto * 14 + 20000) comprarMejora(g, m);
  }

  // Contratación: el área más cargada, si hay caja.
  const cargas = AREAS.map((a) => ({ a, c: carga(g, a) })).sort((x, y) => y.c - x.c);
  if (g.caja > gasto * colchon && g.personas.length < OFICINAS[g.oficina].cupo && g.foco > 0) {
    let rol: Rol | null = cargas[0].c > 0.95 ? cargas[0].a : limitante;
    if (!rol && g.personas.length >= 5 && !g.personas.some((p) => p.rol === 'comercial')) rol = 'comercial';
    if (!rol && g.personas.length >= 8 && !g.personas.some((p) => p.rol === 'operaciones')) rol = 'operaciones';
    if (!rol && bot === 'agresivo' && g.oportunidades.length > 0) rol = cargas[0].a;
    if (rol && !abrirBusqueda(g, rol)) {
      const c = g.candidatos[bot === 'agresivo' ? 2 : 1] ?? g.candidatos[0];
      if (c) contratar(g, c.id);
    }
  }
  for (const { a, c } of cargas) {
    if (c > 1.25 && g.caja > gasto * 3) ajustarFreelance(g, a, 1);
  }

  // Personas.
  if (g.etapa >= 2 && g.foco > 0) {
    for (const a of AREAS) {
      const gente = g.personas.filter((p) => p.rol === a);
      if (gente.length >= 3 && !gente.some((p) => p.lider) && g.foco > 0) promover(g, [...gente].sort((x, y) => y.habilidad - x.habilidad)[0].id);
    }
  }
  if (bot === 'razonable') {
    const orden = [...g.personas].sort((a, b) => a.animo - b.animo);
    for (const p of orden.slice(0, 2)) {
      if (g.foco <= 0) break;
      if (p.animo < 60 && p.ultima1a1 !== g.semana) abrir1a1(g, p.id);
    }
    for (const p of orden) {
      if (p.animo < 50 && g.foco > 0) reconocer(g, p.id);
      if (p.salario < p.salarioMercado * 0.92 && g.caja > gasto * 6) darAumento(g, p.id);
      if (p.motivador === 'crecimiento' && g.semana - p.ultimaCapacitacion > 10 && g.caja > gasto * 8) capacitar(g, p.id);
    }
  }
  if (g.estresCeo > 65 && g.foco > 0) descansar(g);
  while (g.foco > 0 && g.oportunidades.length < 2 && g.prospeccion < 2) prospectar(g);
}

function partida(bot: Bot, semilla: string, modo: Juego['modo']) {
  const g = nuevoJuego({ empresa: 'Sim', ceo: 'Bot', modo, semilla });
  const r = azar(semilla.length * 7919 + semilla.charCodeAt(semilla.length - 1) * 31 + bot.length);
  let guard = 0;
  while (!g.fin && guard++ < 200) {
    jugarSemana(g, bot, r);
    cerrarSemana(g);
    const nums = [g.caja, g.reputacion, g.estresCeo, patrimonio(g), ...g.personas.flatMap((p) => [p.animo, p.estres, p.energia, p.habilidad])];
    if (nums.some((n) => !Number.isFinite(n))) throw new Error(`Valor no finito en semana ${g.semana} (${bot}, ${semilla})`);
  }
  return g;
}

const k = (n: number) => `${Math.round(n / 1000)}k`.padStart(6);

function pct(xs: number[], p: number): number {
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(p * o.length))];
}

// Modo traza: npx tsx scripts/mando-sim.ts traza <bot> <semilla>
if (process.argv[2] === 'traza') {
  const bot = (process.argv[3] ?? 'razonable') as Bot;
  const semilla = process.argv[4] ?? 'sim-1';
  const g = nuevoJuego({ empresa: 'Sim', ceo: 'Bot', modo: 'anual', semilla });
  const r = azar(semilla.length * 7919 + semilla.charCodeAt(semilla.length - 1) * 31 + bot.length);
  while (!g.fin) {
    const sits = g.situaciones.map((s) => s.id).join(',');
    jugarSemana(g, bot, r);
    const cargas = AREAS.map((a) => carga(g, a).toFixed(2)).join('/');
    const act = g.proyectos.filter((p) => p.estado === 'activo');
    console.log(
      `S${String(g.semana).padStart(2)} caja ${k(g.caja)} deuda ${k(g.deuda)} cxc ${k(g.facturas.reduce((x, f) => x + f.monto, 0))} gasto ${k(gastoSemanal(g))} rep ${g.reputacion.toFixed(0).padStart(3)} gente ${g.personas.length} proy ${act.map((p) => p.tier + (p.tipo === 'fee' ? 'f' : '')).join('')} cargas ${cargas} ops ${g.oportunidades.length} foco ${g.foco}/${g.focoMax} et ${g.etapa} ${sits}`,
    );
    cerrarSemana(g);
  }
  console.log(g.fin, g.stats, 'patrimonio', patrimonio(g));
  process.exit(0);
}

// Modo volcar: juega hasta la semana indicada y escribe la partida en JSON (para pruebas de interfaz).
// npx tsx scripts/mando-sim.ts volcar <bot> <semilla> <semana>
if (process.argv[2] === 'volcar') {
  const bot = (process.argv[3] ?? 'razonable') as Bot;
  const semilla = process.argv[4] ?? 'sim-1';
  const hasta = Number(process.argv[5] ?? 52);
  const g = nuevoJuego({ empresa: 'Casa Violeta', ceo: 'José', modo: 'anual', semilla });
  const r = azar(semilla.length * 7919 + semilla.charCodeAt(semilla.length - 1) * 31 + bot.length);
  while (!g.fin && g.semana < hasta) {
    jugarSemana(g, bot, r);
    cerrarSemana(g);
  }
  process.stdout.write(JSON.stringify(g));
  process.exit(0);
}

const N = Number(process.argv[2] ?? 150);
const modo: Juego['modo'] = process.argv[3] === '26' ? 'sprint' : 'anual';

for (const bot of ['pasivo', 'razonable', 'agresivo'] as Bot[]) {
  const gs = Array.from({ length: N }, (_, i) => partida(bot, `sim-${i}`, modo));
  const pat = gs.map(patrimonio);
  const quiebras = gs.filter((g) => g.fin?.motivo === 'quiebra').length;
  const etapas = [1, 2, 3, 4, 5].map((e) => gs.filter((g) => g.etapa === e).length);
  const rangos: Record<string, number> = {};
  for (const p of pat) rangos[rangoDe(p).letra] = (rangos[rangoDe(p).letra] ?? 0) + 1;
  const prom = (f: (g: Juego) => number) => (gs.reduce((s, g) => s + f(g), 0) / N).toFixed(1);
  console.log(`\n== ${bot} (${N} partidas, ${modo}) ==`);
  console.log(`patrimonio  p10 ${k(pct(pat, 0.1))}  p50 ${k(pct(pat, 0.5))}  p90 ${k(pct(pat, 0.9))}  max ${k(Math.max(...pat))}`);
  console.log(`quiebras ${quiebras}  etapas [${etapas.join(', ')}]  rangos ${JSON.stringify(rangos)}`);
  console.log(`personas ${prom((g) => g.personas.length)}  rep ${prom((g) => g.reputacion)}  renuncias ${prom((g) => g.stats.renuncias)}  entregas ${prom((g) => g.stats.entregas)}  tarde ${prom((g) => g.stats.entregasTarde)}  estresCeo ${prom((g) => g.estresCeo)}  animo ${prom((g) => g.personas.reduce((s, p) => s + p.animo, 0) / Math.max(1, g.personas.length))}`);
  const sq = gs.filter((g) => g.fin?.motivo === 'quiebra').map((g) => g.fin!.semana);
  if (sq.length) console.log(`quiebra en semana p10 ${pct(sq, 0.1)} p50 ${pct(sq, 0.5)} p90 ${pct(sq, 0.9)}  deuda p50 ${k(pct(gs.map((g) => g.deuda), 0.5))}`);
  console.log(`caja p50 ${k(pct(gs.map((g) => g.caja), 0.5))}  facturado p50 ${k(pct(gs.map((g) => g.stats.facturado), 0.5))}  situaciones vistas ${prom((g) => g.decisiones.length)}`);
}
