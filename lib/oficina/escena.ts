// Escena 3D de la oficina en three.js: construye el piso, los muebles y las personas,
// maneja la cámara estilo estrategia en tiempo real y traduce el mouse en selección y órdenes.
import * as THREE from 'three';
import { ALTO, ANCHO, type Estacion } from './mapa';
import type { Agente, Sim } from './sim';

export type Objetivo =
  | { tipo: 'suelo'; x: number; z: number }
  | { tipo: 'estacion'; id: string }
  | { tipo: 'agente'; id: string };

export interface Manejadores {
  seleccionar(ids: string[], agregar: boolean): void;
  /** Devuelve true si la orden se dio. Con `soloSiAplica`, no convierte el toque sobre una persona en "moverse". */
  ordenar(o: Objetivo, soloSiAplica?: boolean): boolean;
  comprarEscritorio(): void;
  haySeleccion(): boolean;
}

const COLOR = {
  fondo: 0x0c0420,
  muro: 0x2a1f5c,
  muroTapa: 0x4a3a9a,
  madera: 0xd8b48a,
  metal: 0x23202e,
  purpura: 0x4b15eb,
  lavanda: 0x8466f4,
  blanco: 0xf3f1fa,
  hoja: 0x2f9e6b,
  hoja2: 0x46c486,
  ok: 0x3dd6a0,
  alerta: 0xf5a742,
  mal: 0xff5a5a,
  oro: 0xffd166,
};
const PIEL = [0xf2c9a5, 0xe0ac84, 0xc68e63, 0xa5714b, 0x8a5a3a];
const PELO = [0x1c1818, 0x3b2a20, 0x6b4a2e, 0xa8743a, 0x2a2a35];
const CAMISA: Record<string, number> = { cuentas: 0x38bdf8, creatividad: 0xf472b6, produccion: 0xf5a742, ceo: 0x4b15eb };

interface Figura {
  raiz: THREE.Group;
  cuerpo: THREE.Group;
  piernas: [THREE.Group, THREE.Group];
  brazos: [THREE.Group, THREE.Group];
  cabeza: THREE.Mesh;
  rombo: THREE.Mesh;
  anillo: THREE.Mesh;
  golpe: THREE.Mesh;
  fase: number;
  burbuja: HTMLDivElement | null;
  etiqueta: HTMLDivElement | null;
}

interface Flotante {
  el: HTMLDivElement;
  x: number;
  z: number;
  t: number;
}

/** Los colores se escriben en sRGB; three r128 los espera en lineal cuando la salida es sRGB. */
const L = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: L(color), roughness: 0.85, metalness: 0.02, ...extra });
const LIN = { ok: L(COLOR.ok), alerta: L(COLOR.alerta), mal: L(COLOR.mal), oro: L(COLOR.oro) };

export class Escena {
  readonly renderer: THREE.WebGLRenderer;
  readonly escena = new THREE.Scene();
  readonly camara = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
  private readonly rayo = new THREE.Raycaster();
  private readonly figuras = new Map<string, Figura>();
  private readonly golpes: THREE.Object3D[] = [];
  private readonly golpesEstacion: THREE.Object3D[] = [];
  private readonly mesas = new Map<string, { real: THREE.Group; fantasma: THREE.Group; pantalla: THREE.MeshStandardMaterial; activo: boolean }>();
  private readonly marcas: { malla: THREE.Mesh; t: number }[] = [];
  private flotantes: Flotante[] = [];
  private readonly cajaSel: HTMLDivElement;
  private readonly suelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private ancho = 1;
  private alto = 1;
  private tiempo = 0;

  // Cámara: un punto en el suelo, una distancia y un giro. La inclinación depende del zoom.
  private cam = { x: 15.5, z: 12.8, dist: 31, giro: 0 };
  private meta = { x: 15.5, z: 12.8, dist: 31, giro: 0 };
  private readonly teclas = new Set<string>();
  bordes = false;
  private puntero = { x: -1, y: -1, dentro: false };
  private readonly punteros = new Map<number, { x: number; y: number }>();
  private arrastre: null | { tipo: 'caja' | 'pan' | 'pellizco'; x0: number; y0: number; boton: number; movido: boolean; gx: number; gz: number; d0: number; dist0: number; tactil: boolean } = null;
  private ultimoClic = { t: 0, id: '' };
  sobre: string | null = null;
  private limpiar: (() => void)[] = [];

  constructor(
    private readonly lienzo: HTMLCanvasElement,
    private readonly capa: HTMLDivElement,
    sim: Sim,
    private readonly manejar: Manejadores,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.escena.background = new THREE.Color(COLOR.fondo);
    this.escena.fog = new THREE.Fog(COLOR.fondo, 70, 150);
    this.escena.fog.color.convertSRGBToLinear();

    this.cajaSel = document.createElement('div');
    this.cajaSel.className = 'of-caja-sel';
    this.cajaSel.hidden = true;
    capa.appendChild(this.cajaSel);

    this.luces();
    this.piso();
    this.construir(sim);
    this.entradas();
    this.redimensionar();
    if (this.ancho < 700) {
      this.cam.x = this.meta.x = 9;
      this.cam.z = this.meta.z = 12.5;
      this.cam.dist = this.meta.dist = 30;
    }
  }

  // ------------------------------ construcción ------------------------------

  private luces(): void {
    this.escena.add(new THREE.HemisphereLight(0xe4deff, 0x2a1f5c, 0.95));
    this.escena.add(new THREE.AmbientLight(0xffffff, 0.32));
    const sol = new THREE.DirectionalLight(0xfff1e0, 1.25);
    sol.position.set(ANCHO / 2 - 12, 34, ALTO / 2 + 20);
    sol.target.position.set(ANCHO / 2, 0, ALTO / 2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const c = sol.shadow.camera;
    c.left = -26;
    c.right = 26;
    c.top = 22;
    c.bottom = -22;
    c.near = 1;
    c.far = 90;
    sol.shadow.bias = -0.0006;
    sol.shadow.radius = 3;
    this.escena.add(sol, sol.target);
  }

  private caja(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, padre: THREE.Object3D = this.escena, sombra = true): THREE.Mesh {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    malla.position.set(x, y, z);
    malla.castShadow = sombra;
    malla.receiveShadow = true;
    padre.add(malla);
    return malla;
  }

  private piso(): void {
    const px = 32;
    const cv = document.createElement('canvas');
    cv.width = ANCHO * px;
    cv.height = ALTO * px;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#aea7cc';
    g.fillRect(0, 0, cv.width, cv.height);
    const zona = (x: number, z: number, w: number, d: number, color: string) => {
      g.fillStyle = color;
      g.fillRect(x * px, z * px, w * px, d * px);
    };
    zona(1, 1, 9, 7, '#4a3a9a'); // sala de reuniones
    zona(24, 1, 9, 7, '#352a78'); // despacho
    for (let z = 16; z < 23; z++) for (let x = 1; x < 9; x++) zona(x, z, 1, 1, (x + z) % 2 ? '#cfc9e6' : '#9d95c4'); // cocina
    g.fillStyle = '#8672dc';
    g.beginPath();
    g.ellipse(28.5 * px, 19 * px, 3.6 * px, 2.9 * px, 0, 0, Math.PI * 2);
    g.fill(); // alfombra del descanso
    zona(15.5, 21.6, 3, 1.4, '#4b15eb'); // felpudo de la entrada
    g.strokeStyle = 'rgba(30, 14, 90, 0.16)';
    g.lineWidth = 1;
    for (let x = 0; x <= ANCHO; x++) {
      g.beginPath();
      g.moveTo(x * px, 0);
      g.lineTo(x * px, cv.height);
      g.stroke();
    }
    for (let z = 0; z <= ALTO; z++) {
      g.beginPath();
      g.moveTo(0, z * px);
      g.lineTo(cv.width, z * px);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO, ALTO), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(ANCHO / 2, 0, ALTO / 2);
    piso.receiveShadow = true;
    this.escena.add(piso);

    const exterior = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x0e0628, { roughness: 1 }));
    exterior.rotation.x = -Math.PI / 2;
    exterior.position.set(ANCHO / 2, -0.03, ALTO / 2);
    exterior.receiveShadow = true;
    this.escena.add(exterior);
    const grilla = new THREE.GridHelper(400, 200, 0x2a1f5c, 0x1a1238);
    grilla.position.set(ANCHO / 2, -0.015, ALTO / 2);
    this.escena.add(grilla);
    // Vereda de la entrada.
    const vereda = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.5), mat(0x2a1f5c, { roughness: 1 }));
    vereda.rotation.x = -Math.PI / 2;
    vereda.position.set(17, -0.005, ALTO + 2.2);
    vereda.receiveShadow = true;
    this.escena.add(vereda);
  }

  private construir(sim: Sim): void {
    const mMuro = mat(COLOR.muro);
    const mTapa = mat(COLOR.muroTapa);
    const mVidrio = new THREE.MeshStandardMaterial({ color: L(COLOR.lavanda), transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, depthWrite: false });
    for (const m of sim.mapa.muros) {
      const cx = m.x + m.ancho / 2;
      const cz = m.z + m.fondo / 2;
      if (m.vidrio) {
        const w = m.ancho > m.fondo ? m.ancho : 0.12;
        const d = m.ancho > m.fondo ? 0.12 : m.fondo;
        this.caja(w, 1.9, d, mVidrio, cx, 0.95, cz, this.escena, false);
        this.caja(w, 0.08, d + 0.06, mTapa, cx, 1.92, cz);
        this.caja(w, 0.1, d + 0.06, mTapa, cx, 0.05, cz, this.escena, false);
      } else {
        this.caja(m.ancho, 1.25, m.fondo, mMuro, cx, 0.625, cz);
        this.caja(m.ancho, 0.07, m.fondo, mTapa, cx, 1.285, cz, this.escena, false);
      }
    }
    // Marco de la puerta y pantalla de proyectos en la pared del fondo.
    this.caja(0.2, 2.2, 0.5, mTapa, 15.95, 1.1, ALTO - 0.5);
    this.caja(0.2, 2.2, 0.5, mTapa, 18.05, 1.1, ALTO - 0.5);
    this.caja(2.3, 0.2, 0.5, mTapa, 17, 2.2, ALTO - 0.5);
    this.caja(7.4, 1.9, 0.12, mat(COLOR.metal), 17, 1.6, 1.02);
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#1b0f45';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#8466f4';
    g.font = '900 78px "Zalando Sans Expanded", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('MANDO', 256, 68);
    const texto = new THREE.CanvasTexture(cv);
    texto.encoding = THREE.sRGBEncoding;
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.6), new THREE.MeshBasicMaterial({ map: texto }));
    pantalla.position.set(17, 1.6, 1.09);
    this.escena.add(pantalla);

    for (const p of sim.mapa.plantas) this.planta(p.x, p.z);
    for (const e of sim.mapa.estaciones) {
      if (e.tipo === 'escritorio') this.mesa(e);
      else if (e.tipo === 'despacho') this.despacho(e);
      else if (e.tipo === 'reunion') this.salaReunion(e);
      else if (e.tipo === 'cafe') this.cocina(e);
      else if (e.tipo === 'sofa') this.descanso(e);
    }
  }

  private planta(x: number, z: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.42, 14), mat(COLOR.blanco));
    maceta.position.y = 0.21;
    maceta.castShadow = true;
    g.add(maceta);
    const hojas: [number, number, number, number][] = [[0, 0.82, 0, 0.36], [0.18, 1.08, 0.08, 0.26], [-0.16, 1.02, -0.1, 0.24], [0.02, 1.3, -0.02, 0.2]];
    hojas.forEach(([hx, hy, hz, r], i) => {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(i % 2 ? COLOR.hoja2 : COLOR.hoja, { flatShading: true }));
      h.position.set(hx, hy, hz);
      h.castShadow = true;
      g.add(h);
    });
    this.escena.add(g);
  }

  private silla(padre: THREE.Object3D, x: number, z: number, rot: number, color = COLOR.purpura): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const oscuro = mat(COLOR.metal);
    this.caja(0.46, 0.07, 0.46, mat(color), 0, 0.43, 0, g);
    this.caja(0.46, 0.5, 0.07, mat(color), 0, 0.72, -0.23, g);
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), oscuro);
    pie.position.y = 0.2;
    g.add(pie);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 12), oscuro);
    base.position.y = 0.03;
    g.add(base);
    padre.add(g);
  }

  private zonaClic(id: string, x: number, z: number, w: number, d: number, h = 1.2): void {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    malla.position.set(x, h / 2, z);
    malla.userData.estacion = id;
    this.escena.add(malla);
    this.golpesEstacion.push(malla);
  }

  /** Un escritorio mirando hacia +z local: la mesa en el origen y la silla detrás. */
  private mesa(e: Estacion): void {
    const p = e.puestos[0];
    const haciaSilla = p.z > e.z ? 1 : -1;
    const real = new THREE.Group();
    real.position.set(e.x, 0, e.z);
    this.caja(1.8, 0.07, 0.82, mat(COLOR.madera, { roughness: 0.6 }), 0, 0.74, 0, real);
    const pata = mat(COLOR.metal);
    for (const sx of [-0.82, 0.82]) this.caja(0.06, 0.72, 0.7, pata, sx, 0.36, 0, real);
    this.caja(0.9, 0.5, 0.05, mat(0x15121f), 0, 1.16, -0.2 * haciaSilla, real);
    const pantalla = new THREE.MeshStandardMaterial({ color: L(0x1a1140), emissive: L(COLOR.lavanda), emissiveIntensity: 0.25 });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.42), pantalla);
    pm.position.set(0, 1.16, (-0.2 + 0.028) * haciaSilla);
    pm.rotation.y = haciaSilla > 0 ? 0 : Math.PI;
    real.add(pm);
    this.caja(0.08, 0.2, 0.08, pata, 0, 0.86, -0.2 * haciaSilla, real);
    this.caja(0.5, 0.025, 0.16, mat(0x2a2638), 0, 0.79, 0.14 * haciaSilla, real, false);
    this.caja(0.16, 0.14, 0.16, mat(COLOR.blanco), 0.62, 0.84, -0.12 * haciaSilla, real, false);
    this.silla(real, p.x - e.x, p.z - e.z, p.rot);

    const fantasma = new THREE.Group();
    fantasma.position.set(e.x, 0, e.z + 0.5 * haciaSilla);
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const g = cv.getContext('2d')!;
    g.strokeStyle = '#8466f4';
    g.lineWidth = 6;
    g.setLineDash([18, 12]);
    g.strokeRect(8, 8, 240, 240);
    g.fillStyle = 'rgba(132,102,244,.16)';
    g.fillRect(8, 8, 240, 240);
    g.fillStyle = '#b9a8ff';
    g.font = '600 120px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('+', 128, 122);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const base = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.02;
    fantasma.add(base);

    this.escena.add(real, fantasma);
    this.mesas.set(e.id, { real, fantasma, pantalla, activo: !e.activo });
    this.zonaClic(e.id, e.x, e.z + 0.5 * haciaSilla, 2, 2, 1.3);
  }

  private despacho(e: Estacion): void {
    const g = new THREE.Group();
    g.position.set(e.x, 0, e.z);
    this.caja(2.8, 0.09, 0.9, mat(0x3a2412, { roughness: 0.5 }), 0, 0.76, 0, g);
    this.caja(2.6, 0.74, 0.08, mat(0x2a1a0e), 0, 0.37, 0.36, g);
    for (const sx of [-1.3, 1.3]) this.caja(0.08, 0.74, 0.8, mat(0x2a1a0e), sx, 0.37, 0, g);
    this.caja(0.8, 0.46, 0.05, mat(0x15121f), 0.5, 1.14, 0.1, g);
    this.caja(0.4, 0.03, 0.3, mat(COLOR.blanco), -0.6, 0.82, 0, g, false);
    this.silla(g, e.puestos[0].x - e.x, e.puestos[0].z - e.z, 0, 0x15121f);
    this.escena.add(g);
    this.zonaClic(e.id, e.x, e.z - 0.4, 3.2, 2.2);
  }

  private salaReunion(e: Estacion): void {
    const g = new THREE.Group();
    g.position.set(e.x, 0, e.z);
    this.caja(4.6, 0.09, 2.5, mat(COLOR.blanco, { roughness: 0.4 }), 0, 0.76, 0, g);
    for (const sx of [-1.6, 1.6]) this.caja(0.5, 0.72, 1.4, mat(COLOR.metal), sx, 0.36, 0, g);
    this.escena.add(g);
    for (const p of e.puestos) this.silla(this.escena, p.x, p.z, p.rot, 0x23202e);
    this.zonaClic(e.id, e.x, e.z, 7, 5);
  }

  private cocina(e: Estacion): void {
    this.caja(0.95, 0.92, 5.9, mat(0x3a2c7a), 1.5, 0.46, 19);
    this.caja(1.02, 0.06, 6, mat(COLOR.blanco, { roughness: 0.3 }), 1.5, 0.95, 19);
    this.caja(0.5, 0.62, 0.6, mat(0x15121f, { roughness: 0.3, metalness: 0.4 }), 1.4, 1.29, 18.5);
    this.caja(0.06, 0.06, 0.2, new THREE.MeshStandardMaterial({ color: L(COLOR.alerta), emissive: L(COLOR.alerta), emissiveIntensity: 1.2 }), 1.67, 1.42, 18.5, this.escena, false);
    for (const z of [17.3, 17.6, 19.6]) {
      const taza = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.12, 10), mat(COLOR.blanco));
      taza.position.set(1.6, 1.04, z);
      this.escena.add(taza);
    }
    this.caja(0.9, 1.9, 0.9, mat(0xdcd8ea, { roughness: 0.3, metalness: 0.3 }), 1.5, 0.95, 21.5);
    // Mesa alta.
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20), mat(COLOR.blanco));
    mesa.position.set(5.5, 1.05, 19.5);
    mesa.castShadow = true;
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 1.02, 10), mat(COLOR.metal));
    pie.position.set(5.5, 0.51, 19.5);
    pie.castShadow = true;
    this.escena.add(mesa, pie);
    this.zonaClic(e.id, 2, 18.8, 2.4, 5.6, 1.6);
  }

  private descanso(e: Estacion): void {
    const tela = mat(COLOR.purpura);
    const cojin = mat(0x7b52f0);
    // Sofá contra la pared derecha.
    this.caja(0.95, 0.4, 4, tela, 32.5, 0.22, 18);
    this.caja(0.25, 0.85, 4, tela, 32.86, 0.45, 18);
    for (const z of [16.5, 17.5, 18.5, 19.5]) this.caja(0.7, 0.12, 0.9, cojin, 32.4, 0.47, z, this.escena, false);
    // Sofá contra la pared de abajo.
    this.caja(3, 0.4, 0.95, tela, 28.5, 0.22, 22.5);
    this.caja(3, 0.85, 0.25, tela, 28.5, 0.45, 22.86);
    for (const x of [27.5, 28.5, 29.5]) this.caja(0.9, 0.12, 0.7, cojin, x, 0.47, 22.4, this.escena, false);
    // Mesa baja.
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20), mat(COLOR.madera));
    mesa.position.set(30.5, 0.42, 20.5);
    mesa.castShadow = true;
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.4, 10), mat(COLOR.metal));
    pie.position.set(30.5, 0.2, 20.5);
    this.escena.add(mesa, pie);
    this.zonaClic(e.id, 32.2, 18, 1.8, 4.2);
    this.zonaClic(e.id, 28.5, 22.3, 3.2, 1.6);
  }

  // -------------------------------- personas --------------------------------

  private crearFigura(a: Agente): Figura {
    const raiz = new THREE.Group();
    const cuerpo = new THREE.Group();
    raiz.add(cuerpo);
    const camisa = mat(CAMISA[a.rol] ?? COLOR.lavanda, { roughness: 0.7 });
    const piel = mat(PIEL[a.aspecto.piel % PIEL.length], { roughness: 0.8 });
    const pantalon = mat(a.rol === 'ceo' ? 0x15121f : 0x2b2a45);
    const sombra = (m: THREE.Mesh) => {
      m.castShadow = true;
      return m;
    };
    const miembro = (x: number, y: number, largo: number, radio: number, m: THREE.Material, mano?: THREE.Material): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      const c = sombra(new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 0.9, largo, 8), m));
      c.position.y = -largo / 2;
      g.add(c);
      if (mano) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(radio * 1.15, 8, 6), mano);
        s.position.y = -largo - 0.02;
        g.add(s);
      }
      cuerpo.add(g);
      return g;
    };
    const piernas: [THREE.Group, THREE.Group] = [miembro(-0.1, 0.46, 0.46, 0.08, pantalon), miembro(0.1, 0.46, 0.46, 0.08, pantalon)];
    const torso = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.5, 12), camisa));
    torso.position.y = 0.7;
    cuerpo.add(torso);
    const hombros = new THREE.Mesh(new THREE.SphereGeometry(0.195, 12, 8), camisa);
    hombros.scale.y = 0.55;
    hombros.position.y = 0.95;
    cuerpo.add(hombros);
    if (a.rol === 'ceo') {
      const pecho = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.02), mat(COLOR.blanco));
      pecho.position.set(0, 0.76, 0.2);
      cuerpo.add(pecho);
    }
    const brazos: [THREE.Group, THREE.Group] = [miembro(-0.26, 0.93, 0.38, 0.06, camisa, piel), miembro(0.26, 0.93, 0.38, 0.06, camisa, piel)];
    const cabeza = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), piel));
    cabeza.position.y = 1.17;
    cuerpo.add(cabeza);
    // Ojos: dan una cara y dejan claro hacia dónde mira cada persona.
    const mOjo = mat(0x1a1420, { roughness: 0.4 });
    for (const ox of [-0.066, 0.066]) {
      const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), mOjo);
      ojo.position.set(ox, 0.015, 0.166);
      cabeza.add(ojo);
    }
    const mPelo = mat(PELO[a.aspecto.pelo % PELO.length], { roughness: 1 });
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.192, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mPelo);
    casco.position.y = 0.012;
    casco.rotation.x = -0.25;
    cabeza.add(casco);
    if (a.aspecto.largo) {
      const melena = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), mPelo);
      melena.scale.set(1.05, 1.25, 0.7);
      melena.position.set(0, -0.1, -0.09);
      cabeza.add(melena);
    }

    const rombo = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshStandardMaterial({ color: LIN.ok.clone(), emissive: LIN.ok.clone(), emissiveIntensity: 0.9, roughness: 0.3 }));
    rombo.scale.y = 1.55;
    rombo.position.y = 1.78;
    raiz.add(rombo);

    const anillo = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.54, 40), new THREE.MeshBasicMaterial({ color: L(a.rol === 'ceo' ? COLOR.oro : COLOR.ok), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = 0.04;
    anillo.visible = false;
    raiz.add(anillo);

    const golpe = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.9, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    golpe.position.y = 0.95;
    golpe.userData.agente = a.id;
    raiz.add(golpe);
    this.golpes.push(golpe);

    raiz.scale.setScalar(a.rol === 'ceo' ? 1.24 : 1.15);
    raiz.position.set(a.x, 0, a.z);
    raiz.rotation.y = a.rot;
    this.escena.add(raiz);
    return { raiz, cuerpo, piernas, brazos, cabeza, rombo, anillo, golpe, fase: Math.random() * 6, burbuja: null, etiqueta: null };
  }

  private quitarFigura(id: string): void {
    const f = this.figuras.get(id);
    if (!f) return;
    this.escena.remove(f.raiz);
    const i = this.golpes.indexOf(f.golpe);
    if (i >= 0) this.golpes.splice(i, 1);
    f.burbuja?.remove();
    f.etiqueta?.remove();
    this.figuras.delete(id);
  }

  private animar(f: Figura, a: Agente, dt: number, seleccionado: boolean): void {
    const aparece = a.presente && !f.raiz.visible;
    f.raiz.visible = a.presente;
    if (!a.presente) return;
    const k = Math.min(1, dt * 14);
    if (aparece || Math.hypot(a.x - f.raiz.position.x, a.z - f.raiz.position.z) > 3) {
      f.raiz.position.set(a.x, 0, a.z);
      f.raiz.rotation.y = a.rot;
    }
    f.raiz.position.x += (a.x - f.raiz.position.x) * k;
    f.raiz.position.z += (a.z - f.raiz.position.z) * k;
    let dr = a.rot - f.raiz.rotation.y;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    f.raiz.rotation.y += dr * Math.min(1, dt * 10);

    let pierna = 0;
    let brazoI = 0;
    let brazoD = 0;
    let alto = 0;
    let inclinar = 0;
    const t = this.tiempo;
    if (a.actividad === 'caminando') {
      f.fase += dt * 11;
      pierna = Math.sin(f.fase) * 0.75;
      brazoI = -pierna * 0.7;
      brazoD = pierna * 0.7;
      alto = Math.abs(Math.sin(f.fase)) * 0.035;
    } else if (a.sentado) {
      f.piernas[0].rotation.x += (-Math.PI / 2 - f.piernas[0].rotation.x) * k;
      f.piernas[1].rotation.x += (-Math.PI / 2 - f.piernas[1].rotation.x) * k;
      alto = -0.02;
      if (a.actividad === 'trabajando' || a.actividad === 'vendiendo') {
        brazoI = -1.15 + Math.sin(t * 13 + f.fase) * 0.09;
        brazoD = -1.15 + Math.cos(t * 15 + f.fase) * 0.09;
        inclinar = 0.06;
      } else if (a.actividad === 'descansando') {
        inclinar = -0.2;
        brazoI = brazoD = -0.2;
      } else if (a.actividad === 'reunion' || a.actividad === 'charla') {
        brazoI = -0.9;
        brazoD = -0.9 + Math.sin(t * 3 + f.fase) * 0.35;
      } else {
        brazoI = brazoD = -0.5;
      }
    } else if (a.actividad === 'cafe') {
      brazoD = -1.3 - Math.max(0, Math.sin(t * 1.6 + f.fase)) * 0.9;
    } else if (a.actividad === 'charla') {
      brazoD = -0.5 + Math.sin(t * 4 + f.fase) * 0.4;
      brazoI = -0.2;
    }
    if (!a.sentado) {
      f.piernas[0].rotation.x += (pierna - f.piernas[0].rotation.x) * k;
      f.piernas[1].rotation.x += (-pierna - f.piernas[1].rotation.x) * k;
    }
    f.brazos[0].rotation.x += (brazoI - f.brazos[0].rotation.x) * k;
    f.brazos[1].rotation.x += (brazoD - f.brazos[1].rotation.x) * k;
    f.cuerpo.position.y += (alto - f.cuerpo.position.y) * k;
    f.cuerpo.rotation.x += (inclinar - f.cuerpo.rotation.x) * k;

    // El rombo sobre la cabeza resume el ánimo, como en un juego de vida.
    const color = a.rol === 'ceo' ? LIN.oro : a.animo >= 60 ? LIN.ok : a.animo >= 35 ? LIN.alerta : LIN.mal;
    const m = f.rombo.material as THREE.MeshStandardMaterial;
    m.color.copy(color);
    m.emissive.copy(color);
    const tension = a.rol !== 'ceo' && a.estres > 75;
    f.rombo.rotation.y += dt * (tension ? 6 : 1.6);
    f.rombo.position.y = 1.78 + Math.sin(t * (tension ? 9 : 2.4) + f.fase) * 0.05;
    f.anillo.visible = seleccionado || this.sobre === a.id;
    (f.anillo.material as THREE.MeshBasicMaterial).opacity = seleccionado ? 0.95 : 0.4;
    if (seleccionado) f.anillo.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
  }

  // --------------------------------- cámara ---------------------------------

  private inclinacion(dist: number): number {
    const u = Math.sqrt(Math.max(0, Math.min(1, (dist - 7) / (54 - 7))));
    return 0.5 + (1.08 - 0.5) * u;
  }

  private colocarCamara(): void {
    const inc = this.inclinacion(this.cam.dist);
    const h = Math.cos(inc) * this.cam.dist;
    this.camara.position.set(this.cam.x + Math.sin(this.cam.giro) * h, Math.sin(inc) * this.cam.dist, this.cam.z + Math.cos(this.cam.giro) * h);
    this.camara.lookAt(this.cam.x, 0.6, this.cam.z);
  }

  private moverCamara(dt: number): void {
    const v = this.meta.dist * 0.9 * dt;
    let dx = 0;
    let dz = 0;
    const T = this.teclas;
    if (T.has('w') || T.has('arrowup')) dz -= 1;
    if (T.has('s') || T.has('arrowdown')) dz += 1;
    if (T.has('a') || T.has('arrowleft')) dx -= 1;
    if (T.has('d') || T.has('arrowright')) dx += 1;
    if (this.bordes && this.puntero.dentro && !this.arrastre) {
      const m = 18;
      if (this.puntero.x < m) dx -= 1;
      if (this.puntero.x > this.ancho - m) dx += 1;
      if (this.puntero.y < m) dz -= 1;
      if (this.puntero.y > this.alto - m) dz += 1;
    }
    if (dx || dz) {
      const s = Math.sin(this.meta.giro);
      const c = Math.cos(this.meta.giro);
      this.meta.x += (dx * c + dz * s) * v;
      this.meta.z += (-dx * s + dz * c) * v;
    }
    if (T.has('q')) this.meta.giro += dt * 1.6;
    if (T.has('e')) this.meta.giro -= dt * 1.6;
    this.meta.x = Math.max(-3, Math.min(ANCHO + 3, this.meta.x));
    this.meta.z = Math.max(-3, Math.min(ALTO + 5, this.meta.z));
    this.meta.dist = Math.max(7, Math.min(54, this.meta.dist));
    const k = Math.min(1, dt * 11);
    this.cam.x += (this.meta.x - this.cam.x) * k;
    this.cam.z += (this.meta.z - this.cam.z) * k;
    this.cam.dist += (this.meta.dist - this.cam.dist) * k;
    this.cam.giro += (this.meta.giro - this.cam.giro) * k;
    this.colocarCamara();
  }

  enfocar(x: number, z: number, dist?: number): void {
    this.meta.x = x;
    this.meta.z = z;
    if (dist) this.meta.dist = dist;
  }

  girar(sentido: number): void {
    this.meta.giro += (sentido * Math.PI) / 4;
  }

  acercar(factor: number): void {
    this.meta.dist *= factor;
  }

  /** Las cuatro esquinas de lo que ve la cámara, proyectadas al suelo (para el minimapa). */
  huella(): { x: number; z: number }[] {
    const esquinas: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    return esquinas.map(([nx, ny]) => this.alSuelo(((nx + 1) / 2) * this.ancho, ((1 - ny) / 2) * this.alto) ?? { x: this.cam.x, z: this.cam.z });
  }

  private alSuelo(px: number, py: number): { x: number; z: number } | null {
    this.rayo.setFromCamera(new THREE.Vector2((px / this.ancho) * 2 - 1, -(py / this.alto) * 2 + 1), this.camara);
    const p = new THREE.Vector3();
    return this.rayo.ray.intersectPlane(this.suelo, p) ? { x: p.x, z: p.z } : null;
  }

  private aPantalla(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camara);
    return { x: (v.x * 0.5 + 0.5) * this.ancho, y: (-v.y * 0.5 + 0.5) * this.alto, visible: v.z < 1 && v.z > -1 };
  }

  // -------------------------------- entradas --------------------------------

  private apuntar(px: number, py: number): Objetivo | null {
    this.rayo.setFromCamera(new THREE.Vector2((px / this.ancho) * 2 - 1, -(py / this.alto) * 2 + 1), this.camara);
    const a = this.rayo.intersectObjects(this.golpes.filter((g) => g.parent?.visible), false)[0];
    if (a) return { tipo: 'agente', id: a.object.userData.agente };
    const e = this.rayo.intersectObjects(this.golpesEstacion, false)[0];
    if (e) return { tipo: 'estacion', id: e.object.userData.estacion };
    const s = this.alSuelo(px, py);
    return s ? { tipo: 'suelo', x: s.x, z: s.z } : null;
  }

  private posicion(ev: PointerEvent | WheelEvent | MouseEvent): { x: number; y: number } {
    const r = this.lienzo.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  private entradas(): void {
    const el = this.lienzo;
    const escuchar = <K extends keyof HTMLElementEventMap>(obj: HTMLElement | Window, tipo: K | string, fn: (e: never) => void, op?: AddEventListenerOptions) => {
      obj.addEventListener(tipo, fn as EventListener, op);
      this.limpiar.push(() => obj.removeEventListener(tipo, fn as EventListener, op));
    };

    escuchar(el, 'contextmenu', (e: Event) => e.preventDefault());
    escuchar(el, 'pointerdown', (e: PointerEvent) => {
      el.focus({ preventScroll: true });
      const p = this.posicion(e);
      this.punteros.set(e.pointerId, p);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      const tactil = e.pointerType === 'touch';
      if (tactil && this.punteros.size === 2) {
        const [a, b] = [...this.punteros.values()];
        this.arrastre = { tipo: 'pellizco', x0: p.x, y0: p.y, boton: 0, movido: true, gx: 0, gz: 0, d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: this.meta.dist, tactil };
        return;
      }
      const s = this.alSuelo(p.x, p.y) ?? { x: this.cam.x, z: this.cam.z };
      const pan = tactil || e.button !== 0;
      this.arrastre = { tipo: pan ? 'pan' : 'caja', x0: p.x, y0: p.y, boton: e.button, movido: false, gx: s.x, gz: s.z, d0: 0, dist0: 0, tactil };
    });
    escuchar(el, 'pointermove', (e: PointerEvent) => {
      const p = this.posicion(e);
      this.puntero = { ...p, dentro: true };
      if (this.punteros.has(e.pointerId)) this.punteros.set(e.pointerId, p);
      const d = this.arrastre;
      if (!d) {
        const o = this.apuntar(p.x, p.y);
        this.sobre = o?.tipo === 'agente' ? o.id : null;
        el.style.cursor = o && o.tipo !== 'suelo' ? 'pointer' : 'default';
        return;
      }
      if (d.tipo === 'pellizco') {
        const [a, b] = [...this.punteros.values()];
        if (a && b) this.meta.dist = d.dist0 * (d.d0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)));
        return;
      }
      if (!d.movido && Math.hypot(p.x - d.x0, p.y - d.y0) > 6) d.movido = true;
      if (!d.movido) return;
      if (d.tipo === 'pan') {
        const s = this.alSuelo(p.x, p.y);
        if (s) {
          this.meta.x += d.gx - s.x;
          this.meta.z += d.gz - s.z;
          this.cam.x = this.meta.x;
          this.cam.z = this.meta.z;
          this.colocarCamara();
        }
        el.style.cursor = 'grabbing';
      } else {
        const x = Math.min(p.x, d.x0);
        const y = Math.min(p.y, d.y0);
        this.cajaSel.hidden = false;
        this.cajaSel.style.cssText = `left:${x}px;top:${y}px;width:${Math.abs(p.x - d.x0)}px;height:${Math.abs(p.y - d.y0)}px`;
      }
    });
    const soltar = (e: PointerEvent) => {
      const p = this.posicion(e);
      this.punteros.delete(e.pointerId);
      const d = this.arrastre;
      this.arrastre = null;
      el.style.cursor = 'default';
      if (!d || d.tipo === 'pellizco') return;
      if (d.tipo === 'caja' && d.movido) {
        this.cajaSel.hidden = true;
        const x0 = Math.min(p.x, d.x0);
        const x1 = Math.max(p.x, d.x0);
        const y0 = Math.min(p.y, d.y0);
        const y1 = Math.max(p.y, d.y0);
        const ids: string[] = [];
        for (const [id, f] of this.figuras) {
          if (!f.raiz.visible) continue;
          const s = this.aPantalla(f.raiz.position.x, 0.9, f.raiz.position.z);
          if (s.visible && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1) ids.push(id);
        }
        this.manejar.seleccionar(ids, e.shiftKey);
        return;
      }
      if (d.movido) return;
      const o = this.apuntar(p.x, p.y);
      if (!o) return;
      if (d.boton === 2) {
        this.manejar.ordenar(o);
        return;
      }
      if (d.boton !== 0) return;
      if (o.tipo === 'agente') {
        const ahora = performance.now();
        if (this.ultimoClic.id === o.id && ahora - this.ultimoClic.t < 350) {
          const f = this.figuras.get(o.id);
          if (f) this.enfocar(f.raiz.position.x, f.raiz.position.z, Math.min(this.meta.dist, 16));
        }
        this.ultimoClic = { t: ahora, id: o.id };
        // En pantalla táctil, con el CEO seleccionado, tocar a alguien es ir a conversar.
        if (d.tactil && this.manejar.haySeleccion() && this.manejar.ordenar(o, true)) return;
        this.manejar.seleccionar([o.id], e.shiftKey);
        return;
      }
      if (o.tipo === 'estacion' && this.mesas.get(o.id)?.fantasma.visible) {
        this.manejar.comprarEscritorio();
        return;
      }
      if (d.tactil && this.manejar.haySeleccion()) this.manejar.ordenar(o);
      else this.manejar.seleccionar([], false);
    };
    escuchar(el, 'pointerup', soltar);
    escuchar(el, 'pointercancel', (e: PointerEvent) => {
      this.punteros.delete(e.pointerId);
      this.arrastre = null;
      this.cajaSel.hidden = true;
    });
    escuchar(el, 'pointerleave', () => {
      this.puntero.dentro = false;
      this.sobre = null;
    });
    escuchar(el, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      const p = this.posicion(e);
      const antes = this.meta.dist;
      this.meta.dist = Math.max(7, Math.min(54, this.meta.dist * Math.exp(Math.sign(e.deltaY) * Math.min(0.35, Math.abs(e.deltaY) * 0.0022))));
      const s = this.alSuelo(p.x, p.y);
      if (s && this.meta.dist < antes) {
        const f = (1 - this.meta.dist / antes) * 0.7;
        this.meta.x += (s.x - this.meta.x) * f;
        this.meta.z += (s.z - this.meta.z) * f;
      }
    }, { passive: false });

    const escribiendo = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
    };
    escuchar(window, 'keydown', (e: KeyboardEvent) => {
      if (escribiendo(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.teclas.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
      }
    });
    escuchar(window, 'keyup', (e: KeyboardEvent) => this.teclas.delete(e.key.toLowerCase()));
    escuchar(window, 'blur', () => this.teclas.clear());
    escuchar(window, 'resize', () => this.redimensionar());
  }

  redimensionar(): void {
    const r = this.lienzo.parentElement!.getBoundingClientRect();
    this.ancho = Math.max(1, r.width);
    this.alto = Math.max(1, r.height);
    this.renderer.setSize(this.ancho, this.alto, false);
    this.lienzo.style.width = `${this.ancho}px`;
    this.lienzo.style.height = `${this.alto}px`;
    this.camara.aspect = this.ancho / this.alto;
    this.camara.updateProjectionMatrix();
  }

  // --------------------------------- efectos --------------------------------

  marcar(x: number, z: number, color = COLOR.ok): void {
    const malla = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: L(color), transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }));
    malla.rotation.x = -Math.PI / 2;
    malla.position.set(x, 0.05, z);
    this.escena.add(malla);
    this.marcas.push({ malla, t: 0 });
  }

  flotante(x: number, z: number, texto: string, tono: 'bueno' | 'malo'): void {
    const el = document.createElement('div');
    el.className = `of-flotante of-flotante-${tono}`;
    el.textContent = texto;
    this.capa.appendChild(el);
    this.flotantes.push({ el, x, z, t: 0 });
  }

  posicionDe(id: string): { x: number; z: number } | null {
    const f = this.figuras.get(id);
    return f && f.raiz.visible ? { x: f.raiz.position.x, z: f.raiz.position.z } : null;
  }

  // ---------------------------------- ciclo ---------------------------------

  actualizar(dt: number, sim: Sim, seleccion: Set<string>, velocidad: number): void {
    this.tiempo += dt;
    this.moverCamara(dt);

    // Escritorios comprados o por comprar.
    let siguiente = true;
    for (const e of sim.mapa.estaciones) {
      const m = this.mesas.get(e.id);
      if (!m) continue;
      if (m.activo !== e.activo) {
        m.activo = e.activo;
        m.real.visible = e.activo;
      }
      m.fantasma.visible = !e.activo && siguiente;
      if (!e.activo) siguiente = false;
      const dueno = e.dueno ? sim.agentes.find((a) => a.id === e.dueno) : undefined;
      const trabajando = dueno?.actividad === 'trabajando' && dueno.lugar?.estacion === e.id;
      m.pantalla.emissiveIntensity += ((trabajando ? 0.95 + Math.sin(this.tiempo * 6 + e.x) * 0.15 : e.dueno ? 0.3 : 0.05) - m.pantalla.emissiveIntensity) * Math.min(1, dt * 6);
    }

    // Personas.
    const vivos = new Set(sim.agentes.map((a) => a.id));
    for (const id of [...this.figuras.keys()]) if (!vivos.has(id)) this.quitarFigura(id);
    const dtAnim = dt * Math.max(1, Math.min(velocidad, 2.5));
    for (const a of sim.agentes) {
      let f = this.figuras.get(a.id);
      if (!f) {
        f = this.crearFigura(a);
        this.figuras.set(a.id, f);
      }
      this.animar(f, a, dtAnim, seleccion.has(a.id));
      this.rotulos(f, a, seleccion.has(a.id));
    }

    for (const m of this.marcas) {
      m.t += dt;
      m.malla.scale.setScalar(1 + m.t * 2.2);
      (m.malla.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - m.t / 0.55);
    }
    for (const m of this.marcas.filter((x) => x.t > 0.55)) this.escena.remove(m.malla);
    while (this.marcas.length && this.marcas[0].t > 0.55) this.marcas.shift();

    for (const f of this.flotantes) {
      f.t += dt;
      const p = this.aPantalla(f.x, 1.9 + f.t * 1.1, f.z);
      f.el.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      f.el.style.opacity = String(Math.max(0, Math.min(1, 2.2 - f.t)));
    }
    for (const f of this.flotantes.filter((x) => x.t > 2.2)) f.el.remove();
    this.flotantes = this.flotantes.filter((x) => x.t <= 2.2);

    this.renderer.render(this.escena, this.camara);
  }

  private rotulos(f: Figura, a: Agente, seleccionado: boolean): void {
    const mostrarBurbuja = a.presente && a.burbuja;
    if (mostrarBurbuja) {
      if (!f.burbuja) {
        f.burbuja = document.createElement('div');
        f.burbuja.className = 'of-burbuja';
        this.capa.appendChild(f.burbuja);
      }
      if (f.burbuja.textContent !== a.burbuja!.texto) f.burbuja.textContent = a.burbuja!.texto;
      const p = this.aPantalla(f.raiz.position.x, 2.15, f.raiz.position.z);
      f.burbuja.hidden = !p.visible;
      f.burbuja.style.transform = `translate(-50%, -100%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    } else if (f.burbuja) {
      f.burbuja.remove();
      f.burbuja = null;
    }
    const mostrarNombre = a.presente && (seleccionado || this.sobre === a.id);
    if (mostrarNombre) {
      if (!f.etiqueta) {
        f.etiqueta = document.createElement('div');
        f.etiqueta.className = 'of-etiqueta';
        f.etiqueta.textContent = a.rol === 'ceo' ? 'Tú (CEO)' : a.nombre.split(' ')[0];
        this.capa.appendChild(f.etiqueta);
      }
      const p = this.aPantalla(f.raiz.position.x, -0.15, f.raiz.position.z);
      f.etiqueta.hidden = !p.visible;
      f.etiqueta.style.transform = `translate(-50%, 0) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    } else if (f.etiqueta) {
      f.etiqueta.remove();
      f.etiqueta = null;
    }
  }

  destruir(): void {
    for (const fn of this.limpiar) fn();
    this.renderer.dispose();
    this.capa.innerHTML = '';
  }
}
