// Calendar math for calendar_based training cycles.
// Mirrors the resolution logic in routes/workout-plan.ts so the cycle grid
// and the per-date plan can never disagree.

export function countRestDaysInRange(
  startDateStr: string,
  endDateStr: string,
  restDaysOfWeek: number[],
): number {
  if (restDaysOfWeek.length === 0) return 0;
  const startMs = new Date(startDateStr + "T00:00:00").getTime();
  const endMs = new Date(endDateStr + "T00:00:00").getTime();
  const totalDays = Math.floor((endMs - startMs) / 86400000);
  if (totalDays <= 0) return 0;
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * restDaysOfWeek.length;
  const startDow = new Date(startDateStr + "T00:00:00").getDay();
  for (let i = 0; i < totalDays % 7; i++) {
    if (restDaysOfWeek.includes((startDow + i) % 7)) count++;
  }
  return count;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * For a calendar_based cycle, returns the calendar dates of the CURRENT round —
 * one date per training slot (rest weekdays are skipped). The current round is
 * the pass of the cycle that today falls inside (or the first pass when the
 * cycle starts in the future).
 */
export function computeCurrentRoundDates(
  startDateStr: string,
  todayStr: string,
  restDaysOfWeek: number[],
  slotCount: number,
): string[] {
  if (slotCount < 1 || restDaysOfWeek.length >= 7) return [];

  const startMs = new Date(startDateStr + "T00:00:00").getTime();
  const todayMs = new Date(todayStr + "T00:00:00").getTime();
  const daysSince = Math.floor((todayMs - startMs) / 86400000);

  let roundStartOrdinal = 0;
  if (daysSince >= 0) {
    const restBefore = countRestDaysInRange(startDateStr, todayStr, restDaysOfWeek);
    const trainingBefore = daysSince - restBefore;
    roundStartOrdinal = Math.floor(trainingBefore / slotCount) * slotCount;
  }

  const dates: string[] = [];
  const d = new Date(startDateStr + "T00:00:00");
  let ordinal = 0;
  // Walk calendar days from the cycle start, counting training (non-rest) days.
  // Bounded to stay safe no matter what the data looks like.
  for (let guard = 0; guard < 20000 && dates.length < slotCount; guard++) {
    if (!restDaysOfWeek.includes(d.getDay())) {
      if (ordinal >= roundStartOrdinal) dates.push(toDateStr(d));
      ordinal++;
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
