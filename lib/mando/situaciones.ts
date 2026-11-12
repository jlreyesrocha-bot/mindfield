// MANDO: mazo de situaciones. Cada una plantea un dilema real de gestión,
// con costos en todas las opciones y consecuencias que a veces llegan semanas después.
import {
  animo,
  animoTodos,
  caja,
  candidatoAPersona,
  cliente,
  clientesActivos,
  crearProyecto,
  diferir,
  energia,
  estres,
  estresArea,
  estresCeo,
  feesActivos,
  gen,
  generarCandidato,
  generarOportunidad,
  liquidacion,
  mejorPersona,
  nominaSemanal,
  noticia,
  peorPersona,
  persona,
  personaAlAzar,
  primerNombre,
  proyectosActivos,
  rendimiento,
  rep,
  sacarPersona,
  sat,
  soles,
} from './efectos';
import { clamp, elegir, prob } from './rng';
import type { Cliente, Ctx, Factura, Juego, ManejadorDiferido, Persona, Proyecto, SituacionDef, Tier } from './types';

// ------------------------------- helpers locales ---------------------------

const r100 = (n: number) => Math.round(n / 100) * 100;
const r50 = (n: number) => Math.round(n / 50) * 50;

/** Planilla de una semana, con un piso para que los montos pesen también en el garaje. */
const base = (g: Juego) => Math.max(3000, nominaSemanal(g));

const antiguedad = (g: Juego, p: Persona) => g.semana - p.semanaIngreso;

const soloProyectos = (g: Juego): Proyecto[] => proyectosActivos(g).filter((p) => p.tipo === 'proyecto');

function unProyecto(g: Juego, r: () => number, filtro?: (p: Proyecto) => boolean): Proyecto | undefined {
  const lista = soloProyectos(g).filter((p) => !filtro || filtro(p));
  return lista.length ? elegir(r, lista) : undefined;
}

function ajustarActivos(g: Juego, d: number): void {
  for (const p of proyectosActivos(g)) p.ajusteCalidad += d;
}

function quitarFactura(g: Juego, f: Factura): void {
  g.facturas = g.facturas.filter((x) => x.id !== f.id);
}

function subirSueldo(p: Persona, pct: number): void {
  p.salario = r50(p.salario * (1 + pct));
}

const sinCaja =
  (monto: (x: Ctx) => number) =>
  (x: Ctx): string | null =>
    x.g.caja < monto(x) ? `Necesitas ${soles(monto(x))} en caja` : null;

function bandera(g: Juego, clave: string, d = 1): void {
  g.banderas[clave] = (g.banderas[clave] ?? 0) + d;
}

/** Ingreso semanal aproximado que representa cada cliente con trabajo activo. */
function concentracion(g: Juego): { c: Cliente; parte: number } | null {
  const por = new Map<string, number>();
  let total = 0;
  for (const p of proyectosActivos(g)) {
    const semanal = p.tipo === 'fee' ? p.presupuesto / 4 : p.presupuesto / Math.max(1, p.duracion);
    por.set(p.clienteId, (por.get(p.clienteId) ?? 0) + semanal);
    total += semanal;
  }
  if (total <= 0) return null;
  let mejor: { c: Cliente; parte: number } | null = null;
  for (const [id, monto] of por) {
    const c = cliente(g, id);
    if (c && (!mejor || monto / total > mejor.parte)) mejor = { c, parte: monto / total };
  }
  return mejor;
}

function valorAprox(g: Juego): number {
  const f12 = g.facturadoSemanal.slice(-12).reduce((s, n) => s + n, 0);
  return Math.max(250000, f12 * (52 / 12) * (0.35 + (g.reputacion / 100) * 0.9));
}

/** La persona se va por decisión propia y el equipo lo siente. */
function seVa(g: Juego, p: Persona, golpe: number): void {
  sacarPersona(g, p, 'renuncia');
  animoTodos(g, golpe, `${primerNombre(p)} dejó la empresa.`);
}

// ------------------------------- situaciones -------------------------------

export const SITUACIONES: SituacionDef[] = [
  // ======================= obligatorias, solo por cola ======================
  {
    id: 'renuncia',
    titulo: 'Carta de renuncia',
    categoria: 'personas',
    etapas: [1, 5],
    peso: 0,
    repetible: true,
    texto: (x) => {
      const p = x.p;
      if (!p) return 'Alguien del equipo pidió hablar contigo, pero ya no está en la empresa.';
      const reciente = p.ultima1a1 > 0 && x.g.semana - p.ultima1a1 <= 4;
      return `${p.nombre} te pide diez minutos y deja una carta sobre tu mesa: renuncia. ${
        reciente
          ? 'En su último 1:1 ya te había dado señales.'
          : 'Hace semanas que no conversan a solas y no lo viste venir.'
      } Tiene otra oferta y dice que la decisión está casi tomada.`;
    },
    opciones: [
      {
        texto: 'Hacer una contraoferta económica',
        detalle: 'Sube su sueldo 20%. Puede irse igual',
        estilo: { resultados: 1, personas: 1 },
        aplicar: (x) => {
          const { g, p } = x;
          if (!p) return 'No había nada que decidir.';
          let chance = 0.2 + p.animo / 200;
          if (p.motivador === 'dinero') chance += 0.3;
          if (p.salario < p.salarioMercado * 0.95) chance += 0.1;
          if (p.estres > 70) chance -= 0.15;
          if (prob(x.rnd, clamp(chance, 0.08, 0.9))) {
            subirSueldo(p, 0.2);
            animo(p, 12, 'Renuncié y me retuvieron con un aumento.');
            estres(p, -5);
            const seEnteran = prob(x.rnd, 0.35);
            if (seEnteran) animoTodos(g, -2, `${primerNombre(p)} consiguió un aumento amenazando con irse.`, p.id);
            return `${primerNombre(p)} acepta y se queda con ${soles(p.salario)} al mes.${
              seEnteran ? ' El equipo se entera de cómo lo consiguió y toma nota.' : ''
            }`;
          }
          seVa(g, p, -4);
          return `${primerNombre(p)} agradece la cifra, pero no era un tema de plata. Se va a fin de mes y el equipo lo resiente.`;
        },
      },
      {
        texto: 'Escuchar por qué se va y ofrecer lo que de verdad le importa',
        detalle: 'Funciona mejor si ya conoces a la persona',
        estilo: { personas: 2, vision: 1 },
        aplicar: (x) => {
          const { g, p } = x;
          if (!p) return 'No había nada que decidir.';
          const laConoces = p.motivadorRevelado || (p.ultima1a1 > 0 && g.semana - p.ultima1a1 <= 4);
          const chance = clamp(0.22 + (laConoces ? 0.38 : 0) + p.animo / 250, 0.1, 0.92);
          if (!prob(x.rnd, chance)) {
            seVa(g, p, -3);
            return `Conversan una hora, pero ${
              laConoces ? 'la decisión ya estaba tomada' : 'no logras dar con lo que le faltaba, llegaste tarde'
            }. ${primerNombre(p)} se va.`;
          }
          p.motivadorRevelado = true;
          let oferta = '';
          switch (p.motivador) {
            case 'dinero':
              subirSueldo(p, 0.1);
              oferta = `un ajuste de 10% y una fecha clara de revisión`;
              break;
            case 'reconocimiento':
              p.ultimoReconocimiento = g.semana;
              oferta = 'que presente su trabajo al cliente y que su nombre vaya en los casos';
              break;
            case 'crecimiento':
              caja(g, -1500);
              p.ultimaCapacitacion = g.semana;
              p.habilidad = Math.min(10, p.habilidad + 1);
              oferta = 'un plan de crecimiento con un curso pagado (S/ 1,500) y un proyecto a su cargo';
              break;
            case 'equilibrio':
              estres(p, -25);
              energia(p, 20);
              oferta = 'una carga realista y sus tardes de viernes libres';
              break;
            default:
              oferta = 'participar en elegir qué proyectos toma la empresa';
          }
          animo(p, 16, 'Iba a renunciar, pero me escucharon de verdad.');
          estres(p, -6);
          return `Lo que le faltaba no era lo que pensabas. Le ofreces ${oferta}. ${primerNombre(p)} rompe la carta y se queda.`;
        },
      },
      {
        texto: 'Agradecerle y aceptar su salida con buen trato',
        detalle: 'Pierdes a la persona, cuidas la relación',
        estilo: { integridad: 1, delegacion: 1 },
        aplicar: (x) => {
          const { g, p } = x;
          if (!p) return 'No había nada que decidir.';
          const eraClave = p.habilidad >= 7;
          sacarPersona(g, p, 'renuncia');
          animoTodos(g, eraClave ? -3 : -1, `${primerNombre(p)} se fue en buenos términos.`);
          if (prob(x.rnd, 0.3)) g.prospeccion += 1;
          return `Le organizas una despedida y le das una buena referencia. ${primerNombre(p)} se va hablando bien de ${g.empresa}${
            eraClave ? ', pero su ausencia se va a notar' : ''
          }.`;
        },
      },
    ],
    leccion:
      'Una renuncia casi nunca empieza el día de la carta. La contraoferta compra tiempo, entender el motivo real es lo que retiene.',
  },
  {
    id: 'agotamiento',
    titulo: 'Al límite',
    categoria: 'personas',
    etapas: [1, 5],
    peso: 0,
    repetible: true,
    texto: (x) => {
      const p = x.p;
      if (!p) return 'Alguien del equipo estaba al límite, pero ya no está en la empresa.';
      return `${p.nombre} llegó tarde, no habló en la reunión y a media mañana ${gen(
        p,
        'lo',
        'la',
      )} encuentras mirando la pantalla sin escribir. Lleva semanas con más carga de la que aguanta y hay entregas encima.`;
    },
    opciones: [
      {
        texto: 'Darle una semana libre pagada, desde hoy',
        detalle: 'Su área pierde capacidad una semana',
        estilo: { personas: 2, resultados: -1 },
        aplicar: (x) => {
          const { p } = x;
          if (!p) return 'No había nada que decidir.';
          p.fuera = Math.max(p.fuera, 1);
          estres(p, -35);
          energia(p, 35);
          animo(p, p.motivador === 'equilibrio' ? 14 : 8, 'Me mandaron a descansar cuando ya no podía más.');
          estresArea(x.g, p.rol, 4);
          return `${primerNombre(p)} se va a casa sin laptop. El resto del área absorbe lo suyo esta semana y vuelve ${gen(
            p,
            'recuperado',
            'recuperada',
          )}.`;
        },
      },
      {
        texto: 'Contratar apoyo freelance y bajarle la carga',
        detalle: 'Cuesta un freelance por dos semanas',
        estilo: { personas: 1, resultados: 1 },
        bloqueo: sinCaja(() => 3600),
        aplicar: (x) => {
          const { g, p } = x;
          if (!p) return 'No había nada que decidir.';
          caja(g, -3600);
          estres(p, -20);
          energia(p, 12);
          animo(p, 5, 'Trajeron apoyo para bajarme la carga.');
          return `Pagas S/ 3,600 por un freelance que toma la mitad de sus pendientes. ${primerNombre(
            p,
          )} sigue trabajando, pero respira.`;
        },
      },
      {
        texto: 'Pedirle que aguante hasta la próxima entrega',
        detalle: 'Riesgo: licencia médica de tres semanas',
        estilo: { resultados: 1, personas: -2 },
        aplicar: (x) => {
          const { g, p } = x;
          if (!p) return 'No había nada que decidir.';
          if (prob(x.rnd, clamp(0.35 + (p.estres - 80) / 60, 0.3, 0.8))) {
            p.fuera = 3;
            estres(p, -20);
            animo(p, -15, 'Pedí ayuda, me dijeron que aguantara y terminé con licencia médica.');
            animoTodos(g, -3, `${primerNombre(p)} terminó con licencia médica por agotamiento.`, p.id);
            return `Dos días después su médico le da descanso por tres semanas. El equipo sabe que te lo había pedido antes.`;
          }
          animo(p, -8, 'Pedí ayuda y me dijeron que aguantara.');
          estres(p, 5);
          return `${primerNombre(p)} asiente y vuelve a su sitio. Saca la entrega, pero algo se rompió en cómo te mira.`;
        },
      },
    ],
    leccion:
      'El agotamiento avisa antes de tumbar a alguien. Una semana de capacidad perdida cuesta menos que tres de licencia y la confianza del equipo.',
  },
  {
    id: 'caja_critica',
    titulo: 'No alcanza para la planilla',
    categoria: 'finanzas',
    etapas: [1, 5],
    peso: 0,
    repetible: true,
    texto: (x) =>
      `Es miércoles y la caja marca ${soles(x.g.caja)}. La planilla de esta semana suma ${soles(
        nominaSemanal(x.g),
      )} y los cobros grandes todavía no entran. El viernes alguien va a revisar su cuenta.`,
    opciones: [
      {
        texto: 'Reunir al equipo, explicar la situación y pagar con dos semanas de atraso',
        detalle: 'Alivia la caja ahora, golpea el ánimo',
        estilo: { integridad: 2, personas: 1 },
        aplicar: (x) => {
          const { g } = x;
          const monto = r100(nominaSemanal(g) * 2);
          caja(g, monto, 'nomina');
          diferir(g, 2, 'planilla_atrasada', { monto });
          for (const p of g.personas) animo(p, p.motivador === 'dinero' ? -10 : -5, 'Nos pagaron tarde, pero nos lo dijeron de frente.');
          return `Muestras los números y das una fecha. Retienes ${soles(monto)} que pagarás en dos semanas. Nadie aplaude, pero nadie se entera por el banco.`;
        },
      },
      {
        texto: 'Tomar un préstamo rápido y pagar puntual',
        detalle: 'Devuelves 15% más de lo que recibes',
        estilo: { resultados: 1, audacia: 1 },
        aplicar: (x) => {
          const { g } = x;
          const monto = r100(Math.max(8000, nominaSemanal(g) * 4));
          caja(g, monto);
          g.deuda += r100(monto * 1.15);
          estresCeo(g, 6);
          return `Recibes ${soles(monto)} y firmas por ${soles(r100(monto * 1.15))}. El equipo cobra el viernes sin saber nada. La deuda queda en tu cabeza.`;
        },
      },
      {
        texto: 'Pagar completo a los sueldos más bajos y pedir paciencia al resto',
        detalle: 'Los que esperan lo resienten',
        estilo: { personas: 1, integridad: -1, resultados: 1 },
        bloqueo: (x) => (x.g.personas.length < 2 ? 'Necesitas al menos dos personas' : null),
        aplicar: (x) => {
          const { g } = x;
          const orden = [...g.personas].sort((a, b) => b.salario - a.salario);
          const esperan = orden.slice(0, Math.ceil(orden.length / 2));
          const monto = r100(esperan.reduce((s, p) => s + p.salario / 4, 0) * 2);
          caja(g, monto, 'nomina');
          diferir(g, 2, 'planilla_atrasada', { monto });
          for (const p of esperan) animo(p, -12, 'A otros les pagaron a tiempo y a mí me pidieron esperar.');
          return `Los sueldos más altos esperan dos semanas por ${soles(monto)} en total. Lo entienden en la reunión y lo comentan molestos en el almuerzo.`;
        },
      },
    ],
    leccion:
      'La caja se cuida semanas antes, no el miércoles. Cuando ya falta, lo que el equipo recuerda es si se enteró por ti o por su banco.',
  },

  // ============================ etapa 1: garaje =============================
  {
    id: 'primer_descuento',
    titulo: 'Descuento por exposición',
    categoria: 'clientes',
    etapas: [1, 2],
    peso: 1.4,
    texto: () =>
      'Una marca conocida quiere su primera activación contigo, pero pide 30% menos «por la visibilidad que te va a dar». Sería tu cliente más visible hasta hoy y el margen quedaría casi en cero.',
    opciones: [
      {
        texto: 'Aceptar el descuento y ganar el logo',
        detalle: 'Margen mínimo. Sienta precedente de precio',
        estilo: { audacia: 1, resultados: -1 },
        aplicar: (x) => {
          const proy = crearProyecto(x.g, x.rnd, { tier: 'S', factorPrecio: 0.7 });
          const c = cliente(x.g, proy.clienteId);
          bandera(x.g, 'precioBajo');
          return `Firmas con ${c?.nombre ?? 'la marca'} por ${soles(proy.presupuesto)}. Tienes el logo, y un cliente que ya sabe que tu precio se negocia.`;
        },
      },
      {
        texto: 'Mantener el precio y ofrecer menos alcance',
        detalle: 'Puede aceptar o irse',
        estilo: { resultados: 1, vision: 1 },
        aplicar: (x) => {
          if (prob(x.rnd, 0.5 + x.g.reputacion / 200)) {
            const proy = crearProyecto(x.g, x.rnd, { tier: 'S', factorPrecio: 0.9 });
            const c = cliente(x.g, proy.clienteId);
            return `Les muestras qué entra en su presupuesto y qué no. ${c?.nombre ?? 'La marca'} acepta una versión más corta por ${soles(proy.presupuesto)}, con tu margen intacto.`;
          }
          return 'Escuchan tu propuesta y responden que van a evaluar otras opciones. No vuelven a escribir.';
        },
      },
      {
        texto: 'Agradecer y decir que no',
        detalle: 'Pierdes el proyecto',
        estilo: { integridad: 1, vision: 1, audacia: -1 },
        aplicar: (x) => {
          if (prob(x.rnd, 0.25)) {
            const proy = crearProyecto(x.g, x.rnd, { tier: 'S' });
            const c = cliente(x.g, proy.clienteId);
            return `Dos días después llaman de nuevo: la otra agencia no los convenció. ${c?.nombre ?? 'La marca'} firma a precio completo, ${soles(proy.presupuesto)}.`;
          }
          return 'Les explicas que la visibilidad no paga proveedores. Se van con otra agencia y tu calendario sigue libre.';
        },
      },
    ],
    leccion:
      'El primer precio que aceptas define cómo te ve ese cliente para siempre. Si vas a ceder, cede alcance antes que tarifa.',
  },
  {
    id: 'socio_amigo',
    titulo: 'Un amigo quiere invertir',
    categoria: 'estrategia',
    etapas: [1, 2],
    elegir: (g) => (g.participacion >= 0.99 ? {} : null),
    texto: (x) => {
      const monto = r100(Math.max(50000, base(x.g) * 16));
      return `Un amigo de la universidad te ofrece ${soles(monto)} por el 30% de ${x.g.empresa}. Con eso tendrías meses de tranquilidad. También tendrías un socio con opinión sobre cada decisión.`;
    },
    opciones: [
      {
        texto: 'Aceptar: 30% por el dinero',
        detalle: 'Cedes 30% de la empresa',
        estilo: { audacia: 1, vision: -1 },
        aplicar: (x) => {
          const monto = r100(Math.max(50000, base(x.g) * 16));
          caja(x.g, monto);
          x.g.participacion = Math.max(0.05, x.g.participacion - 0.3);
          estresCeo(x.g, -8);
          diferir(x.g, 10, 'socio_opina');
          return `Entran ${soles(monto)} a la cuenta y firman en una notaría de Miraflores. Ahora el 30% de todo lo que construyas es suyo.`;
        },
      },
      {
        texto: 'Contraproponer: 15% por la mitad del dinero',
        detalle: 'Puede ofenderse',
        estilo: { resultados: 1, vision: 1 },
        aplicar: (x) => {
          const monto = r100(Math.max(50000, base(x.g) * 16) * 0.55);
          if (prob(x.rnd, 0.5)) {
            caja(x.g, monto);
            x.g.participacion = Math.max(0.05, x.g.participacion - 0.15);
            diferir(x.g, 12, 'socio_opina');
            return `Lo piensa un fin de semana y acepta: ${soles(monto)} por el 15%. Menos caja, más empresa tuya.`;
          }
          estresCeo(x.g, 4);
          return 'Siente que le estás regateando la amistad. Retira la oferta y la conversación queda incómoda.';
        },
      },
      {
        texto: 'Rechazar y crecer con caja propia',
        detalle: 'Sigues con lo que tienes',
        estilo: { vision: 1, audacia: -1 },
        aplicar: (x) => {
          estresCeo(x.g, 3);
          return 'Le agradeces y le dices que todavía no. La empresa sigue siendo tuya completa, igual que el riesgo.';
        },
      },
    ],
    leccion:
      'El capital temprano es el más caro que vas a vender. Antes de aceptarlo, pregúntate si necesitas el dinero o solo la tranquilidad.',
  },
  {
    id: 'proveedor_falla',
    titulo: 'El proveedor no llega',
    categoria: 'crisis',
    etapas: [1, 5],
    elegir: (g, r) => {
      const proy = unProyecto(g, r);
      return proy ? { proy, c: cliente(g, proy.clienteId) } : null;
    },
    texto: (x) => {
      const costo = r100(x.proy!.presupuesto * 0.08);
      return `Faltan doce horas para el montaje de «${x.proy!.nombre}» de ${x.c?.nombre ?? 'tu cliente'} y el proveedor de estructuras dejó de contestar. Otro proveedor puede cubrirlo esta noche por ${soles(costo)} adicionales.`;
    },
    opciones: [
      {
        texto: 'Pagar la urgencia al otro proveedor',
        detalle: 'Sale de tu margen',
        estilo: { resultados: 1, audacia: 1 },
        bloqueo: sinCaja((x) => r100(x.proy!.presupuesto * 0.08)),
        aplicar: (x) => {
          const costo = r100(x.proy!.presupuesto * 0.08);
          caja(x.g, -costo, 'terceros');
          return `Pagas ${soles(costo)} y a las seis de la mañana la estructura está en pie. El cliente nunca se entera.`;
        },
      },
      {
        texto: 'Resolverlo con el equipo, toda la noche',
        detalle: 'Agota a producción, baja la calidad',
        estilo: { resultados: 1, personas: -1 },
        aplicar: (x) => {
          for (const p of x.g.personas.filter((q) => q.rol === 'produccion')) {
            estres(p, 14);
            energia(p, -18);
            animo(p, -3, 'Pasamos la noche armando lo que el proveedor no trajo.');
          }
          estresCeo(x.g, 8);
          x.proy!.ajusteCalidad -= 6;
          return 'Alquilan lo que encuentran y arman con sus manos hasta el amanecer. El evento sale, con acabados que tú sabes que no eran los prometidos.';
        },
      },
      {
        texto: 'Llamar al cliente ahora y replantear el montaje',
        detalle: 'Arriesgas su confianza',
        estilo: { integridad: 2, audacia: -1 },
        aplicar: (x) => {
          const c = x.c;
          x.proy!.ajusteCalidad -= 4;
          if (c && prob(x.rnd, 0.35 + c.satisfaccion / 200)) {
            sat(c, 4);
            return `Le cuentas el problema con una alternativa ya dibujada. ${c.nombre} valora que no se lo escondiste y aprueba el cambio.`;
          }
          if (c) sat(c, -9);
          return 'Le cuentas el problema y propones un montaje más simple. Lo aprueba porque no le queda otra, y te lo hace saber.';
        },
      },
    ],
    leccion:
      'En una crisis de producción decides entre margen, equipo y confianza del cliente. Elige a conciencia cuál gastas, porque uno vas a gastar.',
  },
  {
    id: 'cliente_no_paga',
    titulo: 'La próxima semana, seguro',
    categoria: 'finanzas',
    etapas: [1, 5],
    repetible: true,
    peso: 0.8,
    elegir: (g) => {
      const f = [...g.facturas].sort((a, b) => b.monto - a.monto)[0];
      const c = f ? cliente(g, f.clienteId) : undefined;
      return f && c && g.semana - f.semanaEmision >= 2 ? { f, c } : null;
    },
    texto: (x) =>
      `${x.c!.nombre} te debe ${soles(x.f!.monto)} por «${x.f!.concepto}». Es la tercera vez que su área de pagos responde «la próxima semana, seguro». Tu contacto de marketing dice que no depende de él.`,
    opciones: [
      {
        texto: 'Enviar una carta firme y pausar el servicio',
        detalle: 'Probablemente paga. La relación se enfría',
        estilo: { resultados: 2, personas: -1 },
        aplicar: (x) => {
          const c = x.c!;
          const f = x.f!;
          if (prob(x.rnd, 0.65)) {
            f.semanaCobro = x.g.semana + 1;
            sat(c, -10);
            return `La carta llega a su gerencia de finanzas. Programan el pago de ${soles(f.monto)} para la próxima semana y tu contacto deja de contestar con emojis.`;
          }
          f.semanaCobro += 2;
          sat(c, -15);
          return 'Se molestan por el tono y ahora el pago «está en revisión». Vas a cobrar, pero más tarde y con la relación dañada.';
        },
      },
      {
        texto: 'Esperar y cuidar la relación',
        detalle: 'El cobro se atrasa un mes',
        estilo: { personas: 1, resultados: -1 },
        aplicar: (x) => {
          x.f!.semanaCobro += 4;
          sat(x.c!, 2);
          return `Les dices que entiendes. El pago de ${soles(x.f!.monto)} se mueve cuatro semanas y tu caja lo va a sentir.`;
        },
      },
      {
        texto: 'Vender la factura a una empresa de factoring',
        detalle: 'Cobras hoy el 92%',
        estilo: { resultados: 1, audacia: 1 },
        aplicar: (x) => {
          const f = x.f!;
          const neto = r100(f.monto * 0.92);
          caja(x.g, neto, 'cobros');
          quitarFactura(x.g, f);
          return `El factoring te deposita ${soles(neto)} hoy. Pierdes ${soles(f.monto - neto)}, ganas semanas de aire y el cliente ni se entera.`;
        },
      },
    ],
    leccion:
      'Cobrar es parte del servicio, no una descortesía. El costo de esperar se mide en tu caja, no en la de tu cliente.',
  },
  {
    id: 'trabajo_gratis',
    titulo: 'Gratis, por el portafolio',
    categoria: 'clientes',
    etapas: [1, 2],
    texto: () =>
      'Tu exjefe ahora es gerente de una marca que todos conocen. Te pide una activación «al costo, por el portafolio»: cubre proveedores y nada más. Tu equipo trabajaría tres semanas sin cobrar.',
    opciones: [
      {
        texto: 'Aceptar y hacerlo como si pagaran completo',
        detalle: 'Ocupa al equipo sin dejar margen',
        estilo: { audacia: 1, vision: 1, resultados: -1 },
        aplicar: (x) => {
          const proy = crearProyecto(x.g, x.rnd, { tier: 'S', factorPrecio: 0.5 });
          proy.ajusteCalidad += 3;
          diferir(x.g, proy.duracion + 2, 'portafolio', { clienteId: proy.clienteId });
          return `Aceptas por ${soles(proy.presupuesto)}, que apenas cubre proveedores. Si sale bien, tendrás un caso que mostrar.`;
        },
      },
      {
        texto: 'Proponer costo más un fee mínimo',
        detalle: 'Puede decir que no',
        estilo: { resultados: 1, integridad: 1 },
        aplicar: (x) => {
          if (prob(x.rnd, 0.5)) {
            const proy = crearProyecto(x.g, x.rnd, { tier: 'S', factorPrecio: 0.72 });
            return `Le explicas que gratis no puedes sostenerlo. Consigue algo de presupuesto y cierran en ${soles(proy.presupuesto)}.`;
          }
          return 'Dice que no tiene de dónde sacar más. Queda en llamarte «cuando haya presupuesto de verdad».';
        },
      },
      {
        texto: 'Decir que no',
        detalle: 'Sin caso, sin desgaste',
        estilo: { resultados: 1, audacia: -1 },
        aplicar: () =>
          'Le agradeces la confianza y le dices que hoy no puedes regalar tres semanas de equipo. Lo entiende, o eso dice.',
      },
    ],
    leccion:
      'El trabajo regalado también cuesta: ocupa a las personas que podrían estar en un proyecto que paga. Si lo haces, que sea una inversión elegida.',
  },
  {
    id: 'microgestion',
    titulo: 'Revisas cada pieza',
    categoria: 'personas',
    etapas: [1, 3],
    elegir: (g, r) => {
      const p = personaAlAzar(g, r, (q) => (q.rol === 'creatividad' || q.rol === 'produccion') && antiguedad(g, q) >= 3);
      return p ? { p } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} te pide hablar. «Revisas cada pieza antes de que salga y cambias cosas que ya estaban aprobadas. Siento que no confías en mi trabajo.» Tiene razón en lo primero: nada sale sin pasar por ti.`,
    opciones: [
      {
        texto: 'Soltar: desde hoy sus piezas salen sin tu revisión',
        detalle: 'Puede colarse algún error',
        estilo: { delegacion: 2, audacia: 1 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, 9, 'Dejaron de revisarme cada pieza. Confían en mí.');
          estresCeo(x.g, -5);
          if (prob(x.rnd, clamp(0.5 - p.habilidad * 0.04, 0.1, 0.45))) {
            const proy = unProyecto(x.g, x.rnd);
            if (proy) proy.ajusteCalidad -= 5;
            return `${primerNombre(p)} trabaja con otra energía. A la segunda semana sale una pieza con un error que tú habrías visto. Es el precio de aprender a soltar.`;
          }
          return `${primerNombre(p)} trabaja con otra energía y nada se cae. Recuperas horas que no sabías que estabas gastando.`;
        },
      },
      {
        texto: 'Explicar que tu revisión es lo que protege la calidad',
        detalle: 'Su ánimo baja',
        estilo: { resultados: 1, delegacion: -2 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, p.rasgo === 'ambicioso' ? -10 : -7, 'Pedí autonomía y me dijeron que todo sigue pasando por arriba.');
          ajustarActivos(x.g, 2);
          estresCeo(x.g, 5);
          return `Le dices que el estándar es tuyo y que por ahora sigue así. ${primerNombre(p)} asiente. La calidad se mantiene y tú sigues siendo el cuello de botella.`;
        },
      },
      {
        texto: 'Definir juntos qué revisas y qué no',
        detalle: 'Te cuesta 1 de foco esta semana',
        estilo: { delegacion: 1, vision: 1, personas: 1 },
        bloqueo: (x) => (x.g.foco < 1 ? 'No te queda foco esta semana' : null),
        aplicar: (x) => {
          const p = x.p!;
          x.g.foco = Math.max(0, x.g.foco - 1);
          animo(p, 6, 'Acordamos qué piezas reviso yo y cuáles revisa la dirección.');
          estresCeo(x.g, -2);
          ajustarActivos(x.g, 1);
          return `Pasan una tarde armando una lista corta: qué necesita tus ojos y qué no. ${primerNombre(p)} gana autonomía con criterios claros.`;
        },
      },
    ],
    leccion:
      'Delegar no es soltar ni controlar todo: es acordar el criterio. Si tu equipo solo aprende lo que apruebas, la empresa crece hasta donde te alcance el día.',
  },
  {
    id: 'sin_factura',
    titulo: 'Pago hoy, sin factura',
    categoria: 'etica',
    etapas: [1, 3],
    elegir: (g) => {
      const f = [...g.facturas].sort((a, b) => a.monto - b.monto)[0];
      const c = f ? cliente(g, f.clienteId) : undefined;
      return f && c ? { f, c } : null;
    },
    texto: (x) =>
      `El administrador de ${x.c!.nombre} te hace una propuesta por teléfono: te paga hoy en efectivo ${soles(
        r100(x.f!.monto * 0.9),
      )} si anulas la factura de ${soles(x.f!.monto)}. «Ganamos los dos», dice. Tu caja agradecería el efectivo.`,
    opciones: [
      {
        texto: 'Aceptar el efectivo y anular la factura',
        detalle: 'Riesgo: fiscalización más adelante',
        estilo: { integridad: -2, resultados: 1, audacia: 1 },
        aplicar: (x) => {
          const f = x.f!;
          const neto = r100(f.monto * 0.9);
          caja(x.g, neto, 'cobros');
          quitarFactura(x.g, f);
          bandera(x.g, 'sinFactura');
          diferir(x.g, 9, 'multa_sunat', { monto: f.monto });
          return `Recibes ${soles(neto)} en un sobre. El problema de caja de esta semana desaparece. El registro de esa operación, también.`;
        },
      },
      {
        texto: 'Rechazar y mantener la factura',
        detalle: 'Cobras en el plazo normal',
        estilo: { integridad: 2 },
        aplicar: (x) => {
          sat(x.c!, -3);
          return `Le dices que trabajas todo con factura. Hay un silencio incómodo y cuelga. Cobrarás ${soles(x.f!.monto)} cuando toque.`;
        },
      },
      {
        texto: 'Ofrecer 5% de descuento por pronto pago, con factura',
        detalle: 'Puede aceptar',
        estilo: { integridad: 1, resultados: 1 },
        aplicar: (x) => {
          const f = x.f!;
          if (prob(x.rnd, 0.6)) {
            f.monto = r100(f.monto * 0.95);
            f.semanaCobro = x.g.semana + 1;
            return `Le propones una salida formal y acepta. Te transfieren ${soles(f.monto)} la próxima semana, con todo en regla.`;
          }
          return 'No le interesa: lo suyo era el efectivo. La factura sigue su curso normal.';
        },
      },
    ],
    leccion:
      'Los atajos fiscales se pagan con intereses y en el peor momento. Casi siempre existe una versión formal del mismo acuerdo.',
  },
  {
    id: 'permiso_montaje',
    titulo: 'Permiso el día del montaje',
    categoria: 'personas',
    etapas: [1, 5],
    elegir: (g, r) => {
      const proy = unProyecto(g, r);
      const p = personaAlAzar(g, r, (q) => q.rol === 'produccion' || q.rol === 'creatividad');
      return proy && p ? { proy, p } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} te pide salir a las tres de la tarde el día del montaje de «${x.proy!.nombre}»: es la graduación de su hermana menor y es la única familia que tiene en Lima. Ese día todas las manos cuentan.`,
    opciones: [
      {
        texto: 'Darle el permiso y cubrir su turno tú',
        detalle: 'Sube tu estrés',
        estilo: { personas: 2, delegacion: -1 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, p.motivador === 'equilibrio' ? 14 : 9, 'Me cubrieron el turno para ir a la graduación de mi hermana.');
          estresCeo(x.g, 9);
          return `${primerNombre(p)} llega a la graduación. Tú terminas el día cargando cajas y coordinando luces, y el equipo lo ve.`;
        },
      },
      {
        texto: 'Darle el permiso y que el equipo se reparta lo suyo',
        detalle: 'Más carga para su área',
        estilo: { personas: 1, delegacion: 1 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, 8, 'Me dieron permiso el día del montaje.');
          for (const q of x.g.personas) if (q.rol === p.rol && q.id !== p.id) estres(q, 6);
          x.proy!.ajusteCalidad -= 2;
          return `${primerNombre(p)} se va a las tres. Sus compañeros cierran el montaje con una persona menos y algún detalle queda sin pulir.`;
        },
      },
      {
        texto: 'Pedirle que se quede: ese día no se puede',
        detalle: 'Su ánimo cae',
        estilo: { resultados: 2, personas: -2 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, p.motivador === 'equilibrio' ? -16 : -10, 'Me perdí la graduación de mi hermana por un montaje.');
          x.proy!.ajusteCalidad += 1;
          return `${primerNombre(p)} se queda y el montaje sale completo. Ve la ceremonia por videollamada desde el almacén.`;
        },
      },
    ],
    leccion:
      'La gente recuerda durante años cómo la trataste el día que te pidió algo personal. Y el equipo observa qué pasa cuando alguien lo pide.',
  },
  {
    id: 'idea_arriesgada',
    titulo: 'Una idea que da miedo',
    categoria: 'operaciones',
    etapas: [1, 5],
    elegir: (g, r) => {
      const proy = unProyecto(g, r);
      const p = personaAlAzar(g, r, (q) => q.rol === 'creatividad');
      return proy && p ? { proy, p, c: cliente(g, proy.clienteId) } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} entra con un boceto para «${x.proy!.nombre}»: una mecánica que nadie ha probado en el país. Si funciona, ${
        x.c?.nombre ?? 'el cliente'
      } va a hablar de esto por meses. Si falla, falla frente a todos. Probarla antes cuesta ${soles(
        r100(x.proy!.presupuesto * 0.03),
      )}.`,
    opciones: [
      {
        texto: 'Ir con la idea completa',
        detalle: 'Mucho que ganar, mucho que perder',
        estilo: { audacia: 2, delegacion: 1 },
        aplicar: (x) => {
          const p = x.p!;
          if (prob(x.rnd, clamp(0.3 + p.habilidad * 0.055, 0.3, 0.85))) {
            x.proy!.ajusteCalidad += 12;
            animo(p, 10, 'Apostaron por mi idea y funcionó.');
            rep(x.g, 1);
            return `La mecánica funciona y la gente hace cola para vivirla. ${primerNombre(p)} no cabe en sí y el cliente pide el video para su gerencia regional.`;
          }
          x.proy!.ajusteCalidad -= 10;
          animo(p, -5, 'Mi idea falló frente al cliente.');
          if (x.c) sat(x.c, -6);
          return `El día del evento la mecánica se traba dos veces frente al cliente. ${primerNombre(p)} lo toma como algo personal.`;
        },
      },
      {
        texto: 'Pagar una prueba en pequeño antes de decidir',
        detalle: 'Cuesta 3% del presupuesto',
        estilo: { vision: 1, resultados: 1 },
        bloqueo: sinCaja((x) => r100(x.proy!.presupuesto * 0.03)),
        aplicar: (x) => {
          const p = x.p!;
          caja(x.g, -r100(x.proy!.presupuesto * 0.03), 'terceros');
          x.proy!.ajusteCalidad += 5;
          animo(p, 5, 'Probamos mi idea en pequeño antes de llevarla al evento.');
          return `La prueba revela dos fallas que corrigen a tiempo. La versión final es menos atrevida que el boceto y mucho más sólida.`;
        },
      },
      {
        texto: 'Ir con la versión segura de siempre',
        detalle: 'Sin riesgo. Tu creativo lo resiente',
        estilo: { audacia: -2, resultados: 1 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, p.rasgo === 'ambicioso' || p.motivador === 'crecimiento' ? -9 : -5, 'Propuse algo distinto y eligieron lo de siempre.');
          x.proy!.ajusteCalidad += 1;
          return `Le dices que este no es el proyecto para experimentar. ${primerNombre(p)} guarda el boceto. El evento saldrá correcto.`;
        },
      },
    ],
    leccion:
      'Entre apostar todo y no apostar hay una tercera opción: probar barato. Y si siempre eliges lo seguro, tus mejores creativos se van a buscar riesgo a otro lado.',
  },
  {
    id: 'cliente_feliz',
    titulo: 'Un cliente contento',
    categoria: 'clientes',
    etapas: [1, 5],
    repetible: true,
    peso: 0.7,
    elegir: (g, r) => {
      const lista = g.clientes.filter((c) => c.satisfaccion >= 75 && c.entregas >= 1);
      return lista.length ? { c: elegir(r, lista) } : null;
    },
    texto: (x) =>
      `Tu contacto en ${x.c!.nombre} te escribe después de la última entrega: «Mi jefa preguntó quién hizo esto. Dime en qué te puedo ayudar». Es un favor que se pide una vez.`,
    opciones: [
      {
        texto: 'Pedir permiso para publicar el caso con su marca',
        detalle: 'Sube tu reputación',
        estilo: { vision: 1, resultados: 1 },
        aplicar: (x) => {
          rep(x.g, 3);
          return `${x.c!.nombre} aprueba el caso con logo y cifras. Tu equipo lo documenta y por fin tienes algo concreto que mostrar en cada reunión.`;
        },
      },
      {
        texto: 'Pedir que te presente a dos colegas de otras marcas',
        detalle: 'Llegan oportunidades nuevas',
        estilo: { audacia: 1, resultados: 1 },
        aplicar: (x) => {
          x.g.prospeccion += 2;
          return 'Te copia en dos correos con una recomendación corta y directa. La próxima semana tendrás reuniones que no tuviste que tocar en frío.';
        },
      },
      {
        texto: 'Proponerle pasar a un fee mensual',
        detalle: 'Puede ser pronto para pedirlo',
        estilo: { audacia: 1, vision: 1 },
        bloqueo: (x) =>
          feesActivos(x.g).some((p) => p.clienteId === x.c!.id) ? 'Ya tienes un fee con este cliente' : null,
        aplicar: (x) => {
          const c = x.c!;
          if (prob(x.rnd, clamp((c.satisfaccion - 55) / 55, 0.15, 0.8))) {
            const tier: Tier = x.g.reputacion >= 45 ? 'M' : 'S';
            const proy = crearProyecto(x.g, x.rnd, { tier, tipo: 'fee', clienteId: c.id });
            return `Lo lleva a su gerencia y vuelve con un sí: ${soles(proy.presupuesto)} al mes. Ingreso que ya no depende de ganar el siguiente pitch.`;
          }
          sat(c, -3);
          return 'Te dice que todavía compran por proyecto y que no quiere amarrarse. Se nota que la pregunta lo incomodó un poco.';
        },
      },
    ],
    leccion:
      'La buena voluntad de un cliente es un activo que caduca. Decide qué necesita más tu empresa hoy: prueba, puertas o ingreso estable.',
  },
  {
    id: 'tiempo_personal',
    titulo: 'Nunca estás en casa',
    categoria: 'personas',
    etapas: [1, 5],
    repetible: true,
    peso: 0.7,
    elegir: (g) => (g.estresCeo >= 55 ? {} : null),
    texto: () =>
      'Es domingo en la noche y estás contestando correos. Tu pareja cierra la laptop por ti: «Llevas dos meses así. ¿Cuándo fue la última vez que cenamos sin tu teléfono en la mesa?». No recuerdas la respuesta.',
    opciones: [
      {
        texto: 'Desconectarte todo el próximo fin de semana',
        detalle: 'Te cuesta 1 de foco. Algo puede caerse',
        estilo: { personas: 1, delegacion: 1 },
        aplicar: (x) => {
          const { g } = x;
          estresCeo(g, -22);
          g.foco = Math.max(0, g.foco - 1);
          const activos = clientesActivos(g);
          if (activos.length && prob(x.rnd, 0.25)) {
            const c = elegir(x.rnd, activos);
            sat(c, -4);
            return `Apagas el teléfono dos días. El lunes encuentras un mensaje de ${c.nombre} del sábado que nadie contestó. Sobrevives, y duermes como hace meses.`;
          }
          return 'Apagas el teléfono dos días. El lunes la empresa sigue en pie y tú piensas con una claridad que habías olvidado.';
        },
      },
      {
        texto: 'Bloquear una tarde fija a la semana, sin excepciones',
        detalle: 'Alivio gradual',
        estilo: { vision: 1, delegacion: 1 },
        aplicar: (x) => {
          estresCeo(x.g, -9);
          diferir(x.g, 4, 'tarde_libre');
          return 'Los jueves desde las cuatro ya no existes para la agencia. Las primeras semanas cuesta. El equipo aprende a resolver sin llamarte.';
        },
      },
      {
        texto: 'Prometer que será después del próximo cierre',
        detalle: 'Tu estrés sigue subiendo',
        estilo: { resultados: 1, personas: -1 },
        aplicar: (x) => {
          estresCeo(x.g, 9);
          return 'Dices que es solo hasta que pase esta entrega. Lo mismo dijiste en la anterior. La laptop vuelve a abrirse.';
        },
      },
    ],
    leccion:
      'Tu energía es un recurso de la empresa y nadie más lo va a administrar. Un CEO agotado decide peor todo lo demás.',
  },
  {
    id: 'cambio_alcance',
    titulo: 'Un cambio chiquito',
    categoria: 'clientes',
    etapas: [1, 5],
    repetible: true,
    peso: 0.9,
    elegir: (g, r) => {
      const proy = unProyecto(g, r);
      const c = proy ? cliente(g, proy.clienteId) : undefined;
      return proy && c ? { proy, c } : null;
    },
    texto: (x) =>
      `A cinco días de «${x.proy!.nombre}», ${x.c!.nombre} pide «un cambio chiquito»: una segunda zona de experiencia que no estaba en la cotización. Producirla cuesta ${soles(
        r100(x.proy!.presupuesto * 0.08),
      )} y no ofrecen presupuesto adicional.`,
    opciones: [
      {
        texto: 'Cotizar el adicional antes de mover un dedo',
        detalle: 'Puede molestarse',
        estilo: { resultados: 2, integridad: 1 },
        aplicar: (x) => {
          const c = x.c!;
          const proy = x.proy!;
          const extra = r100(proy.presupuesto * 0.12);
          if (prob(x.rnd, clamp(0.4 + (c.satisfaccion - 50) / 100, 0.2, 0.85))) {
            proy.presupuesto += extra;
            caja(x.g, -r100((proy.presupuesto - extra) * 0.08), 'terceros');
            estresArea(x.g, 'produccion', 4);
            return `Envías una cotización de ${soles(extra)} el mismo día. La aprueban refunfuñando. El cambio se hace y se cobra.`;
          }
          sat(c, -9);
          return `${c.nombre} responde que «pensaban que era parte del servicio» y retira el pedido. El alcance queda igual y la relación, un poco más fría.`;
        },
      },
      {
        texto: 'Absorber el costo y quedar bien',
        detalle: 'Sale de tu margen y de tu equipo',
        estilo: { personas: -1, resultados: -1, vision: 1 },
        bloqueo: sinCaja((x) => r100(x.proy!.presupuesto * 0.08)),
        aplicar: (x) => {
          const costo = r100(x.proy!.presupuesto * 0.08);
          caja(x.g, -costo, 'terceros');
          estresArea(x.g, 'produccion', 8);
          sat(x.c!, 8);
          return `Dices que sí. Pagas ${soles(costo)} y producción trabaja el fin de semana. ${x.c!.nombre} queda feliz, y aprende que los cambios son gratis.`;
        },
      },
      {
        texto: 'Proponer ir a medias: ellos pagan la mitad',
        detalle: 'Acuerdo intermedio',
        estilo: { resultados: 1, personas: 1 },
        aplicar: (x) => {
          const proy = x.proy!;
          const mitad = r100(proy.presupuesto * 0.04);
          proy.presupuesto += mitad;
          caja(x.g, -mitad * 2, 'terceros');
          estresArea(x.g, 'produccion', 5);
          sat(x.c!, 2);
          return `Acuerdan repartir el costo: facturas ${soles(mitad)} más y pones otros ${soles(mitad)} de tu margen. Nadie gana del todo y el evento crece.`;
        },
      },
    ],
    leccion:
      'Lo que haces gratis una vez se vuelve el estándar. Cobrar un adicional con rapidez y claridad es servicio, no conflicto.',
  },
  {
    id: 'error_presupuesto',
    titulo: 'Cotizamos mal',
    categoria: 'finanzas',
    etapas: [1, 5],
    elegir: (g, r) => {
      const proy = unProyecto(g, r, (p) => p.avance < p.duracion * 0.7);
      const c = proy ? cliente(g, proy.clienteId) : undefined;
      return proy && c ? { proy, c } : null;
    },
    texto: (x) =>
      `Revisando «${x.proy!.nombre}» encuentras el error: se cotizó un día de alquiler de equipos y son tres. La diferencia es de ${soles(
        r100(x.proy!.presupuesto * 0.12),
      )} y ${x.c!.nombre} ya firmó el presupuesto.`,
    opciones: [
      {
        texto: 'Asumir la pérdida y cumplir lo firmado',
        detalle: 'Sale completo de tu caja',
        estilo: { integridad: 2, resultados: -1 },
        aplicar: (x) => {
          const perdida = r100(x.proy!.presupuesto * 0.12);
          caja(x.g, -perdida, 'terceros');
          return `El error fue tuyo y lo pagas tú: ${soles(perdida)}. El cliente nunca lo sabe. Esa tarde cambias el formato de cotización.`;
        },
      },
      {
        texto: 'Contarle al cliente y pedir repartir la diferencia',
        detalle: 'Depende de la relación',
        estilo: { integridad: 1, audacia: 1 },
        aplicar: (x) => {
          const c = x.c!;
          const perdida = r100(x.proy!.presupuesto * 0.12);
          if (prob(x.rnd, clamp(0.35 + (c.satisfaccion - 50) / 110, 0.15, 0.8))) {
            caja(x.g, -perdida / 2, 'terceros');
            x.proy!.presupuesto += perdida / 2;
            sat(c, -2);
            return `Le muestras el error con los números. ${c.nombre} acepta cubrir la mitad, ${soles(perdida / 2)}, y te pide que no vuelva a pasar.`;
          }
          caja(x.g, -perdida, 'terceros');
          sat(c, -6);
          return `${c.nombre} responde que lo firmado es lo firmado. Pagas los ${soles(perdida)} y además quedas como alguien que cotiza mal.`;
        },
      },
      {
        texto: 'Recortar equipos y acabados sin avisar',
        detalle: 'Baja la calidad. Pueden notarlo',
        estilo: { integridad: -2, resultados: 1 },
        aplicar: (x) => {
          x.proy!.ajusteCalidad -= 14;
          for (const p of x.g.personas) if (p.motivador === 'proposito') animo(p, -5, 'Nos pidieron recortar acabados sin decirle al cliente.');
          if (prob(x.rnd, 0.3)) {
            sat(x.c!, -10);
            return 'Bajas de tres días de equipos a uno y medio y cambias materiales. El cliente pregunta en pleno evento por qué las pantallas son más chicas que en el render.';
          }
          return 'Bajas de tres días de equipos a uno y medio y cambias materiales. Los números cuadran. El evento se va a ver más pobre de lo vendido.';
        },
      },
    ],
    leccion:
      'Un error de cotización se paga con dinero o con confianza. El dinero se recupera en el siguiente proyecto.',
  },

  // ============================ etapa 2: boutique ===========================
  {
    id: 'cliente_toxico',
    titulo: 'Le gritó en la reunión',
    categoria: 'clientes',
    etapas: [2, 5],
    elegir: (g, r) => {
      const activos = clientesActivos(g).filter((c) => c.exigencia >= 2);
      const p = personaAlAzar(g, r, (q) => q.rol === 'cuentas') ?? personaAlAzar(g, r);
      return activos.length && p ? { c: elegir(r, activos), p } : null;
    },
    texto: (x) =>
      `El gerente de marca de ${x.c!.nombre} le gritó a ${x.p!.nombre} frente a seis personas por un retraso que venía de su propio equipo. ${primerNombre(
        x.p!,
      )} salió de la sala en silencio. No es la primera vez.`,
    opciones: [
      {
        texto: 'Llamar al cliente y poner un límite',
        detalle: 'Puedes perder la cuenta',
        estilo: { personas: 2, integridad: 1, audacia: 1 },
        aplicar: (x) => {
          const c = x.c!;
          const p = x.p!;
          animo(p, 12, 'Le pusieron un límite al cliente que me gritó.');
          animoTodos(x.g, 4, 'La dirección nos defendió frente a un cliente.', p.id);
          if (prob(x.rnd, clamp(0.3 - (c.satisfaccion - 50) / 200, 0.1, 0.45))) {
            for (const proy of proyectosActivos(x.g)) if (proy.clienteId === c.id && proy.tipo === 'fee') proy.estado = 'cancelado';
            sat(c, -25);
            return `Le dices que así no se le habla a tu equipo. Se ofende y anuncia que no renovará nada con ${x.g.empresa}. El equipo se entera de por qué.`;
          }
          sat(c, -8);
          return `Le dices que así no se le habla a tu equipo. Hay un silencio largo y luego una disculpa seca. Las reuniones siguientes son frías y correctas.`;
        },
      },
      {
        texto: 'Hablar a solas con la persona afectada y pedirle paciencia',
        detalle: 'Proteges la cuenta, no a la persona',
        estilo: { resultados: 1, personas: -2 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, -12, 'Un cliente me gritó y me pidieron paciencia.');
          estres(p, 8);
          animoTodos(x.g, -3, 'Un cliente maltrató a alguien del equipo y no pasó nada.', p.id);
          return `Le explicas lo que pesa esa cuenta. ${primerNombre(p)} dice que entiende. El equipo saca sus propias conclusiones sobre qué vale más aquí.`;
        },
      },
      {
        texto: 'Asumir tú esa cuenta por un tiempo',
        detalle: 'Más carga para ti',
        estilo: { personas: 1, delegacion: -2 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, 4, 'Me sacaron de la cuenta donde me gritaban.');
          estres(p, -8);
          estresCeo(x.g, 10);
          sat(x.c!, 3);
          return `Tú vas a las reuniones de ${x.c!.nombre} desde ahora. A ti no te grita. ${primerNombre(p)} respira, y tu agenda no.`;
        },
      },
    ],
    leccion:
      'Tu equipo mide cuánto vale para ti el día que un cliente lo maltrata. Ninguna cuenta paga lo suficiente para enseñarle que vale menos que una factura.',
  },
  {
    id: 'oferta_competencia',
    titulo: 'Oferta de una agencia grande',
    categoria: 'personas',
    etapas: [2, 5],
    repetible: true,
    peso: 0.8,
    elegir: (g) => {
      if (g.personas.length < 4) return null;
      const p = mejorPersona(g, (q) => antiguedad(g, q) >= 4 && !q.lider);
      return p && p.habilidad >= 6 ? { p } : null;
    },
    texto: (x) =>
      `${x.p!.nombre}, tu mejor talento en ${x.p!.rol === 'produccion' ? 'producción' : x.p!.rol}, te lo dice de frente: una agencia multinacional le ofrece 30% más. Hoy gana ${soles(
        x.p!.salario,
      )}. Quiere escucharte antes de responder.`,
    opciones: [
      {
        texto: 'Igualar la oferta',
        detalle: 'Sube su sueldo 30%',
        estilo: { resultados: 1, personas: 1 },
        aplicar: (x) => {
          const p = x.p!;
          subirSueldo(p, 0.3);
          animo(p, p.motivador === 'dinero' ? 12 : 6, 'Igualaron la oferta que me hizo otra agencia.');
          const seEnteran = prob(x.rnd, 0.4);
          if (seEnteran) animoTodos(x.g, -3, `A ${primerNombre(p)} le subieron el sueldo por traer una oferta de afuera.`, p.id);
          return `${primerNombre(p)} se queda con ${soles(p.salario)} al mes.${
            seEnteran ? ' La cifra se filtra y dos personas actualizan su LinkedIn esa semana.' : ''
          }`;
        },
      },
      {
        texto: 'Ofrecerle liderar su área, con 10% de aumento',
        detalle: 'Depende de lo que busca',
        estilo: { vision: 1, delegacion: 2 },
        aplicar: (x) => {
          const p = x.p!;
          const encaja = p.motivador === 'crecimiento' || p.motivador === 'reconocimiento';
          if (prob(x.rnd, encaja ? 0.85 : p.motivador === 'dinero' ? 0.25 : 0.45)) {
            subirSueldo(p, 0.1);
            p.lider = true;
            p.motivadorRevelado = p.motivadorRevelado || encaja;
            animo(p, 12, 'Me ofrecieron liderar mi área.');
            return `Era lo que estaba esperando escuchar. ${primerNombre(p)} rechaza la otra oferta y empieza a armar su equipo.`;
          }
          seVa(x.g, p, -4);
          return `${primerNombre(p)} agradece el título, pero ${p.motivador === 'dinero' ? 'necesitaba la plata' : 'ya había decidido'}. Se va a la multinacional.`;
        },
      },
      {
        texto: 'Desearle suerte',
        detalle: 'Pierdes a tu mejor talento',
        estilo: { resultados: -1, integridad: 1 },
        aplicar: (x) => {
          const p = x.p!;
          seVa(x.g, p, -5);
          rep(x.g, -1);
          return `Le dices que no puedes competir con esa cifra. ${primerNombre(p)} se va en buenos términos y deja un hueco que todos notan.`;
        },
      },
    ],
    leccion:
      'Cuando alguien te cuenta una oferta antes de aceptarla, te está pidiendo una razón para quedarse. Rara vez esa razón es solo el número.',
  },
  {
    id: 'conflicto_equipo',
    titulo: 'No se hablan',
    categoria: 'personas',
    etapas: [2, 5],
    elegir: (g, r) => {
      const p = personaAlAzar(g, r, (q) => q.rol === 'creatividad');
      const p2 = personaAlAzar(g, r, (q) => q.rol === 'produccion');
      return p && p2 && g.personas.length >= 4 ? { p, p2 } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} y ${x.p2!.nombre} no se hablan desde el último evento. Creatividad dice que producción «destruyó la idea». Producción dice que la idea «no se podía construir con ese presupuesto». Ahora se comunican por correo, con copia a ti.`,
    opciones: [
      {
        texto: 'Sentarlos juntos y mediar tú',
        detalle: 'Te cuesta 1 de foco',
        estilo: { personas: 2, delegacion: -1 },
        bloqueo: (x) => (x.g.foco < 1 ? 'No te queda foco esta semana' : null),
        aplicar: (x) => {
          const p = x.p!;
          const p2 = x.p2!;
          x.g.foco = Math.max(0, x.g.foco - 1);
          estresCeo(x.g, 5);
          if (prob(x.rnd, 0.75)) {
            animo(p, 6, `Aclaré las cosas con ${primerNombre(p2)}.`);
            animo(p2, 6, `Aclaré las cosas con ${primerNombre(p)}.`);
            ajustarActivos(x.g, 2);
            return 'Dos horas incómodas. Cada uno escucha la versión del otro por primera vez. Salen sin ser amigos, pero vuelven a hablarse.';
          }
          animo(p, -3);
          animo(p2, -3);
          return 'La reunión termina en reproches. Al menos ahora sabes que el problema es más viejo que ese evento.';
        },
      },
      {
        texto: 'Dejar que lo resuelvan como adultos',
        detalle: 'Puede arreglarse o empeorar',
        estilo: { delegacion: 2, personas: -1 },
        aplicar: (x) => {
          const p = x.p!;
          const p2 = x.p2!;
          if (prob(x.rnd, 0.4)) {
            animo(p, 3);
            animo(p2, 3);
            return 'Un viernes terminan almorzando juntos y lo conversan. Nadie te cuenta los detalles y no hace falta.';
          }
          animo(p, -8, `Sigo sin poder trabajar con ${primerNombre(p2)} y a nadie le importa.`);
          animo(p2, -8, `Sigo sin poder trabajar con ${primerNombre(p)} y a nadie le importa.`);
          ajustarActivos(x.g, -4);
          animoTodos(x.g, -2, 'Creatividad y producción están en guerra.');
          return 'El silencio se vuelve bandos. Los juniors ya saben a quién no copiar en cada correo y los proyectos lo pagan.';
        },
      },
      {
        texto: 'Crear una reunión de traspaso obligatoria por proyecto',
        detalle: 'Arregla el proceso, no la relación',
        estilo: { vision: 2, resultados: 1 },
        aplicar: (x) => {
          animo(x.p!, 2);
          animo(x.p2!, 2);
          ajustarActivos(x.g, 3);
          estresArea(x.g, 'produccion', -3);
          return 'Desde ahora ninguna idea se vende al cliente sin que producción la firme como viable. Discuten antes, no después. La tensión baja sola.';
        },
      },
    ],
    leccion:
      'Muchos conflictos entre personas son un proceso roto disfrazado. Antes de arbitrar, revisa en qué momento del trabajo chocan.',
  },
  {
    id: 'primer_fee',
    titulo: 'Fee con letra chica',
    categoria: 'estrategia',
    etapas: [2, 3],
    elegir: (g) => (feesActivos(g).length === 0 ? {} : null),
    texto: () =>
      'Una marca de consumo masivo te propone un fee mensual por un año. Ingreso fijo, por fin. Las condiciones: exclusividad en toda su categoría y pago a 90 días.',
    opciones: [
      {
        texto: 'Firmar como viene',
        detalle: 'Cobras a 90 días. Pierdes su categoría',
        estilo: { audacia: 1, resultados: 1 },
        aplicar: (x) => {
          const { g } = x;
          const proy = crearProyecto(g, x.rnd, { tier: g.reputacion >= 35 ? 'M' : 'S', tipo: 'fee' });
          const c = cliente(g, proy.clienteId);
          if (c) {
            c.plazoPago = 12;
            g.oportunidades = g.oportunidades.filter((o) => o.rubro !== c.rubro || o.clienteId === c.id);
          }
          bandera(g, 'exclusividad');
          return `Firmas con ${c?.nombre ?? 'la marca'}: ${soles(proy.presupuesto)} al mes. El primer pago llegará en tres meses y sus competidores ya no son clientes posibles.`;
        },
      },
      {
        texto: 'Negociar: 60 días y sin exclusividad',
        detalle: 'Pueden retirarse',
        estilo: { resultados: 1, vision: 1 },
        aplicar: (x) => {
          const { g } = x;
          if (prob(x.rnd, clamp(0.4 + g.reputacion / 200, 0.3, 0.8))) {
            const proy = crearProyecto(g, x.rnd, { tier: g.reputacion >= 35 ? 'M' : 'S', tipo: 'fee', factorPrecio: 0.95 });
            const c = cliente(g, proy.clienteId);
            if (c) c.plazoPago = 8;
            return `Después de dos rondas ceden: ${soles(proy.presupuesto)} al mes, pago a 60 días, sin exclusividad. Tu primer ingreso recurrente, en términos que puedes sostener.`;
          }
          return 'Su área de compras responde que las condiciones son estándar y no negociables. Eligen a otra agencia.';
        },
      },
      {
        texto: 'Rechazar: no puedes financiar a un cliente tres meses',
        detalle: 'Sigues viviendo de proyectos',
        estilo: { vision: 1, audacia: -1 },
        aplicar: () =>
          'Haces la cuenta: tres meses de planilla adelantada para atenderlos. Dices que no. Tu ingreso sigue dependiendo del próximo pitch.',
      },
    ],
    leccion:
      'Un fee da estabilidad solo si puedes financiar el plazo de pago. Lee el contrato pensando en tu caja del tercer mes, no en la factura.',
  },
  {
    id: 'aumento_general',
    titulo: 'Piden revisión de sueldos',
    categoria: 'personas',
    etapas: [2, 5],
    elegir: (g) => (g.personas.length >= 4 && g.semana >= 10 ? {} : null),
    texto: (x) =>
      `Tres personas del equipo te piden una reunión: los alquileres subieron, el menú subió y los sueldos no se mueven desde que entraron. Un ajuste de 8% para todos cuesta ${soles(
        r100(nominaSemanal(x.g) * 4 * 0.08),
      )} más cada mes.`,
    opciones: [
      {
        texto: 'Subir 8% a todos',
        detalle: 'Sube la planilla para siempre',
        estilo: { personas: 2, resultados: -1 },
        aplicar: (x) => {
          for (const p of x.g.personas) {
            subirSueldo(p, 0.08);
            animo(p, p.motivador === 'dinero' ? 9 : 5, 'Subieron 8% a todo el equipo.');
          }
          return `Anuncias el ajuste en la reunión del lunes. La planilla sube a ${soles(r100(nominaSemanal(x.g) * 4))} al mes y el ambiente cambia.`;
        },
      },
      {
        texto: 'Subir 15% solo a quienes mejor rinden',
        detalle: 'El resto lo resiente',
        estilo: { resultados: 2, personas: -1 },
        aplicar: (x) => {
          const orden = [...x.g.personas].sort((a, b) => rendimiento(b) - rendimiento(a));
          const corte = Math.max(1, Math.round(orden.length / 3));
          orden.forEach((p, i) => {
            if (i < corte) {
              subirSueldo(p, 0.15);
              animo(p, 10, 'Me subieron 15% por desempeño.');
            } else {
              animo(p, p.motivador === 'dinero' ? -7 : -4, 'Subieron sueldos y a mí no me tocó.');
            }
          });
          return `Subes a ${corte} ${corte === 1 ? 'persona' : 'personas'}. Quienes recibieron el aumento se sienten vistos. El resto pregunta con qué criterio se decidió.`;
        },
      },
      {
        texto: 'Posponer con fecha: 6% dentro de ocho semanas',
        detalle: 'Compras tiempo, comprometes tu palabra',
        estilo: { vision: 1, integridad: 1 },
        aplicar: (x) => {
          animoTodos(x.g, -2, 'Prometieron un ajuste de sueldo en ocho semanas.');
          diferir(x.g, 8, 'aumento_prometido');
          return 'Muestras la caja y pones una fecha en el calendario compartido. No es lo que querían oír, pero es una fecha y la van a recordar.';
        },
      },
    ],
    leccion:
      'Subir a todos por igual es justo y caro. Subir por mérito es eficiente solo si el criterio es visible. Lo que no funciona es no responder.',
  },
  {
    id: 'bajo_rendimiento',
    titulo: 'Entrega tarde, otra vez',
    categoria: 'personas',
    etapas: [2, 5],
    repetible: true,
    peso: 0.7,
    elegir: (g) => {
      if (g.personas.length < 4) return null;
      const p = peorPersona(g, (q) => antiguedad(g, q) >= 6 && q.fuera === 0);
      return p && p.habilidad <= 5 ? { p } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} entregó tarde por tercera semana seguida. Sus compañeros ya corrigen su trabajo sin avisarte. Lleva ${antiguedad(
        x.g,
        x.p!,
      )} semanas en la empresa y despedir${gen(x.p!, 'lo', 'la')} costaría ${soles(liquidacion(x.p!))}.`,
    opciones: [
      {
        texto: 'Conversación franca y plan de mejora a un mes',
        detalle: 'Puede mejorar, o no',
        estilo: { personas: 1, vision: 1 },
        aplicar: (x) => {
          const p = x.p!;
          const reciente = p.ultima1a1 > 0 && x.g.semana - p.ultima1a1 <= 4;
          if (prob(x.rnd, 0.5 + (reciente ? 0.15 : 0) + (p.rasgo === 'leal' || p.rasgo === 'optimista' ? 0.1 : 0))) {
            p.habilidad = Math.min(10, p.habilidad + 1);
            animo(p, 6, 'Me dijeron de frente qué no estaba funcionando y me dieron un plan.');
            return `Le dices exactamente qué esperas y para cuándo. Nadie se lo había dicho tan claro. En tres semanas el cambio se nota.`;
          }
          animo(p, -6, 'Me pusieron en plan de mejora.');
          estres(p, 8);
          return `${primerNombre(p)} firma el plan sin discutir. Dos semanas después nada cambió, y ahora además está ${gen(p, 'asustado', 'asustada')}.`;
        },
      },
      {
        texto: 'Despedir con trato digno',
        detalle: 'Pagas la liquidación',
        estilo: { resultados: 2, personas: -1 },
        bloqueo: sinCaja((x) => liquidacion(x.p!)),
        aplicar: (x) => {
          const p = x.p!;
          const costo = liquidacion(p);
          caja(x.g, -costo);
          sacarPersona(x.g, p, 'despido');
          const alivio = p.habilidad <= 4;
          animoTodos(x.g, alivio ? 2 : -4, alivio ? 'Por fin se resolvió lo que todos veíamos.' : `Despidieron a ${primerNombre(p)}.`);
          return `Pagas ${soles(costo)} y le das una referencia honesta. ${
            alivio ? 'El equipo, que llevaba semanas cubriendo su trabajo, respira.' : 'El equipo se pregunta quién sigue.'
          }`;
        },
      },
      {
        texto: 'Dejarlo pasar: no es el momento',
        detalle: 'Los demás lo notan',
        estilo: { personas: -1, resultados: -1, delegacion: 1 },
        aplicar: (x) => {
          const p = x.p!;
          animoTodos(x.g, -3, 'Aquí da igual rendir que no rendir.', p.id);
          ajustarActivos(x.g, -3);
          return 'Decides esperar a que pase la temporada alta. Tus mejores personas siguen corrigiendo trabajo ajeno y sacando conclusiones.';
        },
      },
    ],
    leccion:
      'Tolerar el bajo rendimiento es una decisión que toman por ti tus mejores personas: pagan el costo ellas. Decir la verdad a tiempo es lo más respetuoso para todos.',
  },
  {
    id: 'premio',
    titulo: 'Convocatoria a premios',
    categoria: 'estrategia',
    etapas: [2, 5],
    repetible: true,
    peso: 0.5,
    elegir: (g) => (g.stats.entregas >= 3 ? {} : null),
    texto: (x) =>
      `Abrió la convocatoria del festival de marketing más visto del país. Inscribir tu mejor caso cuesta ${soles(
        r100(Math.max(5000, base(x.g) * 0.8)),
      )} y varias noches de tus creativos. Un trofeo cambia cómo te atienden el teléfono.`,
    opciones: [
      {
        texto: 'Inscribir el caso con un video bien producido',
        detalle: 'Cuesta el doble, compite mejor',
        estilo: { audacia: 2, vision: 1 },
        bloqueo: sinCaja((x) => r100(Math.max(5000, base(x.g) * 0.8)) * 2),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(Math.max(5000, base(g) * 0.8)) * 2);
          estresArea(g, 'creatividad', 8);
          diferir(g, 4, 'premio_resultado', { chance: clamp(0.28 + g.reputacion / 220 + (g.stats.mejorCalidad - 75) / 90, 0.1, 0.8) });
          return 'Graban testimonios, editan tres noches y envían el caso a minutos del cierre. El jurado anuncia finalistas en un mes.';
        },
      },
      {
        texto: 'Inscribir el caso con lo que ya tienes',
        detalle: 'Más barato, menos chances',
        estilo: { audacia: 1, resultados: 1 },
        bloqueo: sinCaja((x) => r100(Math.max(5000, base(x.g) * 0.8))),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(Math.max(5000, base(g) * 0.8)));
          estresArea(g, 'creatividad', 4);
          diferir(g, 4, 'premio_resultado', { chance: clamp(0.1 + g.reputacion / 260 + (g.stats.mejorCalidad - 75) / 110, 0.04, 0.55) });
          return 'Arman el caso con fotos del evento y un texto ajustado. Lo envían. El jurado anuncia finalistas en un mes.';
        },
      },
      {
        texto: 'Este año no',
        detalle: 'Guardas caja y energía',
        estilo: { resultados: 1, audacia: -1 },
        aplicar: (x) => {
          for (const p of x.g.personas) if (p.motivador === 'reconocimiento' && p.rol === 'creatividad') animo(p, -4, 'No inscribimos nada a premios este año.');
          return 'Decides que la caja y las noches del equipo valen más que una estatuilla posible. Algún creativo esperaba otra respuesta.';
        },
      },
    ],
    leccion:
      'Los premios son marketing caro con resultado incierto. Valen cuando tienes un caso sólido y caja para perder la apuesta.',
  },
  {
    id: 'horas_extra',
    titulo: 'Tres fines de semana seguidos',
    categoria: 'personas',
    etapas: [2, 5],
    repetible: true,
    peso: 0.7,
    elegir: (g) => {
      const prod = g.personas.filter((q) => q.rol === 'produccion');
      const p = [...prod].sort((a, b) => b.estres - a.estres)[0];
      return prod.length >= 2 && p && p.estres >= 50 ? { p } : null;
    },
    texto: (x) => {
      const prod = x.g.personas.filter((q) => q.rol === 'produccion');
      const bono = r100(prod.reduce((s, q) => s + q.salario / 4, 0) * 0.6);
      return `Producción lleva tres fines de semana seguidos en montajes. ${x.p!.nombre} habla por el área: piden que eso se compense de alguna forma. Un bono para todos sumaría ${soles(bono)}.`;
    },
    opciones: [
      {
        texto: 'Pagar un bono por los fines de semana trabajados',
        detalle: 'Sale de caja',
        estilo: { personas: 1, resultados: 1 },
        bloqueo: sinCaja((x) => r100(x.g.personas.filter((q) => q.rol === 'produccion').reduce((s, q) => s + q.salario / 4, 0) * 0.6)),
        aplicar: (x) => {
          const prod = x.g.personas.filter((q) => q.rol === 'produccion');
          const bono = r100(prod.reduce((s, q) => s + q.salario / 4, 0) * 0.6);
          caja(x.g, -bono, 'nomina');
          for (const q of prod) animo(q, q.motivador === 'dinero' ? 11 : q.motivador === 'equilibrio' ? 4 : 7, 'Nos pagaron un bono por los fines de semana.');
          return `Depositas ${soles(bono)} entre todo el equipo de producción. El cansancio sigue ahí, pero ya no sienten que lo regalan.`;
        },
      },
      {
        texto: 'Dar días libres compensatorios la próxima semana',
        detalle: 'Producción rinde menos esa semana',
        estilo: { personas: 2, resultados: -1 },
        aplicar: (x) => {
          for (const q of x.g.personas.filter((r) => r.rol === 'produccion')) {
            energia(q, 22);
            estres(q, -14);
            animo(q, q.motivador === 'equilibrio' ? 11 : 6, 'Nos devolvieron los días trabajados en fin de semana.');
            q.rampa = Math.max(q.rampa, 1);
          }
          return 'Se turnan para tomar dos días cada uno. La semana que viene producción irá a media máquina y volverá con otra cara.';
        },
      },
      {
        texto: 'Recordarles que así es el negocio de eventos',
        detalle: 'Su ánimo cae',
        estilo: { resultados: 1, personas: -2 },
        aplicar: (x) => {
          for (const q of x.g.personas.filter((r) => r.rol === 'produccion')) {
            animo(q, q.motivador === 'equilibrio' ? -13 : -8, 'Pedimos compensación por los fines de semana y nos dijeron que así es el rubro.');
            estres(q, 4);
          }
          return `Les dices que en BTL los eventos son los fines de semana y que todos lo sabían al entrar. ${primerNombre(x.p!)} no discute. Tampoco sonríe.`;
        },
      },
    ],
    leccion:
      'El esfuerzo extra que no se reconoce se convierte en deuda, y el equipo la cobra con desgano o con una renuncia. Compensar puede ser dinero o tiempo, pero tiene que ser algo.',
  },
  {
    id: 'linea_credito',
    titulo: 'El banco ofrece una línea',
    categoria: 'finanzas',
    etapas: [2, 5],
    elegir: (g) => (g.deuda === 0 && (g.caja < base(g) * 7 || g.etapa >= 3) ? {} : null),
    texto: (x) =>
      `Tu sectorista del banco te ofrece una línea de capital de trabajo por ${soles(
        r100(base(x.g) * 8),
      )}, con 10% de costo total. Con clientes que pagan a 60 y 90 días, es la diferencia entre tomar o no el próximo proyecto grande.`,
    opciones: [
      {
        texto: 'Tomar la línea completa',
        detalle: 'Devuelves 10% más',
        estilo: { audacia: 2, resultados: 1 },
        aplicar: (x) => {
          const monto = r100(base(x.g) * 8);
          caja(x.g, monto);
          x.g.deuda += r100(monto * 1.1);
          return `Entran ${soles(monto)} a la cuenta. Debes ${soles(r100(monto * 1.1))}. Ahora puedes adelantar proveedores sin mirar el saldo cada mañana.`;
        },
      },
      {
        texto: 'Adelantar tu factura más grande con factoring',
        detalle: 'Cobras hoy el 93%',
        estilo: { resultados: 1, vision: 1 },
        bloqueo: (x) => (x.g.facturas.length === 0 ? 'No tienes facturas por cobrar' : null),
        aplicar: (x) => {
          const f = [...x.g.facturas].sort((a, b) => b.monto - a.monto)[0];
          const neto = r100(f.monto * 0.93);
          caja(x.g, neto, 'cobros');
          quitarFactura(x.g, f);
          return `En vez de deuda, vendes la factura de «${f.concepto}». Recibes ${soles(neto)} hoy y no le debes nada a nadie.`;
        },
      },
      {
        texto: 'No endeudarse: crecer al ritmo de la caja',
        detalle: 'Sin deuda, sin colchón',
        estilo: { audacia: -2, vision: 1 },
        aplicar: () =>
          'Agradeces y dejas la oferta en el cajón. Tu crecimiento seguirá atado a cuándo te pagan. Duermes sin cuotas.',
      },
    ],
    leccion:
      'La deuda no es buena ni mala: sirve para financiar trabajo ya vendido y es peligrosa para tapar pérdidas. Pregúntate qué estarías financiando.',
  },

  // ============================= etapa 3: agencia ===========================
  {
    id: 'clima_rumbo',
    titulo: 'No sabemos a dónde vamos',
    categoria: 'personas',
    etapas: [3, 5],
    elegir: (g) => (g.personas.length >= 8 ? {} : null),
    texto: () =>
      'Llega el resultado de la encuesta interna. La frase que más se repite: «No sabemos a dónde va la empresa ni cómo nos va». Cuando eran cinco, todos lo sabían porque almorzaban contigo.',
    opciones: [
      {
        texto: 'Reunión mensual con los números abiertos',
        detalle: 'Te expones. Más carga para ti',
        estilo: { integridad: 1, vision: 2, personas: 1 },
        aplicar: (x) => {
          const { g } = x;
          estresCeo(g, 4);
          const apretado = g.caja < nominaSemanal(g) * 5;
          for (const p of g.personas) {
            const d = apretado && p.rasgo === 'ansioso' ? -3 : p.motivador === 'proposito' ? 8 : 5;
            animo(p, d, 'Ahora nos muestran los números de la empresa cada mes.');
          }
          return `Muestras ventas, caja y lo que viene.${
            apretado ? ' Los números asustan a un par de personas, pero ' : ' '
          }Las preguntas son mejores de lo que esperabas. Por primera vez el equipo opina como dueño.`;
        },
      },
      {
        texto: 'Contratar una consultora de clima',
        detalle: 'Cuesta una semana de planilla',
        estilo: { delegacion: 1, resultados: -1 },
        bloqueo: sinCaja((x) => r100(base(x.g))),
        aplicar: (x) => {
          caja(x.g, -r100(base(x.g)));
          animoTodos(x.g, 3, 'Vino una consultora a preguntar cómo estamos.');
          return `Pagas ${soles(r100(base(x.g)))} por talleres y un informe de cuarenta páginas. El equipo aprecia el gesto. El informe dice lo mismo que la encuesta.`;
        },
      },
      {
        texto: 'Seguir igual: los resultados hablan solos',
        detalle: 'El ánimo se desgasta',
        estilo: { resultados: 1, personas: -1, vision: -1 },
        aplicar: (x) => {
          animoTodos(x.g, -4, 'Contestamos la encuesta de clima y no cambió nada.');
          return 'Archivas la encuesta. El equipo nota que preguntaste y no respondiste. La próxima vez contestarán menos.';
        },
      },
    ],
    leccion:
      'Al crecer, lo que antes se contagiaba en el almuerzo hay que comunicarlo a propósito. Si no cuentas el rumbo, el equipo lo inventa.',
  },
  {
    id: 'lider_o_estrella',
    titulo: 'Creatividad necesita un líder',
    categoria: 'estrategia',
    etapas: [3, 5],
    elegir: (g) => {
      const crea = g.personas.filter((q) => q.rol === 'creatividad');
      if (crea.length < 2 || crea.some((q) => q.lider)) return null;
      const p = mejorPersona(g, (q) => q.rol === 'creatividad');
      return p ? { p } : null;
    },
    texto: (x) =>
      `Ya no puedes dirigir creatividad y la empresa a la vez. ${x.p!.nombre} es tu mejor talento del área, pero nunca ha liderado a nadie. La otra opción es traer a alguien con experiencia de afuera.`,
    opciones: [
      {
        texto: 'Promover a tu mejor talento',
        detalle: 'Gran ejecutor no siempre es buen líder',
        estilo: { delegacion: 2, personas: 1 },
        aplicar: (x) => {
          const { g } = x;
          const p = x.p!;
          p.lider = true;
          subirSueldo(p, 0.12);
          const natural = p.rasgo === 'mentor' || p.rasgo === 'leal' || p.rasgo === 'optimista';
          if (prob(x.rnd, natural ? 0.85 : 0.4)) {
            animo(p, 10, 'Me promovieron a liderar creatividad.');
            for (const q of g.personas) if (q.rol === 'creatividad' && q.id !== p.id) animo(q, 5, `${primerNombre(p)} ahora lidera el área y lo hace bien.`);
            estresCeo(g, -10);
            return `${primerNombre(p)} asume con naturalidad: escucha, ordena y defiende a su equipo. Recuperas tus mañanas.`;
          }
          estres(p, 15);
          animo(p, -4, 'Me promovieron y siento que no doy la talla como líder.');
          for (const q of g.personas) if (q.rol === 'creatividad' && q.id !== p.id) animo(q, -6, `${primerNombre(p)} ahora dirige el área y corrige todo como si fuera suyo.`);
          return `${primerNombre(p)} sigue haciendo el trabajo en vez de dirigirlo y rehace las piezas de su equipo de madrugada. Perdiste a tu mejor talento creativo y ganaste una jefatura estresada.`;
        },
      },
      {
        texto: 'Contratar a un director creativo de afuera',
        detalle: 'Caro. Tu estrella lo puede tomar mal',
        estilo: { resultados: 1, audacia: 1, personas: -1 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 0.6)),
        aplicar: (x) => {
          const { g } = x;
          const p = x.p!;
          caja(g, -r100(base(g) * 0.6));
          const nuevo = candidatoAPersona(g, generarCandidato(g, x.rnd, 'creatividad', [8, 9]));
          nuevo.lider = true;
          g.personas.push(nuevo);
          g.stats.contrataciones += 1;
          animo(p, p.rasgo === 'ambicioso' || p.motivador === 'crecimiento' ? -16 : -8, 'Trajeron a alguien de afuera para el puesto que yo quería.');
          estresCeo(g, -8);
          return `Entra ${nuevo.nombre} con ${soles(nuevo.salario)} al mes y experiencia de sobra. ${primerNombre(p)} saluda con cortesía y cierra su laptop temprano ese día.`;
        },
      },
      {
        texto: 'Seguir dirigiendo creatividad tú',
        detalle: 'Tu estrés sube',
        estilo: { delegacion: -2, resultados: 1 },
        aplicar: (x) => {
          estresCeo(x.g, 12);
          ajustarActivos(x.g, 2);
          animo(x.p!, -3, 'El área sigue sin líder propio.');
          return 'Decides que todavía nadie está listo. La calidad se sostiene porque sigues ahí cada noche. La pregunta es cuánto más.';
        },
      },
    ],
    leccion:
      'Promover al mejor ejecutor es apostar a que quiere y sabe liderar, que es otro oficio. Averigua eso antes de darle el cargo.',
  },
  {
    id: 'cliente_concentrado',
    titulo: 'Tu cliente más grande aprieta',
    categoria: 'clientes',
    etapas: [2, 5],
    elegir: (g) => {
      if (proyectosActivos(g).length < 2) return null;
      const k = concentracion(g);
      return k && k.parte > 0.45 ? { c: k.c } : null;
    },
    texto: (x) => {
      const k = concentracion(x.g);
      const pct = Math.round((k?.parte ?? 0.5) * 100);
      return `${x.c!.nombre} representa cerca del ${pct}% de tu ingreso y su nuevo gerente de compras lo sabe. Pide 12% de rebaja en todo lo vigente o saca la cuenta a licitación.`;
    },
    opciones: [
      {
        texto: 'Aceptar la rebaja de 12%',
        detalle: 'Conservas la cuenta, pierdes margen',
        estilo: { resultados: -1, audacia: -1, personas: 1 },
        aplicar: (x) => {
          const c = x.c!;
          for (const p of proyectosActivos(x.g)) if (p.clienteId === c.id) p.presupuesto = r100(p.presupuesto * 0.88);
          sat(c, 5);
          return `Firmas la adenda. ${c.nombre} se queda y compras ya sabe que cuando aprieta, cedes.`;
        },
      },
      {
        texto: 'Defender el precio con resultados',
        detalle: 'Puedes perder la cuenta',
        estilo: { audacia: 2, resultados: 1 },
        aplicar: (x) => {
          const c = x.c!;
          if (prob(x.rnd, clamp(0.3 + (c.satisfaccion - 50) / 80, 0.1, 0.85))) {
            sat(c, 3);
            return `Llevas las cifras de cada activación a la reunión. Marketing te defiende frente a compras y el precio se queda donde está.`;
          }
          for (const p of proyectosActivos(x.g)) if (p.clienteId === c.id && p.tipo === 'fee') p.estado = 'cancelado';
          sat(c, -18);
          animoTodos(x.g, -3, `Perdimos lo recurrente con ${c.nombre}.`);
          return `Compras cumple su amenaza: licitan y gana una agencia más barata. Lo recurrente con ${c.nombre} se termina y solo cierras lo que ya estaba en marcha.`;
        },
      },
      {
        texto: 'Ceder 6% y empezar a diversificar esta semana',
        detalle: 'Margen menor y más trabajo comercial',
        estilo: { vision: 2, resultados: 1 },
        aplicar: (x) => {
          const c = x.c!;
          for (const p of proyectosActivos(x.g)) if (p.clienteId === c.id) p.presupuesto = r100(p.presupuesto * 0.94);
          x.g.prospeccion += 2;
          estresCeo(x.g, 5);
          return `Negocias la mitad de la rebaja y esa misma tarde llamas a cinco marcas con las que nunca trabajaste. No vuelves a depender así de un solo cliente.`;
        },
      },
    ],
    leccion:
      'Un cliente que pesa la mitad de tus ingresos es tu socio mayoritario sin haber invertido. La negociación se gana meses antes, diversificando.',
  },
  {
    id: 'denuncia_acoso',
    titulo: 'Comentarios fuera de lugar',
    categoria: 'etica',
    etapas: [3, 5],
    elegir: (g, r) => {
      if (g.personas.length < 8) return null;
      const p2 = mejorPersona(g, (q) => q.habilidad >= 7);
      const p = p2 ? personaAlAzar(g, r, (q) => q.id !== p2.id && q.habilidad <= 6) : undefined;
      return p && p2 ? { p, p2 } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} cierra la puerta de tu oficina. Te cuenta que ${x.p2!.nombre}, una de las personas que más rinde en la agencia, le hace comentarios sobre su cuerpo desde hace semanas. No quiere «hacer problema», solo que pare.`,
    opciones: [
      {
        texto: 'Abrir una investigación formal con asesoría externa',
        detalle: 'Cuesta dinero y puede costarte a tu estrella',
        estilo: { integridad: 2, personas: 1, resultados: -1 },
        aplicar: (x) => {
          const { g } = x;
          const p = x.p!;
          const p2 = x.p2!;
          const costo = r100(Math.max(4000, base(g) * 0.4));
          caja(g, -costo);
          animo(p, 10, 'Denuncié y me tomaron en serio.');
          if (prob(x.rnd, 0.6)) {
            sacarPersona(g, p2, 'despido');
            animoTodos(g, 5, 'La empresa actuó frente a una denuncia de acoso.');
            ajustarActivos(g, -4);
            return `Pagas ${soles(costo)} por la investigación. Otras dos personas confirman el patrón. Desvinculas a ${primerNombre(p2)} esa misma semana. Los proyectos lo sienten, el equipo también, de otra forma.`;
          }
          animo(p2, -10, 'Me investigaron por una denuncia.');
          animoTodos(g, 2, 'La empresa investigó una denuncia con seriedad.', p2.id);
          return `Pagas ${soles(costo)}. La investigación no es concluyente y termina en una advertencia escrita y un protocolo nuevo. ${primerNombre(p)} sabe que le creíste.`;
        },
      },
      {
        texto: 'Hablar en privado con la persona señalada y advertirle',
        detalle: 'Rápido. Puede repetirse',
        estilo: { personas: 1, integridad: -1 },
        aplicar: (x) => {
          const p = x.p!;
          const p2 = x.p2!;
          animo(p, -3, 'Denuncié y solo hubo una conversación informal.');
          animo(p2, -4);
          diferir(x.g, 6, 'acoso_repite', { personaId: p.id, persona2Id: p2.id });
          return `${primerNombre(p2)} dice que eran bromas y promete cuidarse. No queda nada por escrito. ${primerNombre(p)} agradece, sin mucha convicción.`;
        },
      },
      {
        texto: 'Pedirle que no lo tome tan a pecho',
        detalle: 'Proteges a quien más factura',
        estilo: { integridad: -2, personas: -2, resultados: 1 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, -20, 'Denuncié acoso y me dijeron que no exagere.');
          bandera(x.g, 'acosoMinimizado');
          diferir(x.g, 4, 'acoso_crisis', { personaId: p.id, persona2Id: x.p2!.id });
          return `Le dices que ${primerNombre(x.p2!)} «es así con todos» y que no vale la pena el lío. ${primerNombre(p)} te mira un segundo de más y sale sin decir nada.`;
        },
      },
    ],
    leccion:
      'Lo que haces con la primera denuncia define si habrá una segunda o si la gente simplemente se irá callada. Ningún talento compensa ese costo.',
  },
  {
    id: 'licitacion_grande',
    titulo: 'La licitación del año',
    categoria: 'estrategia',
    etapas: [3, 5],
    repetible: true,
    peso: 0.6,
    elegir: (g) => (g.reputacion >= 40 && g.personas.some((p) => p.rol === 'creatividad') ? {} : null),
    texto: (x) =>
      `Una de las marcas más grandes del país licita su cuenta de experiencias: un fee que cambiaría el tamaño de ${x.g.empresa}. Compiten seis agencias. Presentarse bien exige tres semanas de tus mejores creativos y ${soles(
        r100(base(x.g) * 1.2),
      )} en maquetas, sin garantía de nada.`,
    opciones: [
      {
        texto: 'Ir con todo',
        detalle: 'Agota al equipo. Premio enorme',
        estilo: { audacia: 2, vision: 1 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 1.2)),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 1.2));
          for (const p of g.personas.filter((q) => q.rol === 'creatividad')) {
            estres(p, 14);
            energia(p, -14);
          }
          estresCeo(g, 8);
          const mejor = mejorPersona(g, (q) => q.rol === 'creatividad');
          const chance = clamp(0.2 + g.reputacion / 260 + ((mejor?.habilidad ?? 5) - 6) * 0.05, 0.1, 0.7);
          diferir(g, 3, 'licitacion_resultado', { chance, costoAnimo: 7 });
          return 'Tres semanas de pizarras llenas y cenas en la oficina. La presentación sale como la soñaron. Ahora toca esperar el correo.';
        },
      },
      {
        texto: 'Presentarse en modo eficiente',
        detalle: 'Menos desgaste, menos chances',
        estilo: { resultados: 1, audacia: 1 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 0.4)),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 0.4));
          estresArea(g, 'creatividad', 5);
          const mejor = mejorPersona(g, (q) => q.rol === 'creatividad');
          const chance = clamp(0.08 + g.reputacion / 500 + ((mejor?.habilidad ?? 5) - 6) * 0.025, 0.04, 0.35);
          diferir(g, 3, 'licitacion_resultado', { chance, costoAnimo: 2 });
          return 'Adaptan una idea que ya tenían y arman una presentación correcta sin frenar los proyectos en curso. Entran a competir, sin ilusionarse mucho.';
        },
      },
      {
        texto: 'Pasar: cuidar a los clientes actuales',
        detalle: 'Sin riesgo, sin salto',
        estilo: { audacia: -1, resultados: 1, personas: 1 },
        aplicar: (x) => {
          for (const p of x.g.personas) if (p.rasgo === 'ambicioso') animo(p, -4, 'No nos presentamos a la licitación más grande del año.');
          ajustarActivos(x.g, 2);
          return 'Decides no distraer al equipo. Los clientes actuales reciben toda la atención. Los más ambiciosos se quedan con las ganas.';
        },
      },
    ],
    leccion:
      'Una licitación grande se paga con el trabajo de tus clientes actuales. Preséntate cuando tengas chances reales y capacidad para absorber tanto ganar como perder.',
  },
  {
    id: 'soborno',
    titulo: 'Una comisión para adjudicar',
    categoria: 'etica',
    etapas: [3, 5],
    texto: () =>
      'Estás a punto de ganar un proyecto grande con una empresa nueva. El comprador te invita un café y lo dice sin decirlo: con una «comisión» de 5% para él, la adjudicación sale esta semana. Sin eso, «hay otras propuestas muy buenas».',
    opciones: [
      {
        texto: 'Pagar la comisión',
        detalle: 'Ganas el proyecto. Queda un secreto',
        estilo: { integridad: -2, resultados: 2, audacia: 1 },
        aplicar: (x) => {
          const { g } = x;
          const proy = crearProyecto(g, x.rnd, { tier: 'L' });
          const coima = r100(proy.presupuesto * 0.05);
          caja(g, -coima);
          bandera(g, 'soborno');
          diferir(g, 10, 'soborno_sale', { clienteId: proy.clienteId, proyectoId: proy.id });
          return `Entregas ${soles(coima)} en efectivo y el viernes llega la orden de compra por ${soles(proy.presupuesto)}. Solo tú y él lo saben. Por ahora.`;
        },
      },
      {
        texto: 'Negarte y retirarte del proceso',
        detalle: 'Pierdes el proyecto',
        estilo: { integridad: 2, resultados: -1 },
        aplicar: () =>
          'Pagas tu café, le dices que así no trabajas y te vas. El proyecto se lo lleva otra agencia. Nadie te va a felicitar por esto.',
      },
      {
        texto: 'Reportarlo al área de cumplimiento de su empresa',
        detalle: 'Puede abrir o cerrar la puerta',
        estilo: { integridad: 2, audacia: 2 },
        aplicar: (x) => {
          const { g } = x;
          if (prob(x.rnd, 0.4)) {
            const proy = crearProyecto(g, x.rnd, { tier: 'L' });
            rep(g, 3);
            return `La empresa abre una investigación, separa al comprador y reinicia el proceso. Lo ganas limpio: ${soles(proy.presupuesto)}. El gerente general pide conocerte.`;
          }
          rep(g, 1);
          return 'Recibes un correo formal agradeciendo el reporte. El proceso se declara desierto y nadie vuelve a llamarte de esa empresa.';
        },
      },
    ],
    leccion:
      'Un soborno no compra un proyecto: compra un socio que conoce tu precio. La integridad se decide cuando cuesta, no cuando sale gratis.',
  },
  {
    id: 'estrella_toxica',
    titulo: 'Gana premios, rompe gente',
    categoria: 'personas',
    etapas: [3, 5],
    elegir: (g) => {
      if (g.personas.length < 8) return null;
      const p = mejorPersona(g, (q) => q.habilidad >= 8 && (q.rasgo === 'directo' || q.rasgo === 'ambicioso' || q.rasgo === 'perfeccionista'));
      return p ? { p } : null;
    },
    texto: (x) =>
      `${x.p!.nombre} es quien más factura y quien más presentaciones gana. También hizo llorar a dos juniors este mes y ya nadie quiere estar en su equipo. Recursos humanos, que eres tú, tiene tres quejas escritas.`,
    opciones: [
      {
        texto: 'Desvincular, con todo lo que cuesta',
        detalle: 'Liquidación y un hueco de talento',
        estilo: { personas: 2, integridad: 1, resultados: -1 },
        bloqueo: sinCaja((x) => liquidacion(x.p!)),
        aplicar: (x) => {
          const { g } = x;
          const p = x.p!;
          caja(g, -liquidacion(p));
          sacarPersona(g, p, 'despido');
          animoTodos(g, 6, `Sacaron a ${primerNombre(p)}. Aquí el talento no justifica el maltrato.`);
          ajustarActivos(g, -5);
          rep(g, -1);
          return `Pagas ${soles(liquidacion(p))} y ${primerNombre(p)} se va dando un portazo. Los proyectos pierden su mejor mano. El equipo entiende qué se tolera aquí y qué no.`;
        },
      },
      {
        texto: 'Coaching externo y un ultimátum por escrito',
        detalle: 'Puede cambiar, o ganar tiempo',
        estilo: { personas: 1, vision: 1 },
        bloqueo: sinCaja(() => 4000),
        aplicar: (x) => {
          const { g } = x;
          const p = x.p!;
          caja(g, -4000);
          if (prob(x.rnd, p.rasgo === 'perfeccionista' ? 0.6 : 0.45)) {
            animoTodos(g, 3, `${primerNombre(p)} cambió su forma de tratar al equipo.`, p.id);
            animo(p, -3);
            return `Pagas S/ 4,000 de coaching. ${primerNombre(p)} lo toma como un golpe al orgullo, pero cambia: pide las cosas de otra forma y hasta se disculpa con un junior.`;
          }
          diferir(g, 5, 'toxica_sigue', { personaId: p.id });
          return `Pagas S/ 4,000 de coaching. ${primerNombre(p)} asiste a las sesiones y firma el compromiso. Dos semanas se porta bien.`;
        },
      },
      {
        texto: 'Tolerarlo: los resultados mandan',
        detalle: 'El equipo paga el costo',
        estilo: { resultados: 2, personas: -2 },
        aplicar: (x) => {
          const { g } = x;
          const p = x.p!;
          for (const q of g.personas) {
            if (q.id === p.id) continue;
            animo(q, q.habilidad <= 5 ? -8 : -4, `Se quejaron de ${primerNombre(p)} y no pasó nada.`);
            if (q.rol === p.rol) estres(q, 6);
          }
          diferir(g, 5, 'toxica_sigue', { personaId: p.id });
          return `Decides que ${primerNombre(p)} es demasiado valios${gen(p, 'o', 'a')} para tocar. Las quejas dejan de llegar. No porque el problema haya parado.`;
        },
      },
    ],
    leccion:
      'El rendimiento de una estrella que maltrata se resta del rendimiento de todos los que tiene alrededor. Haz esa cuenta completa.',
  },
  {
    id: 'accidente_evento',
    titulo: 'Accidente en pleno evento',
    categoria: 'crisis',
    etapas: [3, 5],
    elegir: (g, r) => {
      const proy = unProyecto(g, r, (p) => p.tier !== 'S');
      const c = proy ? cliente(g, proy.clienteId) : undefined;
      return proy && c ? { proy, c } : null;
    },
    texto: (x) =>
      `En «${x.proy!.nombre}» un panel de la escenografía cayó sobre una asistente. Está fuera de peligro, con un brazo roto. Hay videos circulando y ${x.c!.nombre} te llama cada diez minutos. El panel lo instaló un proveedor tuyo.`,
    opciones: [
      {
        texto: 'Dar la cara: asumir, cubrir gastos y comunicar',
        detalle: 'Cuesta dinero. Golpe inicial a tu nombre',
        estilo: { integridad: 2, personas: 1, audacia: 1 },
        aplicar: (x) => {
          const { g } = x;
          const costo = r100(x.proy!.presupuesto * (g.mejoras.includes('legal') ? 0.03 : 0.07));
          caja(g, -costo);
          rep(g, -2);
          sat(x.c!, 4);
          diferir(g, 3, 'cara_dada');
          for (const p of g.personas) if (p.motivador === 'proposito') animo(p, 5, 'La empresa dio la cara en el accidente.');
          return `Vas a la clínica, cubres ${soles(costo)} en gastos y firmas un comunicado con tu nombre. Los primeros titulares duelen. ${x.c!.nombre} agradece no estar solo en esto.`;
        },
      },
      {
        texto: 'Dejar que lo manejen el seguro y el cliente',
        detalle: 'Sin costo directo. Quedas ausente',
        estilo: { resultados: 1, integridad: -1, personas: -1 },
        aplicar: (x) => {
          rep(x.g, x.g.mejoras.includes('legal') ? -3 : -5);
          sat(x.c!, -12);
          x.proy!.ajusteCalidad -= 6;
          return `Derivas todo al seguro y no das declaraciones. ${x.c!.nombre} termina respondiendo a la prensa por un evento que montaste tú, y no lo olvida.`;
        },
      },
      {
        texto: 'Señalar públicamente al proveedor',
        detalle: 'Puede volverse contra ti',
        estilo: { integridad: -2, resultados: 1 },
        aplicar: (x) => {
          const { g } = x;
          if (prob(x.rnd, 0.5)) {
            rep(g, -9);
            sat(x.c!, -15);
            for (const p of g.personas) if (p.motivador === 'proposito') animo(p, -8, 'Culpamos al proveedor por algo que nosotros supervisábamos.');
            return 'El proveedor publica los correos donde tu equipo aprobó el montaje sin la revisión de seguridad. Ahora la historia es que además mentiste.';
          }
          rep(g, -2);
          return 'El comunicado apunta al proveedor y la prensa lo compra. Sales casi limpio. Los proveedores del medio toman nota de cómo respondes cuando algo sale mal.';
        },
      },
    ],
    leccion:
      'En una crisis la gente perdona el error y castiga la ausencia. Quien da la cara primero escribe la historia.',
  },
  {
    id: 'segunda_linea',
    titulo: 'Decidió sin consultarte',
    categoria: 'operaciones',
    etapas: [3, 5],
    elegir: (g, r) => {
      const p =
        g.personas.find((q) => q.lider) ??
        mejorPersona(g, (q) => (q.rol === 'cuentas' || q.rol === 'operaciones' || q.rol === 'comercial') && q.habilidad >= 6);
      const activos = clientesActivos(g);
      return p && activos.length && g.personas.length >= 8 ? { p, c: elegir(r, activos) } : null;
    },
    texto: (x) =>
      `Te enteras por un correo en copia: ${x.p!.nombre} le dio a ${x.c!.nombre} un descuento de ${soles(
        r100(base(x.g) * 0.3),
      )} para cerrar una renovación. No te consultó. Tú no lo habrías dado.`,
    opciones: [
      {
        texto: 'Respaldar la decisión y conversar el criterio en privado',
        detalle: 'El descuento se queda',
        estilo: { delegacion: 2, personas: 1 },
        aplicar: (x) => {
          const p = x.p!;
          caja(x.g, -r100(base(x.g) * 0.3));
          animo(p, 7, 'Tomé una decisión con un cliente y me respaldaron.');
          sat(x.c!, 4);
          estresCeo(x.g, -4);
          return `Frente al cliente, la decisión es de la empresa. A solas le explicas cómo lo habrías pensado tú. ${primerNombre(p)} sale sabiendo que puede decidir y cómo decidir mejor.`;
        },
      },
      {
        texto: 'Revertir el descuento',
        detalle: 'Desautorizas a tu líder',
        estilo: { resultados: 1, delegacion: -2 },
        aplicar: (x) => {
          const p = x.p!;
          animo(p, -14, 'Me desautorizaron frente a un cliente.');
          sat(x.c!, -6);
          for (const q of x.g.personas) if (q.lider && q.id !== p.id) animo(q, -4, `Desautorizaron a ${primerNombre(p)} frente a su cliente.`);
          return `Llamas a ${x.c!.nombre} y corriges la oferta. Recuperas el dinero. ${primerNombre(p)} no vuelve a decidir nada sin preguntarte, que es justo lo que no necesitabas.`;
        },
      },
      {
        texto: 'Exigir que todo descuento pase por ti',
        detalle: 'Control total, más carga para ti',
        estilo: { delegacion: -2, resultados: 1 },
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 0.3));
          estresCeo(g, 10);
          for (const q of g.personas) if (q.lider || q.id === x.p!.id) animo(q, -7, 'Ahora cada decisión comercial necesita aprobación de arriba.');
          diferir(g, 3, 'cuello_botella');
          return 'Envías un correo a todos los líderes: ningún descuento sin tu firma. El de esta vez se respeta. Tu bandeja de entrada empieza a llenarse de pedidos de aprobación.';
        },
      },
    ],
    leccion:
      'Liderar líderes es aceptar decisiones distintas a las tuyas. Corrige el criterio en privado: si corriges la decisión en público, pierdes al líder.',
  },
  {
    id: 'despidos',
    titulo: 'La planilla no se sostiene',
    categoria: 'finanzas',
    etapas: [3, 5],
    elegir: (g) => (g.personas.length >= 9 && g.caja < nominaSemanal(g) * 5 ? {} : null),
    texto: (x) => {
      const n = Math.max(2, Math.round(x.g.personas.length * 0.15));
      return `Los números no mienten: con ${soles(x.g.caja)} en caja y una planilla de ${soles(
        r100(nominaSemanal(x.g) * 4),
      )} al mes, te quedan pocas semanas. Reducir ${n} puestos alarga la pista. También hay otras formas de repartir el golpe.`;
    },
    opciones: [
      {
        texto: 'Reducir puestos ahora, con trato digno',
        detalle: 'Pagas liquidaciones. Golpe al ánimo',
        estilo: { resultados: 2, personas: -1, integridad: 1 },
        aplicar: (x) => {
          const { g } = x;
          const n = Math.max(2, Math.round(g.personas.length * 0.15));
          const salen = [...g.personas].sort((a, b) => rendimiento(a) - rendimiento(b)).slice(0, n);
          let total = 0;
          for (const p of salen) {
            total += liquidacion(p);
            sacarPersona(g, p, 'despido');
          }
          caja(g, -total);
          animoTodos(g, -8, `Despidieron a ${n} compañeros por la situación de caja.`);
          estresCeo(g, 10);
          return `Hablas con cada una de las ${n} personas, pagas ${soles(total)} en liquidaciones y ofreces referencias. El lunes hay sillas vacías y un silencio que tarda en irse.`;
        },
      },
      {
        texto: 'Recorte temporal de 15% para todos, por ocho semanas',
        detalle: 'Nadie sale. Todos pierden algo',
        estilo: { personas: 1, vision: 1, audacia: 1 },
        aplicar: (x) => {
          const { g } = x;
          for (const p of g.personas) {
            p.salario = r50(p.salario * 0.85);
            animo(p, p.motivador === 'dinero' ? -12 : -6, 'Nos bajaron el sueldo 15% por ocho semanas para no despedir a nadie.');
          }
          diferir(g, 8, 'recorte_fin');
          return `Lo anuncias con los números en pantalla y una fecha de fin. Nadie pierde su puesto. La planilla baja a ${soles(r100(nominaSemanal(g) * 4))} al mes y más de uno empieza a mirar ofertas.`;
        },
      },
      {
        texto: 'Aguantar y apostar a que entra una venta',
        detalle: 'Si no entra, será peor',
        estilo: { audacia: 2, resultados: -1 },
        aplicar: (x) => {
          const { g } = x;
          estresCeo(g, 12);
          g.prospeccion += 1;
          if (prob(x.rnd, 0.5)) animoTodos(g, -3, 'Se rumorea que la empresa no tiene caja.');
          return 'No tocas a nadie y sales a vender como si te fuera la vida. El rumor de la caja corre igual por los pasillos.';
        },
      },
    ],
    leccion:
      'Un recorte hecho a tiempo, una sola vez y con respeto duele menos que tres recortes tardíos. Lo que el equipo no perdona es la incertidumbre.',
  },
  {
    id: 'nueva_unidad',
    titulo: 'Una unidad de contenido',
    categoria: 'estrategia',
    etapas: [3, 5],
    elegir: (g) => (g.personas.length >= 9 && !g.banderas.unidadDigital ? {} : null),
    texto: (x) =>
      `Tres clientes te han pedido lo mismo este trimestre: que el evento también viva en redes. Montar una unidad de contenido propia cuesta ${soles(
        r100(base(x.g) * 5),
      )} entre equipos y arranque. Hoy ese dinero se lo llevan otras productoras.`,
    opciones: [
      {
        texto: 'Lanzar la unidad completa',
        detalle: 'Inversión fuerte, resultado en semanas',
        estilo: { audacia: 2, vision: 2 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 5)),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 5));
          estresCeo(g, 8);
          diferir(g, 6, 'unidad_resultado', { chance: clamp(0.45 + g.reputacion / 300 + g.procesos * 0.04, 0.3, 0.85) });
          return `Compras cámaras, armas una sala de edición y lo anuncias a tus clientes. ${soles(r100(base(g) * 5))} menos en caja y una línea nueva que todavía no factura.`;
        },
      },
      {
        texto: 'Probar con un piloto para un cliente actual',
        detalle: 'Inversión chica, aprendizaje real',
        estilo: { vision: 1, resultados: 1 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 1.5)),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 1.5));
          diferir(g, 5, 'unidad_piloto');
          return `Alquilas equipos y ofreces el servicio a un cliente de confianza por ${soles(r100(base(g) * 1.5))} de tu bolsillo. En cinco semanas sabrás si esto se vende.`;
        },
      },
      {
        texto: 'Mantener el foco en lo que ya haces bien',
        detalle: 'Sin distracción, sin línea nueva',
        estilo: { resultados: 1, audacia: -1 },
        aplicar: (x) => {
          ajustarActivos(x.g, 2);
          for (const p of x.g.personas) if (p.rasgo === 'ambicioso') animo(p, -3, 'Descartamos abrir la unidad de contenido.');
          return 'Decides que primero quieres ser la mejor agencia de eventos, no una mediana de todo. El equipo sigue concentrado en lo suyo.';
        },
      },
    ],
    leccion:
      'Diversificar tiene sentido cuando tus clientes ya te lo piden y puedes probarlo barato. El foco también es una estrategia, si lo eliges y no es miedo.',
  },
  {
    id: 'prensa_negativa',
    titulo: 'Una publicación incómoda',
    categoria: 'crisis',
    etapas: [3, 5],
    elegir: (g) => (g.stats.renuncias + g.stats.despidos >= 2 ? {} : null),
    texto: (x) =>
      `Alguien que trabajó en ${x.g.empresa} publicó en LinkedIn un texto largo sobre «la agencia donde las jornadas no terminan y el fundador decide todo». No da tu nombre, pero todos saben. Ya tiene cuatrocientas reacciones y dos de tus clientes le dieron «me gusta».`,
    opciones: [
      {
        texto: 'Responder en público, reconociendo lo que es cierto',
        detalle: 'Te expones. Puede salir bien',
        estilo: { integridad: 2, audacia: 1 },
        aplicar: (x) => {
          const { g } = x;
          rep(g, -1);
          if (prob(x.rnd, 0.6)) {
            rep(g, 5);
            animoTodos(g, 3, 'La dirección reconoció en público lo que hay que mejorar.');
            return 'Escribes sin abogados: qué es cierto, qué cambió y qué falta. La respuesta se comparte más que la crítica. Tu equipo la lee completa.';
          }
          rep(g, -2);
          return 'Escribes una respuesta honesta. Los comentarios la leen como control de daños y la discusión dura tres días más.';
        },
      },
      {
        texto: 'Llamar a esa persona y escucharla en privado',
        detalle: 'Puede retirar la publicación, o no',
        estilo: { personas: 2, vision: 1 },
        aplicar: (x) => {
          const { g } = x;
          estresCeo(g, 5);
          if (prob(x.rnd, 0.5)) {
            animoTodos(g, 2);
            return 'La llamada dura una hora y casi todo lo que escuchas es justo. No borra el texto, pero agrega un comentario: «El fundador me llamó. Ojalá cambie». Te quedas con una lista de cosas por arreglar.';
          }
          rep(g, -4);
          return 'No te contesta. Publica una captura de tu llamada perdida con la frase «ahora sí tienen tiempo para hablar».';
        },
      },
      {
        texto: 'No responder y esperar a que pase',
        detalle: 'El silencio también comunica',
        estilo: { resultados: 1, integridad: -1 },
        aplicar: (x) => {
          rep(x.g, -3);
          animoTodos(x.g, -2, 'Salió una publicación sobre la cultura de la empresa y nadie dijo nada.');
          return 'El tema muere en una semana. Queda en la primera página cuando un candidato busca el nombre de la empresa.';
        },
      },
    ],
    leccion:
      'Una crítica pública sobre tu cultura casi siempre tiene una parte cierta. Responder a esa parte, y no al tono, es lo único que cambia la conversación.',
  },

  // ======================= etapas 4 y 5: casa y referente ===================
  {
    id: 'oferta_compra',
    titulo: 'Quieren comprar la agencia',
    categoria: 'estrategia',
    etapas: [4, 5],
    elegir: (g) => (g.participacion >= 0.5 && !g.banderas.ventaMayoria ? {} : null),
    texto: (x) => {
      const v = valorAprox(x.g);
      return `Una red internacional de agencias quiere el 51% de ${x.g.empresa} y ofrece ${soles(
        r100(v * 0.51),
      )}, que irían a tu cuenta personal. Seguirías como CEO, reportando a un comité regional en otro huso horario.`;
    },
    opciones: [
      {
        texto: 'Vender el 51%',
        detalle: 'Cobras hoy. Dejas de tener la última palabra',
        estilo: { resultados: 2, audacia: 1, vision: -1 },
        aplicar: (x) => {
          const { g } = x;
          const pago = r100(valorAprox(g) * 0.51);
          bandera(g, 'cobradoVenta', pago);
          bandera(g, 'ventaMayoria');
          g.participacion = Math.max(0.05, g.participacion - 0.51);
          rep(g, 4);
          g.prospeccion += 2;
          for (const p of g.personas) animo(p, p.rasgo === 'ansioso' || p.rasgo === 'leal' ? -6 : -2, 'La agencia ahora es de una red internacional.');
          return `Firmas en una sala con vista al mar. ${soles(pago)} van a tu cuenta y la red te abre sus clientes regionales. El equipo se pregunta qué va a cambiar. Tú también.`;
        },
      },
      {
        texto: 'Contraproponer una participación minoritaria de 25%',
        detalle: 'Pueden no interesarse',
        estilo: { vision: 2, resultados: 1 },
        aplicar: (x) => {
          const { g } = x;
          if (prob(x.rnd, 0.5)) {
            const pago = r100(valorAprox(g) * 0.25 * 0.9);
            bandera(g, 'cobradoVenta', pago);
            g.participacion = Math.max(0.05, g.participacion - 0.25);
            g.prospeccion += 2;
            rep(g, 2);
            return `Aceptan entrar como socios minoritarios: ${soles(pago)} para ti por el 25%. Ganas una red y conservas el control.`;
          }
          return 'Responden que su modelo es de control mayoritario. Se despiden con cortesía y compran a tu competidor seis meses después.';
        },
      },
      {
        texto: 'Rechazar: todavía no terminas lo que empezaste',
        detalle: 'Sigues independiente',
        estilo: { vision: 1, audacia: 1, resultados: -1 },
        aplicar: (x) => {
          animoTodos(x.g, 3, 'Rechazamos una oferta de compra. Seguimos independientes.');
          return 'Les agradeces el interés y vuelves a la oficina. Cuando el equipo se entera, alguien pega en la pared una hoja que dice «No estamos en venta».';
        },
      },
    ],
    leccion:
      'Vender no es ganar ni perder: es cambiar lo que tienes por lo que quieres. Antes de mirar la cifra, define qué quieres seguir decidiendo tú.',
  },
  {
    id: 'expansion_regional',
    titulo: 'Abrir en otro país',
    categoria: 'estrategia',
    etapas: [4, 5],
    elegir: (g) => (!g.banderas.expansion ? {} : null),
    texto: (x) =>
      `Dos clientes regionales te piden lo mismo: que los atiendas también en Bogotá. Abrir oficina allá cuesta ${soles(
        r100(base(x.g) * 10),
      )} y meses de tu atención. Una agencia local te ofrece una alianza, con menos control y menos riesgo.`,
    opciones: [
      {
        texto: 'Abrir oficina propia en Bogotá',
        detalle: 'Inversión grande y muchos viajes',
        estilo: { audacia: 2, vision: 1 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 10)),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 10));
          estresCeo(g, 15);
          bandera(g, 'expansion');
          diferir(g, 8, 'expansion_resultado', { chance: clamp(0.35 + g.procesos * 0.07 + g.reputacion / 400, 0.25, 0.85), inversion: r100(base(g) * 10) });
          return `Alquilas un piso en Chapinero, contratas un equipo base y pasas media vida en el aeropuerto. Lima tiene que funcionar sin ti por primera vez.`;
        },
      },
      {
        texto: 'Firmar una alianza con la agencia local',
        detalle: 'Poco capital, menos control',
        estilo: { delegacion: 2, resultados: 1 },
        bloqueo: sinCaja((x) => r100(base(x.g) * 1.5)),
        aplicar: (x) => {
          const { g } = x;
          caja(g, -r100(base(g) * 1.5));
          bandera(g, 'expansion');
          diferir(g, 6, 'alianza_resultado');
          return `Firmas un acuerdo de un año: ellos producen allá con tu método y tu supervisión. Inviertes ${soles(r100(base(g) * 1.5))} en capacitarlos.`;
        },
      },
      {
        texto: 'Consolidar Perú antes de salir',
        detalle: 'Los clientes regionales buscarán a otro',
        estilo: { audacia: -1, resultados: 1, personas: 1 },
        aplicar: (x) => {
          animoTodos(x.g, 2);
          ajustarActivos(x.g, 2);
          return 'Les dices que todavía no, y los recomiendas con una agencia colombiana seria. Tu equipo agradece no sumar otro frente este año.';
        },
      },
    ],
    leccion:
      'Expandirse multiplica lo que ya eres, incluido el desorden. Sal cuando la operación de origen camine sin ti, no antes.',
  },
];

// ------------------------------- diferidos ---------------------------------

export const DIFERIDOS: Record<string, ManejadorDiferido> = {
  planilla_atrasada: (g, d) => {
    const monto = Number(d.monto) || 0;
    caja(g, -monto, 'nomina');
    noticia(g, 'neutro', `Pagaste los ${soles(monto)} de planilla que habías retenido.`);
  },
  socio_opina: (g) => {
    estresCeo(g, 8);
    noticia(g, 'neutro', 'Tu socio pidió una reunión para revisar los números y sugirió repartir utilidades este año. Ahora hay dos opiniones sobre cada decisión grande.');
  },
  portafolio: (g, d, r) => {
    const c = cliente(g, String(d.clienteId));
    if (c && c.satisfaccion >= 60 && prob(r, 0.7)) {
      rep(g, 3);
      g.prospeccion += 1;
      noticia(g, 'bueno', `El trabajo al costo para ${c.nombre} circuló en el medio. Sube tu reputación y te llega una consulta nueva.`);
    } else {
      noticia(g, 'neutro', 'El trabajo al costo se entregó y nadie más habló de él. Tres semanas de equipo por una foto en la web.');
    }
  },
  multa_sunat: (g, d, r) => {
    const monto = Number(d.monto) || 0;
    if (prob(r, 0.5)) {
      const multa = r100(monto * 0.6);
      caja(g, -multa);
      estresCeo(g, 12);
      rep(g, -2);
      noticia(g, 'malo', `Una fiscalización de SUNAT detectó la operación sin factura. Multa e intereses: ${soles(multa)}.`);
    } else {
      noticia(g, 'neutro', 'Llegó una carta de SUNAT pidiendo sustento de tus ingresos. Esta vez no encontraron la operación sin factura.');
    }
  },
  tarde_libre: (g) => {
    estresCeo(g, -8);
    noticia(g, 'bueno', 'Llevas un mes respetando tu tarde libre. El equipo dejó de escribirte los jueves y nada se incendió.');
  },
  aumento_prometido: (g) => {
    for (const p of g.personas) {
      subirSueldo(p, 0.06);
      animo(p, 4, 'Cumplieron el aumento que prometieron.');
    }
    noticia(g, 'neutro', `Cumpliste la fecha: 6% de aumento para todos. La planilla sube a ${soles(r100(nominaSemanal(g) * 4))} al mes.`);
  },
  premio_resultado: (g, d, r) => {
    if (prob(r, Number(d.chance) || 0.2)) {
      rep(g, 8);
      animoTodos(g, 5, 'Ganamos un premio en el festival de marketing.');
      g.prospeccion += 1;
      noticia(g, 'bueno', `${g.empresa} ganó un trofeo en el festival. Sube la reputación y el teléfono suena distinto.`);
    } else {
      for (const p of g.personas) if (p.rol === 'creatividad') animo(p, -2);
      noticia(g, 'neutro', 'El festival anunció a los ganadores y tu caso no pasó de finalista.');
    }
  },
  acoso_repite: (g, d, r) => {
    const p = persona(g, String(d.personaId));
    const p2 = persona(g, String(d.persona2Id));
    if (!p || !p2) return;
    if (prob(r, 0.5)) {
      animo(p, -15, 'Los comentarios volvieron. La advertencia informal no sirvió.');
      animoTodos(g, -4, 'El acoso que se denunció se repitió.', p2.id);
      g.colaSituaciones.push({ id: 'renuncia', personaId: p.id });
      noticia(g, 'malo', `Los comentarios de ${primerNombre(p2)} hacia ${primerNombre(p)} volvieron. No hay nada por escrito y el equipo ya lo sabe.`);
    } else {
      animo(p, 4, 'Después de la advertencia, los comentarios pararon.');
      noticia(g, 'neutro', `La advertencia a ${primerNombre(p2)} parece haber funcionado. ${primerNombre(p)} trabaja más tranquil${gen(p, 'o', 'a')}.`);
    }
  },
  acoso_crisis: (g, d) => {
    const p = persona(g, String(d.personaId));
    rep(g, -8);
    if (p) sacarPersona(g, p, 'renuncia');
    animoTodos(g, -10, 'Alguien del equipo denunció acoso, la dirección lo minimizó y terminó renunciando.');
    for (const q of g.personas) if (q.motivador === 'proposito') animo(q, -6);
    noticia(
      g,
      'malo',
      `${p ? primerNombre(p) : 'La persona que denunció'} renunció y contó en redes por qué. Dos clientes preguntaron qué pasó y el equipo sabe que tú lo sabías.`,
    );
  },
  licitacion_resultado: (g, d, r) => {
    if (prob(r, Number(d.chance) || 0.15)) {
      const proy = crearProyecto(g, r, { tier: g.etapa >= 4 ? 'XL' : 'L', tipo: 'fee' });
      const c = cliente(g, proy.clienteId);
      rep(g, 5);
      animoTodos(g, 7, 'Ganamos la licitación más grande del año.');
      noticia(g, 'bueno', `Ganaste la licitación: ${c?.nombre ?? 'la marca'} firma un fee de ${soles(proy.presupuesto)} al mes. La empresa cambia de tamaño.`);
    } else {
      const golpe = Number(d.costoAnimo) || 2;
      for (const p of g.personas) if (p.rol === 'creatividad') animo(p, -golpe, 'Perdimos la licitación después de semanas de trabajo.');
      noticia(g, 'malo', 'Llegó el correo: la licitación la ganó otra agencia. «Fue una decisión muy reñida», dicen todos los correos de ese tipo.');
    }
  },
  soborno_sale: (g, d, r) => {
    if (!prob(r, 0.45)) return;
    const c = cliente(g, String(d.clienteId));
    const proy = g.proyectos.find((p) => p.id === String(d.proyectoId));
    if (proy && proy.estado === 'activo') proy.estado = 'cancelado';
    if (c) sat(c, -40);
    rep(g, -10);
    for (const p of g.personas) animo(p, p.motivador === 'proposito' ? -12 : -5, 'Salió a la luz que la empresa pagó una comisión para ganar un proyecto.');
    estresCeo(g, 15);
    noticia(g, 'malo', `Una auditoría en ${c?.nombre ?? 'el cliente'} destapó la comisión que pagaste. Despidieron al comprador, cortaron la relación y el rumor ya corre entre agencias.`);
  },
  toxica_sigue: (g, d, r) => {
    const p = persona(g, String(d.personaId));
    if (!p) return;
    animoTodos(g, -6, `${primerNombre(p)} sigue tratando mal al equipo.`, p.id);
    const junior = personaAlAzar(g, r, (q) => q.id !== p.id && q.habilidad <= 6 && q.rol === p.rol) ?? personaAlAzar(g, r, (q) => q.id !== p.id && q.habilidad <= 5);
    if (junior) g.colaSituaciones.push({ id: 'renuncia', personaId: junior.id });
    noticia(g, 'malo', `${primerNombre(p)} volvió a explotar en una revisión.${junior ? ` ${primerNombre(junior)} ya no aguanta más.` : ''}`);
  },
  cara_dada: (g) => {
    rep(g, 6);
    noticia(g, 'bueno', 'Semanas después del accidente, lo que se recuerda es cómo respondiste. Un medio del sector lo citó como ejemplo de manejo de crisis.');
  },
  cuello_botella: (g, _d, r) => {
    estresCeo(g, 8);
    const activos = clientesActivos(g);
    if (activos.length) sat(elegir(r, activos), -5);
    noticia(g, 'malo', 'Tienes once descuentos esperando tu firma. Un cliente se cansó de esperar respuesta y tus líderes ya no proponen nada.');
  },
  recorte_fin: (g) => {
    for (const p of g.personas) {
      p.salario = r50(p.salario / 0.85);
      animo(p, 4, 'Nos devolvieron el sueldo completo, como prometieron.');
    }
    noticia(g, 'neutro', `Terminaron las ocho semanas de recorte: los sueldos vuelven a su nivel. La planilla sube a ${soles(r100(nominaSemanal(g) * 4))} al mes.`);
  },
  unidad_resultado: (g, d, r) => {
    if (prob(r, Number(d.chance) || 0.5)) {
      g.banderas.unidadDigital = 1;
      g.prospeccion += 3;
      rep(g, 4);
      animoTodos(g, 3, 'La unidad de contenido ya vende.');
      noticia(g, 'bueno', 'La unidad de contenido cerró sus primeros encargos. Llegan oportunidades nuevas y los clientes te ven como algo más que una agencia de eventos.');
    } else {
      noticia(g, 'malo', 'La unidad de contenido no despegó: los clientes siguen prefiriendo a sus productoras de siempre. Los equipos quedan guardados en un clóset.');
    }
  },
  unidad_piloto: (g, _d, r) => {
    const felices = g.clientes.filter((c) => c.satisfaccion >= 60 && c.entregas >= 1);
    if (felices.length && prob(r, 0.6)) {
      const c = elegir(r, felices);
      if (!feesActivos(g).some((p) => p.clienteId === c.id)) {
        const proy = crearProyecto(g, r, { tier: 'S', tipo: 'fee', clienteId: c.id });
        g.banderas.unidadDigital = 1;
        noticia(g, 'bueno', `El piloto de contenido funcionó: ${c.nombre} lo contrata como fee mensual por ${soles(proy.presupuesto)}.`);
        return;
      }
      rep(g, 2);
      noticia(g, 'bueno', `El piloto de contenido gustó en ${c.nombre}. Todavía no es una línea de negocio, pero ya tienes un caso.`);
      return;
    }
    noticia(g, 'neutro', 'El piloto de contenido salió correcto y el cliente no pidió repetirlo. Aprendiste barato que todavía no es tu negocio.');
  },
  expansion_resultado: (g, d, r) => {
    if (prob(r, Number(d.chance) || 0.4)) {
      rep(g, 10);
      g.oportunidades.push(generarOportunidad(g, r, { tier: 'L' }));
      g.oportunidades.push(generarOportunidad(g, r, { tier: g.reputacion >= 70 ? 'XL' : 'L', tipo: 'fee' }));
      animoTodos(g, 4, 'La oficina de Bogotá ya trae negocio.');
      noticia(g, 'bueno', 'Bogotá despegó: dos marcas regionales quieren trabajar contigo en ambos países. Revisa tus oportunidades.');
    } else {
      const extra = r100((Number(d.inversion) || 0) * 0.4);
      caja(g, -extra);
      rep(g, -3);
      estresCeo(g, 10);
      noticia(g, 'malo', `Bogotá no arranca: el equipo local rota, los clientes demoran y tuviste que inyectar ${soles(extra)} más. Lima te extraña.`);
    }
  },
  alianza_resultado: (g, _d, r) => {
    if (prob(r, 0.6)) {
      rep(g, 4);
      g.prospeccion += 2;
      noticia(g, 'bueno', 'La alianza en Bogotá entregó su primer evento con tu método. Los clientes regionales te recomiendan y llegan consultas nuevas.');
    } else {
      rep(g, -2);
      noticia(g, 'malo', 'El primer evento de la alianza en Bogotá salió por debajo de tu estándar, con tu nombre en el contrato. Controlar a distancia cuesta.');
    }
  },
};
