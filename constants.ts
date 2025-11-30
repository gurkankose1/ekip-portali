import { ShiftType } from './types.ts';

export const SHIFT_CYCLE: ShiftType[] = ['OFF', 'OFF', 'SABAH', 'SABAH', 'OFF', 'OFF', 'GECE', 'GECE'];
export const STATIONS: string[] = [
  'Planlama',
  'Frekans',
  'Su Anons',
  'Board1',
  'Board2',
  'Board3',
  'Board4',
];

export const INITIAL_PERSONNEL: string[] = ['Hüseyin', 'Berfin', 'Eylül', 'Emir', 'Kurtuluş'];
export const SPECIAL_PERSONNEL = 'Volkan';
export const SPECIAL_PERSONNEL_STATION = 'Su Anons';

// Resmi tatilleri YYYY-MM-DD formatında ekleyin.
export const PUBLIC_HOLIDAYS: string[] = [];

// Tüm ekibin izinli olduğu özel günleri YYYY-MM-DD formatında ekleyin.
export const TEAM_LEAVE_DAYS: string[] = [];