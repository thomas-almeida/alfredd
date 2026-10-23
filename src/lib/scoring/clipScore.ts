/**
 * ClipScore 0–100 — versão inicial explicável e evolutiva (guia §7).
 * Função PURA e testável. NÃO inventa dados: exige amostras suficientes,
 * caso contrário retorna status "insuficiente" ou "novo".
 *
 * Pesos iniciais:
 *   - velocidade de views/hora: 45%
 *   - desempenho relativo ao grupo comparável: 30%
 *   - aceleração: 15%
 *   - recência: 10%
 */

export const CLIP_SCORE_VERSION = "1.0.0";

export const WEIGHTS = {
  viewVelocity: 0.45,
  relativePerformance: 0.3,
  acceleration: 0.15,
  recency: 0.1,
} as const;

export interface ClipScoreInput {
  /** Snapshots de views ordenados por tempo (mais antigo → mais recente). */
  snapshots: Array<{ viewCount: number; observedAt: Date }>;
  /** Idade do clipe em horas, a partir do created_at da Twitch. */
  ageHours: number;
  /** Mediana de views/hora da coorte comparável (mesmo jogo/idade). */
  cohortMedianVelocity?: number;
  /** p90 de views/hora da coorte, para normalização. */
  cohortP90Velocity?: number;
}

export type ClipScoreStatus = "ok" | "novo" | "insuficiente";

export interface ClipScoreResult {
  status: ClipScoreStatus;
  version: string;
  score: number | null;
  factors: {
    viewVelocity: number | null;
    relativePerformance: number | null;
    acceleration: number | null;
    recency: number | null;
  };
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

function viewsPerHour(
  snapshots: ClipScoreInput["snapshots"],
): number | null {
  if (snapshots.length < 2) return null;
  const first = snapshots[0]!;
  const last = snapshots[snapshots.length - 1]!;
  const hours =
    (last.observedAt.getTime() - first.observedAt.getTime()) / 3_600_000;
  if (hours <= 0) return null;
  return (last.viewCount - first.viewCount) / hours;
}

export function computeClipScore(input: ClipScoreInput): ClipScoreResult {
  const empty: ClipScoreResult["factors"] = {
    viewVelocity: null,
    relativePerformance: null,
    acceleration: null,
    recency: null,
  };

  // Sem snapshots suficientes não há taxa confiável.
  if (input.snapshots.length < 2) {
    return {
      status: input.ageHours < 2 ? "novo" : "insuficiente",
      version: CLIP_SCORE_VERSION,
      score: null,
      factors: empty,
    };
  }

  const velocity = viewsPerHour(input.snapshots);
  if (velocity === null) {
    return {
      status: "insuficiente",
      version: CLIP_SCORE_VERSION,
      score: null,
      factors: empty,
    };
  }

  // Normalização da velocidade pela coorte (quando disponível).
  const p90 = input.cohortP90Velocity ?? Math.max(velocity, 1);
  const velocityNorm = clamp(velocity / p90);

  // Desempenho relativo à mediana da coorte.
  const median = input.cohortMedianVelocity;
  const relative =
    median && median > 0 ? clamp(velocity / (median * 2)) : velocityNorm;

  // Aceleração: compara a taxa da 2ª metade vs 1ª metade das observações.
  const mid = Math.floor(input.snapshots.length / 2);
  const firstHalf = viewsPerHour(input.snapshots.slice(0, mid + 1));
  const secondHalf = viewsPerHour(input.snapshots.slice(mid));
  const acceleration =
    firstHalf && firstHalf > 0 && secondHalf !== null
      ? clamp(secondHalf / (firstHalf * 2))
      : 0.5;

  // Recência: decai ao longo de ~48h.
  const recency = clamp(1 - input.ageHours / 48);

  const score =
    WEIGHTS.viewVelocity * velocityNorm +
    WEIGHTS.relativePerformance * relative +
    WEIGHTS.acceleration * acceleration +
    WEIGHTS.recency * recency;

  return {
    status: "ok",
    version: CLIP_SCORE_VERSION,
    score: Math.round(clamp(score) * 100),
    factors: {
      viewVelocity: velocityNorm,
      relativePerformance: relative,
      acceleration,
      recency,
    },
  };
}
