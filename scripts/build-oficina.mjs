// Empaqueta la maqueta 3D en un solo HTML jugable. three.js se carga desde cdnjs (r128, la misma
// versión del proyecto) y las fuentes van embebidas. Uso: node scripts/build-oficina.mjs [salida.html]
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const salida = resolve(process.argv[2] ?? 'out/mando-oficina.html');
const fuente = (archivo) => `data:font/woff2;base64,${readFileSync(`public/mando/fonts/${archivo}`).toString('base64')}`;

const threeGlobal = {
  name: 'three-global',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'three-global' }));
    b.onLoad({ filter: /.*/, namespace: 'three-global' }, () => ({ contents: 'module.exports = window.THREE;', loader: 'js' }));
  },
};

const r = await build({
  entryPoints: ['lib/oficina/standalone.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  write: false,
  plugins: [threeGlobal],
  define: {
    __FUENTES__: JSON.stringify({
      display: fuente('ZalandoSansExpanded-var.woff2'),
      cuerpo300: fuente('WorkSans-300.woff2'),
      cuerpo600: fuente('WorkSans-600.woff2'),
      mono: fuente('JetBrainsMono-400.woff2'),
    }),
  },
});

const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<title>MANDO Oficina</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Un solo mundo visual, oscuro: el juego ocupa toda la pantalla. */
  :root { color-scheme: dark; --pagina-fondo: #0c0420; --pagina-texto: #ffffff; }
  html, body { height: 100%; }
  body { background: var(--pagina-fondo); color: var(--pagina-texto); overflow: hidden; }
  #juego { height: 100%; }
</style>
<div id="juego"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>${js}</script>
`;
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, html);
console.log(`${salida} · ${(html.length / 1024).toFixed(0)} KB`);
