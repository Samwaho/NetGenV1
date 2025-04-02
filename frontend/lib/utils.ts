import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, parseISO } from "date-fns"
import { TZDate, tz } from "@date-fns/tz"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateToNowInTimezone(date: string | Date, timezone: string = "Africa/Nairobi"): string {
  // Parse the input date as UTC first
  const utcDate = typeof date === 'string' 
    ? new Date(date + 'Z')  // Append Z to treat the input as UTC
    : date
    
  // Create TZDate with the UTC date
  const tzDate = new TZDate(utcDate, timezone)
  
  return formatDistanceToNow(tzDate, { 
    addSuffix: true,
    in: tz(timezone)
  })
}







