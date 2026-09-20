import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "ui-field placeholder:text-muted-foreground/80 flex field-sizing-content min-h-20 w-full rounded-xl px-3.5 py-2.5 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-[3px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
