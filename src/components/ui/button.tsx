import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-l from-primary to-[#5B5FE6] text-white shadow-[0_8px_20px_-9px_rgba(37,99,235,0.75),inset_0_1px_0_rgba(255,255,255,0.24)] hover:shadow-[0_12px_28px_-10px_rgba(37,99,235,0.85),inset_0_1px_0_rgba(255,255,255,0.3)] hover:brightness-[1.06]",
        destructive:
          "bg-gradient-to-l from-destructive to-[#e11d48] text-white shadow-[0_8px_20px_-10px_rgba(239,68,68,0.7),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-[1.06]",
        outline:
          "ui-field text-foreground hover:text-primary",
        secondary:
          "border border-white/60 bg-white/70 text-secondary-foreground shadow-[0_4px_14px_-8px_rgba(30,64,175,0.35)] backdrop-blur-sm hover:border-primary/30 hover:bg-white/90 dark:border-white/10 dark:bg-slate-800/50 dark:hover:bg-slate-800/70",
        ghost:
          "text-foreground hover:bg-white/60 dark:hover:bg-white/5",
        link: "text-primary underline-offset-4 hover:underline",
        soft: "border border-white/50 bg-accent/80 text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
