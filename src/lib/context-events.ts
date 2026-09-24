/**
 * Context event labels — shared by Calendar, Today and the dashboard so the
 * same event always reads the same way (classes, exams, meetings, deadlines).
 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  class: "کلاس",
  exam: "امتحان",
  meeting: "جلسه",
  deadline: "مهلت",
  commitment: "تعهد",
  event: "رویداد",
  other: "رویداد",
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? "رویداد";
}
