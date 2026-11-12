'use client';

import {
  ArrowRight,
  Award,
  Battery,
  Check,
  Copy,
  Crown,
  Flame,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Lightbulb,
  Megaphone,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  TrendingUp,
  UserMinus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  AREAS,
  EJE_INFO,
  ETAPAS,
  LOGROS,
  MOTIVADOR_INFO,
  RASGO_INFO,
  ROL_INFO,
  TIER_NOMBRE,
} from '@/lib/mando/datos';
import {
  capacidadArea,
  demandaArea,
  liquidacion,
  primerNombre,
  rendimiento,
  soles,
  solesCorto,
} from '@/lib/mando/efectos';
import { registrarEnRanking, type EntradaRanking } from '@/lib/mando/guardado';
import {
  COSTO_CAPACITACION,
  FACTOR_PRECIO,
  abrir1a1,
  animoPromedio,
  bloqueosDe,
  capacitar,
  cerrarBusqueda,
  contratar,
  costoPitch,
  darAumento,
  darBono,
  darDescanso,
  defSituacion,
  despedir,
  devolucionLocal,
  efectoChat,
  facturado12,
  pasar,
  patrimonio,
  perfil,
  pitch,
  probPitch,
  promover,
  rangoDe,
  reconocer,
  registrarChat,
  resolverSituacion,
  type Precio,
} from '@/lib/mando/motor';
import type { Eje, Juego } from '@/lib/mando/types';
import { PREGUNTAS, fichaParaIA, respuestaLocal } from '@/lib/mando/voz';
import { useMando } from './contexto';
import { riesgoVisible } from './paneles';
import { sonar } from './sonido';
import { Avatar, Barra, Boton, Contador, Eyebrow, Medidor, Modal, colorNivel, cx } from './ui';

const CATEGORIA_NOMBRE: Record<string, string> = {
  personas: 'Personas', clientes: 'Clientes', finanzas: 'Finanzas', operaciones: 'Operaciones',
  etica: 'Ética', estrategia: 'Estrategia', crisis: 'Crisis',
};

// -------------------------------- Situación --------------------------------

export function ModalSituacion({ uid }: { uid: string }) {
  const { g, hacer, abrir } = useMando();
  const s = g.situaciones.find((x) => x.uid === uid);
  const def = s ? defSituacion(s.id) : undefined;
  const bloqueos = s && !s.resuelta ? bloqueosDe(g, s) : [];
  if (!s || !def) return null;

  const siguiente = g.situaciones.find((x) => !x.resuelta && x.uid !== uid);
  const elegida = s.resuelta && s.resuelta.opcion >= 0 ? def.opciones[s.resuelta.opcion] : undefined;

  return (
    <Modal etiqueta={def.titulo} onCerrar={() => abrir(null)}>
      <div className="p-6 sm:p-8">
        <Eyebrow>{CATEGORIA_NOMBRE[def.categoria]} · Semana {g.semana}</Eyebrow>
        <h2 className="m-display text-2xl sm:text-3xl mt-2">{def.titulo}</h2>
        <p className="mt-4 text-base" style={{ lineHeight: 1.6 }}>{s.texto}</p>

        {!s.resuelta ? (
          <div className="grid gap-3 mt-6">
            {def.opciones.map((o, i) => (
              <button key={i} type="button" disabled={Boolean(bloqueos[i])} className="m-card m-card-click p-4 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => hacer((d) => resolverSituacion(d, uid, i), 'clic')}>
                <span className="flex gap-3">
                  <span className="m-num shrink-0 flex items-center justify-center rounded-full text-sm" style={{ width: 26, height: 26, background: 'var(--pp-purpura)' }}>{String.fromCharCode(65 + i)}</span>
                  <span>
                    <strong className="block">{o.texto}</strong>
                    {(bloqueos[i] || o.detalle) && <span className={cx('block text-sm mt-0.5', bloqueos[i] ? 'm-mal' : 'm-tenue')}>{bloqueos[i] ?? o.detalle}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 m-entra">
            {elegida && (
              <div className="m-card p-4" style={{ borderColor: 'var(--pp-lavanda)' }}>
                <Eyebrow>Decidiste</Eyebrow>
                <strong className="block mt-1">{elegida.texto}</strong>
              </div>
            )}
            <div className="mt-4">
              <Eyebrow>Lo que pasó</Eyebrow>
              <p className="mt-1 text-base text-white" style={{ lineHeight: 1.6 }}>{s.resuelta.resultado}</p>
            </div>
            {elegida && (
              <>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {(Object.entries(elegida.estilo) as [Eje, number][]).filter(([, v]) => v).map(([eje, v]) => (
                    <span key={eje} className={cx('m-chip', v > 0 ? 'm-chip-ok' : 'm-chip-mal')}>{EJE_INFO[eje].nombre} {v > 0 ? `+${v}` : v}</span>
                  ))}
                </div>
                <div className="m-card p-4 mt-4 flex gap-3" style={{ background: 'rgba(132,102,244,.12)' }}>
                  <Lightbulb size={20} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: 'var(--pp-lavanda)' }} />
                  <div>
                    <Eyebrow>Criterio de liderazgo</Eyebrow>
                    <p className="text-sm mt-1">{def.leccion}</p>
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end mt-6">
              <Boton variante="primario" onClick={() => abrir(siguiente ? { tipo: 'situacion', uid: siguiente.uid } : null)}>
                {siguiente ? 'Siguiente decisión' : 'Continuar'} <ArrowRight size={16} strokeWidth={1.75} />
              </Boton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --------------------------------- Persona ---------------------------------

const MAX_MENSAJES_SEMANA = 6;

export function ModalPersona({ id }: { id: string }) {
  const { g, hacer, abrir, iaDisponible, avisar } = useMando();
  const p = g.personas.find((x) => x.id === id);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [confirmaDespido, setConfirmaDespido] = useState(false);
  const finChat = useRef<HTMLDivElement>(null);
  const nChat = p?.chat.length ?? 0;

  useEffect(() => {
    finChat.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [nChat, pensando]);

  if (!p) {
    return (
      <Modal etiqueta="Persona" onCerrar={() => abrir(null)}>
        <div className="p-8"><p>Esta persona ya no está en el equipo.</p></div>
      </Modal>
    );
  }

  const ve = riesgoVisible(g, p);
  const conversoHoy = p.ultima1a1 === g.semana;
  const mensajesHoy = p.chat.filter((m) => m.semana === g.semana && m.de === 'ceo').length;
  const puedeHablar = (conversoHoy || g.foco >= 1) && mensajesHoy < MAX_MENSAJES_SEMANA && !pensando;
  const ratio = p.salario / p.salarioMercado;
  const nombre = primerNombre(p);

  const enviar = async (mensaje: string) => {
    const limpio = mensaje.trim().slice(0, 600);
    if (!limpio || pensando) return;
    if (!hacer((d) => abrir1a1(d, id))) return;
    hacer((d) => registrarChat(d, id, 'ceo', limpio), 'clic');
    setTexto('');
    setPensando(true);
    const historial = p.chat.filter((m) => m.semana >= g.semana - 8).slice(-10).map((m) => ({ de: m.de, texto: m.texto }));
    let r: { respuesta: string; deltaAnimo: number; deltaEstres: number; revela: boolean } | null = null;
    if (iaDisponible) {
      try {
        const res = await fetch('/api/mando/ia', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tipo: 'persona', ficha: fichaParaIA(g, p), ceo: g.ceo, historial, mensaje: limpio }),
        });
        if (res.ok) r = await res.json();
      } catch {
        r = null;
      }
    }
    if (!r || !r.respuesta) {
      await new Promise((ok) => setTimeout(ok, 650));
      r = respuestaLocal(g, p, limpio, Math.random);
    }
    const final = r;
    hacer((d) => {
      registrarChat(d, id, 'persona', final.respuesta);
      efectoChat(d, id, final.deltaAnimo, final.deltaEstres, final.revela);
    });
    setPensando(false);
  };

  const accion = (fn: (d: Juego) => string | null, ok: string) => {
    if (hacer(fn, 'cobro')) avisar(ok);
  };

  return (
    <Modal etiqueta={p.nombre} onCerrar={() => abrir(null)} ancho={860}>
      <div className="p-6 sm:p-8 grid gap-6 md:grid-cols-[.9fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Avatar p={p} tam={56} />
            <div className="min-w-0">
              <h2 className="m-display text-xl">{p.nombre}</h2>
              <div className="text-sm m-tenue">{p.cargo} · {g.semana - p.semanaIngreso} sem. en la empresa</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.lider && <span className="m-chip m-chip-purpura"><Crown size={12} strokeWidth={1.75} /> Líder de área</span>}
            <span className="m-chip">{RASGO_INFO[p.rasgo]}</span>
            {p.fuera > 0 && <span className="m-chip m-chip-alerta">Fuera {p.fuera} sem.</span>}
            {p.rampa > 0 && <span className="m-chip">Adaptándose</span>}
          </div>

          <div className="grid gap-3 mt-5">
            <Medidor etiqueta="Ánimo" valor={p.animo} icono={<Smile size={13} strokeWidth={1.75} />} />
            <Medidor etiqueta="Estrés" valor={p.estres} invertida icono={<HeartPulse size={13} strokeWidth={1.75} />} />
            <Medidor etiqueta="Energía" valor={p.energia} icono={<Battery size={13} strokeWidth={1.75} />} />
          </div>

          <dl className="grid grid-cols-2 gap-3 mt-5 text-sm">
            <div><dt className="text-xs m-tenue">Habilidad</dt><dd className="m-num">{p.habilidad.toFixed(1)} / 10</dd></div>
            <div><dt className="text-xs m-tenue">Rinde esta semana</dt><dd className="m-num">{Math.round(rendimiento(p) * 100)}%</dd></div>
            <div><dt className="text-xs m-tenue">Sueldo mensual</dt><dd className="m-num">{soles(p.salario)}</dd></div>
            <div><dt className="text-xs m-tenue">El mercado paga</dt><dd className="m-num" style={{ color: ratio < 0.92 ? 'var(--m-mal)' : ratio > 1.08 ? 'var(--m-ok)' : undefined }}>{soles(p.salarioMercado)}</dd></div>
          </dl>

          <div className="m-card p-3 mt-4">
            <Eyebrow>Lo que le mueve</Eyebrow>
            {p.motivadorRevelado ? (
              <p className="text-sm mt-1"><strong>{MOTIVADOR_INFO[p.motivador].nombre}.</strong> {MOTIVADOR_INFO[p.motivador].pista}</p>
            ) : (
              <p className="text-sm mt-1 m-tenue">Todavía no lo sabes. Se descubre conversando.</p>
            )}
          </div>
          <div className="m-card p-3 mt-2">
            <Eyebrow>Ganas de irse</Eyebrow>
            {ve ? (
              <>
                <div className="flex justify-between text-sm mt-1"><span>{p.riesgoFuga >= 55 ? 'Está buscando salida' : p.riesgoFuga >= 30 ? 'Tiene dudas' : 'Se ve aquí'}</span><span className="m-num" style={{ color: colorNivel(p.riesgoFuga, true) }}>{Math.round(p.riesgoFuga)}</span></div>
                <div className="mt-1"><Barra valor={p.riesgoFuga} invertida /></div>
              </>
            ) : (
              <p className="text-sm mt-1 m-tenue">Sin una conversación en las últimas 4 semanas, no lo sabes.</p>
            )}
          </div>

          <div className="mt-5">
            <Eyebrow>Acciones</Eyebrow>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Boton tam="sm" disabled={g.foco < 1} onClick={() => accion((d) => reconocer(d, id), `Reconociste a ${nombre} frente al equipo.`)}><Megaphone size={14} strokeWidth={1.75} /> Reconocer · 1 foco</Boton>
              <Boton tam="sm" onClick={() => accion((d) => darBono(d, id), `Bono entregado a ${nombre}.`)}><HandCoins size={14} strokeWidth={1.75} /> Bono · {solesCorto(p.salario * 0.5)}</Boton>
              <Boton tam="sm" onClick={() => accion((d) => darAumento(d, id), `Aumento del 10% para ${nombre}.`)}><TrendingUp size={14} strokeWidth={1.75} /> Aumento 10%</Boton>
              <Boton tam="sm" onClick={() => accion((d) => capacitar(d, id), `${nombre} empieza una capacitación.`)}><GraduationCap size={14} strokeWidth={1.75} /> Capacitar · {solesCorto(COSTO_CAPACITACION)}</Boton>
              <Boton tam="sm" disabled={p.fuera > 0} onClick={() => accion((d) => darDescanso(d, id), `${nombre} descansa esta semana.`)}><Battery size={14} strokeWidth={1.75} /> Semana libre</Boton>
              <Boton tam="sm" disabled={p.lider || g.etapa < 2 || g.foco < 1} onClick={() => accion((d) => promover(d, id), `${nombre} ahora lidera su área.`)}><Crown size={14} strokeWidth={1.75} /> Hacer líder · 1 foco</Boton>
            </div>
            <div className="mt-2">
              {confirmaDespido ? (
                <div className="m-card p-3" style={{ borderColor: 'rgba(255,122,122,.5)' }}>
                  <p className="text-sm">Despedir a {nombre} cuesta {soles(liquidacion(p))} de liquidación y 1 de foco. El equipo lo va a sentir.</p>
                  <div className="flex gap-2 mt-2">
                    <Boton tam="sm" variante="peligro" onClick={() => { if (hacer((d) => despedir(d, id))) abrir(null); }}>Confirmar despido</Boton>
                    <Boton tam="sm" variante="fantasma" onClick={() => setConfirmaDespido(false)}>Cancelar</Boton>
                  </div>
                </div>
              ) : (
                <Boton tam="sm" variante="fantasma" onClick={() => setConfirmaDespido(true)}><UserMinus size={14} strokeWidth={1.75} /> Despedir</Boton>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Conversación 1:1</Eyebrow>
            <span className="m-chip">{iaDisponible ? <><Sparkles size={12} strokeWidth={1.75} /> Voz con IA</> : 'Voz del simulador'}</span>
          </div>
          <div className="m-card p-3 mt-2 text-sm italic" style={{ color: 'rgba(255,255,255,.85)' }}>
            <span className="m-eyebrow not-italic block mb-1">Lo que piensa esta semana</span>
            «{p.pensamiento}»
          </div>

          <div className="flex-1 overflow-y-auto mt-3 grid gap-2 content-start" style={{ maxHeight: 320 }} aria-live="polite">
            {p.chat.length === 0 && (
              <p className="text-sm m-tenue">Siéntate con {nombre}. La primera pregunta de la semana cuesta 1 de foco; después puedes seguir conversando. Lo que digas mueve su ánimo, para bien o para mal.</p>
            )}
            {p.chat.map((m, i) => (
              <div key={i} className={cx('rounded-2xl px-3.5 py-2 text-sm max-w-[88%]', m.de === 'ceo' ? 'justify-self-end text-white' : 'justify-self-start')}
                style={{ background: m.de === 'ceo' ? 'var(--pp-purpura)' : 'var(--m-superficie-2)', color: m.de === 'ceo' ? '#fff' : 'rgba(255,255,255,.92)' }}>
                {m.texto}
              </div>
            ))}
            {pensando && <div className="rounded-2xl px-3.5 py-2 text-sm justify-self-start m-pulso" style={{ background: 'var(--m-superficie-2)' }}>{nombre} está pensando…</div>}
            <div ref={finChat} />
          </div>

          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {PREGUNTAS.map((q) => (
                <button key={q.id} type="button" className="m-chip hover:text-white disabled:opacity-40" style={{ cursor: 'pointer', padding: '5px 11px' }} disabled={!puedeHablar} onClick={() => enviar(q.texto)}>{q.texto}</button>
              ))}
            </div>
            <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
              <input className="m-input" value={texto} maxLength={600} onChange={(e) => setTexto(e.target.value)} disabled={!puedeHablar}
                placeholder={mensajesHoy >= MAX_MENSAJES_SEMANA ? 'Suficiente por esta semana' : conversoHoy ? `Escríbele a ${nombre}…` : `Escríbele a ${nombre} (1 foco)…`} aria-label={`Mensaje para ${nombre}`} />
              <Boton variante="primario" type="submit" disabled={!puedeHablar || !texto.trim()} aria-label="Enviar"><Send size={16} strokeWidth={1.75} /></Boton>
            </form>
            {!conversoHoy && g.foco < 1 && <p className="text-xs m-alerta mt-1.5">No te queda foco para un 1:1 esta semana.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------- Pitch ----------------------------------

export function ModalPitch({ id }: { id: string }) {
  const { g, hacer, abrir } = useMando();
  const [op] = useState(() => g.oportunidades.find((o) => o.id === id));
  const [precio, setPrecio] = useState<Precio>('justo');
  const [liderar, setLiderar] = useState(false);
  const [fase, setFase] = useState<'elegir' | 'suspenso' | 'resultado'>('elegir');
  const [resultado, setResultado] = useState<{ ganado: boolean; monto: number } | null>(null);
  const [antes, setAntes] = useState<Juego | null>(null);

  if (!op) return null;
  const base = antes ?? g;
  const costo = costoPitch(op);
  const margen = op.presupuesto * FACTOR_PRECIO[precio] - op.presupuesto * op.costoTerceros;
  const prob = probPitch(base, op, precio, liderar);

  const presentar = () => {
    setAntes(g);
    let res: ReturnType<typeof pitch> = {};
    const ok = hacer((d) => {
      res = pitch(d, id, precio, liderar);
      return res.error ?? null;
    });
    if (!ok) return;
    setResultado({ ganado: Boolean(res.ganado), monto: res.proyecto?.presupuesto ?? 0 });
    if (op.directo) {
      setFase('resultado');
      sonar(res.ganado ? 'gana' : 'pierde');
      return;
    }
    setFase('suspenso');
    setTimeout(() => {
      setFase('resultado');
      sonar(res.ganado ? 'gana' : 'pierde');
    }, 1500);
  };

  const opciones: { id: Precio; nombre: string; detalle: string }[] = [
    { id: 'agresivo', nombre: 'Precio agresivo', detalle: '15% menos. Ganas más fácil, con menos margen.' },
    { id: 'justo', nombre: 'Precio justo', detalle: 'Lo que el cliente tiene presupuestado.' },
    { id: 'premium', nombre: 'Precio premium', detalle: '15% más. Solo funciona si tu reputación lo sostiene.' },
  ];

  return (
    <Modal etiqueta={op.nombre} onCerrar={fase === 'suspenso' ? undefined : () => abrir(null)} ancho={720}>
      <div className="p-6 sm:p-8">
        <Eyebrow>{op.clienteNombre} · {op.rubro}{op.clienteNuevo ? ' · Cliente nuevo' : ''}</Eyebrow>
        <h2 className="m-display text-2xl sm:text-3xl mt-2">{op.nombre}</h2>

        {fase === 'elegir' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <DatoP nombre={op.tipo === 'fee' ? 'Fee mensual' : 'Presupuesto'} valor={solesCorto(op.presupuesto)} />
              <DatoP nombre="Proveedores" valor={`${Math.round(op.costoTerceros * 100)}%`} pie={op.tipo === 'proyecto' ? 'La mitad se paga al arrancar' : 'Cada mes'} />
              <DatoP nombre={op.tipo === 'fee' ? 'Duración' : 'Plazo'} valor={op.tipo === 'fee' ? 'Indefinida' : `${op.duracion} sem.`} pie={TIER_NOMBRE[op.tier]} />
              <DatoP nombre="Te pagan a" valor={`${op.plazoPago} sem.`} pie={op.exigencia === 3 ? 'Cliente muy exigente' : op.exigencia === 2 ? 'Cliente exigente' : 'Cliente tranquilo'} />
            </div>

            <div className="mt-5">
              <Eyebrow>Cómo queda tu equipo si lo tomas</Eyebrow>
              <div className="grid gap-2 mt-2">
                {AREAS.map((a) => {
                  const cap = capacidadArea(g, a);
                  const dem = demandaArea(g, a) + op.demanda[a];
                  const carga = cap > 0 ? dem / cap : 9;
                  const color = carga > 1.25 ? 'var(--m-mal)' : carga > 1 ? 'var(--m-alerta)' : 'var(--m-ok)';
                  return (
                    <div key={a} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0">{ROL_INFO[a].nombre}</span>
                      <div className="flex-1"><Barra valor={Math.min(100, (carga / 1.5) * 100)} color={color} /></div>
                      <span className="m-num w-16 text-right" style={{ color }}>{carga > 4 ? 'Sin gente' : `${Math.round(carga * 100)}%`}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 mt-5" role="radiogroup" aria-label="Precio de la propuesta">
              {opciones.map((o) => {
                const pr = probPitch(g, op, o.id, liderar);
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={precio === o.id} className="m-card m-card-click p-3 flex items-center gap-3"
                    style={precio === o.id ? { borderColor: 'var(--pp-lavanda)', background: 'var(--m-superficie-2)' } : undefined} onClick={() => { setPrecio(o.id); sonar('clic'); }}>
                    <span className="flex-1"><strong className="block text-sm">{o.nombre} · {solesCorto(op.presupuesto * FACTOR_PRECIO[o.id])}</strong><span className="text-sm m-tenue">{o.detalle}</span></span>
                    <span className="m-num text-lg" style={{ color: pr >= 0.6 ? 'var(--m-ok)' : pr >= 0.35 ? 'var(--m-alerta)' : 'var(--m-mal)' }}>{Math.round(pr * 100)}%</span>
                  </button>
                );
              })}
            </div>

            {!op.directo && (
              <label className="flex items-center gap-3 mt-3 text-sm cursor-pointer">
                <input type="checkbox" checked={liderar} disabled={g.foco < 1} onChange={(e) => setLiderar(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#4B15EB' }} />
                <span><strong>Presentar tú mismo</strong> · 1 foco, sube tus chances</span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <div className="text-sm flex-1 min-w-[180px]">
                <span className="m-tenue">Te queda después de proveedores: </span><strong>{solesCorto(margen)}{op.tipo === 'fee' ? ' al mes' : ''}</strong>
                {costo > 0 && <span className="m-tenue block">Preparar el pitch cuesta {soles(costo)}, ganes o pierdas.</span>}
              </div>
              <Boton variante="fantasma" onClick={() => { hacer((d) => pasar(d, id)); abrir(null); }}>Dejar pasar</Boton>
              <Boton variante="primario" tam="lg" onClick={presentar}>{op.directo ? 'Aceptar el encargo' : `Presentar · ${Math.round(prob * 100)}%`}</Boton>
            </div>
          </>
        )}

        {fase === 'suspenso' && (
          <div className="py-14 text-center">
            <div className="m-card m-suspenso mx-auto" style={{ height: 8, maxWidth: 320, borderRadius: 999 }} />
            <p className="m-display text-xl mt-6">El cliente está decidiendo…</p>
            <p className="text-sm m-tenue mt-2">Tenías {Math.round(prob * 100)}% de probabilidad.</p>
          </div>
        )}

        {fase === 'resultado' && resultado && (
          <div className="py-10 text-center m-entra">
            {resultado.ganado ? (
              <>
                <Eyebrow className="!text-[var(--m-ok)]">Es tuyo</Eyebrow>
                <p className="m-display mt-3" style={{ fontSize: 'clamp(40px, 8vw, 72px)', color: 'var(--m-ok)' }}>{solesCorto(resultado.monto)}</p>
                <p className="mt-3">{op.tipo === 'fee' ? 'Cada mes, mientras el cliente siga contento.' : `El equipo arranca esta semana. Entrega en ${op.duracion} semanas.`}</p>
              </>
            ) : (
              <>
                <Eyebrow className="!text-[var(--m-mal)]">No esta vez</Eyebrow>
                <p className="m-display text-3xl mt-3">Se fue con otra agencia</p>
                <p className="mt-3 m-tenue">Tenías {Math.round(prob * 100)}%. Más reputación y mejor equipo creativo suben tus chances.</p>
              </>
            )}
            <Boton variante="primario" className="mt-7" onClick={() => abrir(null)}>Continuar</Boton>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DatoP({ nombre, valor, pie }: { nombre: string; valor: string; pie?: string }) {
  return (
    <div className="m-card p-3">
      <div className="text-xs m-tenue">{nombre}</div>
      <div className="m-num text-xl">{valor}</div>
      {pie && <div className="text-[11px] m-tenue">{pie}</div>}
    </div>
  );
}

// -------------------------------- Contratar --------------------------------

export function ModalContratar() {
  const { g, hacer, abrir } = useMando();
  const rol = g.candidatosRol;
  if (!rol || g.candidatos.length === 0) return null;
  return (
    <Modal etiqueta="Candidatos" onCerrar={() => abrir(null)} ancho={860}>
      <div className="p-6 sm:p-8">
        <Eyebrow>Búsqueda abierta · {ROL_INFO[rol].nombre}</Eyebrow>
        <h2 className="m-display text-2xl sm:text-3xl mt-2">Tres finalistas</h2>
        <p className="mt-2 text-sm m-tenue">Verás su personalidad, pero lo que de verdad les mueve se descubre trabajando y conversando. Las primeras dos semanas rinden menos.</p>
        <div className="grid gap-3 sm:grid-cols-3 mt-5">
          {g.candidatos.map((c) => {
            const sobre = c.salario / c.salarioMercado;
            return (
              <div key={c.id} className="m-card p-4 flex flex-col">
                <div className="flex items-center gap-3">
                  <Avatar p={{ nombre: c.nombre, animo: 70, fuera: 0 }} />
                  <div className="min-w-0"><strong className="block truncate">{c.nombre}</strong><span className="text-xs m-tenue block truncate">{c.cargo}</span></div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs m-tenue"><span>Habilidad</span><span className="m-num">{c.habilidad} / 10</span></div>
                  <div className="mt-1"><Barra valor={c.habilidad * 10} color="var(--pp-lavanda)" /></div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3"><span className="m-chip">{RASGO_INFO[c.rasgo]}</span></div>
                <div className="mt-3 text-sm">
                  <span className="m-tenue">Pide </span><strong>{soles(c.salario)}</strong><span className="m-tenue"> al mes</span>
                  <div className="text-xs" style={{ color: sobre > 1.06 ? 'var(--m-alerta)' : sobre < 0.97 ? 'var(--m-ok)' : 'var(--m-tenue)' }}>
                    {sobre > 1.06 ? 'Por encima del mercado' : sobre < 0.97 ? 'Por debajo del mercado' : 'En línea con el mercado'}
                  </div>
                </div>
                <div className="flex-1" />
                <Boton variante="primario" className="mt-4" onClick={() => { if (hacer((d) => contratar(d, c.id), 'gana')) abrir(null); }}>Contratar · {solesCorto(c.salario * 0.25)}</Boton>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-5">
          <Boton variante="fantasma" onClick={() => { hacer((d) => cerrarBusqueda(d)); abrir(null); }}>No contratar a nadie</Boton>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------- Resumen ---------------------------------

export function ModalResumen() {
  const { g, abrir } = useMando();
  const r = g.resumen;
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    if (!r) return;
    const t1 = setTimeout(() => setPaso(1), 60);
    const t2 = setTimeout(() => {
      const neto = r.cajaDespues - r.cajaAntes;
      if (r.etapaNueva) sonar('etapa');
      else if (r.logrosNuevos.length) sonar('gana');
      else sonar(neto >= 0 ? 'cobro' : 'pierde');
    }, 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [r]);

  if (!r) return null;
  const neto = r.cajaDespues - r.cajaAntes;
  const dValor = (r.valorDespues - r.valorAntes) * g.participacion;
  const continuar = () => abrir(g.fin ? { tipo: 'fin' } : null);
  const primera = g.situaciones.find((s) => !s.resuelta);

  const filas: [string, number][] = [
    ['Cobros', r.flujo.cobros],
    ['Planilla', r.flujo.nomina],
    ['Costos fijos', r.flujo.fijos],
    ['Proveedores y freelances', r.flujo.terceros],
    ['Otros', r.flujo.otros],
  ];

  return (
    <Modal etiqueta={`Resumen de la semana ${r.semana}`} ancho={720}>
      <div className="p-6 sm:p-8">
        <Eyebrow>Semana {r.semana} cerrada</Eyebrow>
        {r.etapaNueva ? (
          <div className="mt-2 m-entra">
            <h2 className="m-display m-display-purpura" style={{ fontSize: 'clamp(34px, 7vw, 60px)' }}>{ETAPAS[r.etapaNueva - 1].nombre}</h2>
            <p className="m-outline uppercase text-xl mt-1">Nueva etapa</p>
            <p className="mt-3">{ETAPAS[r.etapaNueva - 1].lema}</p>
          </div>
        ) : (
          <h2 className="m-display text-2xl sm:text-3xl mt-2">
            {neto >= 0 && dValor >= 0 ? 'Buena semana' : neto < 0 && dValor > 0 ? 'Vales más, con menos caja' : neto >= 0 ? 'Entró caja' : 'Semana cuesta arriba'}
          </h2>
        )}

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="m-card p-4">
            <div className="text-xs m-tenue">Caja</div>
            <div className="text-3xl mt-1"><Contador valor={paso ? r.cajaDespues : r.cajaAntes} formato={solesCorto} duracion={900} /></div>
            <div className={cx('text-sm font-semibold mt-1', neto >= 0 ? 'm-ok' : 'm-mal')}>{neto >= 0 ? '+' : ''}{solesCorto(neto)} esta semana</div>
          </div>
          <div className="m-card p-4">
            <div className="text-xs m-tenue">Tu patrimonio</div>
            <div className="text-3xl mt-1"><Contador valor={paso ? r.valorDespues * g.participacion : r.valorAntes * g.participacion} formato={solesCorto} duracion={1100} /></div>
            <div className={cx('text-sm font-semibold mt-1', dValor >= 0 ? 'm-ok' : 'm-mal')}>{dValor >= 0 ? '+' : ''}{solesCorto(dValor)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <Delta nombre="Reputación" antes={r.reputacionAntes} despues={r.reputacionDespues} />
          <Delta nombre="Ánimo del equipo" antes={r.animoAntes} despues={r.animoDespues} />
        </div>

        <div className="m-card p-4 mt-3">
          <Eyebrow>Movimiento de caja</Eyebrow>
          <ul className="mt-2 grid gap-1 text-sm">
            {filas.filter(([, v]) => Math.round(v) !== 0).map(([n, v]) => (
              <li key={n} className="flex justify-between"><span>{n}</span><span className="m-num" style={{ color: v >= 0 ? 'var(--m-ok)' : undefined }}>{v >= 0 ? '+' : ''}{soles(v)}</span></li>
            ))}
          </ul>
          {Math.round(r.flujo.cobros) === 0 && (
            <p className="text-xs m-tenue mt-2">Esta semana no cobraste nada. El trabajo se factura al entregar y el cliente paga semanas después: revisa «Por cobrar» en Clientes.</p>
          )}
        </div>

        {(r.logrosNuevos.length > 0 || r.racha >= 2) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {r.racha >= 2 && <span className="m-chip m-chip-ok" style={{ padding: '5px 12px' }}><Flame size={14} strokeWidth={1.75} /> Racha de {r.racha} entregas a tiempo</span>}
            {r.logrosNuevos.map((l) => (
              <span key={l} className="m-chip m-destello" style={{ padding: '5px 12px', borderColor: 'var(--m-alerta)', color: 'var(--m-alerta)' }}><Award size={14} strokeWidth={1.75} /> Logro: {LOGROS[l]?.nombre ?? l}</span>
            ))}
          </div>
        )}

        {r.noticias.length > 0 && (
          <div className="mt-4">
            <Eyebrow>Lo que pasó</Eyebrow>
            <ul className="grid gap-2 mt-2">
              {r.noticias.map((n, i) => (
                <li key={i} className="flex gap-2.5 text-sm m-entra" style={{ animationDelay: `${200 + i * 90}ms` }}>
                  <span className="mt-1.5 block rounded-full shrink-0" style={{ width: 7, height: 7, background: n.tipo === 'bueno' ? 'var(--m-ok)' : n.tipo === 'malo' ? 'var(--m-mal)' : 'var(--m-tenue)' }} />
                  <span>{n.texto}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6">
          <span className="text-sm m-tenue">{g.fin ? 'La partida terminó.' : primera ? `Te espera${g.situaciones.filter((s) => !s.resuelta).length > 1 ? 'n' : ''} ${g.situaciones.filter((s) => !s.resuelta).length} decisión${g.situaciones.filter((s) => !s.resuelta).length > 1 ? 'es' : ''}.` : ''}</span>
          <Boton variante="primario" tam="lg" onClick={continuar}>{g.fin ? 'Ver el resultado' : `Empezar la semana ${g.semana}`} <ArrowRight size={18} strokeWidth={1.75} /></Boton>
        </div>
      </div>
    </Modal>
  );
}

function Delta({ nombre, antes, despues }: { nombre: string; antes: number; despues: number }) {
  const d = Math.round(despues) - Math.round(antes);
  return (
    <div className="m-card p-3 flex items-center justify-between">
      <span className="text-sm">{nombre}</span>
      <span className="flex items-baseline gap-2"><span className="m-num text-lg">{Math.round(despues)}</span>{d !== 0 && <span className={cx('text-sm font-semibold', d > 0 ? 'm-ok' : 'm-mal')}>{d > 0 ? `+${d}` : d}</span>}</span>
    </div>
  );
}

// ----------------------------------- Fin -----------------------------------

function resumenParaCoach(g: Juego): string {
  const pf = perfil(g);
  return [
    `Empresa: ${g.empresa}. CEO: ${g.ceo}. Partida de ${g.semanasMax} semanas; terminó en la semana ${g.fin?.semana} por: ${g.fin?.motivo === 'quiebra' ? 'quiebra (caja agotada)' : 'fin del plazo'}.`,
    `Resultado: patrimonio del fundador ${soles(patrimonio(g))} (participación ${Math.round(g.participacion * 100)}%), etapa alcanzada ${ETAPAS[g.etapa - 1].nombre} (${g.etapa} de 5), reputación ${Math.round(g.reputacion)}/100, caja ${soles(g.caja)}, deuda ${soles(g.deuda)}, facturado total ${soles(g.stats.facturado)}, facturado últimas 12 semanas ${soles(facturado12(g))}.`,
    `Equipo: ${g.personas.length} personas, ánimo promedio ${Math.round(animoPromedio(g))}/100, ${g.stats.contrataciones} contrataciones, ${g.stats.renuncias} renuncias, ${g.stats.despidos} despidos, ${g.stats.unoAUno} conversaciones 1:1 en total.`,
    `Operación: ${g.stats.entregas} entregas (${g.stats.entregasTarde} tarde), mejor racha a tiempo ${g.mejorRacha}, mejor calidad ${g.stats.mejorCalidad}, pitches ganados ${g.stats.pitchesGanados} y perdidos ${g.stats.pitchesPerdidos}, semanas con caja en rojo ${g.stats.semanasEnRojo}, nivel de procesos ${g.procesos}/5.`,
    `Perfil de estilo (suma de sus decisiones): ${pf.ejes.map((e) => `${EJE_INFO[e.eje].nombre} ${e.valor}`).join(', ')}.`,
    `Decisiones que tomó, en orden:\n${g.decisiones.map((d) => `- Semana ${d.semana}, "${d.titulo}": eligió "${d.opcion}"`).join('\n') || '- Ninguna'}`,
  ].join('\n\n');
}

export function ModalFin({ onSalir }: { onSalir: () => void }) {
  const { g, iaDisponible, avisar } = useMando();
  const puntaje = patrimonio(g);
  const rango = rangoDe(puntaje, g.semanasMax);
  const pf = perfil(g);
  const [tabla, setTabla] = useState<{ lista: EntradaRanking[]; posicion: number; record: boolean } | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [cargandoCoach, setCargandoCoach] = useState(false);
  const registrado = useRef(false);
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (registrado.current) return;
    registrado.current = true;
    setTabla(registrarEnRanking({
      ceo: g.ceo, empresa: g.empresa, puntaje, rango: rango.letra, etapa: g.etapa, semanas: g.fin?.semana ?? g.semana,
      modo: g.modo, semilla: g.semilla, motivo: g.fin?.motivo ?? 'tiempo', fecha: new Date().toISOString(),
    }));
    const t = setTimeout(() => {
      setMostrar(true);
      sonar(g.fin?.motivo === 'quiebra' ? 'pierde' : 'etapa');
    }, 150);
    if (iaDisponible) {
      setCargandoCoach(true);
      fetch('/api/mando/ia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'coach', resumen: resumenParaCoach(g).slice(0, 8800) }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCoach(d?.texto ?? null))
        .catch(() => setCoach(null))
        .finally(() => setCargandoCoach(false));
    }
    return () => clearTimeout(t);
    // Solo al montar: la partida ya terminó y no cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const local = devolucionLocal(g);
  const maxEje = Math.max(4, ...pf.ejes.map((e) => Math.abs(e.valor)));
  const compartir = async () => {
    const txt = `Dirigí ${g.empresa} en MANDO y terminé con un patrimonio de ${solesCorto(puntaje)} (rango ${rango.letra}, etapa ${ETAPAS[g.etapa - 1].nombre})${g.modo === 'reto' ? ` en el reto ${g.semilla.replace('reto-', '')}` : ''}. ¿Lo superas?`;
    try {
      await navigator.clipboard.writeText(txt);
      avisar('Resultado copiado. Pégalo donde quieras retar a tu equipo.');
    } catch {
      avisar(txt);
    }
  };

  return (
    <Modal etiqueta="Resultado de la partida" ancho={860}>
      <div className="p-6 sm:p-10">
        <Eyebrow>{g.fin?.motivo === 'quiebra' ? `Quiebra en la semana ${g.fin.semana}` : `${g.semanasMax} semanas al mando de ${g.empresa}`}</Eyebrow>
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-end mt-3">
          <div className="m-display m-display-purpura" style={{ fontSize: 'clamp(110px, 22vw, 190px)', lineHeight: 0.8 }}>{rango.letra}</div>
          <div>
            <p className="m-outline uppercase text-2xl">{rango.titulo}</p>
            <div className="text-xs m-tenue mt-3">Tu patrimonio final</div>
            <div className="m-display" style={{ fontSize: 'clamp(36px, 7vw, 64px)' }}><Contador valor={mostrar ? puntaje : 0} formato={(n) => soles(n).replace('S/ ', 'S/\u2009')} duracion={1800} /></div>
            {tabla && <p className="text-sm mt-2">{tabla.record && tabla.lista.length > 1 ? <strong className="m-ok">Nuevo récord personal. </strong> : null}Puesto {tabla.posicion} de {tabla.lista.length} en tus partidas.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
          <DatoP nombre="Etapa alcanzada" valor={`${g.etapa} / 5`} pie={ETAPAS[g.etapa - 1].nombre} />
          <DatoP nombre="Equipo" valor={`${g.personas.length}`} pie={`${g.stats.renuncias} renuncias · ${g.stats.despidos} despidos`} />
          <DatoP nombre="Entregas" valor={`${g.stats.entregas}`} pie={`${g.stats.entregasTarde} tarde · mejor racha ${g.mejorRacha}`} />
          <DatoP nombre="Facturado" valor={solesCorto(g.stats.facturado)} pie={`Reputación ${Math.round(g.reputacion)}`} />
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-7">
          <div>
            <Eyebrow>Tu perfil de liderazgo</Eyebrow>
            <h3 className="m-display text-xl mt-2">{pf.arquetipo}</h3>
            <p className="text-sm mt-2">{pf.descripcion}</p>
            <div className="grid gap-2.5 mt-4">
              {pf.ejes.map(({ eje, valor }) => (
                <div key={eje}>
                  <div className="flex justify-between text-sm"><span>{EJE_INFO[eje].nombre}{eje === pf.ciego && valor < maxEje / 2 ? <span className="m-alerta"> · punto ciego</span> : null}</span><span className="m-num">{valor > 0 ? `+${valor}` : valor}</span></div>
                  <div className="relative mt-1" style={{ height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 999 }}>
                    <span className="absolute top-0 bottom-0 rounded-full" style={{ left: valor >= 0 ? '50%' : `${50 - (Math.abs(valor) / maxEje) * 50}%`, width: `${(Math.abs(valor) / maxEje) * 50}%`, background: valor >= 0 ? 'var(--pp-lavanda)' : 'var(--m-mal)' }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs m-tenue mt-3">{EJE_INFO[pf.ciego].nombre}: {EJE_INFO[pf.ciego].desc} Fue lo que menos pesó en tus decisiones.</p>
          </div>
          <div>
            <Eyebrow>{coach ? 'Devolución de tu coach' : 'Lo que más pesó en tu resultado'}</Eyebrow>
            {cargandoCoach ? (
              <p className="text-sm mt-3 m-pulso">Tu coach está leyendo la partida…</p>
            ) : coach ? (
              <div className="text-sm mt-2 whitespace-pre-line" style={{ lineHeight: 1.6 }}>{coach}</div>
            ) : (
              <ul className="grid gap-3 mt-3">
                {local.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm"><Check size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: 'var(--pp-lavanda)' }} /><span>{t}</span></li>
                ))}
              </ul>
            )}
            {g.logros.length > 0 && (
              <div className="mt-5">
                <Eyebrow>Logros · {g.logros.length}</Eyebrow>
                <div className="flex flex-wrap gap-1.5 mt-2">{g.logros.map((l) => <span key={l} className="m-chip"><Award size={12} strokeWidth={1.75} style={{ color: 'var(--m-alerta)' }} /> {LOGROS[l]?.nombre ?? l}</span>)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 mt-8">
          <Boton onClick={compartir}><Copy size={16} strokeWidth={1.75} /> Copiar resultado para retar</Boton>
          <Boton variante="primario" tam="lg" onClick={onSalir}><RotateCcw size={18} strokeWidth={1.75} /> Jugar otra vez</Boton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------- Ayuda ----------------------------------

export function ModalAyuda() {
  const { g, abrir } = useMando();
  const pasos = [
    { t: 'Gana trabajo', d: 'En Oportunidades eliges qué proyectos pelear y a qué precio. Antes de aceptar, mira cómo queda la carga de tu equipo.' },
    { t: 'Cuida la caja', d: 'Pagas proveedores y planilla antes de cobrar. Una agencia rentable también puede quebrar si la caja no alcanza.' },
    { t: 'Lee a tu gente', d: 'Cada persona muestra ánimo, estrés y energía, y lo que piensa esa semana. Conversa 1:1 para saber qué la mueve y si quiere irse.' },
    { t: 'Decide', d: 'Cada semana llega una situación sin respuesta obvia. Tus decisiones dibujan tu perfil de liderazgo.' },
    { t: 'Cierra la semana', d: 'Tienes 3 puntos de foco. Cuando los uses, cierra la semana y mira qué pasó. Tu puntaje es lo que vale tu parte de la empresa.' },
  ];
  return (
    <Modal etiqueta="Cómo se juega" onCerrar={() => abrir(null)}>
      <div className="p-6 sm:p-8">
        <Eyebrow>Semana {g.semana} · {g.empresa}</Eyebrow>
        <h2 className="m-display text-2xl sm:text-3xl mt-2">Cómo se juega</h2>
        <ol className="grid gap-3 mt-5">
          {pasos.map((p, i) => (
            <li key={p.t} className="flex gap-3">
              <span className="m-num shrink-0 flex items-center justify-center rounded-full text-sm" style={{ width: 26, height: 26, background: 'var(--pp-purpura)' }}>{i + 1}</span>
              <span><strong className="block">{p.t}</strong><span className="text-sm">{p.d}</span></span>
            </li>
          ))}
        </ol>
        <div className="flex justify-end mt-6"><Boton variante="primario" onClick={() => abrir(null)}>Entendido</Boton></div>
      </div>
    </Modal>
  );
}
