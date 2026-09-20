"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.35rem] w-9 shrink-0 items-center rounded-full border border-transparent p-[3px] shadow-[inset_0_1px_3px_rgba(30,64,175,0.12)] outline-none transition-all duration-200",
        "data-[state=unchecked]:bg-slate-300/70 dark:data-[state=unchecked]:bg-slate-700/70",
        "data-[state=checked]:bg-gradient-to-l data-[state=checked]:from-primary data-[state=checked]:to-[#5B5FE6] data-[state=checked]:shadow-[0_5px_14px_-7px_rgba(37,99,235,0.9)]",
        "focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-white pointer-events-none block size-4 rounded-full shadow-[0_1px_3px_rgba(15,23,42,0.28)] ring-0 transition-transform duration-200",
          "data-[state=checked]:translate-x-[calc(100%-1px)] data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-[calc(100%-1px)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
