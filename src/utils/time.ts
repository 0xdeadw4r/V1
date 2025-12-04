import { format, parse, startOfDay, endOfDay, addDays, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export function getCurrentDate(timezone: string): string {
  try {
    const now = new Date();
    const zonedDate = toZonedTime(now, timezone);
    return format(zonedDate, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error formatting date with timezone:', timezone, error);
    // Fallback to UTC if timezone is invalid
    return format(new Date(), 'yyyy-MM-dd');
  }
}

export function getZonedTime(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) {
    return `${mins}m`;
  }
  return `${hours}h ${mins}m`;
}

export function formatDurationLong(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
}

export function parseResetTime(resetTime: string, timezone: string): Date {
  const [hours, minutes] = resetTime.split(':').map(Number);
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const todayStart = startOfDay(zonedNow);

  const resetDate = new Date(todayStart);
  resetDate.setHours(hours, minutes, 0, 0);

  return fromZonedTime(resetDate, timezone);
}

export function getNextResetTime(resetTime: string, timezone: string): Date {
  const resetDate = parseResetTime(resetTime, timezone);
  const now = new Date();

  if (resetDate <= now) {
    return addDays(resetDate, 1);
  }
  return resetDate;
}

export function getMidnightSplitTime(date: string, timezone: string): Date {
  const nextDay = addDays(parse(date, 'yyyy-MM-dd', new Date()), 1);
  const midnight = startOfDay(nextDay);
  return fromZonedTime(midnight, timezone);
}

export function calculateSessionDuration(joinTime: Date, leaveTime: Date): number {
  return Math.max(0, differenceInMinutes(leaveTime, joinTime));
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function hoursToMinutes(hours: number): number {
  return hours * 60;
}