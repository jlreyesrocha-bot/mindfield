// Controlador de la maqueta: une la simulación, la escena 3D y la interfaz.
// No usa ningún framework, así que se puede montar en una página de Next o en un HTML suelto.
import { Escena, type Objetivo } from './escena';
import { estilos, type Fuentes } from './estilos';
import { ALTO, ANCHO } from './mapa';
import {
  ACTIVIDAD_TEXTO,
  AREAS,
  ROL_NOMBRE,
  aceptarOferta,
  buscarCandidatos,
  cargoDe,
  comprarEscritorio,
  contratar,
  costoEscritorio,
  costoIngreso,
  escritoriosLibres,
  horaTexto,
  nuevaSim,
  ordenar,
  rechazarOferta,
  soles,
  tick,
  type Agente,
  type Area,
  type Orden,
  type Sim,
} from './sim';

const COLOR_ROL: Record<string, string> = { cuentas: '#38bdf8', creatividad: '#f472b6', produccion: '#f5a742', ceo: '#ffd166' };

const ICONO = {
  pausa: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
  girar: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1"/><path d="M13.5 2.5v3h-3"/></svg>',
};

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function nivel(valor: number, invertida = false): string {
  const v = invertida ? 100 - valor : valor;
  return v >= 60 ? 'ok' : v >= 38 ? 'alerta' : 'mal';
}

function barra(etiqueta: string, valor: number, invertida = false): string {
  const n = nivel(valor, invertida);
  return `<div class="of-medidor"><div class="of-medidor-fila"><span>${etiqueta}</span><b class="of-${n}">${Math.round(valor)}</b></div><div class="of-barra"><i class="of-bg-${n}" style="width:${Math.max(0, Math.min(100, valor)).toFixed(0)}%"></i></div></div>`;
}

export interface OpcionesJuego {
  fuentes?: Fuentes;
  semilla?: number;
}

export function montar(raiz: HTMLElement, op: OpcionesJuego = {}): () => void {
  let sim: Sim = nuevaSim(op.semilla);
  const seleccion = new Set<string>();
  let velocidad = 1;
  let pausa = true;
  let modal: 'intro' | 'ayuda' | 'contratar' | 'fin' | null = 'intro';
  let rolBusqueda: Area = 'produccion';
  let panelAbierto = window.innerWidth >= 900;
  let toasts: { texto: string; tipo: string; hasta: number }[] = [];
  let audio: AudioContext | null = null;
  let vivo = true;

  const estilo = document.createElement('style');
  estilo.textContent = estilos(op.fuentes);
  raiz.appendChild(estilo);
  const cont = document.createElement('div');
  cont.className = 'of-raiz';
  cont.innerHTML = `
    <canvas class="of-lienzo" tabindex="0" aria-label="Oficina en 3D"></canvas>
    <div class="of-capa"></div>
    <header class="of-top"></header>
    <aside class="of-lado"></aside>
    <div class="of-toasts" role="status" aria-live="polite"></div>
    <footer class="of-bajo">
      <div class="of-mini"><canvas width="204" height="144" aria-label="Minimapa"></canvas></div>
      <section class="of-sel"></section>
      <section class="of-cmd"></section>
    </footer>
    <div class="of-noche"></div>
    <div class="of-modal" hidden></div>`;
  raiz.appendChild(cont);
  const $ = <T extends HTMLElement>(s: string) => cont.querySelector(s) as T;
  const lienzo = $<HTMLCanvasElement>('.of-lienzo');
  const mini = $<HTMLCanvasElement>('.of-mini canvas');
  const elTop = $('.of-top');
  const elLado = $('.of-lado');
  const elSel = $('.of-sel');
  const elCmd = $('.of-cmd');
  const elToasts = $('.of-toasts');
  const elModal = $('.of-modal');
  const elNoche = $('.of-noche');

  // ---------------------------------- sonido --------------------------------

  function sonar(tipo: 'clic' | 'orden' | 'dinero' | 'mal'): void {
    try {
      audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audio.state === 'suspended') void audio.resume();
    } catch {
      return;
    }
    const notas: [number, number, number][] = { clic: [[660, 0, 0.05]], orden: [[520, 0, 0.06], [780, 0.05, 0.08]], dinero: [[784, 0, 0.1], [1047, 0.08, 0.12], [1319, 0.16, 0.2]], mal: [[300, 0, 0.16], [220, 0.12, 0.26]] }[tipo] as [number, number, number][];
    for (const [f, t0, d] of notas) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = audio.currentTime + t0;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    }
  }

  function avisar(texto: string, tipo = 'neutro'): void {
    toasts.push({ texto, tipo, hasta: performance.now() + 5200 });
    if (toasts.length > 4) toasts = toasts.slice(-4);
  }

  // --------------------------------- órdenes --------------------------------

  const presentes = () => [...seleccion].filter((id) => sim.agentes.some((a) => a.id === id && a.presente));

  function mandar(o: Orden, ids = presentes()): void {
    if (!ids.length) return;
    ordenar(sim, ids, o);
    sonar('orden');
    for (const id of ids) {
      const a = sim.agentes.find((x) => x.id === id);
      if (!a) continue;
      const fin = a.ruta[a.ruta.length - 1];
      if (fin && a.destino?.tipo !== 'salir') escena.marcar(fin.x, fin.z, a.rol === 'ceo' ? 0xffd166 : 0x3dd6a0);
    }
  }

  function alOrdenar(o: Objetivo, soloSiAplica = false): boolean {
    const ids = presentes();
    if (!ids.length) return false;
    if (o.tipo === 'agente') {
      if (ids.includes('ceo') && o.id !== 'ceo') {
        mandar({ tipo: 'charla', objetivo: o.id }, ['ceo']);
        return true;
      }
      if (soloSiAplica) return false;
      const p = escena.posicionDe(o.id);
      if (p) mandar({ tipo: 'mover', x: p.x, z: p.z });
      return true;
    }
    if (o.tipo === 'estacion') {
      const e = sim.mapa.estaciones.find((x) => x.id === o.id);
      if (!e || !e.activo) return false;
      const orden: Orden = e.tipo === 'cafe' ? { tipo: 'cafe' } : e.tipo === 'sofa' ? { tipo: 'descansar' } : e.tipo === 'reunion' ? { tipo: 'reunion' } : { tipo: 'trabajar' };
      mandar(orden);
      return true;
    }
    mandar({ tipo: 'mover', x: o.x, z: o.z });
    return true;
  }

  const escena = new Escena(lienzo, $<HTMLDivElement>('.of-capa'), sim, {
    seleccionar(ids, agregar) {
      if (!agregar) seleccion.clear();
      for (const id of ids) seleccion.add(id);
      if (ids.length) sonar('clic');
      pintar(true);
    },
    ordenar: alOrdenar,
    comprarEscritorio() {
      accion('escritorio');
    },
    haySeleccion: () => presentes().length > 0,
  });

  function reiniciar(): void {
    sim = nuevaSim();
    seleccion.clear();
    pausa = false;
    velocidad = 1;
    modal = null;
    toasts = [];
  }

  function accion(a: string, arg = ''): void {
    let error: string | null = null;
    switch (a) {
      case 'empezar':
        modal = null;
        pausa = false;
        sonar('orden');
        break;
      case 'ayuda':
        modal = modal === 'ayuda' ? null : 'ayuda';
        break;
      case 'cerrar':
        modal = null;
        sim.candidatos = [];
        break;
      case 'pausa':
        pausa = !pausa;
        break;
      case 'vel':
        velocidad = Number(arg) || 1;
        pausa = false;
        break;
      case 'panel':
        panelAbierto = !panelAbierto;
        break;
      case 'aceptar':
        error = aceptarOferta(sim, arg);
        if (!error) sonar('orden');
        break;
      case 'rechazar':
        rechazarOferta(sim, arg);
        break;
      case 'contratar':
        modal = 'contratar';
        buscarCandidatos(sim, rolBusqueda);
        break;
      case 'rol':
        rolBusqueda = arg as Area;
        buscarCandidatos(sim, rolBusqueda);
        break;
      case 'fichar':
        error = contratar(sim, arg);
        if (!error) {
          modal = null;
          sonar('dinero');
        }
        break;
      case 'escritorio':
        error = comprarEscritorio(sim);
        if (!error) sonar('orden');
        break;
      case 'trabajar':
      case 'cafe':
      case 'descansar':
      case 'reunion':
        mandar({ tipo: a });
        break;
      case 'charla':
        mandar({ tipo: 'charla', objetivo: arg }, ['ceo']);
        break;
      case 'elegir':
        seleccion.clear();
        seleccion.add(arg);
        break;
      case 'todos':
        seleccion.clear();
        for (const x of sim.agentes) if (x.presente && x.rol !== 'ceo') seleccion.add(x.id);
        break;
      case 'enfocar': {
        const ids = presentes();
        const p = ids.length ? escena.posicionDe(ids[0]) : null;
        if (p) escena.enfocar(p.x, p.z, 15);
        else escena.enfocar(ANCHO / 2, ALTO / 2 + 1, 34);
        break;
      }
      case 'girar':
        escena.girar(Number(arg));
        break;
      case 'zoom':
        escena.acercar(Number(arg));
        break;
      case 'bordes':
        escena.bordes = !escena.bordes;
        break;
      case 'reiniciar':
        reiniciar();
        break;
    }
    if (error) {
      avisar(error, 'malo');
      sonar('mal');
    }
    pintar(true);
  }

  // -------------------------------- interfaz --------------------------------

  const cache = new Map<HTMLElement, string>();
  function poner(el: HTMLElement, html: string): void {
    if (cache.get(el) === html) return;
    cache.set(el, html);
    el.innerHTML = html;
  }

  function plazo(dia: number): string {
    const d = dia - sim.dia;
    return d < 0 ? '<b class="of-mal">Atrasado</b>' : d === 0 ? '<b class="of-alerta">Vence hoy</b>' : d === 1 ? 'Vence mañana' : `Vence en ${d} días`;
  }

  function pintarTop(): void {
    const empleados = sim.agentes.filter((a) => a.rol !== 'ceo').length;
    const vel = (v: number) => `<button type="button" class="of-btn-vel${!pausa && velocidad === v ? ' activo' : ''}" data-a="vel" data-arg="${v}" aria-pressed="${!pausa && velocidad === v}">${v}x</button>`;
    poner(elTop, `
      <div class="of-marca">MANDO</div>
      <div class="of-dato"><span>Día ${sim.dia}</span><b>${sim.fase === 'noche' ? '—' : horaTexto(Math.min(sim.hora, 19.5))}</b></div>
      <div class="of-dato"><span>Caja</span><b class="${sim.caja < 0 ? 'of-mal' : ''}">${soles(sim.caja)}</b></div>
      <div class="of-dato of-solo-ancho"><span>Reputación</span><b>${Math.round(sim.reputacion)}</b></div>
      <div class="of-dato of-solo-ancho"><span>Equipo</span><b>${empleados}</b></div>
      <div class="of-espacio"></div>
      <div class="of-vel" role="group" aria-label="Velocidad">
        <button type="button" class="of-btn-vel${pausa ? ' activo' : ''}" data-a="pausa" aria-label="Pausa" aria-pressed="${pausa}">${ICONO.pausa}</button>
        ${vel(1)}${vel(2)}${vel(4)}
      </div>
      <button type="button" class="of-btn-vel" data-a="ayuda" aria-label="Controles">?</button>`);
  }

  function pintarLado(): void {
    const proyectos = sim.proyectos.map((p) => `
      <div class="of-tarjeta">
        <div class="of-tarjeta-cab"><span class="of-eyebrow">${esc(p.cliente)}</span><span class="of-chico">${plazo(p.diaLimite)}</span></div>
        <div class="of-tarjeta-tit">${esc(p.nombre)} <b>${soles(p.pago)}</b></div>
        ${AREAS.map((a) => `<div class="of-area"><span>${ROL_NOMBRE[a]}</span><div class="of-barra"><i style="width:${Math.min(100, (p.hecho[a] / p.necesita[a]) * 100).toFixed(0)}%;background:${COLOR_ROL[a]}"></i></div><span class="of-num">${Math.min(p.necesita[a], Math.floor(p.hecho[a]))}/${p.necesita[a]}</span></div>`).join('')}
      </div>`).join('');
    const ofertas = sim.ofertas.map((o) => `
      <div class="of-tarjeta of-oferta">
        <div class="of-tarjeta-cab"><span class="of-eyebrow">${esc(o.cliente)}</span><span class="of-chico">${o.dias} día${o.dias > 1 ? 's' : ''} de plazo</span></div>
        <div class="of-tarjeta-tit">${esc(o.nombre)} <b>${soles(o.pago)}</b></div>
        <div class="of-chico">Trabajo: ${AREAS.map((a) => `<span style="color:${COLOR_ROL[a]}">${ROL_NOMBRE[a]} ${o.necesita[a]}</span>`).join(' · ')}</div>
        <div class="of-fila"><button type="button" class="of-btn of-btn-pri" data-a="aceptar" data-arg="${o.id}">Aceptar</button><button type="button" class="of-btn" data-a="rechazar" data-arg="${o.id}">Pasar</button></div>
      </div>`).join('');
    const libres = escritoriosLibres(sim);
    const cuerpo = `
      <div class="of-eyebrow">En curso · ${sim.proyectos.length}</div>
      ${proyectos || '<p class="of-vacio">Sin proyectos. Tu equipo no tiene en qué trabajar: acepta una oferta.</p>'}
      <div class="of-eyebrow of-sep">Ofertas · ${sim.ofertas.length}</div>
      ${ofertas || '<p class="of-vacio">No hay ofertas ahora. Llegan más seguido si te sientas en tu despacho a buscar clientes.</p>'}
      <div class="of-eyebrow of-sep">Crecer</div>
      <div class="of-fila">
        <button type="button" class="of-btn" data-a="contratar">Contratar</button>
        <button type="button" class="of-btn" data-a="escritorio">Escritorio · ${soles(costoEscritorio(sim))}</button>
      </div>
      <p class="of-chico">${libres ? `${libres} escritorio${libres > 1 ? 's' : ''} libre${libres > 1 ? 's' : ''} para contratar.` : 'Sin escritorios libres: compra uno antes de contratar.'}</p>`;
    poner(elLado, `
      <button type="button" class="of-lado-cab" data-a="panel" aria-expanded="${panelAbierto}">
        <span>Proyectos</span><span class="of-chip">${sim.proyectos.length} en curso · ${sim.ofertas.length} oferta${sim.ofertas.length === 1 ? '' : 's'}</span>
      </button>
      ${panelAbierto ? `<div class="of-lado-cuerpo">${cuerpo}</div>` : ''}`);
  }

  function retrato(a: Agente, tam = 44): string {
    const ini = a.rol === 'ceo' ? 'TÚ' : a.nombre.split(' ').map((x) => x[0]).join('').slice(0, 2);
    return `<span class="of-retrato" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.34)}px;border-color:${COLOR_ROL[a.rol]}">${esc(ini)}</span>`;
  }

  function pintarSeleccion(): void {
    const sel = sim.agentes.filter((a) => seleccion.has(a.id) && a.presente);
    if (sel.length === 0) {
      poner(elSel, `<div class="of-pista"><b>Nadie seleccionado.</b> <span class="of-pista-larga">Haz clic en una persona, o arrastra para seleccionar varias. Con clic derecho les das una orden: un escritorio, la cafetera, los sofás o la sala de reuniones.</span><br><button type="button" class="of-btn of-btn-sm" data-a="todos">Seleccionar al equipo</button> <button type="button" class="of-btn of-btn-sm" data-a="elegir" data-arg="ceo">Seleccionarte a ti</button></div>`);
      return;
    }
    if (sel.length === 1) {
      const a = sel[0];
      const ceo = a.rol === 'ceo';
      poner(elSel, `
        <div class="of-ficha">
          ${retrato(a, 52)}
          <div class="of-ficha-datos">
            <div class="of-nombre">${ceo ? 'Tú' : esc(a.nombre)} <span class="of-chico">${ceo ? 'CEO' : `${cargoDe(a)} · habilidad ${a.habilidad}`}</span></div>
            <div class="of-chico"><span class="of-punto" style="background:${COLOR_ROL[a.rol]}"></span>${ACTIVIDAD_TEXTO[a.actividad]}${a.forzadoHasta > sim.hora ? ' · a disgusto' : ''}${a.alineado ? ' · con rumbo claro' : ''}</div>
            ${ceo ? '<p class="of-pensar">Tu tiempo es el recurso escaso: en tu despacho traes clientes, y cuando te acercas a alguien le subes el ánimo.</p>' : `<p class="of-pensar">«${esc(a.pensamiento)}»</p>`}
          </div>
          ${ceo ? '' : `<div class="of-medidores">${barra('Ánimo', a.animo)}${barra('Estrés', a.estres, true)}${barra('Energía', a.energia)}</div>`}
        </div>`);
      return;
    }
    poner(elSel, `<div class="of-grupo">${sel.map((a) => `<button type="button" class="of-mini-ficha" data-a="elegir" data-arg="${a.id}">${retrato(a, 34)}<span class="of-punto of-bg-${a.rol === 'ceo' ? 'ok' : nivel(a.animo)}"></span><span>${a.rol === 'ceo' ? 'Tú' : esc(a.nombre.split(' ')[0])}</span></button>`).join('')}</div>`);
  }

  function pintarComandos(): void {
    const sel = sim.agentes.filter((a) => seleccion.has(a.id) && a.presente);
    const hay = sel.length > 0;
    const soloCeo = sel.length === 1 && sel[0].rol === 'ceo';
    const unEmpleado = sel.length === 1 && sel[0].rol !== 'ceo';
    const b = (a: string, texto: string, tecla: string, arg = '') => `<button type="button" class="of-btn of-btn-cmd" data-a="${a}" data-arg="${arg}" ${hay ? '' : 'disabled'}>${texto}<kbd>${tecla}</kbd></button>`;
    poner(elCmd, `
      <div class="of-cmd-grid">
        ${b('trabajar', soloCeo ? 'Buscar clientes' : 'Trabajar', 'T')}
        ${b('cafe', 'Café', 'C')}
        ${b('descansar', 'Descansar', 'X')}
        ${b('reunion', 'Reunión', 'R')}
      </div>
      ${unEmpleado ? `<button type="button" class="of-btn of-btn-pri of-btn-ancho" data-a="charla" data-arg="${sel[0].id}">Ir a conversar con ${esc(sel[0].nombre.split(' ')[0])}</button>` : soloCeo ? '<p class="of-chico">Clic derecho sobre alguien para ir a conversar.</p>' : ''}
      <div class="of-cam">
        <button type="button" class="of-btn-vel" data-a="girar" data-arg="1" aria-label="Girar cámara a la izquierda">${ICONO.girar}</button>
        <button type="button" class="of-btn-vel" data-a="zoom" data-arg="0.75" aria-label="Acercar">+</button>
        <button type="button" class="of-btn-vel" data-a="zoom" data-arg="1.33" aria-label="Alejar">−</button>
        <button type="button" class="of-btn-vel" data-a="enfocar" aria-label="Centrar la cámara">◎</button>
      </div>`);
  }

  function pintarToasts(): void {
    const ahora = performance.now();
    toasts = toasts.filter((t) => t.hasta > ahora);
    poner(elToasts, toasts.map((t) => `<div class="of-toast of-toast-${t.tipo}">${esc(t.texto)}</div>`).join(''));
  }

  function pintarModal(): void {
    if (sim.fin && modal !== 'fin') modal = 'fin';
    if (!modal) {
      elModal.hidden = true;
      cache.delete(elModal);
      return;
    }
    elModal.hidden = false;
    const controles = `
      <ul class="of-controles">
        <li><kbd>Clic</kbd> selecciona a una persona. <kbd>Arrastrar</kbd> selecciona a varias.</li>
        <li><kbd>Clic derecho</kbd> da la orden: en el piso se mueven; en un escritorio trabajan; en la cafetera, los sofás o la sala hacen eso.</li>
        <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o arrastrar con clic derecho mueve la cámara. <kbd>Rueda</kbd> acerca y aleja. <kbd>Q</kbd><kbd>E</kbd> giran.</li>
        <li><kbd>Espacio</kbd> pausa. <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> cambian la velocidad. <kbd>F</kbd> centra la cámara.</li>
        <li>En pantalla táctil: toca para seleccionar, toca un lugar para ordenar, arrastra para mover la cámara y pellizca para acercar.</li>
      </ul>`;
    let html = '';
    if (modal === 'intro') {
      html = `
        <div class="of-eyebrow">Maqueta jugable · versión 0.1</div>
        <h1 class="of-titulo">MANDO</h1>
        <p class="of-lead">Diriges una agencia desde arriba, como en un juego de estrategia, y cuidas a cada persona como en un simulador de vida.</p>
        <ol class="of-pasos">
          <li><b>Acepta proyectos</b> en el panel de la izquierda. Sin proyectos, el equipo se aburre y la caja se vacía.</li>
          <li><b>Mira los rombos</b> sobre cada cabeza: verde está bien, ámbar atención, rojo se quiere ir.</li>
          <li><b>Decide por ellos o déjalos decidir.</b> Solos van por café o a descansar cuando no dan más. Si los obligas a seguir, obedecen y lo pagas en ánimo.</li>
          <li><b>Muévete tú.</b> Eres la figura de traje púrpura: en tu despacho traes clientes, y junto a alguien, conversas.</li>
        </ol>
        ${controles}
        <button type="button" class="of-btn of-btn-pri of-btn-gr" data-a="empezar">Empezar el día 1</button>`;
    } else if (modal === 'ayuda') {
      html = `<div class="of-eyebrow">Controles</div><h2 class="of-titulo of-titulo-sm">Cómo se juega</h2>${controles}
        <label class="of-check"><input type="checkbox" id="of-bordes" ${escena.bordes ? 'checked' : ''} data-a="bordes"> Mover la cámara al llevar el mouse a los bordes</label>
        <div class="of-fila"><button type="button" class="of-btn of-btn-pri" data-a="cerrar">Volver al juego</button><button type="button" class="of-btn" data-a="reiniciar">Reiniciar partida</button></div>`;
    } else if (modal === 'contratar') {
      html = `<div class="of-eyebrow">Contratar</div><h2 class="of-titulo of-titulo-sm">Tres finalistas</h2>
        <div class="of-fila" role="tablist">${AREAS.map((r) => `<button type="button" class="of-btn${rolBusqueda === r ? ' of-btn-pri' : ''}" data-a="rol" data-arg="${r}" role="tab" aria-selected="${rolBusqueda === r}">${ROL_NOMBRE[r]}</button>`).join('')}</div>
        <div class="of-candidatos">${sim.candidatos.map((c) => `
          <div class="of-tarjeta">
            <div class="of-nombre">${esc(c.nombre)}</div>
            <div class="of-chico">${cargoDe(c)}</div>
            ${barra('Habilidad', c.habilidad * 10)}
            <div class="of-chico">Sueldo ${soles(c.salario)} al mes</div>
            <button type="button" class="of-btn of-btn-pri of-btn-ancho" data-a="fichar" data-arg="${c.id}">Contratar · ${soles(costoIngreso(c))}</button>
          </div>`).join('')}</div>
        <p class="of-chico">${escritoriosLibres(sim) ? 'Llega caminando por la puerta en cuanto firmes.' : 'No hay escritorio libre: compra uno antes de contratar.'}</p>
        <button type="button" class="of-btn" data-a="cerrar">Cerrar</button>`;
    } else {
      html = `<div class="of-eyebrow">Fin de la partida</div><h2 class="of-titulo of-titulo-sm">La caja no aguantó</h2>
        <p class="of-lead">Llegaste al día ${sim.dia} con ${sim.stats.entregados} proyectos entregados y ${soles(sim.stats.facturado)} facturados. Los sueldos y el alquiler se pagan todos los días, haya o no proyectos.</p>
        <button type="button" class="of-btn of-btn-pri of-btn-gr" data-a="reiniciar">Jugar otra vez</button>`;
    }
    poner(elModal, `<div class="of-modal-caja" role="dialog" aria-modal="true">${html}</div>`);
  }

  function pintarMini(): void {
    const g = mini.getContext('2d');
    if (!g) return;
    const k = mini.width / ANCHO;
    g.clearRect(0, 0, mini.width, mini.height);
    g.fillStyle = '#2b2160';
    g.fillRect(0, 0, mini.width, mini.height);
    g.fillStyle = '#0c0420';
    for (let z = 0; z < ALTO; z++) for (let x = 0; x < ANCHO; x++) if (sim.mapa.bloqueado[z * ANCHO + x]) g.fillRect(x * k, z * k, k + 0.5, k + 0.5);
    for (const a of sim.agentes) {
      if (!a.presente) continue;
      g.fillStyle = COLOR_ROL[a.rol];
      g.beginPath();
      g.arc(a.x * k, Math.min(ALTO, a.z) * k, seleccion.has(a.id) ? 4.2 : 3, 0, Math.PI * 2);
      g.fill();
      if (seleccion.has(a.id)) {
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    const h = escena.huella();
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = 1.2;
    g.beginPath();
    h.forEach((p, i) => (i ? g.lineTo(p.x * k, p.z * k) : g.moveTo(p.x * k, p.z * k)));
    g.closePath();
    g.stroke();
  }

  let ultimoPintado = 0;
  function pintar(forzar = false): void {
    const ahora = performance.now();
    if (!forzar && ahora - ultimoPintado < 160) return;
    ultimoPintado = ahora;
    for (const id of [...seleccion]) if (!sim.agentes.some((a) => a.id === id)) seleccion.delete(id);
    pintarTop();
    pintarLado();
    pintarSeleccion();
    pintarComandos();
    pintarToasts();
    pintarModal();
    pintarMini();
    elNoche.classList.toggle('activa', sim.fase === 'noche');
  }

  // -------------------------------- eventos DOM -----------------------------

  let ignorarClic = false;
  const alPulsar = (e: Event) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    if (e.type === 'pointerdown') {
      if ((e as PointerEvent).button !== 0) return;
      ignorarClic = true;
      window.setTimeout(() => (ignorarClic = false), 400);
    } else if (ignorarClic) {
      return;
    }
    if (el.tagName !== 'INPUT') e.preventDefault();
    accion(el.dataset.a!, el.dataset.arg ?? '');
  };
  cont.addEventListener('pointerdown', alPulsar);
  cont.addEventListener('click', alPulsar);

  const enMini = (e: PointerEvent) => {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    const r = mini.getBoundingClientRect();
    escena.enfocar(((e.clientX - r.left) / r.width) * ANCHO, ((e.clientY - r.top) / r.height) * ALTO);
  };
  mini.addEventListener('pointerdown', enMini);
  mini.addEventListener('pointermove', enMini);

  const alTeclear = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
    const k = e.key.toLowerCase();
    if (modal === 'intro') {
      if (k === 'enter') accion('empezar');
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      accion('pausa');
    } else if (k === '1') accion('vel', '1');
    else if (k === '2') accion('vel', '2');
    else if (k === '3') accion('vel', '4');
    else if (k === 't') accion('trabajar');
    else if (k === 'c') accion('cafe');
    else if (k === 'x') accion('descansar');
    else if (k === 'r') accion('reunion');
    else if (k === 'f') accion('enfocar');
    else if (k === 'h') accion('ayuda');
    else if (k === 'escape') {
      if (modal) accion('cerrar');
      else {
        seleccion.clear();
        pintar(true);
      }
    }
  };
  window.addEventListener('keydown', alTeclear);

  // ---------------------------------- ciclo ---------------------------------

  let anterior = performance.now();
  let cuadro = 0;
  function ciclo(ahora: number): void {
    if (!vivo) return;
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    const corre = !pausa && (modal === null || modal === 'contratar') && !sim.fin;
    if (corre) {
      // A velocidades altas se avanza en pasos cortos para que nadie atraviese paredes.
      const pasos = velocidad > 2 ? 2 : 1;
      for (let i = 0; i < pasos; i++) tick(sim, (dt * velocidad) / pasos);
    }
    for (const ev of sim.eventos.splice(0)) {
      avisar(ev.texto, ev.tipo);
      if (ev.tipo === 'malo') sonar('mal');
    }
    for (const ef of sim.efectos.splice(0)) {
      escena.flotante(ef.x, ef.z, ef.texto, ef.tono);
      if (ef.tono === 'bueno') sonar('dinero');
    }
    escena.actualizar(dt, sim, seleccion, corre ? velocidad : 0);
    pintar();
    cuadro = requestAnimationFrame(ciclo);
  }
  pintar(true);
  cuadro = requestAnimationFrame(ciclo);

  // Gancho de pruebas: permite inspeccionar y manejar la partida desde la consola.
  (window as unknown as { __mando?: unknown }).__mando = {
    get sim() {
      return sim;
    },
    escena,
    seleccion,
    accion,
    ordenar: alOrdenar,
    avanzar(segundos: number) {
      for (let i = 0; i < segundos * 30; i++) tick(sim, 1 / 30);
    },
  };

  return () => {
    vivo = false;
    cancelAnimationFrame(cuadro);
    window.removeEventListener('keydown', alTeclear);
    escena.destruir();
    cont.remove();
    estilo.remove();
    void audio?.close();
  };
}
