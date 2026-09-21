import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { enableTestMode, ONBOARDING_PERSONAS, type PersonaKey } from "@/lib/personas";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Test mode persona picker — lets developers enter a persona workspace
 * without real authentication. Marked as test/development only.
 */
export default function TestModePicker() {
  const [selected, setSelected] = useState<PersonaKey | null>(null);
  const navigate = useNavigate();

  const enter = () => {
    if (!selected) return;
    enableTestMode(selected);
    navigate("/dashboard");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2 flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
        TEST MODE — بدون نیاز به حساب کاربری
      </div>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">نسخه آزمایشی فضای کاری</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        نقش مورد نظر را انتخاب کنید تا فضای کاری متناسب با آن بارگذاری شود. این حالت فقط برای تست است.
      </p>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ONBOARDING_PERSONAS.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelected(p.key)}
            className={cn(
              "flex min-h-20 items-start gap-2.5 rounded-2xl border p-3.5 text-start transition-all duration-200",
              selected === p.key
                ? "border-primary/50 bg-accent/70 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                : "border-border/70 bg-white/50 hover:border-primary/30 hover:bg-white/80 dark:bg-white/5",
            )}
          >
            <span className="text-xl">{p.emoji}</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{p.label}</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">{p.description}</span>
            </span>
            {selected === p.key && (
              <span className="ms-auto mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={enter} disabled={!selected}>
          ورود به نسخه آزمایشی
          <ArrowLeft className="size-4" />
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")}>بازگشت</Button>
      </div>
    </div>
  );
}
