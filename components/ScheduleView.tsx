import React from 'react';
import { DaySchedule, ShiftType, Assignment, UserRole } from '../types.ts';

interface ScheduleViewProps {
    schedule: DaySchedule[];
    userRole: UserRole;
    onToggleLeave: (date: Date, personnel: string) => void;
    onAddReinforcement: (date: Date) => void;
    onRemoveReinforcement: (date: Date, personnel: string) => void;
    leaves: Map<string, Set<string>>;
    committedLeaves?: Map<string, Set<string>>;
}

const getShiftColorClass = (shift: ShiftType): string => {
    switch (shift) {
        case 'SABAH':
            return 'text-amber-400';
        case 'GECE':
            return 'text-indigo-400';
        case 'OFF':
            return 'text-slate-400';
        case 'Yıllık İzin':
            return 'text-emerald-400';
        default:
            return 'text-slate-100';
    }
};

const DayCard: React.FC<{
    day: DaySchedule;
    userRole: UserRole;
    onToggleLeave: (date: Date, personnel: string) => void;
    onAddReinforcement: (date: Date) => void;
    onRemoveReinforcement: (date: Date, personnel: string) => void;
    leaves: Map<string, Set<string>>;
    committedLeaves?: Map<string, Set<string>>;
}> = ({ day, userRole, onToggleLeave, onAddReinforcement, onRemoveReinforcement, leaves, committedLeaves }) => {
    const dateStr = day.date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        weekday: 'long',
    });
    const dateISOStr = day.date.toISOString().split('T')[0];

    const shifts: { [key in ShiftType]?: Assignment[] } = {};
    day.assignments.forEach(a => {
        if (!shifts[a.shift]) {
            shifts[a.shift] = [];
        }
        shifts[a.shift]!.push(a);
    });

    const renderShiftGroup = (title: ShiftType, assignments: Assignment[]) => {
        if (!assignments || assignments.length === 0) return null;

        return (
            <div>
                <h4 className={`font-bold text-lg mb-2 ${getShiftColorClass(title)}`}>{title}</h4>
                <ul className="space-y-2 text-slate-300">
                    {assignments.map(a => {
                        const isOnLeave = leaves.get(a.personnel)?.has(dateISOStr);
                        const canTakeLeave = (a.shift === 'SABAH' || a.shift === 'GECE') && !a.isReinforcement;
                        const isPending = isOnLeave && committedLeaves && !committedLeaves.get(a.personnel)?.has(dateISOStr);

                        return (
                            <li key={a.personnel} className="flex justify-between items-center text-sm gap-2">
                                <span className="flex-1 truncate">{a.personnel} {a.isReinforcement && '✨'}</span>
                                {a.shift === 'Yıllık İzin' ? (
                                    <span className={`font-mono text-xs px-2 py-0.5 rounded-md ${isPending ? 'bg-amber-900/80 text-amber-300' : 'bg-emerald-900/80 text-emerald-300'}`}>
                                        {isPending ? 'TASLAK İZİN' : 'YILLIK İZİN'}
                                    </span>
                                ) : a.station ? (
                                    <span className="font-mono text-xs bg-sky-900/50 text-sky-400 px-2 py-0.5 rounded-md">{a.station}</span>
                                ) : null}

                                {userRole === 'admin' && a.isReinforcement && (
                                    <button
                                        onClick={() => onRemoveReinforcement(day.date, a.personnel)}
                                        className="text-xs bg-gray-600 hover:bg-gray-500 text-white font-semibold px-2 py-0.5 rounded-md transition-colors duration-200"
                                        aria-label={`${a.personnel} takviyesini kaldır`}
                                    >
                                        Kaldır
                                    </button>
                                )}

                                {userRole === 'admin' && (canTakeLeave || isOnLeave) && (
                                    <button
                                        onClick={() => onToggleLeave(day.date, a.personnel)}
                                        className={`text-xs font-semibold px-2 py-0.5 rounded-md transition-colors duration-200 ${isPending
                                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                            : isOnLeave
                                                ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                                                : 'bg-red-800 hover:bg-red-700 text-white'
                                            }`}
                                        aria-label={`${a.personnel} için ${isOnLeave ? 'izni iptal et' : 'izin ver'}`}
                                    >
                                        {isPending ? 'Taslak (İptal)' : isOnLeave ? 'İzni İptal Et' : 'İzin Ver'}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    const shiftOrder: ShiftType[] = ['SABAH', 'GECE', 'Yıllık İzin', 'OFF'];

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-4 md:p-6 flex flex-col">
            <h3 className="text-lg font-bold mb-4 border-b border-slate-700 pb-2 text-sky-300">{dateStr}</h3>
            <div className="space-y-4 flex-grow">
                {shiftOrder.map(shiftType => renderShiftGroup(shiftType, shifts[shiftType] || []))}
            </div>
            {userRole === 'admin' && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <button
                        onClick={() => onAddReinforcement(day.date)}
                        className="w-full text-sm bg-sky-800 hover:bg-sky-700 text-white font-semibold px-3 py-1.5 rounded-md transition-colors duration-200"
                        aria-label="Takviye personel ekle"
                    >
                        Takviye Ekle
                    </button>
                </div>
            )}
        </div>
    );
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ schedule, userRole, onToggleLeave, onAddReinforcement, onRemoveReinforcement, leaves, committedLeaves }) => {
    if (!schedule || schedule.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {schedule.map(day => (
                    <DayCard
                        key={day.date.toISOString()}
                        day={day}
                        userRole={userRole}
                        onToggleLeave={onToggleLeave}
                        onAddReinforcement={onAddReinforcement}
                        onRemoveReinforcement={onRemoveReinforcement}
                        leaves={leaves}
                        committedLeaves={committedLeaves}
                    />
                ))}
            </div>
        </div>
    );
};