import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Input({className,...props}:InputHTMLAttributes<HTMLInputElement>){return <input className={cn("min-h-10 w-full border border-border bg-background px-3 text-sm",className)} {...props}/>}
