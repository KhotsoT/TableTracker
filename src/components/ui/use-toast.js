import { toast as sonnerToast } from "sonner"

export function toast({ title, description, variant = "default" }) {
  sonnerToast[variant === "destructive" ? "error" : "success"](title, {
    description: description,
  })
} 