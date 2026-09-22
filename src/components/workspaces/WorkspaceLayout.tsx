import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { formatJalaliFull, toJalaliDate, JALALI_MONTHS, toFa } from "@/lib/persian";
import { PERSONA_GREETINGS, personaMeta } from "@/lib/personas";
import { MyEnvironment } from "@/components/context/MyEnvironment";
import type { ReactNode } from "react";

/**
 * Shared layout for all persona-specific workspaces.
 * Provides: greeting header with persona badge, consistent container.
 */
export function WorkspaceLayout({
  children,
  headerExtra,
  showEnvironment = true,
}: {
  children: ReactNode;
  headerExtra?: ReactNode;
  /** Set false on pages where the environment card would add clutter. */
  showEnvironment?: boolean;
}) {
  const { user } = useAuth();
  const { personaKey } = useUserProfile();
  const pg = PERSONA_GREETINGS[personaKey] ?? PERSONA_GREETINGS.personal;
  const pm = personaMeta(personaKey);
  const j = toJalaliDate(new Date());
  const name = user?.name ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Greeting header with persona badge */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {pg.greeting}{name ? `، ${name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pg.sub} — {formatJalaliFull(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/60 px-3 py-1.5 text-xs font-bold text-foreground dark:bg-white/5">
            <span>{pm.emoji}</span>
            <span>{pm.label}</span>
          </span>
          <div className="text-xs text-muted-foreground">
            {JALALI_MONTHS[j.jm - 1]} {toFa(j.jy)}
          </div>
        </div>
      </header>
      {/* Context Engine — simple surface: "My Institute / My Workplace / My Team" */}
      {showEnvironment !== false && <MyEnvironment compact />}
      {children}
    </div>
  );
}
