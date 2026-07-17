export type RodizioStatus = {
  active: boolean;
  restrictionDay: boolean;
  finalDigit: number | null;
  message: string;
};

const RESTRICTED_ENDINGS: Record<number, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6],
  4: [7, 8],
  5: [9, 0],
};

export function getPlateFinalDigit(plate: string): number | null {
  const digits = plate.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits.at(-1));
}

export function getSaoPauloRodizioStatus(plate: string, date = new Date()): RodizioStatus {
  const finalDigit = getPlateFinalDigit(plate);
  const weekday = date.getDay();
  const restricted = finalDigit !== null && (RESTRICTED_ENDINGS[weekday] ?? []).includes(finalDigit);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const inMorning = minutes >= 7 * 60 && minutes < 10 * 60;
  const inEvening = minutes >= 17 * 60 && minutes < 20 * 60;
  const active = restricted && (inMorning || inEvening);

  if (finalDigit === null) {
    return { active: false, restrictionDay: false, finalDigit, message: "Não foi possível identificar o final da placa." };
  }
  if (active) {
    return { active, restrictionDay: true, finalDigit, message: "Este veículo está no horário do rodízio municipal de São Paulo (7h–10h e 17h–20h)." };
  }
  if (restricted) {
    return { active, restrictionDay: true, finalDigit, message: "Hoje é o dia de rodízio desta placa, mas o horário de restrição não está ativo agora." };
  }
  return { active, restrictionDay: false, finalDigit, message: "A placa não está no rodízio municipal hoje." };
}
