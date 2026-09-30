/**
 * Visual Timeline (Phase 17) — the `/timeline` route.
 *
 * A thin page shell: the board owns all of the timeline's behaviour. The
 * route is registered in the shared navigation config, so it appears in the
 * desktop sidebar AND the mobile hamburger drawer from the same source of
 * truth, and is reachable from the command palette.
 */
import { TimelineBoard } from "@/components/timeline/TimelineBoard";

export default function TimelinePage() {
  return (
    <div className="h-full min-h-0">
      <TimelineBoard />
    </div>
  );
}
