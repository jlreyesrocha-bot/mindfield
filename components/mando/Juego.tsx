'use client';

import {
  Briefcase,
  Building2,
  CalendarDays,
  CircleHelp,
  LogOut,
  Smile,
  Star,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ETAPAS } from '@/lib/mando/datos';
import { solesCorto } from '@/lib/mando/efectos';
import { borrarPartida, cargarPartida, guardarPartida } from '@/lib/mando/guardado';
import {
  animoPromedio,
  cerrarSemana,
  patrimonio,
  runway,
  situacionesPendientes,
} from '@/lib/mando/motor';
import type { Juego } from '@/lib/mando/types';
import { Ctx, type Api, type ModalEstado } from './contexto';
import Inicio from './Inicio';
import {
  ModalAyuda,
  ModalContratar,
  ModalFin,
  ModalPersona,
  ModalPitch,
  ModalResumen,
  ModalSituacion,
} from './modales';
import { PanelClientes, PanelEmpresa, PanelEquipo, PanelSemana } from './paneles';
import { alternarSonido, cargarPreferenciaSonido, sonar, type Sonido } from './sonido';
import { Barra, Boton, Contador, Toast, colorNivel, cx } from './ui';

type Tab = 'semana' | 'equipo' | 'clientes' | 'empresa';

export default function Mando() {
  const [g, setG] = useState<Juego | null>(null);
  const [listo, setListo] = useState(false);
  const [guardada, setGuardada] = useState<Juego | null>(null);
  const [modal, setModal] = useState<ModalEstado>(null);
  const [tab, setTab] = useState<Tab>('semana');
  const [toast, setToast] = useState<string | null>(null);
  const [sonido, setSonido] = useState(true);
  const [iaDisponible, setIaDisponible] = useState(false);
  const gRef = useRef<Juego | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setGuardada(cargarPartida());
    setSonido(cargarPreferenciaSonido());
    setListo(true);
    fetch('/api/mando/ia')
      .then((r) => r.json())
      .then((d) => setIaDisponible(Boolean(d?.disponible)))
      .catch(() => setIaDisponible(false));
  }, []);

  const avisar = useCallback((mensaje: string) => {
    setToast(mensaje);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const fijar = useCallback((d: Juego | null) => {
    gRef.current = d;
    setG(d);
    if (d) guardarPartida(d);
  }, []);

  const hacer = useCallback(
    (fn: (d: Juego) => string | null | void, s?: Sonido) => {
      const actual = gRef.current;
      if (!actual) return false;
      const d = structuredClone(actual);
      const error = fn(d);
      if (typeof error === 'string') {
        avisar(error);
        sonar('alerta');
        return false;
      }
      fijar(d);
      if (s) sonar(s);
      return true;
    },
    [avisar, fijar],
  );

  const api = useMemo<Api | null>(
    () => (g ? { g, hacer, abrir: setModal, avisar, iaDisponible } : null),
    [g, hacer, avisar, iaDisponible],
  );

  if (!listo) return <div className="mando" />;

  // `hacer` lee la partida vigente desde un ref solo dentro de manejadores de eventos (para
  // encadenar acciones sin pisarse); el linter lo confunde con una lectura durante el render.
  // eslint-disable-next-line react-hooks/refs
  if (!g || !api) {
    return (
      <div className="mando">
        <Inicio
          guardada={guardada}
          onContinuar={() => {
            if (guardada) {
              fijar(guardada);
              setTab('semana');
              window.scrollTo({ top: 0 });
            }
          }}
          onNueva={(nuevo) => {
            fijar(nuevo);
            setTab('semana');
            window.scrollTo({ top: 0 });
            setModal({ tipo: 'ayuda' });
            sonar('semana');
          }}
        />
      </div>
    );
  }

  const irA = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const pendientes = situacionesPendientes(g);
  const enRiesgo = g.personas.filter((p) => p.estres >= 75 || p.animo < 40).length;
  const etapa = ETAPAS[g.etapa - 1];

  const cerrar = () => {
    if (pendientes > 0) {
      avisar(`Antes de cerrar la semana, resuelve ${pendientes === 1 ? 'la situación pendiente' : `las ${pendientes} situaciones pendientes`}.`);
      irA('semana');
      return;
    }
    const ok = hacer((d) => {
      cerrarSemana(d);
    });
    if (ok) {
      sonar('semana');
      setModal({ tipo: 'resumen' });
      irA('semana');
    }
  };

  const salir = () => {
    setGuardada(g.fin ? null : g);
    if (g.fin) borrarPartida();
    gRef.current = null;
    setG(null);
    setModal(null);
  };

  const tabs: { id: Tab; nombre: string; icono: React.ReactNode; punto?: number }[] = [
    { id: 'semana', nombre: 'Semana', icono: <CalendarDays size={16} strokeWidth={1.75} />, punto: pendientes },
    { id: 'equipo', nombre: 'Equipo', icono: <Users size={16} strokeWidth={1.75} />, punto: enRiesgo },
    { id: 'clientes', nombre: 'Clientes', icono: <Briefcase size={16} strokeWidth={1.75} /> },
    { id: 'empresa', nombre: 'Empresa', icono: <Building2 size={16} strokeWidth={1.75} /> },
  ];

  const semanasRunway = runway(g);

  const pestanas = (
    <nav className="m-scroll-x -mx-4 px-4 mt-2 pb-2" role="tablist" aria-label="Secciones">
      <div className="flex gap-1 min-w-max">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="m-tab" onClick={() => { irA(t.id); sonar('clic'); }}>
            {t.icono}
            {t.nombre}
            {t.punto ? <span className={cx('m-tab-punto', t.id === 'semana' && 'm-pulso')}>{t.punto}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );


  return (
    <Ctx.Provider value={api}>
      <div className="mando flex flex-col">
        <header className="sm:sticky sm:top-0 z-30" style={{ background: 'rgba(12,4,32,.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--m-borde)' }}>
          <div className="mx-auto max-w-6xl px-4 pt-3">
            <div className="flex items-center gap-3">
              <span className="m-display text-lg" style={{ color: 'var(--pp-lavanda)' }}>MANDO</span>
              <span className="hidden sm:inline text-sm truncate"><strong>{g.empresa}</strong></span>
              <span className="m-chip m-chip-purpura">{etapa.nombre}</span>
              <div className="flex-1" />
              <div className="text-right leading-tight">
                <div className="m-eyebrow">Semana</div>
                <div className="m-num text-sm">{Math.min(g.semana, g.semanasMax)} / {g.semanasMax}</div>
              </div>
              <button type="button" className="m-btn m-btn-fantasma !p-2" aria-label="Cómo se juega" onClick={() => setModal({ tipo: 'ayuda' })}>
                <CircleHelp size={18} strokeWidth={1.75} />
              </button>
              <button type="button" className="m-btn m-btn-fantasma !p-2" aria-label={sonido ? 'Silenciar' : 'Activar sonido'} onClick={() => setSonido(alternarSonido())}>
                {sonido ? <Volume2 size={18} strokeWidth={1.75} /> : <VolumeX size={18} strokeWidth={1.75} />}
              </button>
              <button type="button" className="m-btn m-btn-fantasma !p-2" aria-label="Salir al inicio" onClick={salir}>
                <LogOut size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="mt-2"><Barra valor={((g.semana - 1) / g.semanasMax) * 100} color="var(--pp-purpura)" alto={3} /></div>

            <div className="m-scroll-x -mx-4 px-4 mt-3">
              <div className="flex gap-2 min-w-max sm:min-w-0 sm:grid sm:grid-cols-5">
                <Indicador icono={<Wallet size={14} strokeWidth={1.75} />} etiqueta="Caja" tono={g.caja < 0 ? 'mal' : semanasRunway < 4 ? 'alerta' : undefined}
                  valor={<Contador valor={g.caja} formato={solesCorto} />}
                  pie={g.caja < 0 ? 'En rojo' : `${semanasRunway > 60 ? '60+' : semanasRunway.toFixed(0)} sem. de vida`} />
                <Indicador icono={<TrendingUp size={14} strokeWidth={1.75} />} etiqueta="Tu patrimonio"
                  valor={<Contador valor={patrimonio(g)} formato={solesCorto} />}
                  pie={g.participacion < 1 ? `Tienes el ${Math.round(g.participacion * 100)}%` : 'Tu puntaje'} />
                <Indicador icono={<Star size={14} strokeWidth={1.75} />} etiqueta="Reputación"
                  valor={<Contador valor={g.reputacion} />} barra={g.reputacion} colorBarra="var(--pp-lavanda)" />
                <Indicador icono={<Smile size={14} strokeWidth={1.75} />} etiqueta="Ánimo del equipo"
                  valor={<Contador valor={animoPromedio(g)} />} barra={animoPromedio(g)} />
                <Indicador icono={<Zap size={14} strokeWidth={1.75} />} etiqueta="Tu estrés" tono={g.estresCeo >= 80 ? 'mal' : g.estresCeo >= 60 ? 'alerta' : undefined}
                  valor={<Contador valor={g.estresCeo} />} barra={g.estresCeo} colorBarra={colorNivel(g.estresCeo, true)} />
              </div>
            </div>

            <div className="hidden sm:block">{pestanas}</div>
          </div>
        </header>

        <div className="sm:hidden sticky top-0 z-30 px-4" style={{ background: 'rgba(12,4,32,.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--m-borde)' }}>
          {pestanas}
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-32 flex-1">
          {tab === 'semana' && <PanelSemana />}
          {tab === 'equipo' && <PanelEquipo />}
          {tab === 'clientes' && <PanelClientes />}
          {tab === 'empresa' && <PanelEmpresa />}
        </main>

        <footer className="fixed bottom-0 inset-x-0 z-30" style={{ background: 'rgba(12,4,32,.94)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--m-borde)' }}>
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
            <div>
              <div className="m-eyebrow">Tu foco</div>
              <div className="flex items-center gap-1.5 mt-1" aria-label={`Foco ${g.foco} de ${g.focoMax}`}>
                {g.ceoFuera > 0 ? (
                  <span className="text-sm m-mal font-semibold">Fuera por agotamiento</span>
                ) : (
                  Array.from({ length: Math.max(g.focoMax, 1) }).map((_, i) => (
                    <span key={i} className="block rounded-full" style={{ width: 22, height: 8, background: i < g.foco ? 'var(--pp-lavanda)' : 'rgba(255,255,255,.14)' }} />
                  ))
                )}
              </div>
            </div>
            <div className="flex-1 text-sm m-tenue hidden md:block">
              {pendientes > 0
                ? 'Hay decisiones esperándote. Nada avanza hasta que las tomes.'
                : g.foco > 0 && g.ceoFuera === 0
                  ? 'Te queda foco: conversa con alguien, prospecta o descansa.'
                  : 'Todo listo. Cierra la semana para ver qué pasa.'}
            </div>
            <div className="flex-1 md:hidden" />
            <Boton variante="primario" tam="lg" onClick={cerrar} className={pendientes === 0 ? 'm-destello' : undefined} key={`${g.semana}-${pendientes}`}>
              {pendientes > 0 ? `Decide ${pendientes} pendiente${pendientes > 1 ? 's' : ''}` : `Cerrar semana ${g.semana}`}
            </Boton>
          </div>
        </footer>

        {modal?.tipo === 'situacion' && <ModalSituacion uid={modal.uid} />}
        {modal?.tipo === 'persona' && <ModalPersona id={modal.id} />}
        {modal?.tipo === 'pitch' && <ModalPitch id={modal.id} />}
        {modal?.tipo === 'contratar' && <ModalContratar />}
        {modal?.tipo === 'resumen' && <ModalResumen />}
        {modal?.tipo === 'fin' && <ModalFin onSalir={salir} />}
        {modal?.tipo === 'ayuda' && <ModalAyuda />}
        <Toast mensaje={toast} />
      </div>
    </Ctx.Provider>
  );
}

function Indicador({
  icono,
  etiqueta,
  valor,
  pie,
  barra,
  colorBarra,
  tono,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: React.ReactNode;
  pie?: string;
  barra?: number;
  colorBarra?: string;
  tono?: 'alerta' | 'mal';
}) {
  return (
    <div className="m-card px-3 py-2 min-w-[132px]" style={tono ? { borderColor: tono === 'mal' ? 'rgba(255,122,122,.55)' : 'rgba(245,167,66,.5)' } : undefined}>
      <div className="flex items-center gap-1.5 text-[11px] m-tenue whitespace-nowrap">{icono}{etiqueta}</div>
      <div className={cx('text-xl leading-tight mt-0.5', tono === 'mal' && 'm-mal')}>{valor}</div>
      {barra !== undefined ? (
        <div className="mt-1.5"><Barra valor={barra} color={colorBarra} alto={4} /></div>
      ) : (
        <div className={cx('text-[11px] mt-0.5 whitespace-nowrap', tono === 'mal' ? 'm-mal' : tono === 'alerta' ? 'm-alerta' : 'm-tenue')}>{pie}</div>
      )}
    </div>
  );
}
