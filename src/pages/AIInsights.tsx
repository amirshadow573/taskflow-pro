/**
 * Phase 16 — AI Insights page (§14).
 *
 * A dedicated intelligence workspace, but NOT a top-level nav destination: it
 * is reached from the dashboard strip, from Today, and from the "پیشرفته" nav
 * group, so the assistant never competes with the actual work (§7, §14).
 */
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { AIInsightsCenter } from "@/components/ai/AIInsightsCenter";

export default function AIInsights() {
  return (
    <main className="mx-auto max-w-5xl p-4 pb-24 md:p-8">
      <header className="mb-4 space-y-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" aria-hidden="true" />
          بازگشت به فضای کاری
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">بینش‌های هوشمند</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          الگوها را موتور بهره‌وری محاسبه می‌کند؛ دستیار آن‌ها را توضیح می‌دهد و پیشنهاد می‌دهد.
          هیچ تغییری بدون تأیید شما اعمال نمی‌شود.
        </p>
      </header>

      <AIInsightsCenter />
    </main>
  );
}
