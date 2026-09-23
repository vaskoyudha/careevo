export interface JadwalInput {
  scheduledSessions: number;
  attendedSessions: number;
  actualHours: number;
  weeklyTargetHours: number;
}

export interface JadwalResult {
  score: number;
  complianceRatio: number;
  hoursRatio: number;
}

export function hitungSkorJadwal({
  scheduledSessions,
  attendedSessions,
  actualHours,
  weeklyTargetHours,
}: JadwalInput): JadwalResult {
  const complianceRatio =
    scheduledSessions > 0
      ? Math.min(Math.max(attendedSessions, 0) / scheduledSessions, 1)
      : 0;

  const hoursRatio =
    weeklyTargetHours > 0
      ? Math.min(Math.max(actualHours, 0) / weeklyTargetHours, 1)
      : 0;

  return {
    score: Math.round(complianceRatio * 20 + hoursRatio * 10),
    complianceRatio,
    hoursRatio,
  };
}
