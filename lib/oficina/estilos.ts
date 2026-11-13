// Estilos de la maqueta 3D, sobre los tokens de marca de Purpural. Van como texto para que el
// mismo juego se pueda montar en Next o en un HTML suelto.

export interface Fuentes {
  display: string;
  cuerpo300: string;
  cuerpo600: string;
  mono: string;
}

export function estilos(f?: Fuentes): string {
  const caras = f
    ? `
@font-face { font-family: "Zalando Sans Expanded"; src: url("${f.display}") format("woff2"); font-weight: 100 900; font-display: swap; }
@font-face { font-family: "Work Sans"; src: url("${f.cuerpo300}") format("woff2"); font-weight: 300; font-display: swap; }
@font-face { font-family: "Work Sans"; src: url("${f.cuerpo600}") format("woff2"); font-weight: 600; font-display: swap; }
@font-face { font-family: "JetBrains Mono"; src: url("${f.mono}") format("woff2"); font-weight: 400; font-display: swap; }`
    : '';
  return `${caras}
/* Distribución: lienzo 3D a pantalla completa; encima, barra de recursos arriba, proyectos a la
   izquierda y la consola de mando abajo (minimapa, selección, órdenes), como en un juego de estrategia. */
.of-raiz {
  --of-fondo: #0c0420;
  --of-panel: rgba(19, 8, 51, 0.9);
  --of-panel-2: rgba(132, 102, 244, 0.14);
  --of-borde: rgba(132, 102, 244, 0.34);
  --of-tinta: #ffffff;
  --of-texto: rgba(255, 255, 255, 0.8);
  --of-tenue: rgba(255, 255, 255, 0.56);
  --of-purpura: #4b15eb;
  --of-lavanda: #8466f4;
  --of-ok: #3dd6a0;
  --of-alerta: #f5a742;
  --of-mal: #ff7a7a;
  --of-display: "Zalando Sans Expanded", "Arial Black", system-ui, sans-serif;
  --of-cuerpo: "Work Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --of-mono: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  --of-gi: max(16px, env(safe-area-inset-left, 0px));
  --of-gd: max(16px, env(safe-area-inset-right, 0px));
  position: relative; width: 100%; height: 100%; min-height: 420px; overflow: hidden;
  background: var(--of-fondo); color: var(--of-texto);
  font-family: var(--of-cuerpo); font-weight: 300; font-size: 14px; line-height: 1.45;
  -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none;
}
.of-raiz *, .of-raiz *::before, .of-raiz *::after { box-sizing: border-box; }
.of-raiz b, .of-raiz strong { font-weight: 600; color: var(--of-tinta); }
.of-raiz button { font-family: inherit; }
.of-raiz [hidden] { display: none !important; }
.of-lienzo { position: absolute; inset: 0; display: block; outline: none; touch-action: none; }
.of-capa { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }

.of-ok { color: var(--of-ok) !important; } .of-alerta { color: var(--of-alerta) !important; } .of-mal { color: var(--of-mal) !important; }
.of-bg-ok { background: var(--of-ok); } .of-bg-alerta { background: var(--of-alerta); } .of-bg-mal { background: var(--of-mal); }
.of-eyebrow { font-family: var(--of-mono); font-size: 10.5px; letter-spacing: 0.125em; text-transform: uppercase; color: var(--of-lavanda); }
.of-chico { font-size: 12px; color: var(--of-tenue); }
.of-num { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--of-tinta); font-size: 12px; }
.of-sep { margin-top: 14px; }
.of-fila { display: flex; flex-wrap: wrap; gap: 8px; }
.of-espacio { flex: 1; }
.of-vacio { margin: 6px 0 0; font-size: 12.5px; color: var(--of-tenue); }
.of-punto { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }

/* Barra superior */
.of-top {
  position: absolute; inset: 0 0 auto 0; z-index: 4; display: flex; align-items: center; gap: 6px 18px; flex-wrap: wrap;
  padding: calc(8px + env(safe-area-inset-top, 0px)) var(--of-gd) 8px var(--of-gi);
  background: linear-gradient(rgba(12, 4, 32, 0.94), rgba(12, 4, 32, 0.72)); border-bottom: 1px solid var(--of-borde);
}
.of-marca { font-family: var(--of-display); font-weight: 900; font-size: 18px; letter-spacing: -0.02em; color: var(--of-lavanda); }
.of-dato { display: flex; flex-direction: column; line-height: 1.15; }
.of-dato span { font-family: var(--of-mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--of-lavanda); }
.of-dato b { font-size: 16px; font-variant-numeric: tabular-nums; }
.of-vel { display: flex; gap: 4px; }
.of-btn-vel {
  min-width: 34px; height: 32px; padding: 0 9px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; border: 1px solid var(--of-borde); background: rgba(19, 8, 51, 0.7); font-weight: 600; font-size: 13px; cursor: pointer;
  color: var(--of-tinta);
}
.of-btn-vel:hover { border-color: var(--of-lavanda); }
.of-btn-vel.activo { background: var(--of-purpura); border-color: var(--of-purpura); }

/* Botones */
.of-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 7px 14px; border-radius: 999px;
  border: 1px solid var(--of-borde); background: transparent; color: var(--of-tinta); font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.of-btn:hover:not(:disabled) { border-color: var(--of-lavanda); background: var(--of-panel-2); }
.of-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.of-btn-pri { background: var(--of-purpura); border-color: var(--of-purpura); }
.of-btn-pri:hover:not(:disabled) { background: #6a3cf0; border-color: #6a3cf0; }
.of-btn-sm { padding: 4px 11px; font-size: 12px; margin-top: 8px; }
.of-btn-gr { padding: 13px 28px; font-size: 16px; }
.of-btn-ancho { width: 100%; }
.of-raiz button:focus-visible, .of-lienzo:focus-visible { outline: 2px solid var(--of-lavanda); outline-offset: 2px; }
.of-raiz kbd {
  font-family: var(--of-mono); font-size: 10.5px; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--of-borde);
  color: var(--of-tenue); background: rgba(255, 255, 255, 0.05); margin: 0 1px;
}

/* Panel de proyectos */
.of-lado {
  position: absolute; z-index: 3; left: var(--of-gi); top: calc(62px + env(safe-area-inset-top, 0px)); width: 296px;
  max-height: calc(100% - 300px); display: flex; flex-direction: column;
  background: var(--of-panel); border: 1px solid var(--of-borde); border-radius: 14px; backdrop-filter: blur(8px); overflow: hidden;
}
.of-lado-cab {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 10px 12px; border: 0; background: transparent;
  font-weight: 600; color: var(--of-tinta); cursor: pointer; text-align: left;
}
.of-chip { font-size: 11px; font-weight: 600; color: var(--of-tenue); border: 1px solid var(--of-borde); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
.of-lado-cuerpo { padding: 2px 12px 12px; overflow-y: auto; min-height: 0; }
.of-tarjeta { margin-top: 8px; padding: 10px; border-radius: 10px; border: 1px solid var(--of-borde); background: var(--of-panel-2); display: grid; gap: 6px; }
.of-oferta { background: transparent; }
.of-tarjeta-cab { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.of-tarjeta-tit { font-weight: 600; color: var(--of-tinta); font-size: 13.5px; display: flex; justify-content: space-between; gap: 8px; }
.of-tarjeta-tit b { white-space: nowrap; font-variant-numeric: tabular-nums; }
.of-area { display: grid; grid-template-columns: 78px 1fr 40px; align-items: center; gap: 8px; font-size: 12px; }
.of-area .of-num { text-align: right; }
.of-barra { height: 5px; border-radius: 999px; background: rgba(255, 255, 255, 0.12); overflow: hidden; }
.of-barra i { display: block; height: 100%; border-radius: 999px; transition: width 0.3s; }

/* Consola inferior */
.of-bajo {
  position: absolute; z-index: 3; inset: auto 0 0 0; display: grid; grid-template-columns: 204px minmax(0, 1fr) 292px; gap: 10px; align-items: end;
  padding: 0 var(--of-gd) calc(12px + env(safe-area-inset-bottom, 0px)) var(--of-gi); pointer-events: none;
}
.of-bajo > * { pointer-events: auto; background: var(--of-panel); border: 1px solid var(--of-borde); border-radius: 14px; backdrop-filter: blur(8px); }
.of-mini { padding: 6px; line-height: 0; }
.of-mini canvas { width: 190px; height: auto; border-radius: 8px; cursor: crosshair; touch-action: none; }
.of-sel { padding: 12px 14px; min-height: 118px; }
.of-pista { font-size: 13px; }
.of-ficha { display: flex; gap: 12px; align-items: flex-start; }
.of-ficha-datos { flex: 1; min-width: 0; }
.of-nombre { font-weight: 600; color: var(--of-tinta); font-size: 15px; }
.of-nombre .of-chico { font-weight: 300; margin-left: 6px; }
.of-pensar { margin: 6px 0 0; font-style: italic; color: rgba(255, 255, 255, 0.88); font-size: 13px; }
.of-retrato {
  flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 2.5px solid; background: #1d0e4a;
  font-weight: 600; color: var(--of-tinta);
}
.of-medidores { width: 190px; flex: none; display: grid; gap: 7px; }
.of-medidor-fila { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--of-tenue); margin-bottom: 3px; }
.of-medidor-fila b { font-variant-numeric: tabular-nums; }
.of-grupo { display: flex; flex-wrap: wrap; gap: 8px; max-height: 96px; overflow-y: auto; }
.of-mini-ficha {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px; border-radius: 999px; border: 1px solid var(--of-borde);
  background: transparent; cursor: pointer; font-weight: 600; font-size: 12.5px;
}
.of-mini-ficha .of-punto { margin: 0; }
.of-cmd { padding: 10px; display: grid; gap: 8px; }
.of-cmd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.of-btn-cmd { justify-content: space-between; border-radius: 10px; padding: 8px 10px; }
.of-cam { display: flex; gap: 4px; justify-content: flex-end; }

/* Sobre la escena */
.of-burbuja {
  position: absolute; left: 0; top: 0; max-width: 210px; padding: 6px 11px; border-radius: 12px 12px 12px 2px; background: #ffffff; color: #2a2a30;
  font-weight: 600; font-size: 12.5px; line-height: 1.3; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4); white-space: normal; will-change: transform;
}
.of-etiqueta {
  position: absolute; left: 0; top: 0; padding: 1px 8px; border-radius: 999px; background: rgba(12, 4, 32, 0.85); border: 1px solid var(--of-borde);
  color: var(--of-tinta); font-weight: 600; font-size: 11.5px; white-space: nowrap; will-change: transform;
}
.of-flotante { position: absolute; left: 0; top: 0; font-family: var(--of-display); font-weight: 900; font-size: 22px; white-space: nowrap; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7); will-change: transform; }
.of-flotante-bueno { color: var(--of-ok); } .of-flotante-malo { color: var(--of-mal); }
.of-caja-sel { position: absolute; border: 1.5px solid var(--of-ok); background: rgba(61, 214, 160, 0.14); border-radius: 2px; }

.of-toasts { position: absolute; z-index: 5; top: calc(64px + env(safe-area-inset-top, 0px)); left: 50%; transform: translateX(-50%); width: min(460px, calc(100% - 32px)); display: grid; gap: 6px; pointer-events: none; }
.of-toast { padding: 8px 14px; border-radius: 10px; background: rgba(29, 14, 74, 0.96); border: 1px solid var(--of-borde); color: var(--of-tinta); font-size: 13px; font-weight: 600; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4); animation: of-entra 0.22s ease-out; }
.of-toast-bueno { border-color: rgba(61, 214, 160, 0.6); } .of-toast-malo { border-color: rgba(255, 122, 122, 0.65); }
@keyframes of-entra { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

.of-noche { position: absolute; inset: 0; z-index: 2; background: var(--of-fondo); opacity: 0; pointer-events: none; transition: opacity 0.7s; }
.of-noche.activa { opacity: 0.88; }

/* Ventanas */
.of-modal {
  position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  padding: 16px var(--of-gd) 16px var(--of-gi); background: rgba(6, 2, 18, 0.78); backdrop-filter: blur(5px);
}
.of-modal-caja {
  width: 100%; max-width: 660px; max-height: 100%; overflow-y: auto; padding: 26px; border-radius: 20px; background: #130833; border: 1px solid var(--of-borde);
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.55); display: grid; gap: 12px; user-select: text; -webkit-user-select: text;
}
.of-titulo { margin: 0; font-family: var(--of-display); font-weight: 900; letter-spacing: -0.02em; line-height: 0.95; color: var(--of-purpura); font-size: clamp(54px, 13vw, 104px); }
.of-titulo-sm { color: var(--of-tinta); font-size: clamp(24px, 5vw, 34px); line-height: 1.05; }
.of-lead { margin: 0; font-size: 16px; line-height: 1.5; max-width: 60ch; }
.of-pasos, .of-controles { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 13.5px; }
.of-controles { list-style: none; padding: 12px; border-radius: 12px; border: 1px solid var(--of-borde); background: var(--of-panel-2); font-size: 12.5px; }
.of-candidatos { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
.of-check { display: flex; gap: 8px; align-items: center; font-size: 13px; cursor: pointer; }

@media (max-width: 860px) {
  .of-solo-ancho { display: none; }
  .of-top { gap: 4px 12px; }
  .of-marca { font-size: 15px; }
  .of-dato b { font-size: 14px; }
  .of-lado { right: var(--of-gd); width: auto; top: calc(104px + env(safe-area-inset-top, 0px)); max-height: 44%; }
  .of-pista-larga { display: none; }
  .of-bajo { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .of-mini { display: none; }
  .of-sel { min-height: 0; padding: 10px 12px; }
  .of-medidores { width: 120px; }
  .of-pista { font-size: 12px; }
  .of-toasts { top: calc(156px + env(safe-area-inset-top, 0px)); }
  .of-modal-caja { padding: 18px; }
  .of-cmd-grid { grid-template-columns: repeat(4, 1fr); }
  .of-btn-cmd kbd { display: none; }
  .of-btn-cmd { justify-content: center; padding: 8px 4px; font-size: 12.5px; }
}
@media (prefers-reduced-motion: reduce) { .of-raiz * { animation: none !important; transition: none !important; } }
`;
}
