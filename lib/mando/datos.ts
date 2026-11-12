import type { Area, Eje, Genero, Motivador, Rasgo, Rol, Tier } from './types';

export const AREAS: Area[] = ['cuentas', 'creatividad', 'produccion'];
export const ROLES: Rol[] = ['cuentas', 'creatividad', 'produccion', 'comercial', 'operaciones'];

export const ROL_INFO: Record<Rol, { nombre: string; aporta: string; cargos: [[string, string], [string, string], [string, string]] }> = {
  cuentas: {
    nombre: 'Cuentas',
    aporta: 'Atiende a los clientes y cuida cada relación.',
    cargos: [['Asistente de cuentas', 'Asistente de cuentas'], ['Ejecutivo de cuentas', 'Ejecutiva de cuentas'], ['Director de cuentas', 'Directora de cuentas']],
  },
  creatividad: {
    nombre: 'Creatividad',
    aporta: 'Idea y diseña. Sube la calidad y las chances de ganar un pitch.',
    cargos: [['Diseñador junior', 'Diseñadora junior'], ['Creativo', 'Creativa'], ['Director creativo', 'Directora creativa']],
  },
  produccion: {
    nombre: 'Producción',
    aporta: 'Monta, coordina proveedores y saca el evento a tiempo.',
    cargos: [['Asistente de producción', 'Asistente de producción'], ['Productor', 'Productora'], ['Jefe de producción', 'Jefa de producción']],
  },
  comercial: {
    nombre: 'Comercial',
    aporta: 'Trae oportunidades nuevas cada semana.',
    cargos: [['Ejecutivo comercial', 'Ejecutiva comercial'], ['Ejecutivo comercial senior', 'Ejecutiva comercial senior'], ['Director comercial', 'Directora comercial']],
  },
  operaciones: {
    nombre: 'Operaciones',
    aporta: 'Ordena finanzas y procesos. Con nivel alto te devuelve foco.',
    cargos: [['Asistente administrativo', 'Asistente administrativa'], ['Coordinador de operaciones', 'Coordinadora de operaciones'], ['Gerente de operaciones', 'Gerente de operaciones']],
  },
};

export const NOMBRES: { n: string; g: Genero }[] = [
  { n: 'Valeria', g: 'f' }, { n: 'Camila', g: 'f' }, { n: 'Lucía', g: 'f' }, { n: 'Andrea', g: 'f' },
  { n: 'Daniela', g: 'f' }, { n: 'Fernanda', g: 'f' }, { n: 'Gabriela', g: 'f' }, { n: 'Mariana', g: 'f' },
  { n: 'Paola', g: 'f' }, { n: 'Renata', g: 'f' }, { n: 'Ximena', g: 'f' }, { n: 'Carla', g: 'f' },
  { n: 'Milagros', g: 'f' }, { n: 'Rocío', g: 'f' }, { n: 'Alejandra', g: 'f' }, { n: 'Natalia', g: 'f' },
  { n: 'Claudia', g: 'f' }, { n: 'Sofía', g: 'f' }, { n: 'Elena', g: 'f' }, { n: 'Pilar', g: 'f' },
  { n: 'Diego', g: 'm' }, { n: 'Sebastián', g: 'm' }, { n: 'Mateo', g: 'm' }, { n: 'Rodrigo', g: 'm' },
  { n: 'Álvaro', g: 'm' }, { n: 'Bruno', g: 'm' }, { n: 'Gonzalo', g: 'm' }, { n: 'Renzo', g: 'm' },
  { n: 'Joaquín', g: 'm' }, { n: 'Martín', g: 'm' }, { n: 'Nicolás', g: 'm' }, { n: 'Piero', g: 'm' },
  { n: 'Franco', g: 'm' }, { n: 'Javier', g: 'm' }, { n: 'Luis', g: 'm' }, { n: 'Óscar', g: 'm' },
  { n: 'Iván', g: 'm' }, { n: 'Tomás', g: 'm' }, { n: 'Emilio', g: 'm' }, { n: 'Raúl', g: 'm' },
];

export const APELLIDOS = [
  'Quispe', 'Rojas', 'Mendoza', 'Salazar', 'Vargas', 'Castillo', 'Paredes', 'Huamán', 'Córdova', 'Aguirre',
  'Benavides', 'Tapia', 'Zegarra', 'Montoya', 'Carrasco', 'Villanueva', 'Espinoza', 'Lozano', 'Arce', 'Palacios',
  'Chávez', 'Navarro', 'Cáceres', 'Bustamante', 'Solís', 'Guevara', 'Medina', 'Ortiz', 'Peña', 'Ríos',
];

export const CLIENTES_BASE: { nombre: string; rubro: string }[] = [
  { nombre: 'Andina Móvil', rubro: 'Telecomunicaciones' },
  { nombre: 'Cervecería Altura', rubro: 'Bebidas' },
  { nombre: 'Banco Litoral', rubro: 'Banca' },
  { nombre: 'Motores Kuntur', rubro: 'Automotriz' },
  { nombre: 'Lácteos Valle Verde', rubro: 'Consumo masivo' },
  { nombre: 'Snacks Qhali', rubro: 'Consumo masivo' },
  { nombre: 'Seguros Horizonte', rubro: 'Seguros' },
  { nombre: 'Tiendas Mercurio', rubro: 'Retail' },
  { nombre: 'Bebidas Chaski', rubro: 'Bebidas' },
  { nombre: 'Farmacias Vitalia', rubro: 'Salud' },
  { nombre: 'Aerolínea Albatros', rubro: 'Turismo' },
  { nombre: 'Cosmética Qori', rubro: 'Belleza' },
  { nombre: 'Pagos Tinku', rubro: 'Fintech' },
  { nombre: 'Cementos Roca Sur', rubro: 'Construcción' },
  { nombre: 'Instituto Avanza', rubro: 'Educación' },
  { nombre: 'Helados Glaciar', rubro: 'Consumo masivo' },
  { nombre: 'Energía Solara', rubro: 'Energía' },
  { nombre: 'Café Apu', rubro: 'Alimentos' },
  { nombre: 'Clínica Santa Aurora', rubro: 'Salud' },
  { nombre: 'Textiles Wayra', rubro: 'Moda' },
  { nombre: 'Minera Cumbre Alta', rubro: 'Minería' },
  { nombre: 'Supermercados La Canasta', rubro: 'Retail' },
  { nombre: 'Hoteles Mirador', rubro: 'Turismo' },
  { nombre: 'Pinturas Arcoíris', rubro: 'Construcción' },
  { nombre: 'Agua Nevada', rubro: 'Bebidas' },
  { nombre: 'Inmobiliaria Los Olivares', rubro: 'Inmobiliario' },
  { nombre: 'Gimnasios Pulso', rubro: 'Bienestar' },
  { nombre: 'Editorial Tinta Sur', rubro: 'Educación' },
  { nombre: 'Logística Ruta Uno', rubro: 'Logística' },
  { nombre: 'Chocolates Tambo', rubro: 'Alimentos' },
];

export const NOMBRES_PROYECTO: Record<Tier, string[]> = {
  S: ['Sampling en universidades', 'Activación en punto de venta', 'Stand para feria local', 'Desayuno con prensa', 'Módulo de experiencia de marca'],
  M: ['Lanzamiento de producto', 'Activación en centros comerciales', 'Evento para distribuidores', 'Pop-up de marca', 'Fiesta de fin de año'],
  L: ['Convención anual de ventas', 'Gira en cinco ciudades', 'Experiencia de marca en festival', 'Lanzamiento nacional', 'Road show regional'],
  XL: ['Plataforma de experiencias del año', 'Festival propio de la marca', 'Convención regional con tres países', 'Lanzamiento de la nueva identidad'],
};

export const NOMBRES_FEE: Record<Tier, string> = {
  S: 'Fee mensual de activaciones',
  M: 'Fee mensual de trade y eventos',
  L: 'Fee mensual de brand experience',
  XL: 'Cuenta integral de experiencias',
};

export interface TierInfo {
  demanda: Record<Area, number>;
  duracion: number;
  presupuesto: [number, number];
  /** Reputación desde la que te empiezan a considerar */
  repMin: number;
  /** Cuánto pesa una entrega en la reputación */
  peso: number;
}

export const TIERS: Record<Tier, TierInfo> = {
  S: { demanda: { cuentas: 0.25, creatividad: 0.45, produccion: 0.45 }, duracion: 3, presupuesto: [18000, 30000], repMin: 0, peso: 0.6 },
  M: { demanda: { cuentas: 0.5, creatividad: 0.9, produccion: 1.0 }, duracion: 4, presupuesto: [52000, 88000], repMin: 20, peso: 1 },
  L: { demanda: { cuentas: 0.9, creatividad: 1.6, produccion: 2.0 }, duracion: 6, presupuesto: [140000, 230000], repMin: 40, peso: 1.6 },
  XL: { demanda: { cuentas: 1.5, creatividad: 2.6, produccion: 3.5 }, duracion: 8, presupuesto: [350000, 550000], repMin: 60, peso: 2.4 },
};

export const TIERS_FEE: Record<Tier, { demanda: Record<Area, number>; presupuesto: [number, number] }> = {
  S: { demanda: { cuentas: 0.3, creatividad: 0.4, produccion: 0.2 }, presupuesto: [13000, 20000] },
  M: { demanda: { cuentas: 0.6, creatividad: 0.8, produccion: 0.5 }, presupuesto: [28000, 42000] },
  L: { demanda: { cuentas: 1.1, creatividad: 1.5, produccion: 1.0 }, presupuesto: [56000, 84000] },
  XL: { demanda: { cuentas: 2.0, creatividad: 2.6, produccion: 1.8 }, presupuesto: [110000, 165000] },
};

export const TIER_NOMBRE: Record<Tier, string> = { S: 'Chico', M: 'Mediano', L: 'Grande', XL: 'Gigante' };

export const OFICINAS = [
  { nombre: 'Garaje', cupo: 4, costoSemanal: 300, precio: 0 },
  { nombre: 'Coworking', cupo: 9, costoSemanal: 1100, precio: 6000 },
  { nombre: 'Oficina propia', cupo: 18, costoSemanal: 3200, precio: 22000 },
  { nombre: 'Piso corporativo', cupo: 32, costoSemanal: 7500, precio: 60000 },
  { nombre: 'Sede', cupo: 60, costoSemanal: 14000, precio: 140000 },
];

export const COSTO_PROCESOS = [7000, 14000, 26000, 45000, 70000];

export interface MejoraInfo {
  id: string;
  nombre: string;
  precio: number;
  efecto: string;
  etapa: number;
}

export const MEJORAS: MejoraInfo[] = [
  { id: 'crm', nombre: 'Cobranza ordenada', precio: 9000, efecto: 'Las facturas nuevas se cobran una semana antes y llegan más oportunidades.', etapa: 1 },
  { id: 'pulso', nombre: 'Pulso de clima', precio: 8000, efecto: 'Ves el riesgo de fuga de todo el equipo sin necesidad de un 1:1 reciente.', etapa: 2 },
  { id: 'bienestar', nombre: 'Programa de bienestar', precio: 12000, efecto: 'El equipo recupera energía más rápido y acumula menos estrés.', etapa: 2 },
  { id: 'carrera', nombre: 'Plan de carrera', precio: 14000, efecto: 'Baja el riesgo de fuga y quienes buscan crecer se quedan más contentos.', etapa: 2 },
  { id: 'casos', nombre: 'Casos y premios', precio: 18000, efecto: 'Documentas tu trabajo: +6 de reputación y deja de desgastarse sola.', etapa: 2 },
  { id: 'legal', nombre: 'Contratos y seguros', precio: 10000, efecto: 'Amortigua el golpe de accidentes, impagos y disputas.', etapa: 3 },
];

export interface EtapaInfo {
  n: number;
  nombre: string;
  lema: string;
  personas: number;
  reputacion: number;
  /** Facturación de las últimas 12 semanas */
  facturado12: number;
  fees: number;
}

export const ETAPAS: EtapaInfo[] = [
  { n: 1, nombre: 'Garaje', lema: 'Vendes, produces y cobras. Todo pasa por ti.', personas: 0, reputacion: 0, facturado12: 0, fees: 0 },
  { n: 2, nombre: 'Boutique', lema: 'Ya hay equipo. Ahora tu trabajo es que funcione sin ti en cada detalle.', personas: 5, reputacion: 25, facturado12: 130000, fees: 0 },
  { n: 3, nombre: 'Agencia', lema: 'Áreas, líderes y procesos. Creces o te desordenas.', personas: 9, reputacion: 42, facturado12: 380000, fees: 1 },
  { n: 4, nombre: 'Casa consolidada', lema: 'Las decisiones ya no son tuyas solamente. Lideras líderes.', personas: 15, reputacion: 58, facturado12: 850000, fees: 2 },
  { n: 5, nombre: 'Referente regional', lema: 'La industria te mira. Lo que hagas define el estándar.', personas: 22, reputacion: 72, facturado12: 1600000, fees: 3 },
];

export const LOGROS: Record<string, { nombre: string; desc: string }> = {
  primera_venta: { nombre: 'Primera venta', desc: 'Ganaste tu primer proyecto.' },
  primer_fee: { nombre: 'Ingreso recurrente', desc: 'Firmaste tu primer fee mensual.' },
  primera_entrega: { nombre: 'Se entregó', desc: 'Entregaste tu primer proyecto.' },
  calidad_alta: { nombre: 'Ovación', desc: 'Una entrega con calidad de 90 o más.' },
  racha_5: { nombre: 'Racha de 5', desc: 'Cinco entregas seguidas a tiempo.' },
  racha_10: { nombre: 'Reloj suizo', desc: 'Diez entregas seguidas a tiempo.' },
  equipo_10: { nombre: 'Ya somos diez', desc: 'Un equipo de diez personas.' },
  equipo_20: { nombre: 'Veinte y contando', desc: 'Un equipo de veinte personas.' },
  escucha: { nombre: 'Puerta abierta', desc: 'Diez conversaciones 1:1 con tu equipo.' },
  cero_fugas: { nombre: 'Nadie se quiere ir', desc: 'Veinte semanas seguidas sin renuncias, con seis o más personas.' },
  caja_300k: { nombre: 'Colchón', desc: 'S/ 300 mil en caja.' },
  valor_1m: { nombre: 'El primer millón', desc: 'La empresa vale S/ 1 millón.' },
  valor_5m: { nombre: 'Cinco millones', desc: 'La empresa vale S/ 5 millones.' },
  rep_70: { nombre: 'Te recomiendan', desc: 'Reputación de 70 o más.' },
  etapa_2: { nombre: 'Boutique', desc: 'Saliste del garaje.' },
  etapa_3: { nombre: 'Agencia', desc: 'Llegaste a la etapa de agencia.' },
  etapa_4: { nombre: 'Casa consolidada', desc: 'Lideras líderes.' },
  etapa_5: { nombre: 'Referente regional', desc: 'Completaste todas las etapas.' },
};

export const RASGO_INFO: Record<Rasgo, string> = {
  ambicioso: 'Ambición alta',
  perfeccionista: 'Perfeccionista',
  leal: 'Leal',
  reservado: 'Reservado',
  directo: 'Sin filtro',
  optimista: 'Optimista',
  ansioso: 'Se preocupa fácil',
  mentor: 'Enseña a otros',
};

export const MOTIVADOR_INFO: Record<Motivador, { nombre: string; pista: string }> = {
  dinero: { nombre: 'Estabilidad económica', pista: 'Responde a aumentos y bonos. Un sueldo bajo mercado le pesa el doble.' },
  reconocimiento: { nombre: 'Reconocimiento', pista: 'Necesita que su trabajo se vea. Reconócelo en público con frecuencia.' },
  crecimiento: { nombre: 'Crecimiento', pista: 'Quiere aprender y subir. Capacítalo y dale retos o se aburre.' },
  equilibrio: { nombre: 'Equilibrio de vida', pista: 'Las semanas de sobrecarga le cuestan más que a nadie. Cuida su carga.' },
  proposito: { nombre: 'Propósito', pista: 'Le importa hacer trabajo del que sentirse orgulloso y una empresa íntegra.' },
};

export const EJE_INFO: Record<Eje, { nombre: string; desc: string }> = {
  personas: { nombre: 'Personas', desc: 'Cuidas a tu gente y decides pensando en ella.' },
  resultados: { nombre: 'Resultados', desc: 'Proteges el negocio, el margen y la entrega.' },
  integridad: { nombre: 'Integridad', desc: 'Haces lo correcto aunque cueste.' },
  vision: { nombre: 'Visión', desc: 'Eliges el largo plazo sobre el alivio inmediato.' },
  audacia: { nombre: 'Audacia', desc: 'Tomas riesgos cuando el premio lo vale.' },
  delegacion: { nombre: 'Delegación', desc: 'Sueltas el control y haces crecer a otros.' },
};

export const RANGOS: { letra: string; titulo: string; min: number }[] = [
  { letra: 'S', titulo: 'Leyenda de la industria', min: 5000000 },
  { letra: 'A', titulo: 'CEO de referencia', min: 2500000 },
  { letra: 'B', titulo: 'Empresa sólida', min: 1000000 },
  { letra: 'C', titulo: 'Negocio en pie', min: 350000 },
  { letra: 'D', titulo: 'Sobreviviente', min: 1 },
  { letra: 'E', titulo: 'Lección cara', min: -Infinity },
];
