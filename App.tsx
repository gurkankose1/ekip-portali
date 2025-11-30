import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { database } from './firebaseConfig.ts';
import { ref, onValue, set, get, update, remove, push, onDisconnect } from 'firebase/database';
import { INITIAL_PERSONNEL, SHIFT_CYCLE, STATIONS, SPECIAL_PERSONNEL, SPECIAL_PERSONNEL_STATION, PUBLIC_HOLIDAYS, TEAM_LEAVE_DAYS } from './constants.ts';
import { DaySchedule, Assignment, SummaryData, ScheduleState, User, ChatMessage, Task, ExternalLink, ActiveView } from './types.ts';
import { AddReinforcementModal } from './components/AddReinforcementModal.tsx';
import { AdminControls } from './components/AdminControls.tsx';
import { MonthAccordion } from './components/MonthAccordion.tsx';
import { AppHeader } from './components/AppHeader.tsx';
import { ChatRoom } from './components/ChatWidget.tsx';
import { PortalView } from './components/PortalView.tsx';
import { SpreadsheetView } from './components/SpreadsheetView.tsx';
import { LoginView } from './components/LoginView.tsx';
import { ChangePasswordModal } from './components/ChangePasswordModal.tsx';
import { AccountView } from './components/AccountView.tsx';
import { UserManagementView } from './components/UserManagementView.tsx';
import AiAssistantView from './components/AiAssistantView.tsx';
import { AiAssistantLogView } from './components/AiAssistantLogView.tsx';
import { LinkManagementView } from './components/LinkManagementView.tsx';
import { MusicPlayerWidget } from './components/MusicPlayerWidget.tsx';
import { SummaryView } from './components/SummaryView.tsx';
import { PersonalDashboard } from './components/PersonalDashboard.tsx';
import { AnnouncementBar } from './components/AnnouncementBar.tsx';


// --- Firebase Persistence ---
const scheduleStateRef = ref(database, 'scheduleState');
const usersRef = ref(database, 'users');
const linksRef = ref(database, 'externalLinks');

// Serialization: Convert state with Map/Set to a plain object for Firebase
const serializeState = (state: ScheduleState): object => {
    return {
        personnel: state.personnel,
        leaves: Array.from(state.leaves.entries()).map(([key, value]) => [key, Array.from(value)]),
        reinforcements: Array.from(state.reinforcements.entries()),
    };
};

// Deserialization: Convert plain object from Firebase back to state with Map/Set
const deserializeState = (plainObject: any): ScheduleState => {
    if (!plainObject) {
        return { personnel: [], leaves: new Map(), reinforcements: new Map() };
    }
    return {
        personnel: plainObject.personnel || [],
        leaves: new Map((plainObject.leaves || []).map(([key, value]: [string, string[]]) => [key, new Set(value)])),
        reinforcements: new Map(plainObject.reinforcements || []),
    };
};
// --- End of Persistence ---

// --- Helper Functions ---
const sanitizeUsernameForKey = (username: string): string => {
    return username.toLowerCase().replace(/\s+/g, '');
};

// Map'leri karşılaştırmak için bir yardımcı fonksiyon
const areMapsEqual = <K, V>(map1: Map<K, V>, map2: Map<K, V>): boolean => {
    if (map1.size !== map2.size) return false;
    for (const [key, value] of map1) {
        if (!map2.has(key) || JSON.stringify(Array.from(value as any)) !== JSON.stringify(Array.from(map2.get(key) as any))) {
            return false;
        }
    }
    return true;
};

// Dizileri karşılaştırmak için bir yardımcı fonksiyon
const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = [...arr1].sort();
    const sortedArr2 = [...arr2].sort();
    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) return false;
    }
    return true;
};

// Belirli bir takvim için aylık özet hesaplayan yardımcı fonksiyon
const calculateSummaryForSchedule = (schedule: DaySchedule[], personnel: string[]): SummaryData => {
    const summary: SummaryData = {};
    const allPersonnel = new Set([...personnel, SPECIAL_PERSONNEL]);
    schedule.forEach(day => day.assignments.forEach(a => allPersonnel.add(a.personnel)));

    allPersonnel.forEach(p => {
        summary[p] = { total: 0, stations: {} };
    });

    for (const day of schedule) {
        for (const assignment of day.assignments) {
            if (assignment.station) {
                if (summary[assignment.personnel]) {
                    summary[assignment.personnel].total++;
                    summary[assignment.personnel].stations[assignment.station] = (summary[assignment.personnel].stations[assignment.station] || 0) + 1;
                }
            }
        }
    }
    return summary;
};


// Bu fonksiyonu component dışında tanımlayarak yeniden render'larda tekrar oluşturulmasını engelliyoruz.
const generateAndAssignSchedule = (
    currentState: ScheduleState,
    fixedSchedule?: DaySchedule[],
    lockDate?: Date
): DaySchedule[] => {
    const { personnel, leaves: currentLeaves, reinforcements: currentReinforcements } = currentState;

    const scheduleStartDateRef = new Date('2025-12-01T00:00:00');
    const startYear = scheduleStartDateRef.getFullYear();
    const startMonth = scheduleStartDateRef.getMonth();

    const generatedSchedule: DaySchedule[] = [];
    const cycleStartDate = new Date('2025-12-01T00:00:00');

    let lastDayAssignments: { [personnel: string]: string } = {};
    const runningSummary: SummaryData = {};


    [...personnel, SPECIAL_PERSONNEL].forEach(p => {
        runningSummary[p] = { total: 0, stations: {} };
    });

    for (let i = 0; i < 12; i++) {
        const currentMonthDate = new Date(startYear, startMonth + i, 1);
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const currentDate = new Date(year, month, d);
            const currentDateStr = currentDate.toISOString().split('T')[0];

            // --- LOCK LOGIC START ---
            // If a lockDate is provided and we are on or before that date,
            // try to use the assignment from fixedSchedule.
            if (lockDate && currentDate <= lockDate && fixedSchedule) {
                const fixedDay = fixedSchedule.find(day => day.date.toISOString().split('T')[0] === currentDateStr);
                if (fixedDay) {
                    // Update runningSummary based on fixed assignments to keep stats correct for future days
                    fixedDay.assignments.forEach(assignment => {
                        // Count tasks for summary
                        if (assignment.shift !== 'OFF' && assignment.shift !== 'Yıllık İzin') {
                            // Volkan special case: He is always SABAH but might be OFF in reality if on leave.
                            // But here we trust the fixed assignment.

                            // Check if it's a station assignment
                            if (assignment.station) {
                                if (!runningSummary[assignment.personnel]) {
                                    runningSummary[assignment.personnel] = { total: 0, stations: {} };
                                }
                                runningSummary[assignment.personnel].total++;
                                runningSummary[assignment.personnel].stations[assignment.station] = (runningSummary[assignment.personnel].stations[assignment.station] || 0) + 1;
                            } else if (assignment.personnel === SPECIAL_PERSONNEL && assignment.shift === 'SABAH' && assignment.station === SPECIAL_PERSONNEL_STATION) {
                                // Explicit check for Volkan if station prop is missing but implied (though usually it should be there)
                                runningSummary[assignment.personnel].total++;
                                runningSummary[assignment.personnel].stations[SPECIAL_PERSONNEL_STATION] = (runningSummary[assignment.personnel].stations[SPECIAL_PERSONNEL_STATION] || 0) + 1;
                            }
                        }
                    });

                    // Update lastDayAssignments for the next iteration
                    const currentDayAssignments: { [personnel: string]: string } = {};
                    fixedDay.assignments.forEach(a => {
                        if (a.station) currentDayAssignments[a.personnel] = a.station;
                    });
                    lastDayAssignments = currentDayAssignments;

                    generatedSchedule.push(fixedDay);
                    continue; // Skip normal generation for this day
                }
            }
            // --- LOCK LOGIC END ---

            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = PUBLIC_HOLIDAYS.includes(currentDateStr);
            const isTeamLeaveDay = TEAM_LEAVE_DAYS.includes(currentDateStr);

            const dailyAssignments: Assignment[] = [];
            const currentDayAssignments: { [personnel: string]: string } = {};

            const diffInMs = currentDate.getTime() - cycleStartDate.getTime();
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

            const cycleIndex = ((diffInDays % SHIFT_CYCLE.length) + SHIFT_CYCLE.length) % SHIFT_CYCLE.length;
            let teamShift = SHIFT_CYCLE[cycleIndex];
            if (isTeamLeaveDay) {
                teamShift = 'OFF';
            }

            const dayReinforcementsList = currentReinforcements.get(currentDateStr) || [];
            const allPersonnelForDay = [...personnel, SPECIAL_PERSONNEL, ...dayReinforcementsList.map(r => r.personnel)];
            const personnelOnLeaveToday = new Set<string>();

            new Set(allPersonnelForDay).forEach(p => {
                if (currentLeaves.get(p)?.has(currentDateStr)) {
                    dailyAssignments.push({ personnel: p, shift: 'Yıllık İzin' });
                    personnelOnLeaveToday.add(p);
                }
            });

            const stationsCoveredByReinforcements = new Set<string>();

            dayReinforcementsList.forEach(reinf => {
                if (!runningSummary[reinf.personnel]) {
                    runningSummary[reinf.personnel] = { total: 0, stations: {} };
                }
                const assignmentShift = personnelOnLeaveToday.has(reinf.personnel) ? 'Yıllık İzin' : teamShift;
                const assignment: Assignment = { ...reinf, shift: assignmentShift };

                if (assignment.shift !== 'OFF' && assignment.shift !== 'Yıllık İzin' && assignment.station) {
                    stationsCoveredByReinforcements.add(assignment.station);
                    runningSummary[reinf.personnel].total++;
                    runningSummary[reinf.personnel].stations[assignment.station] = (runningSummary[reinf.personnel].stations[assignment.station] || 0) + 1;
                    currentDayAssignments[reinf.personnel] = assignment.station;
                }
                dailyAssignments.push(assignment);
            });

            const isVolkanOnShift = teamShift === 'SABAH' && !isWeekend && !isHoliday && !isTeamLeaveDay;
            const isVolkanOnLeave = personnelOnLeaveToday.has(SPECIAL_PERSONNEL);
            const isSuAnonsCovered = stationsCoveredByReinforcements.has(SPECIAL_PERSONNEL_STATION);
            const isVolkanWorkingToday = isVolkanOnShift && !isVolkanOnLeave && !isSuAnonsCovered;

            if (!isVolkanOnLeave) {
                let volkanAssignment: Assignment;
                if (isVolkanWorkingToday) {
                    volkanAssignment = { personnel: SPECIAL_PERSONNEL, shift: 'SABAH', station: SPECIAL_PERSONNEL_STATION };
                    currentDayAssignments[SPECIAL_PERSONNEL] = SPECIAL_PERSONNEL_STATION;
                    runningSummary[SPECIAL_PERSONNEL].total++;
                    runningSummary[SPECIAL_PERSONNEL].stations[SPECIAL_PERSONNEL_STATION] = (runningSummary[SPECIAL_PERSONNEL].stations[SPECIAL_PERSONNEL_STATION] || 0) + 1;
                } else {
                    volkanAssignment = { personnel: SPECIAL_PERSONNEL, shift: 'OFF' };
                }
                dailyAssignments.push(volkanAssignment);
            }

            const workingTeam = personnel.filter(p => !personnelOnLeaveToday.has(p));

            if (teamShift === 'SABAH' || teamShift === 'GECE') {
                let stationsForMainTeam: string[];
                if (teamShift === 'GECE' || isWeekend || isHoliday || isTeamLeaveDay) {
                    stationsForMainTeam = [...STATIONS];
                } else {
                    stationsForMainTeam = STATIONS.filter(s => s !== SPECIAL_PERSONNEL_STATION);
                    if (!isVolkanWorkingToday) {
                        stationsForMainTeam.push(SPECIAL_PERSONNEL_STATION);
                    }
                }

                const highPriorityStationsToday = ['Planlama', 'Frekans'];
                if (stationsForMainTeam.includes(SPECIAL_PERSONNEL_STATION)) {
                    highPriorityStationsToday.push(SPECIAL_PERSONNEL_STATION);
                }

                const finalStationsToFill = stationsForMainTeam.filter(s => !stationsCoveredByReinforcements.has(s) && s !== currentDayAssignments[SPECIAL_PERSONNEL]);

                const priorityOrder = ['Planlama', 'Frekans', 'Su Anons', 'Board1', 'Board2', 'Board3', 'Board4'];

                // Sadece o gün doldurulması gereken (ve Volkan'ın oturmadığı) istasyonları filtrele
                // SIRALAMA YAPMIYORUZ! priorityOrder'a sadık kalıyoruz. Böylece personel yetersizse sondakiler (B4, B3...) boş kalır.
                let prioritizedStationsToFill = priorityOrder.filter(s => finalStationsToFill.includes(s));

                let assignablePersonnel = [...workingTeam];

                for (const station of prioritizedStationsToFill) {
                    if (assignablePersonnel.length === 0) break;

                    let candidatePool = assignablePersonnel.filter(p => lastDayAssignments[p] !== station);
                    if (candidatePool.length === 0) {
                        candidatePool = [...assignablePersonnel];
                    }

                    candidatePool.sort((a, b) => {
                        const isCriticalStation = ['Planlama', 'Frekans', 'Su Anons'].includes(station);

                        if (isCriticalStation) {
                            // 1. ÖNCELİK: Bu spesifik istasyondaki görev sayısı (Eşitlik İlkesi)
                            // Eğer biri bu istasyonda diğerinden az oturmuşsa, direkt onu seç.
                            const stationCountA = runningSummary[a]?.stations[station] || 0;
                            const stationCountB = runningSummary[b]?.stations[station] || 0;
                            if (stationCountA !== stationCountB) return stationCountA - stationCountB;

                            // 2. ÖNCELİK: Toplam Kritik Görev Sayısı
                            const criticalCountA = (runningSummary[a]?.stations['Planlama'] || 0) + (runningSummary[a]?.stations['Frekans'] || 0) + (runningSummary[a]?.stations['Su Anons'] || 0);
                            const criticalCountB = (runningSummary[b]?.stations['Planlama'] || 0) + (runningSummary[b]?.stations['Frekans'] || 0) + (runningSummary[b]?.stations['Su Anons'] || 0);
                            if (criticalCountA !== criticalCountB) return criticalCountA - criticalCountB;
                        } else {
                            // Boardlar için:

                            // 1. ÖNCELİK: Bu spesifik boarddaki görev sayısı (Eşitlik İlkesi)
                            const stationCountA = runningSummary[a]?.stations[station] || 0;
                            const stationCountB = runningSummary[b]?.stations[station] || 0;
                            if (stationCountA !== stationCountB) return stationCountA - stationCountB;

                            // 2. ÖNCELİK: Toplam Board Görev Sayısı (B1+B2+B3+B4) en az olan öne geçer.
                            const boardCountA = (runningSummary[a]?.stations['Board1'] || 0) + (runningSummary[a]?.stations['Board2'] || 0) + (runningSummary[a]?.stations['Board3'] || 0) + (runningSummary[a]?.stations['Board4'] || 0);
                            const boardCountB = (runningSummary[b]?.stations['Board1'] || 0) + (runningSummary[b]?.stations['Board2'] || 0) + (runningSummary[b]?.stations['Board3'] || 0) + (runningSummary[b]?.stations['Board4'] || 0);

                            if (boardCountA !== boardCountB) return boardCountA - boardCountB;
                        }

                        // Son çare: Toplam görev sayısı
                        const totalDiff = (runningSummary[a]?.total || 0) - (runningSummary[b]?.total || 0);
                        return totalDiff;
                    });

                    const personToAssign = candidatePool[0];

                    if (personToAssign) {
                        const assignment: Assignment = { personnel: personToAssign, shift: teamShift, station: station };
                        dailyAssignments.push(assignment);

                        currentDayAssignments[personToAssign] = station;
                        runningSummary[personToAssign].total++;
                        runningSummary[personToAssign].stations[station] = (runningSummary[personToAssign].stations[station] || 0) + 1;

                        assignablePersonnel = assignablePersonnel.filter(p => p !== personToAssign);
                    }
                }
                assignablePersonnel.forEach(p => dailyAssignments.push({ personnel: p, shift: teamShift }));
            } else {
                workingTeam.forEach(person => dailyAssignments.push({ personnel: person, shift: 'OFF' }));
            }

            lastDayAssignments = currentDayAssignments;

            generatedSchedule.push({
                date: currentDate,
                assignments: dailyAssignments.sort((a, b) => a.personnel.localeCompare(b.personnel)),
            });
        }
    }
    return generatedSchedule;
};


type Theme = 'dark' | 'light' | 'blue';

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    const [publishedState, setPublishedState] = useState<ScheduleState>({
        personnel: [],
        leaves: new Map(),
        reinforcements: new Map(),
    });

    // Pending state for leaves (Admin only)
    const [pendingLeaves, setPendingLeaves] = useState<Map<string, Set<string>>>(new Map());
    const [earliestPendingChange, setEarliestPendingChange] = useState<Date | null>(null);

    const [history, setHistory] = useState<ScheduleState[]>([publishedState]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [theme, setTheme] = useState<Theme>(() => {
        const storedTheme = localStorage.getItem('ekip-portal-theme');
        return (storedTheme as Theme) || 'dark'; // dark is default
    });
    const darkMode = theme === 'dark';

    const [externalLinks, setExternalLinks] = useState<ExternalLink[]>([]);
    const [musicUrl, setMusicUrl] = useState<string | null>(null);
    const [isMusicPlayerVisible, setIsMusicPlayerVisible] = useState(true);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const initialLoadDone = useRef(new Set<string>());
    const taskSoundRef = useRef<HTMLAudioElement | null>(null);


    // --- User & Auth Management ---
    useEffect(() => {
        // Seed users on first run if DB is empty
        get(usersRef).then((snapshot) => {
            if (!snapshot.exists()) {
                const initialUsersToCreate = [...new Set([...INITIAL_PERSONNEL, 'gurkankose'])];
                const usersPayload: { [key: string]: Omit<User, 'id'> } = {};
                initialUsersToCreate.forEach(username => {
                    const id = sanitizeUsernameForKey(username);
                    const isAdmin = username === 'gurkankose';
                    usersPayload[id] = {
                        username,
                        password_insecure: isAdmin ? 'Gg.113355' : '12345',
                        isAdmin: isAdmin,
                        forcePasswordChange: !isAdmin,
                        includeInSchedule: !isAdmin,
                    };
                });
                set(usersRef, usersPayload);
            }
        });
    }, []);

    useEffect(() => {
        // Listen for all users from Firebase
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const data = snapshot.val() || {};
            let loadedUsers: User[] = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
            loadedUsers = loadedUsers.filter(u => u.username && u.username.trim() !== 'Yeni Personel');

            setAllUsers(loadedUsers);

            const newSchedulePersonnel = loadedUsers
                .filter(u => u.includeInSchedule)
                .map(u => u.username)
                .sort();

            if (!areArraysEqual(newSchedulePersonnel, publishedState.personnel)) {
                setPublishedState(prevState => {
                    const newPersonnelSet = new Set(newSchedulePersonnel);
                    const newLeaves = new Map(prevState.leaves);
                    const newReinforcements = new Map(prevState.reinforcements);

                    for (const [personnel] of newLeaves.entries()) {
                        if (typeof personnel === 'string' && !newPersonnelSet.has(personnel)) {
                            newLeaves.delete(personnel);
                        }
                    }
                    newReinforcements.forEach((assignments, date) => {
                        if (Array.isArray(assignments)) {
                            const filteredAssignments = assignments.filter(a => newPersonnelSet.has(a.personnel));
                            if (filteredAssignments.length > 0) {
                                newReinforcements.set(date, filteredAssignments);
                            } else {
                                newReinforcements.delete(date);
                            }
                        }
                    });

                    const newState = {
                        personnel: newSchedulePersonnel,
                        leaves: newLeaves,
                        reinforcements: newReinforcements,
                    };
                    setHistory([newState]);
                    setHistoryIndex(0);
                    setPendingLeaves(newLeaves); // Sync pending leaves
                    return newState;
                });
            }


            // If current user is logged in, update its info
            if (currentUser) {
                const updatedCurrentUser = loadedUsers.find(u => u.id === currentUser.id);
                if (updatedCurrentUser) {
                    setCurrentUser(updatedCurrentUser);
                } else {
                    // Current user was deleted from DB, so log out
                    handleLogout();
                }
            }
        });
        return () => unsubscribe();
    }, [currentUser?.id, publishedState.personnel]);

    // Session restore logic removed to force fresh login


    // --- External Links Data Fetching ---
    useEffect(() => {
        // Listen for external links
        const unsubscribeLinks = onValue(linksRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const loadedLinks: ExternalLink[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                // Find and set music URL
                const musicLink = loadedLinks.find(link => link.id === 'music_player_url');
                setMusicUrl(musicLink ? musicLink.href : null);

                setExternalLinks(loadedLinks.sort((a, b) => a.order - b.order));
            } else {
                // Seed initial links if none exist in DB
                const initialLinks = [
                    { id: push(linksRef).key!, title: 'Çekim Listesi', href: 'https://docs.google.com/spreadsheets/d/1WContylOJGG3CGoS0YzncqLmBMzz8OfnNWdpH8ahmaY/edit?usp=sharing', order: 1, maskHref: false },
                    { id: push(linksRef).key!, title: 'Çalışma Programı', href: 'https://docs.google.com/spreadsheets/d/1S9_a8gwilvoM-IswZJgH1MeL7k-xX1zkcOq64RePcaI/edit?gid=0#gid=0', order: 2, maskHref: false },
                    { id: push(linksRef).key!, title: 'Hazır Formu', href: 'https://docs.google.com/spreadsheets/d/1qkLNHq9f_UAKyms0IQbCeu9h39iSP2Py-HYVVdu6MwA/edit?gid=0#gid=0', order: 3, maskHref: false },
                    { id: push(linksRef).key!, title: 'Operatör Bekleme', href: 'https://docs.google.com/spreadsheets/d/1SoGJwGv1_b5Gt1gD3w-Q8uETQpMjp78O4hnnXCjpBFI/edit?gid=0#gid=0', order: 4, maskHref: false },
                    { id: push(linksRef).key!, title: 'Arıza Olay Formu', href: 'https://docs.google.com/spreadsheets/d/1YJBHO0ySssJpTSlrENTI3zAd1G1Ip-9bnTwLtwO6r_0/edit?gid=468636740#gid=468636740', order: 5, maskHref: false },
                    { id: push(linksRef).key!, title: 'SafeIST', href: 'https://safeist.igairport.aero/Operation/TowingRequestFormIndex', order: 6, maskHref: false },
                    { id: push(linksRef).key!, title: 'Flightradar', href: 'https://www.flightradar24.com/', order: 7, maskHref: true },
                    { id: push(linksRef).key!, title: 'OpsView', href: 'http://10.181.50.65/portal/?request=authentication', order: 8, maskHref: false },
                ];
                const musicLink: ExternalLink = {
                    id: 'music_player_url',
                    title: 'Music Player URL',
                    href: 'https://www.youtube.com/embed/jfKfPfyJRdk', // Default lofi stream
                    order: 999
                };

                const allInitialLinks = [...initialLinks, musicLink];

                const updates: { [key: string]: Omit<ExternalLink, 'id'> } = {};
                allInitialLinks.forEach(link => {
                    const { id, ...data } = link;
                    updates[id] = data;
                });
                set(linksRef, updates);
            }
        });

        return () => {
            unsubscribeLinks();
        };
    }, [currentUser]);


    const handleLogin = (username: string, password_insecure: string) => {
        setLoginError(null);
        const user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (user && user.password_insecure === password_insecure) {
            setCurrentUser(user);
            sessionStorage.setItem('currentUserId', user.id);
        } else {
            setLoginError('Geçersiz kullanıcı adı veya şifre.');
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUserId');
        setActiveView('portal');
    };

    const handlePasswordChange = (newPassword: string) => {
        if (!currentUser) return;

        const userRef = ref(database, `users/${currentUser.id}`);
        update(userRef, {
            password_insecure: newPassword,
            forcePasswordChange: false
        }).then(() => {
            setIsPasswordModalOpen(false);
        });
    };

    const handleResetPassword = (userId: string) => {
        const userRef = ref(database, `users/${userId}`);
        update(userRef, {
            password_insecure: '12345',
            forcePasswordChange: true
        });
    };

    const handleCreateUser = (newUser: Omit<User, 'id' | 'password_insecure' | 'forcePasswordChange'>) => {
        const userId = sanitizeUsernameForKey(newUser.username);
        const userRef = ref(database, `users/${userId}`);

        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                alert(`"${newUser.username}" adında bir kullanıcı zaten var.`);
            } else {
                const userPayload: Omit<User, 'id'> = {
                    ...newUser,
                    password_insecure: '12345',
                    forcePasswordChange: true,
                };
                set(userRef, userPayload);
            }
        });
    };

    const handleUpdateUser = (userId: string, updates: Partial<Omit<User, 'id'>>) => {
        const userRef = ref(database, `users/${userId}`);
        update(userRef, updates);
    };

    const handleDeleteUser = (userId: string) => {
        if (userId === 'gurkankose') {
            alert("Ana admin hesabı silinemez.");
            return;
        }
        const userRef = ref(database, `users/${userId}`);
        remove(userRef);
    };

    // --- External Link Management ---
    const handleCreateLink = (linkData: Omit<ExternalLink, 'id'>) => {
        const newLinkRef = push(linksRef);
        set(newLinkRef, linkData);
    };

    const handleUpdateLink = (linkId: string, updates: Partial<Omit<ExternalLink, 'id'>>) => {
        const linkToUpdateRef = ref(database, `externalLinks/${linkId}`);
        update(linkToUpdateRef, updates);
    };

    const handleDeleteLink = (linkId: string) => {
        const linkToDeleteRef = ref(database, `externalLinks/${linkId}`);
        remove(linkToDeleteRef);
    };

    // --- Theme Management ---
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('dark', 'light', 'blue');
        root.classList.add(theme);
        localStorage.setItem('ekip-portal-theme', theme);
    }, [theme]);

    // --- Global Presence & Task Management (Moved from ChatWidget) ---
    useEffect(() => {
        if (!currentUser) return;

        // Setup notification sound
        taskSoundRef.current = new Audio('data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGliAv4uQxAAAAA021t4AAAAAE4AAACs6AAAAjIGxarmGCn8wEAc0TDE8AIAAAABn1dTEAAAAAAB4dW5nB4DAAABp5wIABkDAAABp5wIABkDAAAAAAADhhwAFwAA4TwAAgCXgDRABAADhPAACAFmADNARgAAAAAAAAB2dTYAAAANDg0ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg-LAAADSAQAGEEACAQDxAAAAAABA3AAAAAAW3///4AALm4AH/V3wfxP44e8u//AABbAAAADs/ABoAAAAAABvWAAAAAAAB9eAAAAAAAgB5v/v+AEiAgAAAAAAAAAAAAAAAAAAAAAYgCAAAAAAAAAAAAAAAAAAB2ZgAQAAADAyAAAAAAAAD2ZgAwAAAsAjIAAABmZgA4AAAAAwMiAAAAA2ZgBCgAAAMDIgAAAAxmZgA0AAAAAwMiAAAAFmZgECAAwMAyAAAHZmZgDAAAAAwMiAAAAgmZgDCAAAAMDIgAAAJmZgEIAAAAEwMiAAAAxZmYBAAAAAwMiAAABAAAAAPtmZgAAAAAAAwMiAAABAAAAANmZgEAAAAAAMAiAAABAAAAApmZgAAAAAAAwMiAAABAAAAAspmZgAAAAAAAwMiAAABAAAAA5mZgAAAAAAAwMiAAABAAAABFmZgAAAAAAAAAiAAACAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAD/LUL4HwAAENABoBAAAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACg==');

        // Setup presence
        const presenceRef = ref(database, 'presence');
        const mySessionRef = push(presenceRef);
        const connectedRef = ref(database, '.info/connected');

        const connectedUnsubscribe = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === true) {
                set(mySessionRef, currentUser.username);
                onDisconnect(mySessionRef).remove();
            }
        });

        const presenceUnsubscribe = onValue(presenceRef, (snapshot) => {
            const presenceData = snapshot.val() || {};
            const activeUsernames = Object.values(presenceData) as string[];
            const uniqueUsernames = [...new Set(activeUsernames)];
            setActiveUsers(uniqueUsernames.sort());
        });

        // Setup task listener
        const tasksRef = ref(database, 'tasks');
        const tasksUnsubscribe = onValue(tasksRef, (snapshot) => {
            const data = snapshot.val() || {};
            const newTasks = Object.keys(data).map(key => ({
                id: key, ...data[key]
            })).sort((a, b) => b.createdAt - a.createdAt);

            setTasks(prevTasks => {
                if (!initialLoadDone.current.has('tasks')) {
                    initialLoadDone.current.add('tasks');
                } else {
                    const newlyAssignedTasks = newTasks.filter(t =>
                        t.assignee === currentUser.username &&
                        t.status === 'bekleniyor' &&
                        !prevTasks.some(oldTask => oldTask.id === t.id)
                    );
                    if (newlyAssignedTasks.length > 0) {
                        taskSoundRef.current?.play().catch(e => console.error("Task sound play error:", e));
                    }
                }
                return newTasks;
            });
        });

        return () => {
            presenceUnsubscribe();
            connectedUnsubscribe();
            tasksUnsubscribe();
            remove(mySessionRef);
        };
    }, [currentUser]);

    // --- Schedule State Management ---
    useEffect(() => {
        const unsubscribe = onValue(scheduleStateRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedState = deserializeState(data);
                if (Array.isArray(loadedState.personnel) && loadedState.leaves instanceof Map && loadedState.reinforcements instanceof Map) {
                    setPublishedState(prevState => ({ ...prevState, ...loadedState }));
                    setHistory(prevHistory => [{ ...prevHistory[0], ...loadedState }]);
                    setHistoryIndex(0);
                    setPendingLeaves(loadedState.leaves); // Sync pending leaves on load
                    setEarliestPendingChange(null);
                }
            } else {
                const initialState = {
                    personnel: [],
                    leaves: new Map(),
                    reinforcements: new Map(),
                };
                set(scheduleStateRef, serializeState(initialState));
            }
        });

        return () => unsubscribe();
    }, []);

    const draftState = history[historyIndex];

    const [isReinforcementModalOpen, setIsReinforcementModalOpen] = useState(false);
    const [reinforcementModalDate, setReinforcementModalDate] = useState<Date | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [announcement, setAnnouncement] = useState("Hoş geldiniz! Aralık ayı vardiya çizelgesi güncellenmiştir. Lütfen kontrol ediniz.");

    // Duyuruyu Firebase'den dinle
    useEffect(() => {
        const announcementRef = ref(database, 'settings/announcement');
        const unsubscribe = onValue(announcementRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setAnnouncement(data);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateAnnouncement = (newMessage: string) => {
        setAnnouncement(newMessage); // Optimistic update
        const announcementRef = ref(database, 'settings/announcement');
        set(announcementRef, newMessage).catch(err => {
            console.error("Duyuru güncellenemedi:", err);
            // Hata olursa eski haline döndürme mantığı eklenebilir
        });
    };
    const [activeView, setActiveView] = useState<ActiveView>('portal');

    const processYearlySchedule = useMemo(() => (fullSchedule: DaySchedule[], personnel: string[]) => {
        const grouped = new Map<string, DaySchedule[]>();
        const monthFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

        for (const day of fullSchedule) {
            const key = monthFormatter.format(day.date);
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(day);
        }

        const result = new Map<string, { schedule: DaySchedule[], summary: SummaryData }>();

        // Calculate summary for the WHOLE year first
        const yearlySummary: SummaryData = {};
        [...personnel, SPECIAL_PERSONNEL].forEach(p => {
            yearlySummary[p] = { total: 0, stations: {} };
        });

        fullSchedule.forEach(day => {
            day.assignments.forEach(assignment => {
                if (!assignment || !assignment.personnel) return;

                if (assignment.shift !== 'OFF' && assignment.shift !== 'Yıllık İzin' && assignment.station) {
                    if (!yearlySummary[assignment.personnel]) yearlySummary[assignment.personnel] = { total: 0, stations: {} };

                    const personSummary = yearlySummary[assignment.personnel];
                    if (personSummary) {
                        personSummary.total++;
                        personSummary.stations[assignment.station] = (personSummary.stations[assignment.station] || 0) + 1;
                    }
                } else if (assignment.personnel === SPECIAL_PERSONNEL && assignment.shift === 'SABAH' && assignment.station === SPECIAL_PERSONNEL_STATION) {
                    if (!yearlySummary[assignment.personnel]) yearlySummary[assignment.personnel] = { total: 0, stations: {} };

                    const personSummary = yearlySummary[assignment.personnel];
                    if (personSummary) {
                        personSummary.total++;
                        personSummary.stations[SPECIAL_PERSONNEL_STATION] = (personSummary.stations[SPECIAL_PERSONNEL_STATION] || 0) + 1;
                    }
                }
            });
        });

        grouped.forEach((days, key) => {
            // Calculate monthly summary
            const summary: SummaryData = {};
            [...personnel, SPECIAL_PERSONNEL].forEach(p => {
                summary[p] = { total: 0, stations: {} };
            });

            days.forEach(day => {
                day.assignments.forEach(assignment => {
                    if (!assignment || !assignment.personnel) return;

                    if (assignment.shift !== 'OFF' && assignment.shift !== 'Yıllık İzin' && assignment.station) {
                        if (!summary[assignment.personnel]) summary[assignment.personnel] = { total: 0, stations: {} };

                        const personSummary = summary[assignment.personnel];
                        if (personSummary) {
                            personSummary.total++;
                            personSummary.stations[assignment.station] = (personSummary.stations[assignment.station] || 0) + 1;
                        }
                    } else if (assignment.personnel === SPECIAL_PERSONNEL && assignment.shift === 'SABAH' && assignment.station === SPECIAL_PERSONNEL_STATION) {
                        if (!summary[assignment.personnel]) summary[assignment.personnel] = { total: 0, stations: {} };

                        const personSummary = summary[assignment.personnel];
                        if (personSummary) {
                            personSummary.total++;
                            personSummary.stations[SPECIAL_PERSONNEL_STATION] = (personSummary.stations[SPECIAL_PERSONNEL_STATION] || 0) + 1;
                        }
                    }
                });
            });

            result.set(key, { schedule: days, summary });
        });

        return { monthlyData: result, yearlySummary };
    }, []);

    const userRole = currentUser?.isAdmin ? 'admin' : 'viewer';

    // Lock Logic:
    // We need a "Base Schedule" that represents the "Truth of the Past".
    // This is derived from 'publishedState' (what is currently in DB).
    // We want to lock everything BEFORE today.

    const publishedFullSchedule = useMemo(() => {
        if (!publishedState) return [];
        return generateAndAssignSchedule(publishedState);
    }, [publishedState]);

    const adminFullSchedule = useMemo(() => {
        if (!draftState) return [];
        // Lock date is yesterday (so today is re-generatable). 
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        return generateAndAssignSchedule(draftState, publishedFullSchedule, yesterday);
    }, [draftState, publishedFullSchedule]);

    const viewerFullSchedule = useMemo(() => {
        if (!publishedState) return [];
        return generateAndAssignSchedule(publishedState);
    }, [publishedState]);

    const { monthlyData: adminMonthlyData, yearlySummary: adminYearlySummary } = useMemo(() => {
        if (!draftState) return { monthlyData: new Map(), yearlySummary: {} };
        return processYearlySchedule(adminFullSchedule, draftState.personnel);
    }, [adminFullSchedule, draftState?.personnel, processYearlySchedule]);

    const { monthlyData: viewerMonthlyData, yearlySummary: viewerYearlySummary } = useMemo(() => {
        if (!publishedState) return { monthlyData: new Map(), yearlySummary: {} };
        return processYearlySchedule(viewerFullSchedule, publishedState.personnel);
    }, [viewerFullSchedule, publishedState?.personnel, processYearlySchedule]);


    const updateDraftState = (newState: ScheduleState) => {
        const newHistory = history.slice(0, historyIndex + 1);
        setHistory([...newHistory, newState]);
        setHistoryIndex(newHistory.length);
    };

    const handleToggleLeave = useCallback((date: Date, personnel: string) => {
        const dateStr = date.toISOString().split('T')[0];

        setPendingLeaves(prevPending => {
            const newLeaves = new Map(prevPending);
            const personLeaves = new Set(newLeaves.get(personnel) || []);

            if (personLeaves.has(dateStr)) {
                personLeaves.delete(dateStr);
            } else {
                personLeaves.add(dateStr);
            }
            newLeaves.set(personnel, personLeaves);
            return newLeaves;
        });

        // Track the earliest change to optimize/inform regeneration
        setEarliestPendingChange(prevDate => {
            if (!prevDate) return date;
            return date < prevDate ? date : prevDate;
        });
    }, []);

    const handleGenerateSchedule = () => {
        // 1. Pending değişiklikleri draftState'e işle
        const newLeaves = new Map(draftState.leaves);
        pendingLeaves.forEach((dates, personnel) => {
            const existingDates = newLeaves.get(personnel) || new Set();
            dates.forEach(date => existingDates.add(date));
            newLeaves.set(personnel, existingDates);
        });

        // 2. Takvimi yeniden oluştur (pending değişikliklerin en erken olduğu tarihten itibaren)
        // Eğer pending değişiklik yoksa, bugünden itibaren oluşturur.
        // earliestPendingChange null ise, normal akış devam eder.
        const regenerateFrom = earliestPendingChange ? new Date(earliestPendingChange) : undefined;

        generateAndAssignSchedule(newLeaves, regenerateFrom);

        // 3. Pending state'i temizle
        setPendingLeaves(new Map());
        setEarliestPendingChange(null);
    };

    const handleDownloadExcel = () => {
        const scheduleToExport = userRole === 'admin' ? adminFullSchedule : viewerFullSchedule;

        // Veriyi düzleştirip Excel için uygun formata getir
        const data = scheduleToExport.flatMap(day =>
            day.assignments.map(assignment => ({
                Tarih: day.date.toLocaleDateString('tr-TR'),
                Personel: assignment.personnel,
                Vardiya: assignment.shift,
                İstasyon: assignment.station || ''
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Vardiya Çizelgesi");

        XLSX.writeFile(workbook, `Vardiya_Cizelgesi_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDiscardPending = () => {
        setPendingLeaves(draftState.leaves);
        setEarliestPendingChange(null);
    };

    const handleAddReinforcement = useCallback((personnel: string, station: string) => {
        if (!reinforcementModalDate) return;
        const dateStr = reinforcementModalDate.toISOString().split('T')[0];

        const newReinforcements: Map<string, Assignment[]> = new Map(draftState.reinforcements);
        const dayReinforcements = newReinforcements.get(dateStr) || [];

        if (dayReinforcements.some(r => r.personnel.toLowerCase() === personnel.toLowerCase())) {
            alert(`${personnel} zaten bu gün için takviye olarak eklenmiş.`);
            return;
        }

        const newAssignment: Assignment = {
            personnel, station, shift: 'SABAH', isReinforcement: true,
        };

        const updatedDayReinforcements = [...dayReinforcements, newAssignment];
        newReinforcements.set(dateStr, updatedDayReinforcements);

        updateDraftState({ ...draftState, reinforcements: newReinforcements });
        setIsReinforcementModalOpen(false);
        setReinforcementModalDate(null);
    }, [draftState, reinforcementModalDate, history, historyIndex]);

    const handleRemoveReinforcement = useCallback((date: Date, personnel: string) => {
        const dateStr = date.toISOString().split('T')[0];
        const newReinforcements: Map<string, Assignment[]> = new Map(draftState.reinforcements);
        const dayReinforcements = newReinforcements.get(dateStr) || [];

        const updatedDayReinforcements = dayReinforcements.filter(r => r.personnel !== personnel);

        if (updatedDayReinforcements.length > 0) {
            newReinforcements.set(dateStr, updatedDayReinforcements);
        } else {
            newReinforcements.delete(dateStr);
        }

        updateDraftState({ ...draftState, reinforcements: newReinforcements });
    }, [draftState, history, historyIndex]);

    const openReinforcementModal = useCallback((date: Date) => {
        setReinforcementModalDate(date);
        setIsReinforcementModalOpen(true);
    }, []);

    const handleUndo = () => historyIndex > 0 && setHistoryIndex(historyIndex - 1);
    const handleRedo = () => historyIndex < history.length - 1 && setHistoryIndex(historyIndex - 1);

    const handleSaveChanges = () => {
        const stateToSave = {
            ...draftState,
            personnel: publishedState.personnel // Always save with the current personnel from DB
        };
        set(scheduleStateRef, serializeState(stateToSave)).catch(error => {
            console.error("Could not save state to Firebase", error);
            alert("Değişiklikler kaydedilemedi.");
        });
    };

    const handleDiscardChanges = () => {
        setHistory([publishedState]);
        setHistoryIndex(0);
    };

    const handleAssignTask = (assignee: string, description: string) => {
        if (!currentUser) return;
        const tasksListRef = ref(database, 'tasks');
        const newTaskRef = push(tasksListRef);
        set(newTaskRef, {
            assigner: currentUser.username, assignee, description, status: 'bekleniyor', createdAt: Date.now()
        });
    };

    const handleAcknowledgeTask = (taskId: string) => {
        set(ref(database, `tasks/${taskId}/status`), 'onaylandı');
    };

    const handleRejectTask = (taskId: string) => {
        if (!currentUser) return;
        set(ref(database, `tasks/${taskId}/status`), 'reddedildi');
    };

    if (!draftState) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Yükleniyor...</div>;
    }

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    const hasUnsavedChanges = !areMapsEqual(draftState.leaves, publishedState.leaves) || !areMapsEqual(draftState.reinforcements, publishedState.reinforcements);
    const hasPendingChanges = !areMapsEqual(pendingLeaves, draftState.leaves);

    const monthlyData = userRole === 'admin' ? adminMonthlyData : viewerMonthlyData;
    // Admin sees pending leaves in the UI to know what they are editing
    const currentLeaves = userRole === 'admin' ? pendingLeaves : publishedState.leaves;
    const currentPersonnelList = userRole === 'admin' ? draftState.personnel : publishedState.personnel;

    const scheduleStartDate = new Date('2025-11-01');
    const scheduleEndDate = new Date(scheduleStartDate.getFullYear(), scheduleStartDate.getMonth() + 12, 0);
    const dateRangeFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
    const startMonthStr = dateRangeFormatter.format(scheduleStartDate);
    const endMonthStr = dateRangeFormatter.format(scheduleEndDate);

    // --- Render Logic ---
    if (!currentUser) {
        return <LoginView onLogin={handleLogin} error={loginError} allUsers={allUsers} />;
    }

    if (currentUser.forcePasswordChange) {
        return (
            <div className="min-h-screen bg-slate-900">
                <ChangePasswordModal
                    isOpen={true}
                    onClose={() => { }} // Can't close
                    onSubmit={handlePasswordChange}
                    isFirstLogin={true}
                />
            </div>
        );
    }

    const handleNavigation = (view: ActiveView) => {
        setActiveView(view);
    };

    const renderTaskNotifications = () => {
        if (!currentUser) return null;
        const myPendingTasks = tasks.filter(t => t.assignee === currentUser.username && t.status === 'bekleniyor');
        if (myPendingTasks.length === 0) return null;

        return (
            <div className="fixed bottom-20 right-4 z-[100] flex flex-col items-end gap-3 w-full max-w-sm">
                {myPendingTasks.map(task => (
                    <div key={task.id} className="bg-slate-800 border border-sky-600 rounded-lg shadow-2xl p-4 w-full animate-fade-in">
                        <h3 className="text-md font-bold text-sky-300 mb-2">Yeni Görev Atandı!</h3>
                        <div className="space-y-3">
                            <p className="text-sm"><span className="font-bold text-amber-400">{task.assigner}</span> size yeni bir görev atadı:</p>
                            <p className="p-3 bg-slate-700 rounded-md text-slate-200 text-sm break-words whitespace-pre-wrap">{task.description}</p>
                            <div className="pt-2 flex justify-end gap-3">
                                <button onClick={() => handleRejectTask(task.id)} className="bg-red-800 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-md transition-colors text-sm">
                                    Reddet
                                </button>
                                <button onClick={() => handleAcknowledgeTask(task.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-md transition-colors text-sm">
                                    Onayla
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderActiveView = () => {
        switch (activeView) {
            case 'portal':
                return <PortalView setActiveView={handleNavigation} currentUser={currentUser} externalLinks={externalLinks} />;
            case 'schedule':
                return (
                    <div className="animate-fade-in">
                        <header className="text-center mb-8 relative">
                            <p className="text-slate-400 mt-2 text-lg">
                                Yıllık Görev ve İstasyon Dağılımı ({startMonthStr} - {endMonthStr})
                            </p>
                            <div className="absolute right-0 top-0 mt-2 mr-2">
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${showHistory
                                        ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                                        : 'bg-sky-900/30 text-sky-400 border-sky-800 hover:bg-sky-900/50'
                                        }`}
                                >
                                    {showHistory ? 'Geçmişi Gizle' : 'Geçmişi Göster'}
                                </button>
                            </div>
                        </header>

                        <main>
                            {userRole === 'admin' && (
                                <div className="bg-slate-800 p-4 rounded-lg shadow-lg mb-6 border border-slate-700">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xl font-bold text-sky-400">Yönetici Paneli</h2>
                                            {hasPendingChanges && (
                                                <div className="flex flex-col">
                                                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-full animate-pulse text-center">
                                                        Değişiklikler Bekliyor
                                                    </span>
                                                    {earliestPendingChange && (
                                                        <span className="text-slate-400 text-[10px] mt-1">
                                                            {earliestPendingChange.toLocaleDateString('tr-TR')} tarihinden sonrası etkilenecek.
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 items-center">
                                            {hasPendingChanges ? (
                                                <>
                                                    <button
                                                        onClick={handleGenerateSchedule}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-bold transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.276a1 1 0 01-2 0V14.907A7.002 7.002 0 017.396 8.327a1 1 0 01.61-1.27z" clipRule="evenodd" />
                                                        </svg>
                                                        Dağıtımı Yenile (Generate)
                                                    </button>
                                                    <button
                                                        onClick={handleDiscardPending}
                                                        className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-md font-semibold transition-colors"
                                                    >
                                                        İptal Et
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="text-slate-500 text-sm italic flex items-center mr-4">
                                                    <span>İzinleri düzenleyin ve "Dağıtımı Yenile"ye basın.</span>
                                                </div>
                                            )}

                                            <div className="w-px h-8 bg-slate-700 mx-2 hidden md:block"></div>

                                            <button
                                                onClick={handleUndo}
                                                disabled={!canUndo}
                                                className={`p-2 rounded-md transition-colors ${canUndo ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                                title="Geri Al"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={handleRedo}
                                                disabled={!canRedo}
                                                className={`p-2 rounded-md transition-colors ${canRedo ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                                title="İleri Al"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>

                                            <button
                                                onClick={handleSaveChanges}
                                                disabled={!hasUnsavedChanges}
                                                className={`px-4 py-2 rounded-md font-bold transition-all shadow-lg ${hasUnsavedChanges
                                                    ? 'bg-sky-600 hover:bg-sky-500 text-white hover:shadow-sky-500/20'
                                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                    }`}
                                            >
                                                {hasUnsavedChanges ? 'Yayınla (Kaydet)' : 'Değişiklik Yok'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {monthlyData.size > 0 ? (
                                <>
                                    {currentUser && (
                                        <PersonalDashboard
                                            currentUser={currentUser.name}
                                            schedule={userRole === 'admin' ? adminFullSchedule : viewerFullSchedule}
                                        />
                                    )}
                                    <MonthAccordion
                                        monthsData={monthlyData}
                                        userRole={userRole}
                                        onToggleLeave={handleToggleLeave}
                                        onAddReinforcement={openReinforcementModal}
                                        onRemoveReinforcement={handleRemoveReinforcement}
                                        leaves={currentLeaves}
                                        committedLeaves={draftState.leaves}
                                        personnel={currentPersonnelList}
                                        showHistory={showHistory}
                                    />


                                    <div className="mt-8 bg-slate-800 rounded-lg shadow-md overflow-hidden p-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-xl font-bold text-sky-400">Yıllık Genel Özet</h2>
                                            <button
                                                onClick={handleDownloadExcel}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors text-sm font-medium"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                                Excel İndir
                                            </button>
                                        </div>
                                        <SummaryView
                                            summary={userRole === 'admin' ? adminYearlySummary : viewerYearlySummary}
                                            monthName="Yıllık Toplam"
                                            personnel={currentPersonnelList}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="text-center p-8 text-slate-400">
                                    <p>Vardiya çizelgesi oluşturuluyor...</p>
                                </div>
                            )}
                        </main>
                    </div >
                );
            case 'chat':
                return (
                    <ChatRoom
                        username={currentUser.username}
                        tasks={tasks}
                        activeUsers={activeUsers}
                        onAssignTask={handleAssignTask}
                        onAcknowledgeTask={handleAcknowledgeTask}
                        onRejectTask={handleRejectTask}
                    />
                );
            case 'spreadsheet':
                return <SpreadsheetView currentUser={currentUser} />;
            case 'ai_assistant':
                return <AiAssistantView currentUser={currentUser} />;
            case 'account':
                return <AccountView onChangePassword={() => setIsPasswordModalOpen(true)} />;
            case 'user_management':
                return currentUser.isAdmin ? (
                    <UserManagementView
                        onResetPassword={handleResetPassword}
                        onCreateUser={handleCreateUser}
                        onUpdateUser={handleUpdateUser}
                        onDeleteUser={handleDeleteUser}
                        allUsers={allUsers}
                    />
                ) : null;
            case 'links':
                return currentUser.isAdmin ? (
                    <LinkManagementView
                        links={externalLinks}
                        onCreate={handleCreateLink}
                        onUpdate={handleUpdateLink}
                        onDelete={handleDeleteLink}
                    />
                ) : null;

        }
    };

    // --- Render ---
    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
            <AnnouncementBar
                message={announcement}
                isAdmin={userRole === 'admin'}
                onUpdateMessage={handleUpdateAnnouncement}
            />
            <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-50 transition-colors duration-300">
                <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                `}</style>
                <AppHeader
                    activeView={activeView}
                    setActiveView={handleNavigation}
                    theme={theme}
                    setTheme={setTheme}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    isMusicPlayerVisible={isMusicPlayerVisible}
                    onToggleMusicPlayer={() => setIsMusicPlayerVisible(!isMusicPlayerVisible)}
                />
            </header>

            <main className="w-full max-w-7xl mx-auto p-4 mt-4">
                {renderActiveView()}
            </main>

            <AddReinforcementModal
                isOpen={isReinforcementModalOpen}
                onClose={() => setIsReinforcementModalOpen(false)}
                onSubmit={handleAddReinforcement}
            />
            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onSubmit={handlePasswordChange}
            />
            <MusicPlayerWidget
                url={musicUrl}
                isVisible={isMusicPlayerVisible}
            />
            {renderTaskNotifications()}
        </div>
    );
};

export default App;