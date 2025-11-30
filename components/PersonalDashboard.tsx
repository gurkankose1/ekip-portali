import React from 'react';
import { Calendar, Clock, MapPin, Coffee, Sun, Moon, Umbrella, TrendingUp, Activity } from 'lucide-react';
import { DaySchedule } from '../types';

interface PersonalDashboardProps {
    currentUser: string;
    schedule: DaySchedule[];
}

export const PersonalDashboard: React.FC<PersonalDashboardProps> = ({ currentUser, schedule }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Yerel saat dilimine göre tarih karşılaştırması
    const isSameDay = (d1: Date, d2: Date) => {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    };

    const todaySchedule = schedule.find(d => isSameDay(d.date, today));
    const tomorrowSchedule = schedule.find(d => isSameDay(d.date, tomorrow));

    const myToday = todaySchedule?.assignments.find(a => a.personnel === currentUser);
    const myTomorrow = tomorrowSchedule?.assignments.find(a => a.personnel === currentUser);

    // Gelecek ilk izin tarihini bul
    let nextLeaveDate: Date | null = null;
    const futureSchedule = schedule.filter(d => new Date(d.date) > today);
    for (const day of futureSchedule) {
        const myAssignment = day.assignments.find(a => a.personnel === currentUser);
        if (myAssignment?.shift === 'Yıllık İzin') {
            nextLeaveDate = new Date(day.date);
            break;
        }
    }

    // Bu ayki istatistikler
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthlyAssignments = schedule.filter(d => {
        const date = new Date(d.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
        .flatMap(d => d.assignments)
        .filter(a => a.personnel === currentUser && a.station);

    const totalTasks = monthlyAssignments.length;
    const criticalTasks = monthlyAssignments.filter(a => ['Planlama', 'Frekans', 'Su Anons'].includes(a.station!)).length;

    const getShiftIcon = (shift?: string) => {
        if (shift === 'SABAH') return <Sun className="w-6 h-6 text-amber-500" />;
        if (shift === 'GECE') return <Moon className="w-6 h-6 text-indigo-400" />;
        if (shift === 'OFF') return <Coffee className="w-6 h-6 text-emerald-500" />;
        if (shift === 'Yıllık İzin') return <Umbrella className="w-6 h-6 text-rose-500" />;
        return <Clock className="w-6 h-6 text-gray-400" />;
    };

    const getShiftColor = (shift?: string) => {
        if (shift === 'SABAH') return 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300';
        if (shift === 'GECE') return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300';
        if (shift === 'OFF') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300';
        if (shift === 'Yıllık İzin') return 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300';
        return 'bg-gray-500/10 border-gray-500/20 text-gray-700 dark:text-gray-300';
    };

    return (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sol Kart: Selamlama ve Bugün */}
            <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">
                        Merhaba, {currentUser} 👋
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        {today.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Bugün */}
                        <div className={`p-4 rounded-xl border ${getShiftColor(myToday?.shift)} transition-all duration-300 hover:shadow-md`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold uppercase tracking-wider opacity-70">BUGÜN</span>
                                {getShiftIcon(myToday?.shift)}
                            </div>
                            <div className="text-xl font-bold mb-1">
                                {myToday?.shift === 'OFF' ? 'İzinlisin' :
                                    myToday?.shift === 'Yıllık İzin' ? 'Yıllık İzin' :
                                        myToday?.station || 'Görev Yok'}
                            </div>
                            <div className="text-sm opacity-80 flex items-center gap-1">
                                {myToday?.shift !== 'OFF' && myToday?.shift !== 'Yıllık İzin' && (
                                    <>
                                        <Clock className="w-3 h-3" />
                                        {myToday?.shift} Vardiyası
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Yarın */}
                        <div className={`p-4 rounded-xl border ${getShiftColor(myTomorrow?.shift)} opacity-80 hover:opacity-100 transition-all duration-300`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold uppercase tracking-wider opacity-70">YARIN</span>
                                {getShiftIcon(myTomorrow?.shift)}
                            </div>
                            <div className="text-lg font-bold mb-1">
                                {myTomorrow?.shift === 'OFF' ? 'İzinlisin' :
                                    myTomorrow?.shift === 'Yıllık İzin' ? 'Yıllık İzin' :
                                        myTomorrow?.station || 'Belirlenmedi'}
                            </div>
                            <div className="text-sm opacity-80">
                                {myTomorrow?.shift !== 'OFF' && myTomorrow?.shift !== 'Yıllık İzin' ? `${myTomorrow?.shift} Vardiyası` : 'Dinlenme Zamanı'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sağ Kart: İstatistikler ve Bilgiler */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Bu Ayki Durumun
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400">Toplam Görev</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{totalTasks}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(totalTasks * 3, 100)}%` }}></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400">Kritik Görevler</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{criticalTasks}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${Math.min(criticalTasks * 5, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {nextLeaveDate && (
                    <div className="mt-6 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800/30 flex items-center gap-3">
                        <div className="bg-rose-100 dark:bg-rose-800/50 p-2 rounded-full">
                            <Calendar className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                            <div className="text-xs text-rose-600 dark:text-rose-400 font-medium uppercase tracking-wide">Sıradaki İzin</div>
                            <div className="text-sm font-bold text-rose-800 dark:text-rose-200">
                                {nextLeaveDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
