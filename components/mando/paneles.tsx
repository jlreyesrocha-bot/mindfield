'use client';

import {
  AlertTriangle,
  Award,
  Battery,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  Crown,
  Flame,
  HeartPulse,
  Lock,
  Megaphone,
  Minus,
  PartyPopper,
  Plus,
  Search,
  Smile,
  Wrench,
} from 'lucide-react';
import {
  AREAS,
  COSTO_PROCESOS,
  EJE_INFO,
  ETAPAS,
  LOGROS,
  MEJORAS,
  OFICINAS,
  ROLES,
  ROL_INFO,
  TIER_NOMBRE,
} from '@/lib/mando/datos';
import {
  capacidadArea,
  cliente,
  demandaArea,
  feesActivos,
  nominaSemanal,
  porCobrar,
  proyectosActivos,
  rendimiento,
  soles,
  solesCorto,
} from '@/lib/mando/efectos';
import {
  COSTO_FREELANCE,
  abrirBusqueda,
  ajustarFreelance,
  apoyarArea,
  apurarCobro,
  calidadEsperada,
  calidadProyecto,
  caos,
  capacidadGestion,
  comprarMejora,
  costoFijoSemanal,
  costoIntegracion,
  defSituacion,
  descansar,
  facturado12,
  gastoSemanal,
  integracion,
  limiteCredito,
  mejorarProcesos,
  mudarOficina,
  pagarDeuda,
  pedirPrestamo,
  probPitch,
  prospectar,
  requisitosEtapa,
  valoracion,
} from '@/lib/mando/motor';
import type { Area, Eje, Persona, Rol } from '@/lib/mando/types';
import { useMando } from './contexto';
import { Avatar, Barra, Boton, Eyebrow, Tendencia, colorNivel, cx } from './ui';

const CATEGORIA_NOMBRE: Record<string, string> = {
  personas: 'Personas', clientes: 'Clientes', finanzas: 'Finanzas', operaciones: 'Operaciones',
  etica: 'Ética', estrategia: 'Estrategia', crisis: 'Crisis',
};

function Seccion({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="flex items-end justify-between gap-3 mb-3">
        <Eyebrow>{titulo}</Eyebrow>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="m-card p-5 text-sm m-tenue">{children}</div>;
}

// --------------------------------- Semana ----------------------------------

export function PanelSemana() {
  const { g, hacer, abrir } = useMando();
  const pendientes = g.situaciones.filter((s) => !s.resuelta);
  const resueltas = g.situaciones.filter((s) => s.resuelta);

  return (
    <div className="grid gap-x-8 lg:grid-cols-[1.25fr_.75fr]">
      <div>
        {g.ceoFuera > 0 && (
          <div className="m-card m-card-alerta p-4 mb-6 flex gap-3">
            <AlertTriangle size={20} strokeWidth={1.75} className="m-alerta shrink-0 mt-0.5" />
            <p className="text-sm"><strong>Estás fuera por agotamiento.</strong> Te {g.ceoFuera === 1 ? 'queda 1 semana' : `quedan ${g.ceoFuera} semanas`} sin foco. El equipo sigue trabajando; tú solo puedes cerrar la semana.</p>
          </div>
        )}

        {(pendientes.length > 0 || resueltas.length > 0) && (
          <Seccion titulo="Requiere tu decisión">
            <div className="grid gap-3">
              {pendientes.map((s) => {
                const def = defSituacion(s.id);
                return (
                  <button key={s.uid} type="button" className="m-card m-card-click m-card-alerta p-4 m-entra" onClick={() => abrir({ tipo: 'situacion', uid: s.uid })}>
                    <span className="flex items-center gap-2">
                      <span className="m-pulso block rounded-full" style={{ width: 8, height: 8, background: 'var(--m-alerta)' }} />
                      <span className="m-eyebrow" style={{ color: 'var(--m-alerta)' }}>{CATEGORIA_NOMBRE[def?.categoria ?? ''] ?? 'Situación'}</span>
                    </span>
                    <span className="flex items-center justify-between gap-3 mt-1">
                      <strong className="text-base">{def?.titulo ?? 'Situación'}</strong>
                      <ChevronRight size={18} strokeWidth={1.75} />
                    </span>
                    <span className="block text-sm mt-1 line-clamp-2">{s.texto}</span>
                  </button>
                );
              })}
              {resueltas.map((s) => (
                <div key={s.uid} className="m-card p-4 opacity-70">
                  <span className="flex items-center gap-2 text-sm"><Check size={16} strokeWidth={1.75} className="m-ok" /><strong>{defSituacion(s.id)?.titulo}</strong></span>
                  <p className="text-sm mt-1 m-tenue">{s.resuelta?.resultado}</p>
                </div>
              ))}
            </div>
          </Seccion>
        )}

        <Seccion titulo="Oportunidades" extra={<span className="text-xs m-tenue">Llegan según tu reputación y tu gestión comercial</span>}>
          {g.oportunidades.length === 0 ? (
            <Vacio>No hay oportunidades esta semana. Prospecta con tu foco o sube tu reputación entregando bien.</Vacio>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {g.oportunidades.map((o) => {
                const prob = probPitch(g, o, 'justo', false);
                return (
                  <button key={o.id} type="button" className="m-card m-card-click p-4" onClick={() => abrir({ tipo: 'pitch', id: o.id })}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="m-eyebrow truncate">{o.clienteNombre}</span>
                      <span className={cx('m-chip', o.directo && 'm-chip-ok')}>{o.directo ? 'Encargo directo' : `${Math.round(prob * 100)}% de ganar`}</span>
                    </span>
                    <strong className="block mt-1.5">{o.nombre}</strong>
                    <span className="flex items-baseline gap-2 mt-1">
                      <span className="m-num text-xl">{solesCorto(o.presupuesto)}</span>
                      <span className="text-sm m-tenue">{o.tipo === 'fee' ? 'al mes' : `${o.duracion} semanas`}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 mt-2">
                      <span className="m-chip">{o.tipo === 'fee' ? 'Fee mensual' : TIER_NOMBRE[o.tier]}</span>
                      <span className="m-chip"><Clock size={12} strokeWidth={1.75} /> Paga a {o.plazoPago} sem.</span>
                      {o.expira - g.semana <= 1 && <span className="m-chip m-chip-alerta">Última semana</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Carga del equipo" extra={<span className="text-xs m-tenue">Sobre 100% el trabajo sale, pero el equipo se quema</span>}>
          <div className="m-card divide-y" style={{ borderColor: 'var(--m-borde)' }}>
            {AREAS.map((a) => <FilaArea key={a} area={a} />)}
          </div>
        </Seccion>
      </div>

      <div>
        <Seccion titulo="Tu semana">
          <div className="grid gap-2">
            <AccionCeo icono={<Megaphone size={18} strokeWidth={1.75} />} titulo="Prospectar clientes" detalle="Llegan más oportunidades la próxima semana." costo="1 foco" onClick={() => hacer((d) => prospectar(d), 'clic')} hecho={g.prospeccion > 0 ? 'Hecho esta semana' : undefined} />
            <AccionCeo icono={<Coffee size={18} strokeWidth={1.75} />} titulo="Desconectarte" detalle="Baja tu estrés. Un CEO quemado decide peor y pierde foco." costo="1 foco" onClick={() => hacer((d) => descansar(d), 'clic')} />
            <AccionCeo icono={<PartyPopper size={18} strokeWidth={1.75} />} titulo="Día de integración" detalle="Sube el ánimo y baja el estrés de todos." costo={`1 foco · ${solesCorto(costoIntegracion(g))}`} onClick={() => hacer((d) => integracion(d), 'clic')} />
          </div>
          <p className="text-xs m-tenue mt-3">Las conversaciones 1:1, los reconocimientos y las contrataciones se hacen desde la pestaña Equipo.</p>
        </Seccion>

        <Seccion titulo="Bitácora">
          <ul className="grid gap-2">
            {g.noticias.slice(0, 9).map((n, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="mt-1.5 block rounded-full shrink-0" style={{ width: 7, height: 7, background: n.tipo === 'bueno' ? 'var(--m-ok)' : n.tipo === 'malo' ? 'var(--m-mal)' : 'var(--m-tenue)' }} />
                <span><span className="m-tenue">S{n.semana} · </span>{n.texto}</span>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </div>
  );
}

function AccionCeo({ icono, titulo, detalle, costo, onClick, hecho }: { icono: React.ReactNode; titulo: string; detalle: string; costo: string; onClick: () => void; hecho?: string }) {
  const { g } = useMando();
  return (
    <button type="button" className="m-card m-card-click p-3 flex gap-3 items-start disabled:opacity-40" onClick={onClick} disabled={g.foco < 1}>
      <span style={{ color: 'var(--pp-lavanda)' }} className="mt-0.5">{icono}</span>
      <span className="flex-1">
        <span className="flex items-center justify-between gap-2">
          <strong className="text-sm">{titulo}</strong>
          <span className="m-chip">{costo}</span>
        </span>
        <span className="block text-sm m-tenue">{hecho ?? detalle}</span>
      </span>
    </button>
  );
}

function FilaArea({ area }: { area: Area }) {
  const { g, hacer } = useMando();
  const cap = capacidadArea(g, area);
  const dem = demandaArea(g, area);
  const carga = dem <= 0 ? 0 : cap > 0 ? dem / cap : 9;
  const pct = Math.round(carga * 100);
  const color = carga > 1.25 ? 'var(--m-mal)' : carga > 1 ? 'var(--m-alerta)' : carga < 0.35 && dem > 0 ? 'var(--m-tenue)' : 'var(--m-ok)';
  const gente = g.personas.filter((p) => p.rol === area).length;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <strong>{ROL_INFO[area].nombre}</strong>
          <span className="text-sm m-tenue"> · {gente} {gente === 1 ? 'persona' : 'personas'}{area === 'cuentas' && g.etapa <= 2 ? ' + tú' : ''}{g.freelances[area] ? ` + ${g.freelances[area]} freelance` : ''}</span>
        </div>
        <span className="m-num text-lg" style={{ color }}>{dem <= 0 ? 'Libre' : pct > 400 ? 'Sin gente' : `${pct}%`}</span>
      </div>
      <div className="mt-2"><Barra valor={Math.min(100, (carga / 1.5) * 100)} color={color} /></div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-xs m-tenue">Freelance ({solesCorto(COSTO_FREELANCE)}/sem.)</span>
        <button type="button" className="m-btn m-btn-secundario m-btn-sm !px-2" aria-label={`Quitar freelance de ${ROL_INFO[area].nombre}`} disabled={g.freelances[area] === 0} onClick={() => hacer((d) => ajustarFreelance(d, area, -1), 'clic')}><Minus size={14} /></button>
        <span className="m-num w-4 text-center">{g.freelances[area]}</span>
        <button type="button" className="m-btn m-btn-secundario m-btn-sm !px-2" aria-label={`Sumar freelance a ${ROL_INFO[area].nombre}`} onClick={() => hacer((d) => ajustarFreelance(d, area, 1), 'clic')}><Plus size={14} /></button>
        <div className="flex-1" />
        <Boton tam="sm" disabled={g.foco < 1 || g.ceoApoyo !== null} onClick={() => hacer((d) => apoyarArea(d, area), 'clic')}>
          <Wrench size={14} strokeWidth={1.75} /> {g.ceoApoyo === area ? 'Estás apoyando' : 'Meter las manos · 1 foco'}
        </Boton>
      </div>
    </div>
  );
}

// --------------------------------- Equipo ----------------------------------

export function riesgoVisible(g: { semana: number; mejoras: string[] }, p: Persona): boolean {
  return g.mejoras.includes('pulso') || (p.ultima1a1 > 0 && g.semana - p.ultima1a1 <= 4);
}

export function PanelEquipo() {
  const { g, hacer, abrir } = useMando();
  const oficina = OFICINAS[g.oficina];
  const lleno = g.personas.length >= oficina.cupo;
  const nivelCaos = caos(g);

  const buscar = (rol: Rol) => {
    if (hacer((d) => abrirBusqueda(d, rol), 'clic')) abrir({ tipo: 'contratar' });
  };

  return (
    <div>
      <Seccion titulo={`Tu equipo · ${g.personas.length} de ${oficina.cupo} lugares en ${oficina.nombre.toLowerCase()}`}>
        {nivelCaos > 0 && (
          <div className="m-card m-card-alerta p-4 mb-4 flex gap-3">
            <AlertTriangle size={20} strokeWidth={1.75} className="m-alerta shrink-0 mt-0.5" />
            <p className="text-sm"><strong>Hay desorden.</strong> Tu estructura coordina bien a {capacidadGestion(g)} personas y ya son {g.personas.length}. Baja la calidad y sube el estrés de todos. Mejora procesos o nombra líderes en la pestaña Empresa.</p>
          </div>
        )}
        {g.personas.length === 0 ? (
          <Vacio>No queda nadie en el equipo. Contrata para poder entregar.</Vacio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.personas.map((p) => <TarjetaPersona key={p.id} p={p} />)}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Contratar" extra={<span className="text-xs m-tenue">Abrir una búsqueda cuesta 1 foco</span>}>
        {g.candidatos.length > 0 && (
          <Boton variante="primario" className="mb-3" onClick={() => abrir({ tipo: 'contratar' })}><Search size={16} strokeWidth={1.75} /> Ver los candidatos de {ROL_INFO[g.candidatosRol ?? 'cuentas'].nombre}</Boton>
        )}
        {lleno && <p className="text-sm m-alerta mb-3">No hay más espacio en {oficina.nombre.toLowerCase()}. Múdate desde la pestaña Empresa para seguir creciendo.</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((rol) => (
            <button key={rol} type="button" className="m-card m-card-click p-3 disabled:opacity-40" disabled={lleno || g.foco < 1} onClick={() => buscar(rol)}>
              <strong className="text-sm block">{ROL_INFO[rol].nombre}</strong>
              <span className="text-xs m-tenue block">{ROL_INFO[rol].aporta}</span>
              <span className="text-xs m-tenue block mt-1">{g.personas.filter((p) => p.rol === rol).length} en el equipo</span>
            </button>
          ))}
        </div>
      </Seccion>
    </div>
  );
}

function TarjetaPersona({ p }: { p: Persona }) {
  const { g, abrir } = useMando();
  const ve = riesgoVisible(g, p);
  const alerta = p.estres >= 80 || p.animo < 35 || (ve && p.riesgoFuga >= 55);
  return (
    <button type="button" className={cx('m-card m-card-click p-4', alerta && 'm-card-alerta')} onClick={() => abrir({ tipo: 'persona', id: p.id })}>
      <span className="flex gap-3 items-center">
        <Avatar p={p} />
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{p.nombre}</strong>
          <span className="block text-xs m-tenue truncate">{p.cargo}</span>
        </span>
        {p.lider && <Crown size={16} strokeWidth={1.75} style={{ color: 'var(--pp-lavanda)' }} aria-label="Líder de área" />}
      </span>
      <span className="grid grid-cols-3 gap-2 mt-3">
        <Mini icono={<Smile size={12} strokeWidth={1.75} />} nombre="Ánimo" valor={p.animo} />
        <Mini icono={<HeartPulse size={12} strokeWidth={1.75} />} nombre="Estrés" valor={p.estres} invertida />
        <Mini icono={<Battery size={12} strokeWidth={1.75} />} nombre="Energía" valor={p.energia} />
      </span>
      <span className="block text-sm mt-3 italic" style={{ color: 'rgba(255,255,255,.82)' }}>«{p.pensamiento}»</span>
      <span className="flex flex-wrap gap-1.5 mt-3">
        {p.fuera > 0 && <span className="m-chip">Fuera {p.fuera} sem.</span>}
        {p.rampa > 0 && <span className="m-chip">Adaptándose</span>}
        {ve ? (
          <span className={cx('m-chip', p.riesgoFuga >= 55 ? 'm-chip-mal' : p.riesgoFuga >= 30 ? 'm-chip-alerta' : 'm-chip-ok')}>
            {p.riesgoFuga >= 55 ? 'Quiere irse' : p.riesgoFuga >= 30 ? 'Tiene dudas' : 'Se queda'}
          </span>
        ) : (
          <span className="m-chip m-tenue">Sin 1:1 reciente</span>
        )}
      </span>
    </button>
  );
}

function Mini({ icono, nombre, valor, invertida }: { icono: React.ReactNode; nombre: string; valor: number; invertida?: boolean }) {
  return (
    <span className="block">
      <span className="flex items-center gap-1 text-[11px] m-tenue">{icono}{nombre}</span>
      <span className="block mt-1"><Barra valor={valor} invertida={invertida} alto={5} /></span>
    </span>
  );
}

// -------------------------------- Clientes ---------------------------------

export function PanelClientes() {
  const { g, hacer } = useMando();
  const activos = proyectosActivos(g);
  const proyectos = activos.filter((p) => p.tipo === 'proyecto');
  const fees = activos.filter((p) => p.tipo === 'fee');
  const conHistoria = g.clientes.filter((c) => c.entregas > 0 || activos.some((p) => p.clienteId === c.id));

  return (
    <div className="grid gap-x-8 lg:grid-cols-[1.2fr_.8fr]">
      <div>
        <Seccion titulo="Proyectos en curso" extra={g.racha >= 2 ? <span className="m-chip m-chip-ok"><Flame size={12} strokeWidth={1.75} /> Racha de {g.racha} a tiempo</span> : undefined}>
          {proyectos.length === 0 ? <Vacio>No hay proyectos activos. Sin proyectos no hay facturas: revisa las oportunidades.</Vacio> : (
            <div className="grid gap-3">
              {proyectos.map((p) => {
                const c = cliente(g, p.clienteId);
                const avance = Math.min(1, p.avance / p.duracion);
                const restan = p.semanaLimite - g.semana;
                const calidad = calidadProyecto(p);
                const esperado = calidadEsperada(c?.exigencia ?? 2);
                const faltan = p.duracion - p.avance;
                const enRiesgo = faltan > restan + 0.05;
                return (
                  <div key={p.id} className={cx('m-card p-4', enRiesgo && 'm-card-alerta')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="m-eyebrow truncate">{c?.nombre}</span>
                      <span className={cx('m-chip', restan < 0 ? 'm-chip-mal' : enRiesgo ? 'm-chip-alerta' : '')}>
                        {restan < 0 ? `${-restan} sem. de atraso` : restan === 0 ? 'Se entrega esta semana' : `Entrega en ${restan} sem.`}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 mt-1">
                      <strong>{p.nombre}</strong>
                      <span className="m-num">{solesCorto(p.presupuesto)}</span>
                    </div>
                    <div className="mt-2"><Barra valor={avance * 100} color="var(--pp-lavanda)" /></div>
                    <div className="flex justify-between text-xs m-tenue mt-1.5">
                      <span>Avance {Math.round(avance * 100)}%</span>
                      {p.calidadSemanas > 0 && <span>Calidad <span className="m-num" style={{ color: calidad >= esperado ? 'var(--m-ok)' : 'var(--m-alerta)' }}>{Math.round(calidad)}</span> · esperan {esperado}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Fees mensuales">
          {fees.length === 0 ? <Vacio>Todavía no tienes ingresos recurrentes. Un fee mensual te deja planificar sin apostar la caja en cada proyecto.</Vacio> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fees.map((p) => {
                const c = cliente(g, p.clienteId);
                const prox = 4 - ((g.semana - p.semanaInicio) % 4);
                return (
                  <div key={p.id} className="m-card p-4">
                    <span className="m-eyebrow">{c?.nombre}</span>
                    <div className="flex items-baseline gap-2 mt-1"><span className="m-num text-xl">{solesCorto(p.presupuesto)}</span><span className="text-sm m-tenue">al mes</span></div>
                    <div className="text-xs m-tenue mt-1">Próxima factura en {prox} sem.</div>
                    <div className="flex items-center justify-between text-xs mt-2"><span className="m-tenue">Satisfacción</span><span className="m-num" style={{ color: colorNivel(c?.satisfaccion ?? 50) }}>{Math.round(c?.satisfaccion ?? 0)}</span></div>
                    <div className="mt-1"><Barra valor={c?.satisfaccion ?? 0} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>
      </div>

      <div>
        <Seccion titulo={`Por cobrar · ${solesCorto(porCobrar(g))}`}>
          {g.facturas.length === 0 ? <Vacio>No hay facturas pendientes. Recuerda: pagas proveedores y planilla antes de cobrar.</Vacio> : (
            <div className="m-card divide-y" style={{ borderColor: 'var(--m-borde)' }}>
              {[...g.facturas].sort((a, b) => a.semanaCobro - b.semanaCobro).map((f) => {
                const en = f.semanaCobro - g.semana;
                return (
                  <div key={f.id} className="p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate"><strong>{cliente(g, f.clienteId)?.nombre}</strong></div>
                      <div className="text-xs m-tenue truncate">{f.concepto} · {en <= 0 ? 'se cobra al cerrar la semana' : `en ${en} sem.`}{f.demoras ? ' · atrasada' : ''}</div>
                    </div>
                    <span className="m-num">{solesCorto(f.monto)}</span>
                    {en > 1 && !f.apurada && (
                      <Boton tam="sm" disabled={g.foco < 1} onClick={() => hacer((d) => apurarCobro(d, f.id), 'clic')}>Apurar · 1 foco</Boton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Relación con clientes">
          {conHistoria.length === 0 ? <Vacio>Aquí verás qué tan contentos están tus clientes. Los contentos vuelven solos, sin competir.</Vacio> : (
            <div className="grid gap-3">
              {conHistoria.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span><strong>{c.nombre}</strong> <span className="m-tenue">· {c.rubro} · {c.exigencia === 3 ? 'muy exigente' : c.exigencia === 2 ? 'exigente' : 'tranquilo'}</span></span>
                    <span className="m-num" style={{ color: colorNivel(c.satisfaccion) }}>{Math.round(c.satisfaccion)}</span>
                  </div>
                  <div className="mt-1"><Barra valor={c.satisfaccion} /></div>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </div>
    </div>
  );
}

// --------------------------------- Empresa ---------------------------------

export function PanelEmpresa() {
  const { g, hacer } = useMando();
  const req = requisitosEtapa(g);
  const oficina = OFICINAS[g.oficina];
  const sigOficina = OFICINAS[g.oficina + 1];
  const costoProc = COSTO_PROCESOS[g.procesos];
  const disponible = Math.max(0, limiteCredito(g) - g.deuda);
  const feeMes = feesActivos(g).reduce((s, p) => s + p.presupuesto, 0);
  const ejes = Object.entries(g.estilo) as [Eje, number][];
  const maxEje = Math.max(4, ...ejes.map(([, v]) => Math.abs(v)));

  return (
    <div className="grid gap-x-8 lg:grid-cols-2">
      <div>
        <Seccion titulo={`Etapa ${g.etapa} de 5 · ${ETAPAS[g.etapa - 1].nombre}`}>
          <div className="m-card p-4">
            <p className="text-sm">{ETAPAS[g.etapa - 1].lema}</p>
            {req ? (
              <>
                <div className="m-eyebrow mt-4">Para llegar a {req.etapa.nombre}</div>
                <ul className="grid gap-3 mt-2">
                  {req.items.map((i) => (
                    <li key={i.nombre}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">{i.ok ? <Check size={15} strokeWidth={2} className="m-ok" /> : <span className="block rounded-full" style={{ width: 15, height: 15, border: '1.5px solid var(--m-borde-2)' }} />}{i.nombre}</span>
                        <span className="m-num">{'dinero' in i && i.dinero ? `${solesCorto(i.actual)} / ${solesCorto(i.meta)}` : `${i.actual} / ${i.meta}`}</span>
                      </div>
                      <div className="mt-1"><Barra valor={Math.min(100, (i.actual / i.meta) * 100)} color={i.ok ? 'var(--m-ok)' : 'var(--pp-lavanda)'} alto={4} /></div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm m-ok mt-3 font-semibold">Llegaste a la última etapa. Ahora se trata de cuánto vale lo que construiste.</p>
            )}
          </div>
        </Seccion>

        <Seccion titulo="Estructura">
          <div className="grid gap-3">
            <div className="m-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong>Procesos · nivel {g.procesos}</strong>
                  <p className="text-sm m-tenue">Coordinas bien hasta {capacidadGestion(g)} personas. Hoy son {g.personas.length}{caos(g) > 0 ? ': hay desorden.' : '.'}</p>
                </div>
                {costoProc !== undefined ? (
                  <Boton tam="sm" disabled={g.foco < 1 || g.caja < costoProc} onClick={() => hacer((d) => mejorarProcesos(d), 'cobro')}>Subir · {solesCorto(costoProc)} · 1 foco</Boton>
                ) : <span className="m-chip m-chip-ok">Máximo</span>}
              </div>
            </div>
            <div className="m-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong>{oficina.nombre}</strong>
                  <p className="text-sm m-tenue">Caben {oficina.cupo} personas · {solesCorto(oficina.costoSemanal)} por semana</p>
                </div>
                {sigOficina ? (
                  <Boton tam="sm" disabled={g.caja < sigOficina.precio} onClick={() => hacer((d) => mudarOficina(d), 'cobro')}>{sigOficina.nombre} · {solesCorto(sigOficina.precio)}</Boton>
                ) : <span className="m-chip m-chip-ok">Máximo</span>}
              </div>
              {sigOficina && <p className="text-xs m-tenue mt-2">{sigOficina.nombre}: {sigOficina.cupo} personas, {solesCorto(sigOficina.costoSemanal)} por semana.</p>}
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Capacidades">
          <div className="grid gap-2">
            {MEJORAS.map((m) => {
              const tiene = g.mejoras.includes(m.id);
              const bloqueada = g.etapa < m.etapa;
              return (
                <div key={m.id} className={cx('m-card p-3 flex items-center gap-3', bloqueada && 'opacity-50')}>
                  <div className="flex-1 min-w-0">
                    <strong className="text-sm">{m.nombre}</strong>
                    <p className="text-sm m-tenue">{m.efecto}</p>
                  </div>
                  {tiene ? <span className="m-chip m-chip-ok"><Check size={12} strokeWidth={2} /> Activa</span>
                    : bloqueada ? <span className="m-chip"><Lock size={12} strokeWidth={1.75} /> {ETAPAS[m.etapa - 1].nombre}</span>
                    : <Boton tam="sm" disabled={g.caja < m.precio} onClick={() => hacer((d) => comprarMejora(d, m.id), 'cobro')}>{solesCorto(m.precio)}</Boton>}
                </div>
              );
            })}
          </div>
        </Seccion>
      </div>

      <div>
        <Seccion titulo="Finanzas">
          <div className="m-card p-4">
            <div className="grid grid-cols-2 gap-4">
              <Dato nombre="Valor de la empresa" valor={solesCorto(valoracion(g))} />
              <Dato nombre="Facturado en 12 semanas" valor={solesCorto(facturado12(g))} />
              <Dato nombre="Gasto por semana" valor={solesCorto(gastoSemanal(g))} pie={`Planilla ${solesCorto(nominaSemanal(g))} · fijos ${solesCorto(costoFijoSemanal(g))}`} />
              <Dato nombre="Ingreso recurrente" valor={`${solesCorto(feeMes)}/mes`} />
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs m-tenue"><span>Valor de la empresa por semana</span><span>S1 a S{g.semana}</span></div>
              <Tendencia datos={g.historial.map((h) => h.valor)} />
              <div className="flex justify-between text-xs m-tenue mt-2"><span>Caja</span></div>
              <Tendencia datos={g.historial.map((h) => h.caja)} color="var(--m-ok)" />
            </div>
          </div>
          <div className="m-card p-4 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong>Deuda · {solesCorto(g.deuda)}</strong>
                <p className="text-sm m-tenue">El banco te presta hasta {solesCorto(disponible)} más. Interés: 0.6% semanal.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Boton tam="sm" disabled={disponible < 10000} onClick={() => hacer((d) => pedirPrestamo(d, 10000), 'cobro')}>Pedir S/ 10k</Boton>
              <Boton tam="sm" disabled={disponible < 50000} onClick={() => hacer((d) => pedirPrestamo(d, 50000), 'cobro')}>Pedir S/ 50k</Boton>
              <Boton tam="sm" disabled={g.deuda <= 0 || g.caja < Math.min(10000, g.deuda)} onClick={() => hacer((d) => pagarDeuda(d, 10000), 'clic')}>Pagar S/ 10k</Boton>
              <Boton tam="sm" disabled={g.deuda <= 0 || g.caja < g.deuda} onClick={() => hacer((d) => pagarDeuda(d, d.deuda), 'clic')}>Pagar todo</Boton>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Tu estilo hasta ahora">
          <div className="m-card p-4 grid gap-3">
            {g.decisiones.length === 0 && <p className="text-sm m-tenue">Tu perfil de liderazgo se dibuja con cada decisión que tomas.</p>}
            {ejes.map(([eje, v]) => (
              <div key={eje}>
                <div className="flex justify-between text-sm"><span>{EJE_INFO[eje].nombre}</span><span className="m-num">{v > 0 ? `+${v}` : v}</span></div>
                <div className="relative mt-1" style={{ height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 999 }}>
                  <span className="absolute top-0 bottom-0 rounded-full" style={{
                    left: v >= 0 ? '50%' : `${50 - (Math.abs(v) / maxEje) * 50}%`,
                    width: `${(Math.abs(v) / maxEje) * 50}%`,
                    background: v >= 0 ? 'var(--pp-lavanda)' : 'var(--m-mal)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion titulo={`Logros · ${g.logros.length} de ${Object.keys(LOGROS).length}`}>
          <div className="grid gap-2 grid-cols-2">
            {Object.entries(LOGROS).map(([id, l]) => {
              const tiene = g.logros.includes(id);
              return (
                <div key={id} className={cx('m-card p-3 flex gap-2 items-start', !tiene && 'opacity-45')}>
                  <Award size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: tiene ? 'var(--m-alerta)' : 'var(--m-tenue)' }} />
                  <span><strong className="text-sm block">{l.nombre}</strong><span className="text-xs m-tenue">{l.desc}</span></span>
                </div>
              );
            })}
          </div>
        </Seccion>
      </div>
    </div>
  );
}

function Dato({ nombre, valor, pie }: { nombre: string; valor: string; pie?: string }) {
  return (
    <div>
      <div className="text-xs m-tenue">{nombre}</div>
      <div className="m-num text-lg">{valor}</div>
      {pie && <div className="text-[11px] m-tenue">{pie}</div>}
    </div>
  );
}

export { rendimiento, soles };
