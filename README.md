# MANDO · Simulador de liderazgo

Juego de estrategia por turnos para entrenar decisiones de liderazgo. El jugador funda y dirige una
agencia de brand experience (BTL) en Lima, desde el garaje hasta convertirse en referente regional.
Cada turno es una semana: gana proyectos, cuida la caja, conversa con su equipo y resuelve
situaciones sin respuesta obvia. El puntaje es lo que vale su parte de la empresa al final.

El tablero anterior de esferas quedó en `/dashboard`.

## Oficina 3D (maqueta jugable)

En `/oficina` (la raíz del sitio redirige ahí) está la maqueta en tiempo real hecha con three.js:
la misma agencia vista desde arriba con cámara de juego de estrategia, y cada persona con ánimo,
estrés y energía como en un simulador de vida.

- **Cámara:** `W A S D` o arrastrar con clic derecho para moverla, rueda para acercar desde la vista
  general hasta el nivel de una persona, `Q` `E` para girar, minimapa para saltar.
- **Selección y órdenes:** clic o caja de selección; clic derecho sobre el piso, un escritorio, la
  cafetera, los sofás o la sala de reuniones para dar la orden. El CEO es una figura más: en su
  despacho trae clientes y, enviado hacia alguien, conversa y le sube el ánimo.
- **Simulación:** jornada de 9 a 18, proyectos con trabajo por área y plazo, sueldos y alquiler
  diarios, contratación y compra de escritorios. La gente decide sola ir por café o descansar; si
  la obligas a seguir, obedece y lo paga en ánimo. Con estrés al máximo se va a casa; con ánimo
  por el suelo, renuncia.

El código vive en `lib/oficina/` y no usa framework: `sim.ts` y `mapa.ts` son la simulación (se
prueban sin navegador), `escena.ts` es three.js, `juego.ts` es el controlador con la interfaz.
`npm run build:oficina` genera un único HTML jugable en `out/mando-oficina.html`.

El juego por turnos de la primera versión sigue en `/mando`.

## Cómo correrlo

```bash
npm install
npm run dev        # http://localhost:3000
```

Otros comandos:

```bash
npm test           # pruebas del motor (determinismo, partidas completas, todas las situaciones)
npm run sim        # simulación de balance: tres bots juegan 150 partidas cada uno
npm run sim -- traza razonable sim-2   # una partida semana a semana
npm run lint
```

## Voz con IA (opcional)

Sin configurar nada, el juego funciona completo: las personas del equipo responden con voces
generadas desde su estado real (ánimo, estrés, energía, sueldo, recuerdos).

Con una clave de la API de Claude, cada persona conversa en vivo en los 1:1 y al final de la partida
un coach escribe una devolución sobre las decisiones tomadas. Copia `.env.example` a `.env.local`
y completa:

```bash
ANTHROPIC_API_KEY=...          # activa la voz con IA
MANDO_MODELO=claude-opus-5-5   # opcional
```

La ruta `app/api/mando/ia/route.ts` mantiene la clave en el servidor, valida el tamaño de cada
solicitud y limita el uso por IP. Si la IA falla o no responde, el juego vuelve solo a las voces
locales.

## Cómo está armado

| Ruta | Qué contiene |
|---|---|
| `lib/mando/types.ts` | Estado de la partida (JSON serializable) y tipos de situaciones |
| `lib/mando/motor.ts` | Reglas: acciones del CEO, cierre de semana, etapas, valoración, perfil de liderazgo |
| `lib/mando/efectos.ts` | Mutadores (caja, ánimo, reputación) y generadores de personas, clientes y proyectos |
| `lib/mando/situaciones.ts` | Mazo de 39 situaciones de decisión y sus consecuencias diferidas |
| `lib/mando/datos.ts` | Contenido y números de balance: roles, clientes, tamaños de proyecto, etapas, logros |
| `lib/mando/voz.ts` | Pensamientos semanales y respuestas de 1:1 sin IA; ficha de cada persona para la IA |
| `components/mando/` | Interfaz: inicio, paneles (Semana, Equipo, Clientes, Empresa) y modales |
| `app/mando/mando.css` | Estilos sobre los tokens de marca de Purpural |

El motor usa un generador aleatorio con semilla guardado dentro de la partida: la misma semilla y
las mismas decisiones producen la misma partida. El modo «Reto de la semana» usa una semilla por
semana del calendario para que todo el equipo juegue el mismo mercado y compare resultados.

### Agregar una situación

Añade un objeto a `SITUACIONES` en `lib/mando/situaciones.ts` con `id`, `titulo`, `categoria`,
`etapas`, `texto`, `opciones` (cada una con `estilo`, `aplicar` y, si hace falta, `bloqueo`) y
`leccion`. `npm test` ejecuta cada opción de cada situación y sus consecuencias.

### Llevarlo a otra industria o puesto

Las reglas no dependen del rubro. Para otro escenario se reemplaza el contenido: roles y áreas,
clientes y tamaños de proyecto en `datos.ts`, las situaciones en `situaciones.ts` y las voces en
`voz.ts`. Después, `npm run sim` para volver a calibrar la economía.

## Límites actuales

- La partida y el ranking se guardan en el navegador (localStorage). No hay cuentas ni ranking
  compartido entre personas todavía: el reto semanal se compara copiando el resultado.
- La voz con IA se probó con las voces locales de respaldo; la conexión en vivo requiere una clave.
