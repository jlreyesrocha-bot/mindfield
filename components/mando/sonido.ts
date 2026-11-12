// Sonidos sintetizados con WebAudio: sin archivos, sin dependencias.
let ctx: AudioContext | null = null;
let activo = true;

export function sonidoActivo(): boolean {
  return activo;
}

export function alternarSonido(valor?: boolean): boolean {
  activo = valor ?? !activo;
  try {
    localStorage.setItem('mando:sonido', activo ? '1' : '0');
  } catch {}
  return activo;
}

export function cargarPreferenciaSonido(): boolean {
  try {
    activo = localStorage.getItem('mando:sonido') !== '0';
  } catch {}
  return activo;
}

function nota(frecuencia: number, inicio: number, duracion: number, tipo: OscillatorType = 'sine', volumen = 0.06) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  const t = ctx.currentTime + inicio;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volumen, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duracion + 0.02);
}

export type Sonido = 'clic' | 'cobro' | 'gana' | 'pierde' | 'etapa' | 'alerta' | 'semana';

export function sonar(s: Sonido): void {
  if (!activo || typeof window === 'undefined') return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    return;
  }
  switch (s) {
    case 'clic':
      nota(520, 0, 0.06, 'triangle', 0.035);
      break;
    case 'cobro':
      nota(880, 0, 0.09, 'triangle');
      nota(1320, 0.07, 0.16, 'triangle');
      break;
    case 'gana':
      [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.085, 0.22, 'triangle', 0.07));
      break;
    case 'pierde':
      nota(300, 0, 0.18, 'sine');
      nota(220, 0.14, 0.3, 'sine');
      break;
    case 'etapa':
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => nota(f, i * 0.1, 0.34, 'triangle', 0.07));
      break;
    case 'alerta':
      nota(440, 0, 0.1, 'square', 0.03);
      nota(440, 0.16, 0.1, 'square', 0.03);
      break;
    case 'semana':
      nota(392, 0, 0.1, 'sine', 0.05);
      nota(587, 0.08, 0.18, 'sine', 0.05);
      break;
  }
}
