import React, { useState } from 'react';
import { DaySchedule, UserRole, SummaryData } from '../types.ts';
import { ScheduleView } from './ScheduleView.tsx';
import { SummaryView } from './SummaryView.tsx';

interface MonthAccordionProps {
  monthsData: Map<string, { schedule: DaySchedule[], summary: SummaryData }>;
  userRole: UserRole;
  onToggleLeave: (date: Date, personnel: string) => void;
  onAddReinforcement: (date: Date) => void;
  onRemoveReinforcement: (date: Date, personnel: string) => void;
  leaves: Map<string, Set<string>>;
  personnel: string[];
}

export const MonthAccordion: React.FC<MonthAccordionProps> = ({ 
    monthsData, 
    userRole, 
    onToggleLeave, 
    onAddReinforcement, 
    onRemoveReinforcement,
    leaves,
    personnel
}) => {
    const monthKeys = Array.from(monthsData.keys());
    const [activeMonthKey, setActiveMonthKey] = useState<string | null>(monthKeys.length > 0 ? monthKeys[0] : null);

    const toggleMonth = (key: string) => {
        setActiveMonthKey(activeKey => (activeKey === key ? null : key));
    };

    return (
        <div className="space-y-2 mt-8">
            {monthKeys.map(monthKey => {
                // FIX: Add a type guard to ensure monthKey is a string before using it, which resolves the TypeScript error.
                if (typeof monthKey !== 'string') return null;

                const data = monthsData.get(monthKey);
                if (!data) return null;
                const isActive = activeMonthKey === monthKey;

                return (
                    <div key={monthKey} className="bg-slate-800 rounded-lg shadow-md overflow-hidden transition-all duration-300">
                        <h2 className="text-lg font-bold" id={`month-header-${monthKey}`}>
                            <button
                                onClick={() => toggleMonth(monthKey)}
                                className="w-full flex justify-between items-center p-4 text-left font-bold text-lg text-sky-300 hover:bg-slate-700/50 transition-colors duration-200"
                                aria-expanded={isActive}
                                aria-controls={`month-panel-${monthKey}`}
                            >
                                <span>{monthKey}</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-6 w-6 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </h2>
                        {isActive && (
                            <section
                                id={`month-panel-${monthKey}`}
                                role="region"
                                aria-labelledby={`month-header-${monthKey}`}
                                className="p-4 bg-slate-800/50 animate-fade-in"
                            >
                                <ScheduleView 
                                    schedule={data.schedule} 
                                    userRole={userRole}
                                    onToggleLeave={onToggleLeave} 
                                    onAddReinforcement={onAddReinforcement}
                                    onRemoveReinforcement={onRemoveReinforcement}
                                    leaves={leaves}
                                />
                                <SummaryView summary={data.summary} monthName={monthKey} personnel={personnel} />
                            </section>
                        )}
                    </div>
                );
            })}
        </div>
    );
};