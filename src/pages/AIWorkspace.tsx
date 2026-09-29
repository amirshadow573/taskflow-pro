/**
 * Phase 15 — full-screen AI workspace (§32).
 *
 * Same body as the slide-over panel, no modal: this is what a phone gets when
 * the user opens the assistant from a link or a deep entry point. It is NOT in
 * the primary nav (§7) — it is reached contextually, so the assistant never
 * becomes a top-level destination that competes with the actual work.
 */
import { Link } from "react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AIAssistantBody } from "@/components/ai/AIAssistantPanel";

export default function AIWorkspace() {
  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" aria-hidden="true" />
          بازگشت به فضای کاری
        </Link>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <ShieldCheck className="size-3" aria-hidden="true" />
          بدون تغییر خودکار
        </p>
      </div>

      <div className="ui-surface mx-4 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <AIAssistantBody feature="workspace" />
      </div>
    </main>
  );
}
