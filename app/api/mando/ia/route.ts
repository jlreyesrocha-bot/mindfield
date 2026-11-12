// Voz con IA para MANDO: cada persona del equipo responde como alguien real,
// y un coach devuelve una lectura de la partida. Si no hay credenciales
// configuradas, responde 503 y el juego usa sus voces locales.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODELO = process.env.MANDO_MODELO ?? 'claude-opus-5-5';
const BETA_FALLBACK = 'server-side-fallback-2026-07-01';

function hayCredenciales(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// Límite simple por IP para que la ruta no se pueda usar como proxy abierto.
const VENTANA_MS = 5 * 60 * 1000;
const MAX_POR_VENTANA = 40;
const usos = new Map<string, number[]>();

function permitido(ip: string): boolean {
  const ahora = Date.now();
  const lista = (usos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length >= MAX_POR_VENTANA) {
    usos.set(ip, lista);
    return false;
  }
  lista.push(ahora);
  usos.set(ip, lista);
  if (usos.size > 5000) usos.clear();
  return true;
}

const Entrada = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('persona'),
    ficha: z.string().min(1).max(4000),
    ceo: z.string().max(80),
    historial: z.array(z.object({ de: z.enum(['ceo', 'persona']), texto: z.string().max(1200) })).max(14),
    mensaje: z.string().min(1).max(700),
  }),
  z.object({
    tipo: z.literal('coach'),
    resumen: z.string().min(1).max(9000),
  }),
]);

const RespuestaPersona = z.object({
  respuesta: z.string(),
  delta_animo: z.number(),
  delta_estres: z.number(),
  revela_motivador: z.boolean(),
});

const SISTEMA_PERSONA = `Interpretas a una persona que trabaja en una agencia de brand experience (activaciones, eventos, BTL) en Lima, dentro de un simulador de liderazgo. Quien te escribe es el CEO de la agencia, en una conversación uno a uno. El objetivo del simulador es que el CEO practique escuchar y leer a su equipo, así que tu trabajo es ser esa persona de forma creíble, no ser complaciente.

Cómo hablas:
- Español neutro, de tú, natural y breve: entre una y cuatro frases, como alguien que conversa en la oficina. Sin listas, sin emojis, sin comillas alrededor de tu respuesta.
- Hablas desde tu estado real, que recibes en la ficha. Si tu estrés es alto, se nota. Si tu ánimo es bajo, eres más cortante o evasivo. Si estás bien, se nota también.
- Nunca menciones números de la ficha ni palabras como "ánimo", "estrés" o "motivador": tradúcelos a cómo se siente y qué le pasa a una persona.
- Tu apertura depende de la confianza. Con ánimo bajo y un CEO que pregunta por cumplir, respondes "todo bien" y poco más. Si el CEO pregunta con interés genuino, escucha y no minimiza, te abres de a poco y puedes dejar ver lo que de verdad te importa en el trabajo.
- Si tienes ganas de irte, no lo anuncias de entrada: lo insinúas, y lo dices con claridad solo si el CEO crea el espacio para ello.
- Reaccionas a lo que el CEO dice. Una promesa concreta y creíble te alivia. Una frase hecha, presión o minimizar lo que sientes te cierra.
- No inventes hechos de la empresa que contradigan la ficha. Puedes mencionar detalles cotidianos coherentes con tu cargo.

Además de tu respuesta, evalúas el efecto de este mensaje del CEO en ti:
- delta_animo: entre -6 y 6. Positivo si te sentiste escuchado o valorado; negativo si te sentiste presionado, ignorado o tratado con una frase hecha; cerca de 0 si fue un intercambio neutro.
- delta_estres: entre -5 y 5. Negativo si la conversación te quitó peso; positivo si te lo sumó.
- revela_motivador: true solo si en esta respuesta dejaste ver con claridad qué es lo que más te importa en el trabajo.`;

const SISTEMA_COACH = `Eres un coach ejecutivo que acompaña a líderes de agencias y empresas de servicios. Acabas de observar una partida completa de un simulador en el que una persona dirigió, como CEO, una agencia de brand experience desde su fundación. Recibes el resumen de la partida: números finales, decisiones que tomó en cada situación y su perfil de estilo.

Escribe una devolución directa y útil, en español neutro y de tú, para que esa persona decida mejor en su trabajo real:
- Empieza por lo que más pesó en el resultado, con evidencia de la partida (cita decisiones concretas por su nombre).
- Señala un patrón de liderazgo que se repite en sus decisiones y el costo que tiene.
- Termina con tres acciones concretas para su semana real de trabajo.
Entre 150 y 220 palabras, en párrafos cortos, sin títulos, sin listas con viñetas salvo las tres acciones finales numeradas. Sin halagos de relleno y sin frases hechas.`;

export async function GET() {
  return NextResponse.json({ disponible: hayCredenciales() });
}

export async function POST(req: Request) {
  if (!hayCredenciales()) {
    return NextResponse.json({ disponible: false }, { status: 503 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!permitido(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en unos minutos.' }, { status: 429 });
  }

  let entrada: z.infer<typeof Entrada>;
  try {
    entrada = Entrada.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    if (entrada.tipo === 'persona') {
      const conversacion = entrada.historial
        .map((m) => `${m.de === 'ceo' ? entrada.ceo || 'CEO' : 'Tú'}: ${m.texto}`)
        .join('\n');
      const res = await client.beta.messages.parse({
        model: MODELO,
        max_tokens: 4000,
        betas: [BETA_FALLBACK],
        fallbacks: 'default',
        system: SISTEMA_PERSONA,
        output_config: { effort: 'low', format: betaZodOutputFormat(RespuestaPersona) },
        messages: [
          {
            role: 'user',
            content: `Tu ficha:\n${entrada.ficha}\n\n${conversacion ? `La conversación hasta ahora:\n${conversacion}\n\n` : ''}El CEO (${entrada.ceo || 'CEO'}) te dice ahora:\n${entrada.mensaje}`,
          },
        ],
      });
      if (res.stop_reason === 'refusal' || !res.parsed_output) {
        return NextResponse.json({ disponible: false }, { status: 503 });
      }
      const o = res.parsed_output;
      return NextResponse.json({
        respuesta: o.respuesta.trim(),
        deltaAnimo: Math.max(-6, Math.min(6, Math.round(o.delta_animo))),
        deltaEstres: Math.max(-5, Math.min(5, Math.round(o.delta_estres))),
        revela: o.revela_motivador,
      });
    }

    const res = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 6000,
      betas: [BETA_FALLBACK],
      fallbacks: 'default',
      system: SISTEMA_COACH,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: entrada.resumen }],
    });
    if (res.stop_reason === 'refusal') {
      return NextResponse.json({ disponible: false }, { status: 503 });
    }
    const texto = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!texto) return NextResponse.json({ disponible: false }, { status: 503 });
    return NextResponse.json({ texto });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json({ disponible: false, error: 'Credenciales de IA inválidas.' }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'La IA está saturada. Intenta de nuevo en un momento.' }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('MANDO IA', error.status, error.message);
      return NextResponse.json({ disponible: false }, { status: 503 });
    }
    console.error('MANDO IA', error);
    return NextResponse.json({ disponible: false }, { status: 503 });
  }
}
