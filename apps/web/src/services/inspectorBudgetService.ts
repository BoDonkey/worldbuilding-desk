const dayKey = () => new Date().toISOString().slice(0, 10);

const keyFor = (projectId: string) => `inspectorBudget:${projectId}:${dayKey()}`;

export const getInspectorConsultationUsage = (projectId: string): number => {
  const raw = localStorage.getItem(keyFor(projectId));
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const incrementInspectorConsultationUsage = (projectId: string): number => {
  const next = getInspectorConsultationUsage(projectId) + 1;
  localStorage.setItem(keyFor(projectId), String(next));
  return next;
};
