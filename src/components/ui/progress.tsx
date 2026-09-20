import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/12 shadow-[inset_0_1px_2px_rgba(30,64,175,0.08)] dark:bg-primary/20",
        className
      )}
      {...props}
    >
      {/*
       * RTL-first fill: the indicator is sized (not translated), so it always
       * grows from the start edge — the right side in this Persian UI — instead
       * of the physical-left edge a translateX fill would produce.
       */}
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full rounded-full bg-gradient-to-l from-primary to-[#5B5FE6] shadow-[0_0_12px_-2px_rgba(59,130,246,0.7)] transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
