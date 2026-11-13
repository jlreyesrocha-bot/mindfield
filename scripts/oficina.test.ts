// Pruebas de la simulación de la oficina 3D (sin navegador). Uso: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buscarRuta, crearMapa } from '../lib/oficina/mapa';
import { aceptarOferta, buscarCandidatos, comprarEscritorio, contratar, escritoriosLibres, nuevaSim, ordenar, tick, type Sim } from '../lib/oficina/sim';

const avanzar = (s: Sim, segundos: number) => {
  for (let i = 0; i < segundos * 30; i++) tick(s, 1 / 30);
};
const finito = (s: Sim) => [s.caja, s.hora, s.reputacion, ...s.agentes.flatMap((a) => [a.x, a.z, a.rot, a.animo, a.estres, a.energia])].every(Number.isFinite);

test('desde la puerta se llega a todos los puestos de la oficina', () => {
  const m = crearMapa();
  for (const e of m.estaciones) {
    for (const p of e.puestos) assert.ok(buscarRuta(m, m.puerta, p.acceso), `hay ruta a ${e.id}`);
  }
});

test('el equipo llega, trabaja, entrega y vuelve al día siguiente', () => {
  const s = nuevaSim(7);
  aceptarOferta(s, s.ofertas[0].id);
  avanzar(s, 30);
  assert.ok(s.agentes.filter((a) => a.rol !== 'ceo').every((a) => a.actividad === 'trabajando' || a.actividad === 'sin_tarea'), 'todos en su escritorio');
  assert.equal(s.agentes.find((a) => a.rol === 'ceo')!.actividad, 'vendiendo');
  for (let d = 0; d < 4; d++) {
    avanzar(s, 100);
    for (const o of [...s.ofertas]) if (s.proyectos.length < 2) aceptarOferta(s, o.id);
    assert.ok(finito(s));
  }
  assert.ok(s.dia >= 4, `avanzan los días (día ${s.dia})`);
  assert.ok(s.stats.entregados >= 1, 'se entregó al menos un proyecto');
  for (const a of s.agentes) for (const v of [a.animo, a.estres, a.energia]) assert.ok(v >= 0 && v <= 100);
});

test('las órdenes mueven a la gente y la conversación con el CEO sube el ánimo', () => {
  const s = nuevaSim(11);
  avanzar(s, 25);
  const equipo = s.agentes.filter((a) => a.rol !== 'ceo');
  ordenar(s, equipo.map((a) => a.id), { tipo: 'reunion' });
  avanzar(s, 6);
  assert.ok(equipo.every((a) => a.actividad === 'reunion'), 'todos en la sala');
  avanzar(s, 12);
  assert.ok(equipo.every((a) => a.alineado), 'salen de la reunión con rumbo claro');
  const p = equipo[0];
  p.animo = 40;
  ordenar(s, ['ceo'], { tipo: 'charla', objetivo: p.id });
  avanzar(s, 14);
  assert.ok(p.animo > 48, `el 1:1 sube el ánimo (${p.animo.toFixed(0)})`);
  p.estres = 75;
  ordenar(s, [p.id], { tipo: 'descansar' });
  avanzar(s, 9);
  assert.equal(p.actividad, 'descansando');
});

test('obligar a trabajar a alguien agotado cuesta ánimo, y el estrés extremo lo manda a casa', () => {
  const s = nuevaSim(3);
  aceptarOferta(s, s.ofertas[0].id);
  avanzar(s, 25);
  const p = s.agentes.find((a) => a.rol === 'produccion')!;
  p.estres = 90;
  const antes = p.animo;
  ordenar(s, [p.id], { tipo: 'trabajar' });
  assert.ok(p.animo < antes);
  assert.ok(p.forzadoHasta > s.hora);
  p.estres = 100;
  avanzar(s, 1);
  assert.ok(p.seVa && p.licencia === 1);
});

test('contratar exige escritorio libre y la persona nueva llega a trabajar', () => {
  const s = nuevaSim(5);
  avanzar(s, 20);
  buscarCandidatos(s, 'produccion');
  assert.equal(contratar(s, s.candidatos[1].id), null);
  buscarCandidatos(s, 'produccion');
  assert.equal(contratar(s, s.candidatos[1].id), null);
  assert.equal(escritoriosLibres(s), 0);
  buscarCandidatos(s, 'cuentas');
  assert.ok(contratar(s, s.candidatos[0].id), 'sin escritorio no se puede');
  assert.equal(comprarEscritorio(s), null);
  assert.equal(contratar(s, s.candidatos[0].id), null);
  avanzar(s, 15);
  assert.equal(s.agentes.length, 8);
  assert.ok(s.agentes.every((a) => a.presente));
});
