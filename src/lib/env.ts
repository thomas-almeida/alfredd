import { z } from "zod";

/**
 * Validação de ambiente centralizada.
 *
 * - `clientEnv`: variáveis públicas (prefixo NEXT_PUBLIC_), seguras no browser.
 * - `serverEnv`: segredos — nunca devem ser importados por componentes client.
 *
 * As integrações (Twitch, Supabase service role, Resend, Telegram, AbacatePay)
 * podem estar ausentes em desenvolvimento. Em vez de quebrar o build, marcamos
 * cada integração como "configurada" ou não, e cada feature decide como degradar.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  TWITCH_CLIENT_ID: z.string().min(1).optional(),
  TWITCH_CLIENT_SECRET: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  ABACATEPAY_DEV_KEY: z.string().min(1).optional(),
  ABACATEPAY_WEBHOOK: z.string().min(1).optional(),
  // Engajamento do YouTube (Data API v3).
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  // Download de clip/VOD da Twitch (GQL público + ffmpeg).
  TWITCH_WEB_CLIENT_ID: z.string().min(1).optional(),
  FFMPEG_PATH: z.string().min(1).optional(),
  MAX_VOD_WINDOW_SECONDS: z.string().optional(),
  // Transcrição (Whisper via Groq/OpenAI) e IA de destaques.
  GROQ_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  TRANSCRIBE_PROVIDER: z.enum(["groq", "openai"]).optional(),
  TRANSCRIBE_API_KEY: z.string().min(1).optional(),
  TRANSCRIBE_BASE_URL: z.string().min(1).optional(),
  TRANSCRIBE_MODEL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  LLM_BASE_URL: z.string().min(1).optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  LLM_MODEL: z.string().min(1).optional(),
  FFPROBE_PATH: z.string().min(1).optional(),
  YTDLP_PATH: z.string().min(1).optional(),
  PYTHON_PATH: z.string().min(1).optional(),
  YT_INNERTUBE_CLIENT: z.string().min(1).optional(),
  YT_INNERTUBE_CLIENT_VERSION: z.string().min(1).optional(),
});

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

const parsedClient = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!parsedClient.success) {
  throw new Error(
    "Variáveis de ambiente públicas ausentes/inválidas:\n" +
      formatIssues(parsedClient.error.issues) +
      "\nCopie .env.example para .env e preencha os valores do Supabase.",
  );
}

export const clientEnv = parsedClient.data;

/**
 * Lê e valida os segredos de servidor sob demanda. Lançar apenas quando
 * realmente usado evita quebrar páginas públicas por falta de uma chave opcional.
 */
let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

export function getServerEnv(): z.infer<typeof serverSchema> {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Segredos de servidor inválidos:\n" + formatIssues(parsed.error.issues),
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

