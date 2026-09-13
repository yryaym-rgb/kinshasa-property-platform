import { formatDistanceToNow, isToday, isThisMonth, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatDate, formatDateTime } from '@/lib/utils';

export { formatDate, formatDateTime };

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: fr });
}

export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function isCurrentMonth(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isThisMonth(d);
}

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthRange(date = new Date()): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDate(d, 'dd MMM yyyy');
}

export function isDateToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isToday(d);
}

export function formatLongFrenchDate(date: Date = new Date()): string {
  return date.toLocaleDateString('fr-CD', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Kinshasa',
  });
}

export function formatReceiptDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.toLocaleString('fr-CD', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Kinshasa',
  }).replace(',', ' -');
}

export function getDueDateBadge(daysRemaining: number, isOverdue: boolean): {
  label: string;
  variant: 'info' | 'warning' | 'danger';
} {
  if (isOverdue || daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return { label: `En retard de ${days} jour${days > 1 ? 's' : ''}`, variant: 'danger' };
  }
  if (daysRemaining === 0) return { label: "Aujourd'hui", variant: 'danger' };
  if (daysRemaining <= 2) return { label: `Dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`, variant: 'warning' };
  return { label: `Dans ${daysRemaining} jours`, variant: 'info' };
}
