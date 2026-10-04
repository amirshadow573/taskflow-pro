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
    <div className="mx-auto w-full max-w-[1180px] space-y-5 px-4 py-5 md:px-7 md:py-7">
      {/* Greeting header with persona badge */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight md:text-2xl">
            {pg.greeting}{name ? `، ${name}` : ""}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {pg.sub} — {formatJalaliFull(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {headerExtra}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
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
