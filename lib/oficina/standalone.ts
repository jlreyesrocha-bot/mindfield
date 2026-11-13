// Entrada del HTML autónomo: three.js llega como global desde el CDN y las fuentes van embebidas.
import type { Fuentes } from './estilos';
import { montar } from './juego';

declare const __FUENTES__: Fuentes;

const raiz = document.getElementById('juego');
if (raiz) {
  if (!(window as unknown as { THREE?: unknown }).THREE) {
    raiz.innerHTML = '<p style="padding:24px;color:#fff;font:600 16px system-ui">No se pudo cargar three.js. Revisa tu conexión y recarga la página.</p>';
  } else {
    montar(raiz, { fuentes: __FUENTES__ });
  }
}
