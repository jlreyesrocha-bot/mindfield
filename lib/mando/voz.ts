// La voz de cada persona cuando no hay un modelo de IA conectado:
// pensamientos semanales y respuestas de 1:1 generadas desde su estado real.
import { MOTIVADOR_INFO } from './datos';
import { capacidadArea, demandaArea, gen, primerNombre } from './efectos';
import { elegir } from './rng';
import type { Area, Juego, Persona } from './types';

export type Causa = 'fuga' | 'estres' | 'cansancio' | 'sueldo' | 'aburrido' | 'motivador' | 'nuevo' | 'bien' | 'normal';

export function cargaDe(g: Juego, p: Persona): number {
  if (p.rol === 'comercial' || p.rol === 'operaciones') return 0.8;
  const cap = capacidadArea(g, p.rol as Area);
  const dem = demandaArea(g, p.rol as Area);
  return cap > 0 ? dem / cap : dem > 0 ? 2 : 0;
}

export function causaPrincipal(g: Juego, p: Persona): Causa {
  if (p.riesgoFuga >= 55) return 'fuga';
  if (p.estres >= 70) return 'estres';
  if (p.energia <= 35) return 'cansancio';
  if (p.salario < p.salarioMercado * 0.92) return 'sueldo';
  if (g.semana - p.semanaIngreso <= 2) return 'nuevo';
  if (cargaDe(g, p) < 0.35 && g.semana - p.semanaIngreso > 3) return 'aburrido';
  if (p.animo < 55) return 'motivador';
  if (p.animo >= 75) return 'bien';
  return 'normal';
}

const PENSAMIENTOS: Record<Causa, ((p: Persona, g: Juego) => string)[]> = {
  fuga: [
    () => 'Actualicé mi LinkedIn anoche. Solo por si acaso.',
    () => 'Me escribió una reclutadora. Esta vez sí le contesté.',
    (_p, g) => `No sé si en seis meses me veo todavía en ${g.empresa}.`,
    () => 'Ya no discuto en las reuniones. Para qué.',
  ],
  estres: [
    () => 'Tres frentes abiertos y los tres son para ayer.',
    () => 'Anoche soñé con el cronograma. No es buena señal.',
    (p) => `Si entra un proyecto más, no sé cómo lo voy a sacar. Estoy ${gen(p, 'saturado', 'saturada')}.`,
    () => 'Hoy almorcé frente a la pantalla, otra vez.',
  ],
  cansancio: [
    (p) => `Estoy ${gen(p, 'agotado', 'agotada')}. Necesito un fin de semana completo, sin montaje.`,
    () => 'El café ya no me hace efecto.',
    (p) => `Me quedé ${gen(p, 'dormido', 'dormida')} en el taxi de regreso del evento.`,
  ],
  sueldo: [
    () => 'Un amigo con mi mismo cargo gana bastante más en otra agencia.',
    () => 'Hice cuentas este mes y no me cuadran.',
    () => 'Me gusta lo que hago, pero la pasión no paga el alquiler.',
  ],
  aburrido: [
    () => 'Semana tranquila. Demasiado tranquila.',
    () => 'Ordené mis archivos dos veces. Necesito un proyecto.',
    () => 'Quiero un reto, no sé cuánto más puedo estar en pausa.',
  ],
  motivador: [
    (p) => PENSAMIENTO_MOTIVADOR[p.motivador],
  ],
  nuevo: [
    () => 'Todavía estoy entendiendo cómo se hacen las cosas aquí.',
    () => 'Buen equipo. Quiero demostrar por qué me eligieron.',
  ],
  bien: [
    () => 'Me gusta cómo quedó lo último que entregamos.',
    (_p, g) => `Le conté a mi familia lo que hacemos en ${g.empresa}. Me escuché con orgullo.`,
    () => 'Buen ritmo esta semana. Así sí.',
    () => 'Siento que aquí estoy creciendo.',
  ],
  normal: [
    () => 'Semana normal. Avanzando.',
    () => 'Todo en orden por ahora.',
    () => 'Con ganas de ver qué proyecto entra.',
    () => 'Trabajo, casa, trabajo. Bien, sin más.',
  ],
};

const PENSAMIENTO_MOTIVADOR: Record<Persona['motivador'], string> = {
  dinero: 'Trabajo bien, pero siento que mi sueldo se quedó quieto.',
  reconocimiento: 'Nadie comentó nada de lo que entregué. Ni bueno ni malo.',
  crecimiento: 'Hace meses que hago lo mismo. No estoy aprendiendo nada nuevo.',
  equilibrio: 'Casi no he visto a mi familia este mes.',
  proposito: 'A veces no sé para qué hacemos lo que hacemos.',
};

export function pensamiento(g: Juego, p: Persona, r: () => number): string {
  const causa = causaPrincipal(g, p);
  return elegir(r, PENSAMIENTOS[causa])(p, g);
}

// ------------------------------- 1:1 local ---------------------------------

export type Intencion = 'sentir' | 'frena' | 'necesita' | 'empresa' | 'futuro' | 'libre';

export const PREGUNTAS: { id: Intencion; texto: string }[] = [
  { id: 'sentir', texto: '¿Cómo te sientes estas semanas?' },
  { id: 'frena', texto: '¿Qué es lo que más te está frenando?' },
  { id: 'necesita', texto: '¿Qué necesitas de mí?' },
  { id: 'empresa', texto: '¿Cómo ves a la empresa?' },
  { id: 'futuro', texto: '¿Dónde te ves en un año?' },
];

function detectarIntencion(mensaje: string): Intencion {
  const m = mensaje.toLowerCase();
  if (/sient|est[aá]s|ánimo|animo|c[oó]mo vas|c[oó]mo te va/.test(m)) return 'sentir';
  if (/fren|te traba|problema|dificul|molest|te cuesta|obst[aá]culo/.test(m)) return 'frena';
  if (/necesit|ayud|apoy|puedo hacer/.test(m)) return 'necesita';
  if (/empresa|agencia|equipo|rumbo|vamos/.test(m)) return 'empresa';
  if (/futuro|un año|crecer|carrera|te ves|plan/.test(m)) return 'futuro';
  return 'libre';
}

/** Tono del mensaje del CEO: suma si escucha, resta si presiona o minimiza. */
function tono(mensaje: string): number {
  const m = mensaje.toLowerCase();
  let t = 0;
  if (/gracias|valoro|aprecio|buen trabajo|orgull|cuenta conmigo|entiendo|te escucho|perd[oó]n|disculp|tienes raz[oó]n/.test(m)) t += 2;
  if (/\?/.test(m)) t += 1;
  if (/aguanta|no es para tanto|exager|as[ií] es esto|todos estamos|deja de|no te quejes|ponte las pilas|es tu trabajo/.test(m)) t -= 3;
  return t;
}

export interface RespuestaChat {
  respuesta: string;
  deltaAnimo: number;
  deltaEstres: number;
  revela: boolean;
}

export function respuestaLocal(g: Juego, p: Persona, mensaje: string, r: () => number): RespuestaChat {
  const intencion = detectarIntencion(mensaje);
  const causa = causaPrincipal(g, p);
  const confia = p.animo >= 45 || p.rasgo === 'directo';
  const t = tono(mensaje);
  const carga = cargaDe(g, p);
  const partes: string[] = [];
  let revela = false;

  const estado =
    p.animo >= 75 ? 'Bien, de verdad.' :
    p.animo >= 55 ? 'Bien, con sus días.' :
    p.animo >= 40 ? 'Más o menos, para serte sincera.'.replace('sincera', gen(p, 'sincero', 'sincera')) :
    confia ? `No estoy bien. Prefiero decírtelo ${gen(p, 'yo mismo', 'yo misma')}.` : 'Bien. Todo bien.';

  const porCausa: Record<Causa, string> = {
    fuga: confia
      ? 'Te lo digo antes de que te enteres por otro lado: he estado mirando otras opciones.'
      : 'Nada en particular. Solo estoy pensando varias cosas.',
    estres: `Estoy cargando demasiado. ${carga > 1.05 ? 'El área está por encima de lo que puede sacar y se nota en todo.' : 'No es una sola cosa, es que no hay pausa.'}`,
    cansancio: 'Estoy sin energía. Llevo semanas sin descansar bien y ya se me nota en el trabajo.',
    sueldo: 'El tema es el sueldo. Sé lo que se paga afuera por lo que hago y estoy por debajo.',
    aburrido: 'Tengo poco que hacer. Suena a buena noticia, pero me apaga.',
    motivador: PENSAMIENTO_MOTIVADOR[p.motivador],
    nuevo: 'Todavía me estoy ubicando. Me ayudaría tener más claro qué esperas de mí.',
    bien: 'Estoy en un buen momento. Me gusta el equipo y lo que estamos haciendo.',
    normal: 'Nada grave. Las cosas van caminando.',
  };

  const pide: Record<Persona['motivador'], string> = {
    dinero: 'Si me preguntas qué me haría quedarme tranquil@: saber que mi sueldo va a acompañar lo que aporto.',
    reconocimiento: 'Me importa que mi trabajo se vea. No pido un premio, pido que alguien lo diga.',
    crecimiento: 'Quiero aprender cosas nuevas y tener más responsabilidad. Si no crezco aquí, voy a buscarlo.',
    equilibrio: 'Necesito tener vida fuera de la agencia. Las semanas de montaje sin pausa son lo que más me cuesta.',
    proposito: 'Quiero hacer trabajo del que pueda sentir orgullo, y saber que hacemos las cosas bien.',
  };

  switch (intencion) {
    case 'sentir':
      partes.push(estado, porCausa[causa]);
      break;
    case 'frena':
      partes.push(porCausa[causa === 'bien' || causa === 'normal' ? (carga > 1 ? 'estres' : 'normal') : causa]);
      if (g.personas.length > 6 + g.procesos * 4) partes.push('Y hay desorden: a veces no queda claro quién decide qué.');
      break;
    case 'necesita':
      if (confia) {
        partes.push(pide[p.motivador].replace('@', gen(p, 'o', 'a')));
        revela = true;
      } else {
        partes.push('Nada, gracias. Estoy bien así.');
      }
      break;
    case 'empresa':
      partes.push(
        g.caja < 0 ? 'Se comenta que la caja está apretada. Eso pone nervioso a cualquiera.' :
        g.reputacion >= 55 ? 'Siento que nos estamos haciendo un nombre. Eso se nota cuando cuentas dónde trabajas.' :
        'Veo potencial, pero todavía dependemos mucho de cada proyecto que entra.',
      );
      if (g.stats.renuncias > 0 && g.semana - (g.banderas.ultimaRenuncia ?? -99) < 6) partes.push('Lo de la última renuncia nos movió a todos.');
      break;
    case 'futuro':
      if (confia) {
        partes.push(
          p.riesgoFuga >= 55 ? 'Hoy no te puedo asegurar que aquí.' :
          p.motivador === 'crecimiento' ? 'Liderando un equipo, ojalá aquí.' :
          'Aquí, si seguimos creciendo como hasta ahora.',
          pide[p.motivador].replace('@', gen(p, 'o', 'a')),
        );
        revela = true;
      } else {
        partes.push('No lo he pensado mucho.');
      }
      break;
    default:
      if (t >= 2) {
        partes.push(
          p.animo >= 55
            ? elegir(r, ['Gracias. Escucharlo de ti cambia cómo vengo a trabajar.', 'Lo tomo en serio. Voy a seguir empujando.', 'Me sirve saberlo. A veces uno no sabe si lo que hace se nota.'])
            : elegir(r, ['Gracias. Ojalá se note también en el día a día.', 'Lo agradezco. Veamos cómo siguen las próximas semanas.']),
        );
      } else if (t <= -2) {
        partes.push(confia ? 'No esperaba esa respuesta. Pensé que podíamos hablarlo.' : 'Entiendo.');
      } else {
        partes.push(estado, porCausa[causa]);
      }
  }

  if (intencion !== 'libre') {
    if (t <= -2) partes.push(elegir(r, ['Ok. Entendido.', 'Está bien. Vuelvo a lo mío.']));
    else if (t >= 2 && confia) partes.push(elegir(r, ['Gracias por preguntar, en serio.', 'Me sirve que conversemos así.']));
  }
  // No repetir lo mismo que ya dijo en esta conversación.
  const ultima = [...p.chat].reverse().find((m) => m.de === 'persona')?.texto;
  if (ultima && ultima === partes.join(' ')) {
    partes.length = 0;
    partes.push(elegir(r, ['Eso, básicamente. No tengo mucho más que agregar hoy.', 'Lo que te dije. Prefiero mostrártelo con trabajo.', 'Nada nuevo desde hace un rato. Gracias por insistir en preguntar.']));
  }

  // A veces trae a la conversación algo que le pasó hace poco (no el propio 1:1).
  const recuerdo = p.memoria.find((h) => !h.includes('conversar conmigo') && !h.startsWith('Entré a') && !h.startsWith('Dejé mi trabajo'));
  if (recuerdo && (intencion === 'sentir' || intencion === 'frena') && r() < 0.4) partes.push(`Y algo que tengo presente: ${recuerdo}`);

  return {
    respuesta: partes.join(' '),
    deltaAnimo: Math.max(-5, Math.min(4, t)),
    deltaEstres: t >= 1 ? -2 : t <= -2 ? 3 : 0,
    revela,
  };
}

/** Retrato de la persona para el modelo de IA. */
export function fichaParaIA(g: Juego, p: Persona): string {
  const carga = cargaDe(g, p);
  return [
    `Nombre: ${p.nombre} (${primerNombre(p)}). Cargo: ${p.cargo} en ${g.empresa}, agencia de brand experience en Lima con ${g.personas.length} personas. Lleva ${g.semana - p.semanaIngreso} semanas en la empresa.`,
    `Rasgo de personalidad: ${p.rasgo}. Lo que más le importa en el trabajo (no lo dice de frente salvo que haya confianza): ${MOTIVADOR_INFO[p.motivador].nombre}.`,
    `Estado actual (0 a 100): ánimo ${Math.round(p.animo)}, estrés ${Math.round(p.estres)}, energía ${Math.round(p.energia)}, ganas de irse ${Math.round(p.riesgoFuga)}.`,
    `Sueldo: S/ ${p.salario} al mes; el mercado paga S/ ${p.salarioMercado} por su perfil.`,
    `Carga de su área esta semana: ${Math.round(carga * 100)}% de la capacidad.`,
    `Lo que tiene en la cabeza: "${p.pensamiento}"`,
    p.memoria.length ? `Hechos recientes que recuerda: ${p.memoria.slice(0, 5).join(' | ')}` : '',
    `Contexto de la empresa: semana ${g.semana}, caja ${g.caja < 0 ? 'en negativo' : g.caja < 30000 ? 'ajustada' : 'estable'}, reputación ${Math.round(g.reputacion)}/100, ${g.stats.renuncias} renuncias y ${g.stats.despidos} despidos hasta hoy.`,
  ].filter(Boolean).join('\n');
}
