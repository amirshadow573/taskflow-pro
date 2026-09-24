/**
 * Student workspace shell — Phase 09.
 *
 * The student modules (subjects, exams, assignments, grades, study sessions,
 * notes, focus, analytics) already live in StudentWorkspace and are kept
 * exactly as they were. This thin shell only changes what the user sees FIRST:
 * the persona-aware CommandCenter (today's study plan → next action → compact
 * progression → planning) instead of a wall of feature widgets. Every student
 * module stays one tap away.
 */
import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { StudentWorkspace } from "./StudentWorkspace";
import { CommandCenter } from "@/components/workspace/command/CommandCenter";

export function StudentWorkspaceCommand() {
  const [showModules, setShowModules] = useState(false);

  if (showModules) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowModules(false)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ChevronUp className="size-3.5" />
          بازگشت به داشبورد
        </button>
        <StudentWorkspace />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CommandCenter
        quickLinks={[
          { label: "درس‌ها", onClick: () => setShowModules(true) },
          { label: "امتحانات", onClick: () => setShowModules(true) },
          { label: "تکالیف", onClick: () => setShowModules(true) },
          { label: "جلسات مطالعه", onClick: () => setShowModules(true) },
        ]}
      />
      <button
        type="button"
        onClick={() => setShowModules(true)}
        className="w-full rounded-xl border border-border/60 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        بخش‌های تخصصی دانشجو (درس‌ها، آزمون‌ها، تکالیف، نمرات، مطالعه)
      </button>
    </div>
  );
}
