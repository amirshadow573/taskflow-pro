import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background/0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-l from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-600/35 hover:brightness-105 active:scale-[.98]",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-600/90",
        outline:
          "border border-black/10 bg-white/55 backdrop-blur-md hover:bg-white/75 text-foreground",
        secondary:
          "bg-black/[.05] text-foreground hover:bg-black/[.08]",
        ghost: "hover:bg-black/[.06] text-foreground",
        link: "text-blue-600 underline-offset-4 hover:underline",
        glass:
          "border border-white/60 bg-white/55 backdrop-blur-md shadow-[0_4px_18px_oklch(0.5_0.05_250/10%)] hover:bg-white/75 hover:shadow-[0_6px_24px_oklch(0.5_0.05_250/16%)] active:scale-[.98] text-foreground",
        "glass-outline":
          "border border-blue-500/25 bg-blue-500/5 backdrop-blur-md text-blue-700 hover:bg-blue-500/15",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
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
