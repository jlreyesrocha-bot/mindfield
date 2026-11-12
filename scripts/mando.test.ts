// Pruebas del motor de MANDO. Uso: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AREAS } from '../lib/mando/datos';
import { capacidadArea, demandaArea } from '../lib/mando/efectos';
import {
  abrir1a1,
  abrirBusqueda,
  bloqueosDe,
  cerrarSemana,
  contratar,
  forzarSituacion,
  nuevoJuego,
  patrimonio,
  pitch,
  resolverSituacion,
  valoracion,
} from '../lib/mando/motor';
import { SITUACIONES } from '../lib/mando/situaciones';
import type { Juego } from '../lib/mando/types';
import { respuestaLocal } from '../lib/mando/voz';

function finito(g: Juego): boolean {
  const nums = [
    g.caja, g.deuda, g.reputacion, g.estresCeo, g.participacion, valoracion(g), patrimonio(g),
    ...g.personas.flatMap((p) => [p.animo, p.estres, p.energia, p.habilidad, p.salario, p.riesgoFuga]),
    ...g.clientes.map((c) => c.satisfaccion),
    ...g.proyectos.flatMap((p) => [p.presupuesto, p.avance, p.costoTerceros]),
    ...g.facturas.flatMap((f) => [f.monto, f.semanaCobro]),
  ];
  return nums.every((n) => Number.isFinite(n));
}

/** Juega de forma simple y determinista: toma lo que cabe y elige siempre la opción `opcion`. */
function avanzar(g: Juego, semanas: number, opcion = 0): void {
  for (let i = 0; i < semanas && !g.fin; i++) {
    for (const s of g.situaciones) {
      if (s.resuelta) continue;
      const libres = bloqueosDe(g, s).map((b, k) => (b ? -1 : k)).filter((k) => k >= 0);
      const idx = libres.includes(opcion) ? opcion : libres[0] ?? 0;
      resolverSituacion(g, s.uid, idx);
      if (!s.resuelta) for (let k = 0; k < 4 && !s.resuelta; k++) resolverSituacion(g, s.uid, k);
    }
    for (const o of [...g.oportunidades]) {
      const cabe = AREAS.every((a) => {
        const cap = capacidadArea(g, a);
        return cap > 0 && (demandaArea(g, a) + o.demanda[a]) / cap <= 1.15;
      });
      if (cabe) pitch(g, o.id, 'justo', false);
    }
    if (g.semana % 6 === 0 && g.caja > 60000 && !abrirBusqueda(g, AREAS[g.semana % 3])) contratar(g, g.candidatos[1].id);
    assert.ok(cerrarSemana(g), `la semana ${g.semana} debe poder cerrarse`);
  }
}

test('la misma semilla y las mismas decisiones dan la misma partida', () => {
  const a = nuevoJuego({ empresa: 'A', ceo: 'X', modo: 'anual', semilla: 'prueba-1' });
  const b = nuevoJuego({ empresa: 'A', ceo: 'X', modo: 'anual', semilla: 'prueba-1' });
  avanzar(a, 30);
  avanzar(b, 30);
  assert.deepEqual(a, b);
  const c = nuevoJuego({ empresa: 'A', ceo: 'X', modo: 'anual', semilla: 'prueba-2' });
  avanzar(c, 30);
  assert.notDeepEqual(a.historial, c.historial);
});

test('una partida completa termina y mantiene valores finitos', () => {
  for (let i = 0; i < 25; i++) {
    const g = nuevoJuego({ empresa: 'A', ceo: 'X', modo: i % 2 ? 'sprint' : 'anual', semilla: `completa-${i}` });
    avanzar(g, 60, i % 3);
    assert.ok(g.fin, `la partida ${i} debe terminar`);
    assert.ok(finito(g), `valores finitos en la partida ${i}`);
    assert.ok(g.semana <= g.semanasMax + 1);
    for (const p of g.personas) {
      for (const v of [p.animo, p.estres, p.energia, p.riesgoFuga]) assert.ok(v >= 0 && v <= 100);
    }
  }
});

test('no se puede cerrar la semana con decisiones pendientes', () => {
  const g = nuevoJuego({ empresa: 'A', ceo: 'X', modo: 'anual', semilla: 'pendientes' });
  avanzar(g, 3);
  forzarSituacion(g, 'tiempo_personal');
  assert.equal(cerrarSemana(g), null);
});

test('el 1:1 cuesta foco una sola vez por semana y revela con el tiempo', () => {
  const g = nuevoJuego({ empresa: 'A', ceo: 'X', modo: 'anual', semilla: 'unoauno' });
  const p = g.personas[0];
  assert.equal(abrir1a1(g, p.id), null);
  assert.equal(g.foco, 2);
  assert.equal(abrir1a1(g, p.id), null);
  assert.equal(g.foco, 2);
  const r = respuestaLocal(g, p, '¿Qué necesitas de mí?', () => 0.5);
  assert.ok(r.respuesta.length > 10);
  assert.ok(r.revela);
});

test('cada opción de cada situación se puede aplicar sin romper la partida', () => {
  const base = nuevoJuego({ empresa: 'A', ceo: 'X', modo: 'anual', semilla: 'situaciones' });
  avanzar(base, 22);
  // Un estado rico: caja de sobra y etapa alta para que ninguna opción quede bloqueada por contexto.
  base.caja = 900000;
  base.etapa = 4;
  base.foco = 3;
  assert.ok(base.personas.length >= 2 && base.clientes.length >= 1);
  let probadas = 0;
  for (const def of SITUACIONES) {
    for (let i = 0; i < def.opciones.length; i++) {
      for (const semillaAzar of [1, 99991]) {
        const g = structuredClone(base);
        g.rngEstado = (g.rngEstado + semillaAzar * (i + 1)) >>> 0;
        g.situaciones = [];
        const uid = forzarSituacion(g, def.id);
        assert.ok(uid, `se activa ${def.id}`);
        const s = g.situaciones.find((x) => x.uid === uid)!;
        assert.ok(s.texto.length > 20, `${def.id} tiene texto`);
        assert.ok(!/undefined|NaN|\[object/.test(s.texto), `${def.id}: texto limpio`);
        if (bloqueosDe(g, s)[i]) continue;
        const error = resolverSituacion(g, uid!, i);
        assert.equal(error, null, `${def.id} opción ${i}: ${error}`);
        assert.ok(s.resuelta && s.resuelta.resultado.length > 10, `${def.id} opción ${i} devuelve relato`);
        assert.ok(!/undefined|NaN|\[object/.test(s.resuelta.resultado), `${def.id} opción ${i}: relato limpio: ${s.resuelta.resultado}`);
        assert.ok(finito(g), `${def.id} opción ${i} deja valores finitos`);
        // Las consecuencias diferidas también deben poder ejecutarse.
        g.situaciones = g.situaciones.filter((x) => x.resuelta);
        for (let w = 0; w < 14 && !g.fin; w++) {
          for (const pend of g.situaciones) {
            if (pend.resuelta) continue;
            for (let k = 0; k < 4 && !pend.resuelta; k++) resolverSituacion(g, pend.uid, k);
          }
          cerrarSemana(g);
        }
        assert.ok(finito(g), `${def.id} opción ${i}: finito tras los diferidos`);
        probadas++;
      }
    }
  }
  assert.ok(probadas > 150, `se probaron ${probadas} combinaciones`);
});
