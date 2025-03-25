"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "border glow",
          error: "!bg-card !text-red-600 border-red-600/20 glow",
          success: "!bg-card !text-emerald-600 border-emerald-600/20 glow",
          warning: "!bg-card !text-amber-600 border-amber-600/20 glow",
          info: "!bg-card !text-sky-600 border-sky-600/20 glow",
          description: "!text-muted-foreground",
        },
        duration: 3000,
      }}
      {...props}
    />
  )
}

export { Toaster }
