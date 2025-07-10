import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateToNowInTimezone(date: string | Date | null | undefined, timezone: string = "Africa/Nairobi"): string {
  if (!date) return 'No date available';
  
  try {
    // Parse the input date and explicitly handle it as UTC
    const utcDate = typeof date === 'string' 
      ? new Date(date + 'Z')  // Append Z to ensure UTC parsing
      : date;
      
    if (isNaN(utcDate.getTime())) {
      return 'Invalid date';
    }
    
    // Convert to target timezone
    const tzDate = toZonedTime(utcDate, timezone)
    
    return formatDistanceToNow(tzDate, { 
      addSuffix: true,
      locale: enUS // ensure consistent locale
    })
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

export function formatDateToNow(date: string | Date | null | undefined): string {
  if (!date) return 'No date available';
  
  try {
    // Parse the input date and explicitly handle it as UTC
    const utcDate = typeof date === 'string' 
      ? new Date(date + 'Z')  // Append Z to ensure UTC parsing
      : date;
      
    if (isNaN(utcDate.getTime())) {
      return 'Invalid date';
    }
    
    return formatDistanceToNow(utcDate, { 
      addSuffix: true,
      locale: enUS // ensure consistent locale
    })
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

export function formatBytes(bytes: number | string): string {
  const numBytes = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!numBytes || isNaN(numBytes)) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(numBytes) / Math.log(k));

  return `${parseFloat((numBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0s';
  
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);
  
  return parts.join(' ');
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
};

// Add KES currency formatter
export const formatKESCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function formatExpirationDate(date: string | Date | null | undefined, timezone: string = "Africa/Nairobi"): string {
  if (!date) return 'No expiration date';
  
  try {
    // Parse the input date and explicitly handle it as UTC
    const utcDate = typeof date === 'string' 
      ? new Date(date + 'Z')  // Append Z to ensure UTC parsing
      : date;
      
    if (isNaN(utcDate.getTime())) {
      return 'Invalid date';
    }
    
    // Convert to target timezone
    const tzDate = toZonedTime(utcDate, timezone);
    const now = new Date();
    
    // If the date has already passed, show "Expired"
    if (tzDate < now) {
      return 'Expired';
    }
    
    // Otherwise show relative time
    return formatDistanceToNow(tzDate, { 
      addSuffix: true,
      locale: enUS
    });
  } catch (error) {
    console.error('Error formatting expiration date:', error);
    return 'Invalid date';
  }
}


