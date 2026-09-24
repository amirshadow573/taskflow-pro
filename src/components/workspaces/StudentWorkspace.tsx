import { useWorkspace } from "@/components/workspace/WorkspaceData";
import { CapabilityGate } from "@/components/progress/UnlockCenter";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TaskRow } from "@/components/tasks/TaskRow";
import { SmartTaskInput } from "@/components/tasks/SmartTaskInput";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { PersonaStatsStrip } from "@/components/progress/PersonaStats";
import { Button } from "@/components/ui/button";
import { toFa } from "@/lib/persian";
import { todayKey, isOverdue } from "@/lib/task-utils";
import { Link } from "react-router";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, BookOpen, Calculator, Clock, GraduationCap, ListChecks,
  LayoutDashboard, Plus, Target, Timer, TriangleAlert, BookMarked, CheckCircle2,
  FileText, CalendarDays, TrendingUp, BarChart3, ChevronDown, X,
  Star, Search, Filter, AlertCircle, Flame, BookCopy, Pencil, Trash2,
  Save, RotateCcw, Brain, Eye, EyeOff, Zap, CircleDot, ArrowUpRight,
} from "lucide-react";

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

const SUBJECT_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/* ================================================================== */
/*  MODAL WRAPPER                                                      */
/* ================================================================== */

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FORM FIELD HELPERS                                                 */
/* ================================================================== */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30", props.className)} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30", props.className)} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 resize-none", props.className)} />;
}

/* ================================================================== */
/*  EMPTY STATE                                                        */
/* ================================================================== */

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.FC<{ className?: string }>; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-muted/60"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ================================================================== */
/*  SUBJECTS MODULE                                                    */
/* ================================================================== */

function SubjectsModule() {
  const subjects = useQuery(api.student.listSubjects);
  const createSubject = useMutation(api.student.createSubject);
  const updateSubject = useMutation(api.student.updateSubject);
  const archiveSubject = useMutation(api.student.archiveSubject);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"subjects"> | null>(null);
  const [form, setForm] = useState({ name: "", teacher: "", color: SUBJECT_COLORS[0], targetGrade: "" });
  const [detailId, setDetailId] = useState<Id<"subjects"> | null>(null);

  const grades = useQuery(api.student.listGrades);
  const exams = useQuery(api.student.listExams);
  const sessions = useQuery(api.student.listStudySessions);

  const reset = () => { setForm({ name: "", teacher: "", color: SUBJECT_COLORS[0], targetGrade: "" }); setAddOpen(false); setEditId(null); };

  const submit = async () => {
    if (!form.name.trim()) return;
    if (editId) {
      await updateSubject({ id: editId, name: form.name, teacher: form.teacher || undefined, color: form.color, targetGrade: form.targetGrade ? parseFloat(form.targetGrade) : undefined });
    } else {
      await createSubject({ name: form.name, teacher: form.teacher || undefined, color: form.color, targetGrade: form.targetGrade ? parseFloat(form.targetGrade) : undefined });
    }
    reset();
  };

  const startEdit = (s: any) => {
    setForm({ name: s.name, teacher: s.teacher ?? "", color: s.color, targetGrade: s.targetGrade?.toString() ?? "" });
    setEditId(s._id);
    setAddOpen(true);
  };

  const detail = subjects?.find((s) => s._id === detailId);
  const subjectGrades = detail ? grades?.filter((g) => g.subjectId === detail._id) ?? [] : [];
  const subjectExams = detail ? exams?.filter((e) => e.subjectId === detail._id) ?? [] : [];
  const subjectSessions = detail ? sessions?.filter((s) => s.subjectId === detail._id) ?? [] : [];
  const subjectAvg = subjectGrades.length > 0 ? subjectGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.weight, 0) / subjectGrades.reduce((sum, g) => sum + g.weight, 0) : 0;

  if (subjects === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><BookOpen className="size-4 text-blue-600" />درس‌ها</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن درس</Button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="هنوز درسی اضافه نکردی" description="درس‌هایت را اضافه کن تا برنامه مطالعه و پیشرفت هر درس را دنبال کنی." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />افزودن اولین درس</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => {
            const subGrades = grades?.filter((g) => g.subjectId === s._id) ?? [];
            const avg = subGrades.length > 0 ? subGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.weight, 0) / subGrades.reduce((sum, g) => sum + g.weight, 0) : 0;
            const upcomingExam = exams?.filter((e) => e.subjectId === s._id && !e.completed && daysUntil(e.date) > 0).sort((a, b) => a.date.localeCompare(b.date))[0];
            return (
              <div key={s._id} className="group rounded-xl border border-border/60 p-3 transition-all hover:border-primary/30 hover:shadow-sm cursor-pointer" onClick={() => setDetailId(s._id)}>
                <div className="flex items-center gap-2">
                  <span className={cn("size-3 rounded-full", s.color)} />
                  <span className="text-sm font-bold">{s.name}</span>
                  <div className="ms-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(s); }} className="grid size-6 place-items-center rounded hover:bg-muted"><Pencil className="size-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); archiveSubject({ id: s._id }); }} className="grid size-6 place-items-center rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3" /></button>
                  </div>
                </div>
                {s.teacher && <p className="mt-0.5 text-[10px] text-muted-foreground">استاد: {s.teacher}</p>}
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <div className="text-xs font-extrabold tabular-nums">{avg > 0 ? toFa(Math.round(avg * 10) / 10) : "—"}</div>
                    <div className="text-[9px] text-muted-foreground">معدل</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <div className="text-xs font-extrabold tabular-nums">{toFa(Math.round(s.studyHours / 60 * 10) / 10)}h</div>
                    <div className="text-[9px] text-muted-foreground">مطالعه</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <div className="text-xs font-extrabold tabular-nums">{toFa(subGrades.length)}</div>
                    <div className="text-[9px] text-muted-foreground">نمره</div>
                  </div>
                </div>
                {upcomingExam && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <GraduationCap className="size-3" />
                    {upcomingExam.title} — {toFa(daysUntil(upcomingExam.date))} روز
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={addOpen} onClose={reset} title={editId ? "ویرایش درس" : "افزودن درس جدید"}>
        <div className="space-y-3">
          <Field label="نام درس"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً ریاضی" /></Field>
          <Field label="نام استاد (اختیاری)"><Input value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} placeholder="مثلاً دکتر محمدی" /></Field>
          <Field label="رنگ">
            <div className="flex gap-1.5">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} className={cn("size-7 rounded-full border-2 transition-all", c, form.color === c ? "border-foreground scale-110" : "border-transparent")} />
              ))}
            </div>
          </Field>
          <Field label="نمره هدف (اختیاری)"><Input type="number" min={0} max={20} step={0.5} value={form.targetGrade} onChange={(e) => setForm({ ...form, targetGrade: e.target.value })} placeholder="مثلاً 18" /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.name.trim()}>{editId ? "ذخیره" : "افزودن"}</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailId} onClose={() => setDetailId(null)} title={detail?.name ?? ""}>
        {detail && (
          <div className="space-y-4">
            {detail.teacher && <p className="text-xs text-muted-foreground">استاد: {detail.teacher}</p>}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-primary/5 p-3 text-center">
                <div className="text-lg font-extrabold text-primary tabular-nums">{subjectAvg > 0 ? toFa(Math.round(subjectAvg * 10) / 10) : "—"}</div>
                <div className="text-[10px] text-muted-foreground">معدل فعلی</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
                <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{detail.targetGrade ? toFa(detail.targetGrade) : "—"}</div>
                <div className="text-[10px] text-muted-foreground">نمره هدف</div>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-500/10">
                <div className="text-lg font-extrabold text-blue-600 tabular-nums">{toFa(Math.round(detail.studyHours / 60 * 10) / 10)}h</div>
                <div className="text-[10px] text-muted-foreground">زمان مطالعه</div>
              </div>
            </div>
            {subjectGrades.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-bold">نمرات</h4>
                <div className="space-y-1">
                  {subjectGrades.map((g) => (
                    <div key={g._id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                      <span className="font-semibold">{g.title}</span>
                      <span className="font-extrabold tabular-nums">{toFa(g.score)}/{toFa(g.maxScore)} <span className="text-muted-foreground">({toFa(g.weight)}٪)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {subjectExams.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-bold">امتحانات</h4>
                <div className="space-y-1">
                  {subjectExams.map((e) => (
                    <div key={e._id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                      <span className="font-semibold">{e.title}</span>
                      <span className="text-muted-foreground">{formatDate(e.date)} {e.completed && e.actualGrade !== undefined ? `— ${toFa(e.actualGrade)}` : `— ${toFa(daysUntil(e.date))} روز`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  EXAMS MODULE                                                       */
/* ================================================================== */

function ExamsModule() {
  const exams = useQuery(api.student.listExams);
  const subjects = useQuery(api.student.listSubjects);
  const createExam = useMutation(api.student.createExam);
  const updateExam = useMutation(api.student.updateExam);
  const deleteExam = useMutation(api.student.deleteExam);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: "", title: "", date: "", time: "", location: "", importance: "medium", targetGrade: "" });

  const subjectName = useCallback((id: Id<"subjects">) => subjects?.find((s) => s._id === id)?.name ?? "نامشخص", [subjects]);

  const reset = () => { setForm({ subjectId: "", title: "", date: "", time: "", location: "", importance: "medium", targetGrade: "" }); setAddOpen(false); };

  const submit = async () => {
    if (!form.subjectId || !form.title.trim() || !form.date) return;
    await createExam({
      subjectId: form.subjectId as Id<"subjects">,
      title: form.title,
      date: form.date,
      time: form.time || undefined,
      location: form.location || undefined,
      importance: form.importance,
      targetGrade: form.targetGrade ? parseFloat(form.targetGrade) : undefined,
    });
    reset();
  };

  const upcoming = exams?.filter((e) => !e.completed && daysUntil(e.date) > 0).sort((a, b) => a.date.localeCompare(b.date)) ?? [];
  const past = exams?.filter((e) => e.completed || daysUntil(e.date) <= 0).sort((a, b) => b.date.localeCompare(a.date)) ?? [];

  if (exams === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><GraduationCap className="size-4 text-violet-600" />امتحانات</h3>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={!subjects?.length}><Plus className="size-3.5" />افزودن امتحان</Button>
      </div>

      {exams.length === 0 ? (
        <EmptyState icon={GraduationCap} title="هنوز امتحانی ثبت نکردی" description="امتحاناتت را ثبت کن تا زمان باقی‌مانده و پیشرفت آماده‌سازی را دنبال کنی." action={<Button size="sm" onClick={() => setAddOpen(true)} disabled={!subjects?.length}><Plus className="size-3.5" />افزودن اولین امتحان</Button>} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">پیش رو</h4>
              <div className="space-y-2">
                {upcoming.map((ex) => {
                  const days = daysUntil(ex.date);
                  return (
                    <div key={ex._id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold">{ex.title}</span>
                          <span className="me-2 text-[10px] text-muted-foreground">{subjectName(ex.subjectId)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                            ex.importance === "high" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300" :
                            ex.importance === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" :
                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          )}>
                            {days <= 3 ? `${toFa(3)} روز!` : `${toFa(days)} روز`}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-to-l from-primary to-violet-500 transition-all" style={{ width: `${ex.preparationProgress}%` }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums">{toFa(ex.preparationProgress)}٪</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <CalendarDays className="size-3" />{formatDate(ex.date)}
                        {ex.location && <span>— {ex.location}</span>}
                        <div className="ms-auto flex gap-1">
                          <button onClick={() => updateExam({ id: ex._id, preparationProgress: Math.min(100, ex.preparationProgress + 10) })} className="rounded px-1.5 py-0.5 hover:bg-muted text-primary font-bold">+۱۰٪</button>
                          <button onClick={() => updateExam({ id: ex._id, completed: true })} className="rounded px-1.5 py-0.5 hover:bg-emerald-100 text-emerald-600 font-bold">✓ تمام</button>
                          <button onClick={() => deleteExam({ id: ex._id })} className="rounded px-1.5 py-0.5 hover:bg-destructive/10 text-destructive"><Trash2 className="size-3" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold text-muted-foreground">گذشته</h4>
              <div className="space-y-1">
                {past.map((ex) => (
                  <div key={ex._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-semibold">{ex.title} <span className="text-muted-foreground">({subjectName(ex.subjectId)})</span></span>
                    <span className="text-muted-foreground">{formatDate(ex.date)} {ex.actualGrade !== undefined ? `— ${toFa(ex.actualGrade)}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={addOpen} onClose={reset} title="افزودن امتحان">
        <div className="space-y-3">
          <Field label="امتحان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً آزمون میان‌ترم" /></Field>
          <Field label="درس">
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">انتخاب درس</option>
              {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاریخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="ساعت"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          </div>
          <Field label="مکان (اختیاری)"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مثلاً سالن ۳۰۱" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اولویت">
              <Select value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })}>
                <option value="high">مهم</option>
                <option value="medium">متوسط</option>
                <option value="low">عادی</option>
              </Select>
            </Field>
            <Field label="نمره هدف"><Input type="number" min={0} max={20} value={form.targetGrade} onChange={(e) => setForm({ ...form, targetGrade: e.target.value })} placeholder="18" /></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.subjectId || !form.title.trim() || !form.date}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  ASSIGNMENTS MODULE                                                 */
/* ================================================================== */

function AssignmentsModule() {
  const assignments = useQuery(api.student.listAssignments);
  const subjects = useQuery(api.student.listSubjects);
  const createAssignment = useMutation(api.student.createAssignment);
  const updateAssignment = useMutation(api.student.updateAssignment);
  const deleteAssignment = useMutation(api.student.deleteAssignment);
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [form, setForm] = useState({ subjectId: "", title: "", description: "", dueDate: "", difficulty: "medium", estimatedMinutes: "", priority: "medium" });

  const subjectName = useCallback((id: Id<"subjects">) => subjects?.find((s) => s._id === id)?.name ?? "نامشخص", [subjects]);

  const reset = () => { setForm({ subjectId: "", title: "", description: "", dueDate: "", difficulty: "medium", estimatedMinutes: "", priority: "medium" }); setAddOpen(false); };

  const submit = async () => {
    if (!form.subjectId || !form.title.trim() || !form.dueDate) return;
    await createAssignment({
      subjectId: form.subjectId as Id<"subjects">,
      title: form.title,
      description: form.description || undefined,
      dueDate: form.dueDate,
      difficulty: form.difficulty,
      estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
      priority: form.priority,
    });
    reset();
  };

  const filtered = assignments?.filter((a) => filter === "all" || a.status === filter).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) ?? [];
  const overdueCount = assignments?.filter((a) => a.status !== "completed" && daysUntil(a.dueDate) < 0).length ?? 0;

  if (assignments === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><FileText className="size-4 text-amber-600" />تکالیف
          {overdueCount > 0 && <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600 dark:bg-red-500/10">{toFa(overdueCount)}</span>}
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={!subjects?.length}><Plus className="size-3.5" />تکلیف جدید</Button>
      </div>

      <div className="flex gap-1">
        {([["all", "همه"], ["pending", "در انتظار"], ["completed", "انجام‌شده"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition-colors", filter === k ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted")}>{l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title={filter === "completed" ? "تکلیف انجام‌شده‌ای نداری" : "تکلیفی ثبت نشده"} description={filter === "completed" ? "تکالیفت را انجام بده تا اینجا نمایش داده شوند." : "تکالیفت را ثبت کن تا زمان تحویل و اولویت هر کدام را دنبال کنی."} action={filter !== "completed" ? <Button size="sm" onClick={() => setAddOpen(true)} disabled={!subjects?.length}><Plus className="size-3.5" />افزودن</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const days = daysUntil(a.dueDate);
            const isOver = days < 0 && a.status !== "completed";
            return (
              <div key={a._id} className={cn("rounded-xl border p-3 transition-all", isOver ? "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5" : "border-border/60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className={cn("text-sm font-bold", a.status === "completed" && "text-muted-foreground line-through")}>{a.title}</span>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{subjectName(a.subjectId)}</span>
                      <span>—</span>
                      <span>{formatDate(a.dueDate)}</span>
                      {a.estimatedMinutes && <span>~ {toFa(a.estimatedMinutes)} دقیقه</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {a.status !== "completed" && (
                      <button onClick={() => updateAssignment({ id: a._id, status: "completed" })} className="grid size-7 place-items-center rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/20 dark:hover:bg-emerald-500/10">
                        <CheckCircle2 className="size-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteAssignment({ id: a._id })} className="grid size-7 place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold",
                    a.priority === "high" ? "bg-red-100 text-red-600" : a.priority === "medium" ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground"
                  )}>{a.priority === "high" ? "بالا" : a.priority === "medium" ? "متوسط" : "پایین"}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold",
                    a.difficulty === "hard" ? "bg-violet-100 text-violet-600" : a.difficulty === "medium" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                  )}>{a.difficulty === "hard" ? "سخت" : a.difficulty === "medium" ? "متوسط" : "آسان"}</span>
                  {isOver && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:bg-red-500/10">عقب‌افتاده</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={reset} title="تکلیف جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً تمرین فصل ۳" /></Field>
          <Field label="درس">
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">انتخاب درس</option>
              {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="توضیحات"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیحات اختیاری…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="مهلت"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
            <Field label="زمان تقریبی (دقیقه)"><Input type="number" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} placeholder="60" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="اولویت"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="high">بالا</option><option value="medium">متوسط</option><option value="low">پایین</option></Select></Field>
            <Field label="سختی"><Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option value="hard">سخت</option><option value="medium">متوسط</option><option value="easy">آسان</option></Select></Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.subjectId || !form.title.trim() || !form.dueDate}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  GRADES MODULE + CALCULATOR                                         */
/* ================================================================== */

function GradesModule() {
  const grades = useQuery(api.student.listGrades);
  const subjects = useQuery(api.student.listSubjects);
  const createGrade = useMutation(api.student.createGrade);
  const deleteGrade = useMutation(api.student.deleteGrade);
  const updateSubject = useMutation(api.student.updateSubject);
  const [addOpen, setAddOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: "", title: "", score: "", maxScore: "20", weight: "20", date: todayKey(), notes: "" });

  const subjectName = useCallback((id: Id<"subjects">) => subjects?.find((s) => s._id === id)?.name ?? "نامشخص", [subjects]);

  const reset = () => { setForm({ subjectId: "", title: "", score: "", maxScore: "20", weight: "20", date: todayKey(), notes: "" }); setAddOpen(false); };

  const submit = async () => {
    if (!form.subjectId || !form.title.trim() || !form.score) return;
    await createGrade({
      subjectId: form.subjectId as Id<"subjects">,
      title: form.title,
      score: parseFloat(form.score),
      maxScore: parseFloat(form.maxScore) || 20,
      weight: parseFloat(form.weight) || 20,
      date: form.date,
      notes: form.notes || undefined,
    });
    // Update subject current grade
    const subjectGrades = grades?.filter((g) => g.subjectId === form.subjectId) ?? [];
    const allGrades = [...subjectGrades, { score: parseFloat(form.score), maxScore: parseFloat(form.maxScore) || 20, weight: parseFloat(form.weight) || 20 }];
    const avg = allGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.weight, 0) / allGrades.reduce((sum, g) => sum + g.weight, 0);
    await updateSubject({ id: form.subjectId as Id<"subjects">, currentGrade: Math.round(avg * 10) / 10 });
    reset();
  };

  const overallAvg = grades && grades.length > 0 ? grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.weight, 0) / grades.reduce((sum, g) => sum + g.weight, 0) : 0;

  if (grades === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="size-4 text-emerald-600" />نمرات
          {overallAvg > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10">معدل کل: {toFa(Math.round(overallAvg * 10) / 10)}</span>}
        </h3>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setCalcOpen(true)}><Calculator className="size-3.5" />ماشین حساب</Button>
          <Button size="sm" onClick={() => setAddOpen(true)} disabled={!subjects?.length}><Plus className="size-3.5" />نمره جدید</Button>
        </div>
      </div>

      {grades.length === 0 ? (
        <EmptyState icon={BarChart3} title="هنوز نمره‌ای ثبت نکردی" description="نمراتت را ثبت کن تا معدل و پیشرفت تحصیلی‌ات را دنبال کنی." action={<Button size="sm" onClick={() => setAddOpen(true)} disabled={!subjects?.length}><Plus className="size-3.5" />ثبت اولین نمره</Button>} />
      ) : (
        <div className="space-y-1">
          {grades.sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
            <div key={g._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <div>
                <span className="text-xs font-bold">{g.title}</span>
                <span className="ms-2 text-[10px] text-muted-foreground">{subjectName(g.subjectId)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold tabular-nums">{toFa(g.score)}/{toFa(g.maxScore)}</span>
                <span className="text-[10px] text-muted-foreground">({toFa(g.weight)}٪)</span>
                <button onClick={() => deleteGrade({ id: g._id })} className="grid size-5 place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grade Calculator Modal */}
      <Modal open={calcOpen} onClose={() => setCalcOpen(false)} title="ماشین حساب معدل">
        <GradeCalculatorInline />
      </Modal>

      <Modal open={addOpen} onClose={reset} title="ثبت نمره جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً آزمون پایان‌ترم" /></Field>
          <Field label="درس">
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">انتخاب درس</option>
              {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="نمره"><Input type="number" min={0} max={20} step={0.5} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></Field>
            <Field label="نمره کل"><Input type="number" min={1} max={20} value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /></Field>
            <Field label="وزن (٪)"><Input type="number" min={0} max={100} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></Field>
          </div>
          <Field label="تاریخ"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="یادداشت"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="اختیاری" /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.subjectId || !form.title.trim() || !form.score}>ذخیره</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  GRADE CALCULATOR (inline)                                          */
/* ================================================================== */

function GradeCalculatorInline() {
  const [grades, setGrades] = useState([
    { name: "ترم ۱", grade: 16, weight: 30 },
    { name: "ترم ۲", grade: 17.5, weight: 30 },
    { name: "ترم ۳", grade: 0, weight: 40 },
  ]);
  const [target, setTarget] = useState("18");

  const weightedSum = grades.reduce((sum, g) => sum + (g.grade * g.weight) / 100, 0);
  const totalWeight = grades.reduce((sum, g) => sum + (g.grade > 0 ? g.weight : 0), 0);
  const currentAvg = totalWeight > 0 ? (weightedSum / totalWeight) * 20 / 20 * 20 : 0;
  const normalizedAvg = totalWeight > 0 ? (weightedSum / (grades.reduce((sum, g) => sum + g.weight, 0) / 100)) : 0;

  const targetVal = parseFloat(target) || 0;
  const futureWeight = grades.find((g) => g.grade === 0)?.weight ?? 0;
  const needed = futureWeight > 0 && targetVal > 0 ? ((targetVal * grades.reduce((sum, g) => sum + g.weight, 0) / 100 - grades.filter((g) => g.grade > 0).reduce((sum, g) => sum + (g.grade * g.weight) / 100, 0)) / (futureWeight / 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {grades.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 truncate text-xs font-semibold text-muted-foreground">{g.name}</span>
            <input type="number" min={0} max={20} step={0.5} value={g.grade || ""} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setGrades((prev) => prev.map((x, j) => j === i ? { ...x, grade: Math.min(20, Math.max(0, v)) } : x)); }} className="w-16 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-center text-xs font-bold" placeholder="نمره" />
            <span className="text-[10px] text-muted-foreground">{toFa(g.weight)}٪</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-primary/5 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">معدل فعلی</span>
          <span className="text-lg font-extrabold text-primary tabular-nums">{toFa(Math.round(normalizedAvg * 10) / 10)}</span>
        </div>
      </div>
      <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">نمره مورد نیاز برای رسیدن به</span>
          <input type="number" min={0} max={20} step={0.5} value={target} onChange={(e) => setTarget(e.target.value)} className="w-12 rounded border border-border/60 bg-background px-1 py-0.5 text-center text-xs font-bold" />
        </div>
        <div className="mt-1 text-lg font-extrabold text-emerald-600 tabular-nums">
          {needed > 0 && needed <= 20 ? `${toFa(Math.round(needed * 10) / 10)} از ۲۰` : needed > 20 ? "غیرممکن 😔" : "—"}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STUDY SESSIONS MODULE                                              */
/* ================================================================== */

function StudySessionsModule() {
  const sessions = useQuery(api.student.listStudySessions);
  const subjects = useQuery(api.student.listSubjects);
  const createSession = useMutation(api.student.createStudySession);
  const updateSession = useMutation(api.student.updateStudySession);
  const deleteSession = useMutation(api.student.deleteStudySession);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: "", title: "", plannedMinutes: "45", type: "study" });

  const subjectName = useCallback((id?: Id<"subjects">) => id ? subjects?.find((s) => s._id === id)?.name ?? "عمومی" : "عمومی", [subjects]);
  const reset = () => { setForm({ subjectId: "", title: "", plannedMinutes: "45", type: "study" }); setAddOpen(false); };

  const submit = async () => {
    await createSession({
      subjectId: form.subjectId ? (form.subjectId as Id<"subjects">) : undefined,
      title: form.title || undefined,
      plannedMinutes: parseInt(form.plannedMinutes) || 45,
      actualMinutes: 0,
      date: todayKey(),
      completed: false,
      type: form.type,
    });
    reset();
  };

  const today = sessions?.filter((s) => s.date === todayKey()) ?? [];
  const totalPlanned = today.reduce((sum, s) => sum + s.plannedMinutes, 0);
  const totalActual = today.reduce((sum, s) => sum + s.actualMinutes, 0);
  const executionRate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions?.filter((s) => new Date(s.date) >= weekStart) ?? [];
  const weekActual = weekSessions.reduce((sum, s) => sum + s.actualMinutes, 0);

  if (sessions === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Clock className="size-4 text-cyan-600" />جلسات مطالعه</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />جلسه جدید</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-cyan-50 p-3 text-center dark:bg-cyan-500/10">
          <div className="text-lg font-extrabold text-cyan-600 tabular-nums">{toFa(Math.round(weekActual / 60 * 10) / 10)}h</div>
          <div className="text-[10px] text-muted-foreground">این هفته</div>
        </div>
        <div className="rounded-xl bg-primary/5 p-3 text-center">
          <div className="text-lg font-extrabold text-primary tabular-nums">{toFa(today.length)}</div>
          <div className="text-[10px] text-muted-foreground">جلسه امروز</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{toFa(executionRate)}٪</div>
          <div className="text-[10px] text-muted-foreground">نرخ اجرا</div>
        </div>
      </div>

      {/* Planned vs Actual */}
      {totalPlanned > 0 && (
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold">برنامه‌ریزی شده: {toFa(Math.round(totalPlanned / 60 * 10) / 10)}h</span>
            <span className="font-bold text-emerald-600">انجام شده: {toFa(Math.round(totalActual / 60 * 10) / 10)}h</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-500 transition-all" style={{ width: `${Math.min(100, executionRate)}%` }} />
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState icon={Clock} title="اولین جلسه مطالعه‌ات را برنامه‌ریزی کن" description="جلسات مطالعه کمک می‌کنن زمان مطالعه و پیشرفت هر درس را دقیق دنبال کنی." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />شروع</Button>} />
      ) : (
        <div className="space-y-1.5">
          {sessions.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map((s) => (
            <div key={s._id} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-xs", s.completed ? "bg-emerald-50/50 dark:bg-emerald-500/5" : "bg-muted/30")}>
              <div>
                <span className="font-bold">{s.title || subjectName(s.subjectId)}</span>
                <span className="ms-2 text-muted-foreground">{formatDate(s.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">{toFa(s.actualMinutes)}/{toFa(s.plannedMinutes)} دقیقه</span>
                {s.completed ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                ) : (
                  <button onClick={() => updateSession({ id: s._id, completed: true, actualMinutes: s.plannedMinutes })} className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-600 font-bold text-[10px] hover:bg-emerald-200">اتمام</button>
                )}
                <button onClick={() => deleteSession({ id: s._id })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={reset} title="جلسه مطالعه جدید">
        <div className="space-y-3">
          <Field label="درس (اختیاری)">
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">عمومی</option>
              {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="عنوان (اختیاری)"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً مرور فصل ۴" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="زمان برنامه‌ریزی (دقیقه)"><Input type="number" min={5} step={5} value={form.plannedMinutes} onChange={(e) => setForm({ ...form, plannedMinutes: e.target.value })} /></Field>
            <Field label="نوع">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="study">مطالعه</option>
                <option value="focus">تمرکز</option>
                <option value="review">مرور</option>
              </Select>
            </Field>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit}>افزودن</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  STUDENT NOTES MODULE                                               */
/* ================================================================== */

function StudentNotesModule() {
  const notes = useQuery(api.student.listNotes);
  const subjects = useQuery(api.student.listSubjects);
  const createNote = useMutation(api.student.createNote);
  const updateNote = useMutation(api.student.updateNote);
  const deleteNote = useMutation(api.student.deleteNote);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState({ subjectId: "", title: "", content: "", tags: "", noteType: "quick" });

  const subjectName = useCallback((id?: Id<"subjects">) => id ? subjects?.find((s) => s._id === id)?.name ?? "" : "", [subjects]);
  const reset = () => { setForm({ subjectId: "", title: "", content: "", tags: "", noteType: "quick" }); setAddOpen(false); };

  const submit = async () => {
    if (!form.title.trim()) return;
    await createNote({
      subjectId: form.subjectId ? (form.subjectId as Id<"subjects">) : undefined,
      title: form.title,
      content: form.content,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      noteType: form.noteType,
    });
    reset();
  };

  const filtered = notes?.filter((n) => {
    if (typeFilter !== "all" && n.noteType !== typeFilter) return false;
    if (search && !n.title.includes(search) && !n.content.includes(search) && !n.tags.some((t) => t.includes(search))) return false;
    return true;
  }).sort((a, b) => b.updatedAt - a.updatedAt) ?? [];

  const typeLabels: Record<string, string> = { subject: "درسی", lecture: "جلسه‌ای", exam: "امتحانی", quick: "سریع", revision: "مروری" };

  if (notes === undefined) return <div className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><BookMarked className="size-4 text-rose-600" />یادداشت‌ها</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />یادداشت جدید</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو…" className="w-full rounded-lg border border-border/60 bg-background pe-8 ps-8 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs font-medium">
          <option value="all">همه</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookMarked} title="هنوز یادداشتی نداری" description="یادداشت‌های درسی، جلسه‌ای یا مروری‌ات را اینجا ذخیره کن." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" />اولین یادداشت</Button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div key={n._id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold">{n.title}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">{typeLabels[n.noteType] ?? n.noteType}</span>
                    {n.isFavorite && <Star className="size-3 fill-amber-400 text-amber-400" />}
                  </div>
                  {n.content && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{n.content}</p>}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {n.subjectId && <span className="text-[9px] text-primary">{subjectName(n.subjectId)}</span>}
                    {n.tags.map((t) => <span key={t} className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">{t}</span>)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => updateNote({ id: n._id, isFavorite: !n.isFavorite })} className="grid size-6 place-items-center rounded hover:bg-muted"><Star className={cn("size-3", n.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} /></button>
                  <button onClick={() => deleteNote({ id: n._id })} className="grid size-6 place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="size-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={reset} title="یادداشت جدید">
        <div className="space-y-3">
          <Field label="عنوان"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً فرمول‌های فصل ۳" /></Field>
          <Field label="نوع">
            <Select value={form.noteType} onChange={(e) => setForm({ ...form, noteType: e.target.value })}>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="درس (اختیاری)">
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">بدون درس</option>
              {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="محتوا"><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="محتوای یادداشت…" /></Field>
          <Field label="برچسب‌ها (با کاما جدا کنید)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="مثلاً فرمول, امتحان, فصل ۳" /></Field>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={!form.title.trim()}>ذخیره</Button>
            <Button variant="ghost" onClick={reset}>لغو</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  FOCUS CENTER                                                       */
/* ================================================================== */

function FocusCenter() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [targetMinutes, setTargetMinutes] = useState(25);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subjects = useQuery(api.student.listSubjects);
  const createSession = useMutation(api.student.createStudySession);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const progress = Math.min(100, (elapsed / (targetMinutes * 60)) * 100);

  const start = () => {
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };
  const stop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
  const complete = async () => {
    stop();
    await createSession({
      subjectId: selectedSubject ? (selectedSubject as Id<"subjects">) : undefined,
      title: "تمرکز مطالعه",
      plannedMinutes: targetMinutes,
      actualMinutes: mins,
      date: todayKey(),
      completed: true,
      type: "focus",
    });
    setElapsed(0);
  };
  const reset = () => { stop(); setElapsed(0); };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="ui-surface rounded-2xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="ui-icon-tile size-6"><Brain className="size-3.5 text-violet-600" /></span>
        مرکز تمرکز
      </h3>

      <div className="flex flex-col items-center">
        {/* Timer circle */}
        <div className="relative mb-4">
          <svg className="size-36 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" strokeDasharray={`${progress * 2.64} 264`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black tabular-nums">{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
            <span className="text-[10px] text-muted-foreground">{targetMinutes} دقیقه</span>
          </div>
        </div>

        {/* Subject selector */}
        <div className="mb-3 w-full max-w-xs">
          <Select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="text-xs">
            <option value="">انتخاب درس</option>
            {subjects?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
        </div>

        {/* Duration presets */}
        <div className="mb-3 flex gap-1.5">
          {[15, 25, 45, 60].map((m) => (
            <button key={m} onClick={() => setTargetMinutes(m)} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition-colors", targetMinutes === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted")}>
              {toFa(m)} دقیقه
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {!running ? (
            <Button onClick={start}><Zap className="size-3.5" />شروع تمرکز</Button>
          ) : (
            <>
              <Button variant="destructive" onClick={stop}><TriangleAlert className="size-3.5" />توقف</Button>
              <Button onClick={complete} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="size-3.5" />اتمام</Button>
            </>
          )}
          {elapsed > 0 && !running && <Button variant="ghost" onClick={reset}><RotateCcw className="size-3.5" /></Button>}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  STUDY ANALYTICS                                                    */
/* ================================================================== */

function StudyAnalytics() {
  const sessions = useQuery(api.student.listStudySessions);
  const grades = useQuery(api.student.listGrades);
  const subjects = useQuery(api.student.listSubjects);

  if (!sessions || !grades || !subjects) return <div className="py-4 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>;

  // Weekly stats
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions.filter((s) => new Date(s.date) >= weekStart);
  const weekPlanned = weekSessions.reduce((sum, s) => sum + s.plannedMinutes, 0);
  const weekActual = weekSessions.reduce((sum, s) => sum + s.actualMinutes, 0);
  const weekRate = weekPlanned > 0 ? Math.round((weekActual / weekPlanned) * 100) : 0;

  // Monthly stats
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthSessions = sessions.filter((s) => new Date(s.date) >= monthStart);
  const monthActual = monthSessions.reduce((sum, s) => sum + s.actualMinutes, 0);

  // Streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (sessions.some((s) => s.date === key && s.completed)) streak++;
    else break;
  }

  // Subject distribution
  const subjectMinutes = new Map<string, number>();
  for (const s of sessions) {
    const key = s.subjectId ?? "general";
    subjectMinutes.set(key, (subjectMinutes.get(key) ?? 0) + s.actualMinutes);
  }

  // Overall average
  const overallAvg = grades.length > 0 ? grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.weight, 0) / grades.reduce((sum, g) => sum + g.weight, 0) : 0;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-blue-600" />تحلیل مطالعه</h3>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-primary/5 p-3 text-center">
          <div className="text-lg font-extrabold text-primary tabular-nums">{toFa(streak)}</div>
          <div className="text-[10px] text-muted-foreground">روز استمرار 🔥</div>
        </div>
        <div className="rounded-xl bg-cyan-50 p-3 text-center dark:bg-cyan-500/10">
          <div className="text-lg font-extrabold text-cyan-600 tabular-nums">{toFa(Math.round(weekActual / 60 * 10) / 10)}h</div>
          <div className="text-[10px] text-muted-foreground">مطالعه هفته</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
          <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{toFa(weekRate)}٪</div>
          <div className="text-[10px] text-muted-foreground">نرخ اجرای هفتگی</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-500/10">
          <div className="text-lg font-extrabold text-amber-600 tabular-nums">{overallAvg > 0 ? toFa(Math.round(overallAvg * 10) / 10) : "—"}</div>
          <div className="text-[10px] text-muted-foreground">معدل کل</div>
        </div>
      </div>

      {/* Planned vs Actual */}
      <div className="rounded-xl border border-border/60 p-4">
        <h4 className="mb-2 text-xs font-bold">برنامه در مقابل اجرا — این هفته</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">برنامه‌ریزی شده</span>
            <span className="font-extrabold tabular-nums">{toFa(Math.round(weekPlanned / 60 * 10) / 10)}h</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">انجام شده</span>
            <span className="font-extrabold tabular-nums text-emerald-600">{toFa(Math.round(weekActual / 60 * 10) / 10)}h</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-500 transition-all" style={{ width: `${Math.min(100, weekRate)}%` }} />
          </div>
        </div>
      </div>

      {/* Subject distribution */}
      {subjectMinutes.size > 0 && (
        <div className="rounded-xl border border-border/60 p-4">
          <h4 className="mb-2 text-xs font-bold">توزیع مطالعه بر اساس درس</h4>
          <div className="space-y-2">
            {Array.from(subjectMinutes.entries()).sort((a, b) => b[1] - a[1]).map(([key, mins]) => {
              const subj = subjects.find((s) => s._id === key);
              const name = subj?.name ?? "عمومی";
              const color = subj?.color ?? "bg-gray-400";
              const total = Array.from(subjectMinutes.values()).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((mins / total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", color)} />{name}</div>
                    <span className="font-bold tabular-nums">{toFa(Math.round(mins / 60 * 10) / 10)}h ({toFa(pct)}٪)</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAIN STUDENT WORKSPACE                                             */
/* ================================================================== */

export function StudentWorkspace() {
  const { tasks, projects, toggleDone, deleteTask, openTask, createTask } = useWorkspace();
  const { personaKey } = useUserProfile();

  // Student sub-modules for dashboard tab navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "subjects" | "exams" | "assignments" | "grades" | "sessions" | "notes" | "focus" | "analytics">("dashboard");

  const tKey = todayKey();
  const root = tasks.filter((t) => !t.parentId);
  const todayTasks = root.filter((t) => t.dueDate === tKey && t.status !== "done");
  const overdue = root.filter((t) => isOverdue(t));
  const allToday = root.filter((t) => t.dueDate === tKey);
  const completed = allToday.filter((t) => t.status === "done").length;
  const pct = allToday.length ? Math.round((completed / allToday.length) * 100) : 0;

  const subtotals = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const cur = m.get(t.parentId) ?? { total: 0, done: 0 };
      cur.total++;
      if (t.status === "done") cur.done++;
      m.set(t.parentId, cur);
    }
    return m;
  }, [tasks]);
  const projectOf = (id?: string) => projects.find((p) => p._id === id);

  const TABS = [
    { key: "dashboard" as const, label: "داشبورد", icon: LayoutDashboard },
    { key: "subjects" as const, label: "درس‌ها", icon: BookOpen },
    { key: "exams" as const, label: "امتحانات", icon: GraduationCap },
    { key: "assignments" as const, label: "تکالیف", icon: FileText },
    { key: "grades" as const, label: "نمرات", icon: BarChart3 },
    { key: "sessions" as const, label: "مطالعه", icon: Clock },
    { key: "notes" as const, label: "یادداشت", icon: BookMarked },
    { key: "focus" as const, label: "تمرکز", icon: Brain },
    { key: "analytics" as const, label: "تحلیل", icon: TrendingUp },
  ];

  return (
    <WorkspaceLayout>
      {/* Tab navigation */}
      <div className="mb-4 -mx-1 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 px-1 pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dashboard Tab ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "کارهای امروز", value: allToday.length, icon: ListChecks, color: "text-foreground" },
              { label: "انجام‌شده", value: completed, icon: CheckCircle2, color: "text-emerald-600" },
              { label: "عقب‌افتاده", value: overdue.length, icon: AlertCircle, color: "text-red-500" },
              { label: "نرخ تکمیل", value: `${toFa(pct)}٪`, icon: Target, color: "text-primary" },
            ].map((s) => (
              <div key={s.label} className="ui-surface rounded-2xl p-3 text-center">
                <s.icon className={`mx-auto mb-1 size-5 ${s.color}`} />
                <div className="text-lg font-extrabold tabular-nums">{typeof s.value === "number" ? toFa(s.value) : s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Compact persona stats (Phase 04) - secondary to today's work */}
          <PersonaStatsStrip />

          {/* Today's tasks */}
          <section className="ui-surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold"><span className="ui-icon-tile size-6"><ListChecks className="size-3.5 text-primary" /></span>کارهای امروز</h2>
            </div>
            {allToday.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold">برنامه امروز خالی است!</p>
                <p className="mt-1 text-xs text-muted-foreground">کارهای درسی‌ات را اضافه کن تا برنامه مطالعه‌ات شکل بگیرد.</p>
              </div>
            ) : (
              <ul>{allToday.map((t: any) => <TaskRow key={t._id} task={t} project={projectOf(t.projectId)} subtaskTotal={subtotals.get(t._id)?.total} subtaskDone={subtotals.get(t._id)?.done} onToggle={(done) => toggleDone(t, done)} onOpen={() => openTask(t._id)} onDelete={() => deleteTask(t._id)} />)}</ul>
            )}
          </section>

          {/* Smart input */}
          <SmartTaskInput onCreate={(p) => createTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, tags: p.tags })} />

          {/* Quick Focus */}
          <FocusCenter />
        </div>
      )}

      {/* ── Subjects Tab ── */}
      {activeTab === "subjects" && <SubjectsModule />}

      {/* ── Exams Tab ── */}
      {activeTab === "exams" && <ExamsModule />}

      {/* ── Assignments Tab ── */}
      {activeTab === "assignments" && <AssignmentsModule />}

      {/* ── Grades Tab ── */}
      {activeTab === "grades" && <GradesModule />}

      {/* ── Study Sessions Tab ── */}
      {activeTab === "sessions" && <StudySessionsModule />}

      {/* ── Notes Tab ── */}
      {activeTab === "notes" && <StudentNotesModule />}

      {/* ── Focus Tab ── */}
      {activeTab === "focus" && (
        <div className="space-y-4">
          <FocusCenter />
          <StudySessionsModule />
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && (
        <CapabilityGate featureKey="study_analytics">
          <StudyAnalytics />
        </CapabilityGate>
      )}
    </WorkspaceLayout>
  );
}
