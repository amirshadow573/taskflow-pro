"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[18px] shrink-0 rounded-[6px] border border-input/80 bg-white/80 shadow-[inset_0_1px_2px_rgba(30,64,175,0.06)] outline-none transition-all duration-200",
        "data-[state=checked]:border-transparent data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-primary data-[state=checked]:to-[#5B5FE6] data-[state=checked]:text-white data-[state=checked]:shadow-[0_5px_14px_-7px_rgba(37,99,235,0.9)]",
        "focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-white/15 dark:bg-slate-800/60",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
