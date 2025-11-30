export type ShiftType = 'SABAH' | 'GECE' | 'OFF' | 'Yıllık İzin';

// Bu tip, ScheduleView ile geriye dönük uyumluluk için tutulmuştur.
export type UserRole = 'admin' | 'viewer';

export interface User {
  id: string; // Firebase key
  username: string;
  // GERÇEK BİR UYGULAMADA ASLA ŞİFRELERİ DOĞRUDAN SAKLAMAYIN!
  // Bu, yalnızca yeni bağımlılıklar eklenemeyen bu projenin kısıtlamaları için bir yer tutucudur.
  password_insecure: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
  includeInSchedule: boolean;
}


export interface Assignment {
  personnel: string;
  shift: ShiftType;
  station?: string;
  isReinforcement?: boolean;
}

export interface DaySchedule {
  date: Date;
  assignments: Assignment[];
}

export interface SummaryData {
  [personnel: string]: {
    total: number;
    stations: { [station: string]: number };
  };
}

// State'in anlık görüntüsü için bir tip tanımlayalım
export interface ScheduleState {
    personnel: string[];
    leaves: Map<string, Set<string>>;
    reinforcements: Map<string, Assignment[]>;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  channel: string;
}

export interface Task {
  id:string;
  assigner: string;
  assignee: string;
  description: string;
  status: 'bekleniyor' | 'onaylandı' | 'reddedildi';
  createdAt: number;
}

export interface ExternalLink {
  id: string;
  title: string;
  href: string;
  order: number;
  maskHref?: boolean; // Bağlantıyı bir yönlendirme servisi üzerinden maskele
}

export type ActiveView = 'portal' | 'schedule' | 'chat' | 'spreadsheet' | 'account' | 'user_management' | 'ai_assistant' | 'ai_logs' | 'links';