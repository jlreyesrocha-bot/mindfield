'use client';

import { ArrowRight, MessageCircle, Scale, Timer, Trophy } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { ETAPAS } from '@/lib/mando/datos';
import { solesCorto } from '@/lib/mando/efectos';
import { guardarPerfil, perfilGuardado, ranking, type EntradaRanking } from '@/lib/mando/guardado';
import { nuevoJuego, patrimonio, semillaReto } from '@/lib/mando/motor';
import type { Juego } from '@/lib/mando/types';
import { Boton, Eyebrow, cx } from './ui';

const MODOS: { id: Juego['modo']; nombre: string; detalle: string }[] = [
  { id: 'reto', nombre: 'Reto de la semana', detalle: '52 semanas. El mismo mercado para todos: compara tu resultado con tu equipo.' },
  { id: 'anual', nombre: 'Año completo', detalle: '52 semanas en un mercado distinto cada vez.' },
  { id: 'sprint', nombre: 'Sprint', detalle: '26 semanas. Una partida de 15 minutos.' },
];

export default function Inicio({
  guardada,
  onContinuar,
  onNueva,
}: {
  guardada: Juego | null;
  onContinuar: () => void;
  onNueva: (g: Juego) => void;
}) {
  // Este componente solo se monta en el navegador, así que puede leer lo guardado al iniciar.
  const [ceo, setCeo] = useState(() => perfilGuardado().ceo);
  const [empresa, setEmpresa] = useState(() => perfilGuardado().empresa);
  const [modo, setModo] = useState<Juego['modo']>('reto');
  const [tabla] = useState<EntradaRanking[]>(() => ranking());

  const empezar = () => {
    guardarPerfil({ ceo, empresa });
    onNueva(nuevoJuego({ ceo, empresa, modo, semilla: modo === 'reto' ? semillaReto() : undefined }));
  };

  const reto = semillaReto();
  const tablaReto = tabla.filter((t) => t.semilla === reto);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Image src="/mando/logotipo-blanco.png" alt="Purpural" width={120} height={25} className="absolute top-6 left-6 opacity-90" priority />
      <Image src="/mando/isotipo-blanco.png" alt="" width={34} height={29} className="absolute bottom-6 right-6 opacity-70 hidden sm:block" />

      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 grid gap-x-12 gap-y-8 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
        <section className="m-entra">
          <Eyebrow>Simulador de liderazgo · Agencia de brand experience</Eyebrow>
          <h1 className="mt-4">
            <span className="m-display m-display-purpura block" style={{ fontSize: 'clamp(64px, 13vw, 168px)' }}>MANDO</span>
            <span className="m-outline block uppercase" style={{ fontSize: 'clamp(22px, 4.2vw, 52px)' }}>Funda. Lidera. Aguanta.</span>
          </h1>
          <p className="mt-6 text-lg max-w-xl" style={{ lineHeight: 1.55 }}>
            Eres CEO de una agencia que hoy cabe en un garaje. Cada semana decides a quién contratas, qué cliente aceptas,
            con quién conversas y qué problema resuelves primero. <strong>Tu puntaje es lo que vale tu parte de la empresa al final.</strong>
          </p>

        </section>

        <section className="m-card p-6 m-entra lg:col-start-2 lg:row-start-1 lg:row-span-2" style={{ animationDelay: '120ms', background: '#130833' }}>
          {guardada && (
            <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--m-borde)' }}>
              <Eyebrow>Partida en curso</Eyebrow>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{guardada.empresa}</div>
                  <div className="text-sm m-tenue">Semana {guardada.semana} · {ETAPAS[guardada.etapa - 1].nombre} · {solesCorto(patrimonio(guardada))}</div>
                </div>
                <Boton variante="primario" onClick={onContinuar}>Continuar <ArrowRight size={16} strokeWidth={1.75} /></Boton>
              </div>
            </div>
          )}

          <Eyebrow>Nueva partida</Eyebrow>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-white">Tu nombre</span>
              <input className="m-input mt-1" value={ceo} maxLength={30} onChange={(e) => setCeo(e.target.value)} placeholder="Como te llama tu equipo" autoComplete="given-name" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-white">Nombre de tu agencia</span>
              <input className="m-input mt-1" value={empresa} maxLength={30} onChange={(e) => setEmpresa(e.target.value)} placeholder="La que vas a fundar hoy" autoComplete="off" />
            </label>
          </div>

          <div className="mt-5 grid gap-2" role="radiogroup" aria-label="Modo de juego">
            {MODOS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={modo === m.id} onClick={() => setModo(m.id)}
                className={cx('m-card m-card-click p-3')} style={modo === m.id ? { borderColor: 'var(--pp-lavanda)', background: 'var(--m-superficie-2)' } : undefined}>
                <span className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{m.nombre}</strong>
                  {m.id === 'reto' && <span className="m-eyebrow">{reto.replace('reto-', '')}</span>}
                </span>
                <span className="block text-sm m-tenue">{m.detalle}</span>
              </button>
            ))}
          </div>

          <Boton variante="primario" tam="lg" className="w-full mt-5" onClick={empezar}>
            Fundar la agencia <ArrowRight size={18} strokeWidth={1.75} />
          </Boton>

          {tabla.length > 0 && (
            <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--m-borde)' }}>
              <Eyebrow>{modo === 'reto' && tablaReto.length ? 'Tus mejores en el reto de esta semana' : 'Tus mejores partidas'}</Eyebrow>
              <ol className="mt-2 grid gap-1.5">
                {(modo === 'reto' && tablaReto.length ? tablaReto : tabla).slice(0, 5).map((t, i) => (
                  <li key={`${t.fecha}-${i}`} className="flex items-center gap-3 text-sm">
                    <span className="m-num w-5 m-tenue">{i + 1}</span>
                    <span className="m-chip m-chip-purpura">{t.rango}</span>
                    <span className="truncate flex-1">{t.empresa} <span className="m-tenue">· {ETAPAS[t.etapa - 1]?.nombre}</span></span>
                    <span className="m-num">{solesCorto(t.puntaje)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

          <ul className="grid gap-3 sm:grid-cols-2 max-w-2xl lg:col-start-1 lg:row-start-2 m-entra">
            {[
              { i: <Scale size={18} strokeWidth={1.75} />, t: 'Decisiones sin respuesta obvia', d: 'Situaciones reales de agencia: clientes, caja, ética y gente.' },
              { i: <MessageCircle size={18} strokeWidth={1.75} />, t: 'Un equipo que piensa', d: 'Cada persona tiene ánimo, estrés, energía y algo que la mueve. Conversa para descubrirlo.' },
              { i: <Timer size={18} strokeWidth={1.75} />, t: 'Una semana por turno', d: 'Tres puntos de foco. No alcanzan para todo, y de eso se trata.' },
              { i: <Trophy size={18} strokeWidth={1.75} />, t: 'Cinco etapas', d: ETAPAS.map((e) => e.nombre).join(' · ') },
            ].map((x) => (
              <li key={x.t} className="m-card p-4 flex gap-3">
                <span style={{ color: 'var(--pp-lavanda)' }} className="mt-0.5">{x.i}</span>
                <span><strong className="block text-sm">{x.t}</strong><span className="text-sm m-tenue">{x.d}</span></span>
              </li>
            ))}
          </ul>
      </div>
    </div>
  );
}
