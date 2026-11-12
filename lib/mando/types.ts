// MANDO — tipos del simulador. Todo el estado del juego es JSON serializable.

export type Area = 'cuentas' | 'creatividad' | 'produccion';
export type Rol = Area | 'comercial' | 'operaciones';
export type Motivador = 'dinero' | 'reconocimiento' | 'crecimiento' | 'equilibrio' | 'proposito';
export type Rasgo =
  | 'ambicioso'
  | 'perfeccionista'
  | 'leal'
  | 'reservado'
  | 'directo'
  | 'optimista'
  | 'ansioso'
  | 'mentor';
export type Genero = 'f' | 'm';

/** Ejes del perfil de liderazgo que se construye con cada decisión. */
export type Eje = 'personas' | 'resultados' | 'integridad' | 'vision' | 'audacia' | 'delegacion';

export type Tier = 'S' | 'M' | 'L' | 'XL';

export interface Persona {
  id: string;
  nombre: string;
  genero: Genero;
  rol: Rol;
  cargo: string;
  /** 1 a 10 */
  habilidad: number;
  /** Mensual, en soles */
  salario: number;
  salarioMercado: number;
  rasgo: Rasgo;
  motivador: Motivador;
  motivadorRevelado: boolean;
  /** 0 a 100 */
  animo: number;
  estres: number;
  energia: number;
  riesgoFuga: number;
  semanaIngreso: number;
  /** Semanas restantes de adaptación (rinde menos) */
  rampa: number;
  /** Semana de la última conversación 1:1 (0 = nunca) */
  ultima1a1: number;
  ultimoReconocimiento: number;
  ultimaCapacitacion: number;
  /** Semanas restantes fuera (licencia, día libre) */
  fuera: number;
  /** Hechos recientes que la persona recuerda, del más nuevo al más viejo */
  memoria: string[];
  /** Lo que está pensando esta semana */
  pensamiento: string;
  lider: boolean;
  /** Mensajes del 1:1 de esta partida */
  chat: MensajeChat[];
}

export interface MensajeChat {
  de: 'ceo' | 'persona';
  texto: string;
  semana: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  rubro: string;
  /** 1 tranquilo, 2 exigente, 3 muy exigente */
  exigencia: number;
  /** Semanas que tarda en pagar una factura */
  plazoPago: number;
  /** 0 a 100 */
  satisfaccion: number;
  entregas: number;
  activo: boolean;
}

export interface Proyecto {
  id: string;
  clienteId: string;
  nombre: string;
  tipo: 'proyecto' | 'fee';
  tier: Tier;
  /** Proyecto: monto total. Fee: monto mensual (cada 4 semanas). */
  presupuesto: number;
  /** Fracción del presupuesto que se va en proveedores */
  costoTerceros: number;
  /** Puntos de trabajo por semana que exige a cada área */
  demanda: Record<Area, number>;
  duracion: number;
  semanaInicio: number;
  /** Semana límite de entrega (solo proyectos) */
  semanaLimite: number;
  /** Semanas-equivalentes de trabajo completadas */
  avance: number;
  /** Suma de calidad semanal y semanas contadas */
  calidadSuma: number;
  calidadSemanas: number;
  /** Ajuste puntual de calidad por decisiones */
  ajusteCalidad: number;
  estado: 'activo' | 'entregado' | 'cancelado';
}

export interface Factura {
  id: string;
  clienteId: string;
  concepto: string;
  monto: number;
  semanaEmision: number;
  semanaCobro: number;
  /** Veces que el cliente ya atrasó el pago */
  demoras?: number;
  /** Ya la apuraste una vez */
  apurada?: boolean;
}

export interface Oportunidad {
  id: string;
  clienteId: string;
  clienteNombre: string;
  clienteNuevo: boolean;
  rubro: string;
  nombre: string;
  tipo: 'proyecto' | 'fee';
  tier: Tier;
  presupuesto: number;
  costoTerceros: number;
  demanda: Record<Area, number>;
  duracion: number;
  plazoPago: number;
  exigencia: number;
  /** Semana en la que desaparece si no respondes */
  expira: number;
  /** true = encargo directo de un cliente contento: no hay que competir */
  directo: boolean;
}

export interface Candidato {
  id: string;
  nombre: string;
  genero: Genero;
  rol: Rol;
  cargo: string;
  habilidad: number;
  salario: number;
  salarioMercado: number;
  rasgo: Rasgo;
  motivador: Motivador;
}

export interface SituacionActiva {
  uid: string;
  id: string;
  personaId?: string;
  persona2Id?: string;
  clienteId?: string;
  proyectoId?: string;
  facturaId?: string;
  /** Texto ya renderizado al aparecer */
  texto: string;
  resuelta?: { opcion: number; resultado: string };
}

export interface Diferido {
  semana: number;
  clave: string;
  datos: Record<string, string | number | boolean>;
}

export interface Noticia {
  semana: number;
  tipo: 'bueno' | 'malo' | 'neutro';
  texto: string;
}

export interface PuntoHistorial {
  semana: number;
  caja: number;
  valor: number;
  reputacion: number;
  animo: number;
  personas: number;
}

export interface Flujo {
  cobros: number;
  nomina: number;
  fijos: number;
  terceros: number;
  otros: number;
}

export interface ResumenSemana {
  semana: number;
  flujo: Flujo;
  cajaAntes: number;
  cajaDespues: number;
  valorAntes: number;
  valorDespues: number;
  reputacionAntes: number;
  reputacionDespues: number;
  animoAntes: number;
  animoDespues: number;
  noticias: Noticia[];
  logrosNuevos: string[];
  etapaNueva: number | null;
  racha: number;
}

export interface Stats {
  facturado: number;
  entregas: number;
  entregasTarde: number;
  renuncias: number;
  despidos: number;
  pitchesGanados: number;
  pitchesPerdidos: number;
  contrataciones: number;
  unoAUno: number;
  mejorCalidad: number;
  semanasEnRojo: number;
}

export interface DecisionTomada {
  semana: number;
  situacion: string;
  titulo: string;
  opcion: string;
}

export type MotivoFin = 'tiempo' | 'quiebra' | 'sin_equipo' | 'venta';

export interface Juego {
  version: number;
  semilla: string;
  modo: 'sprint' | 'anual' | 'reto';
  semanasMax: number;
  semana: number;
  empresa: string;
  ceo: string;
  rngEstado: number;
  contador: number;

  caja: number;
  deuda: number;
  reputacion: number;
  /** Fracción de la empresa que sigue siendo tuya (0 a 1) */
  participacion: number;
  etapa: number;

  foco: number;
  focoMax: number;
  estresCeo: number;
  /** Semanas que te quedan fuera por agotamiento */
  ceoFuera: number;

  procesos: number;
  oficina: number;
  mejoras: string[];

  personas: Persona[];
  clientes: Cliente[];
  proyectos: Proyecto[];
  facturas: Factura[];
  oportunidades: Oportunidad[];
  candidatos: Candidato[];
  candidatosRol: Rol | null;

  freelances: Record<Area, number>;
  ceoApoyo: Area | null;
  /** Leads extra que llegarán la próxima semana por prospección */
  prospeccion: number;

  situaciones: SituacionActiva[];
  situacionesVistas: string[];
  colaSituaciones: Omit<SituacionActiva, 'uid' | 'texto'>[];
  diferidos: Diferido[];
  noticias: Noticia[];
  historial: PuntoHistorial[];
  facturadoSemanal: number[];
  flujo: Flujo;

  estilo: Record<Eje, number>;
  decisiones: DecisionTomada[];
  logros: string[];
  racha: number;
  mejorRacha: number;
  stats: Stats;
  banderas: Record<string, number>;

  resumen: ResumenSemana | null;
  fin: { motivo: MotivoFin; semana: number } | null;
}

// ---------------------------------------------------------------------------
// Situaciones (definiciones con lógica; no se serializan, se buscan por id)
// ---------------------------------------------------------------------------

export interface Ctx {
  g: Juego;
  p?: Persona;
  p2?: Persona;
  c?: Cliente;
  proy?: Proyecto;
  f?: Factura;
  /** Aleatorio determinista 0..1 */
  rnd: () => number;
}

export type Sujetos = Partial<Pick<Ctx, 'p' | 'p2' | 'c' | 'proy' | 'f'>>;

export type Categoria =
  | 'personas'
  | 'clientes'
  | 'finanzas'
  | 'operaciones'
  | 'etica'
  | 'estrategia'
  | 'crisis';

export interface OpcionDef {
  texto: string;
  /** Pista corta de lo que implica (costo visible, riesgo) */
  detalle?: string;
  estilo: Partial<Record<Eje, number>>;
  /** Devuelve el motivo si la opción no está disponible */
  bloqueo?: (x: Ctx) => string | null;
  /** Aplica los efectos y devuelve el relato de lo que pasó */
  aplicar: (x: Ctx) => string;
}

export interface SituacionDef {
  id: string;
  titulo: string;
  categoria: Categoria;
  /** Etapas en las que puede aparecer [mín, máx] */
  etapas: [number, number];
  /** Peso relativo en el sorteo (por defecto 1) */
  peso?: number;
  /** Si puede repetirse en la misma partida (por defecto no) */
  repetible?: boolean;
  /** Devuelve los sujetos de la situación, o null si no aplica ahora */
  elegir?: (g: Juego, rnd: () => number) => Sujetos | null;
  texto: (x: Ctx) => string;
  opciones: OpcionDef[];
  /** Lo que un buen líder considera en esta situación */
  leccion: string;
}

export type ManejadorDiferido = (
  g: Juego,
  datos: Record<string, string | number | boolean>,
  rnd: () => number,
) => void;
