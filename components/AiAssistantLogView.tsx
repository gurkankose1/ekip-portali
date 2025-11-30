import React, { useState, useEffect } from 'react';
import { database } from '../firebaseConfig.ts';
import { ref, onValue } from 'firebase/database';
import { User } from '../types.ts';
import { UserIcon } from './Icons.tsx';

interface LogData {
    [userId: string]: {
        [messageId: string]: {
            role: 'user' | 'model';
            parts: any[];
            timestamp: number;
        }
    }
}

interface FormattedLog {
    userId: string;
    username: string;
    lastMessageTimestamp: number;
    messageCount: number;
    messages: {
        id: string;
        role: 'user' | 'model';
        parts: any[];
        timestamp: number;
    }[];
}

export const AiAssistantLogView: React.FC<{ allUsers: User[] }> = ({ allUsers }) => {
    const [logs, setLogs] = useState<FormattedLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<FormattedLog | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const logsRef = ref(database, 'ai_assistant_chats');
        const unsubscribe = onValue(logsRef, (snapshot) => {
            const data: LogData = snapshot.val() || {};
            const userMap = new Map(allUsers.map(u => [u.id, u.username]));

            const formattedLogs: FormattedLog[] = Object.entries(data).map(([userId, userMessages]) => {
                const messages = Object.entries(userMessages).map(([id, msg]) => ({ id, ...msg }));
                messages.sort((a, b) => a.timestamp - b.timestamp);
                
                return {
                    userId,
                    // FIX: The compiler incorrectly infers 'username' as 'unknown', likely due to complex types from Firebase. Explicitly converting the expression to a string ensures type correctness.
                    username: String(userMap.get(userId) || userId),
                    messages,
                    messageCount: messages.length,
                    lastMessageTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : 0
                };
            }).sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);

            setLogs(formattedLogs);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [allUsers]);

    // FIX: Add return statement with JSX to render the component and resolve the React.FC type error.
    return (
        <div className="animate-fade-in max-w-7xl mx-auto w-full">
            <h2 className="text-2xl font-bold text-center mb-6 text-sky-300">AI Asistan Kullanım Kayıtları</h2>
            {isLoading ? (
                <p className="text-center text-slate-400">Loglar yükleniyor...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-4 h-[calc(100vh-15rem)] overflow-y-auto">
                        <h3 className="text-lg font-bold text-amber-400 mb-4">Kullanıcılar ({logs.length})</h3>
                        {logs.length === 0 ? (
                            <p className="text-slate-400 text-center">Henüz log kaydı bulunmuyor.</p>
                        ) : (
                            <ul>
                                {logs.map(log => (
                                    <li key={log.userId}>
                                        <button 
                                            onClick={() => setSelectedLog(log)}
                                            className={`w-full text-left p-3 rounded-md mb-2 transition-colors ${selectedLog?.userId === log.userId ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                                        >
                                            <p className="font-semibold">{log.username}</p>
                                            <p className="text-xs text-slate-400">{log.messageCount} mesaj</p>
                                            {log.lastMessageTimestamp > 0 &&
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Son mesaj: {new Date(log.lastMessageTimestamp).toLocaleString('tr-TR')}
                                                </p>
                                            }
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="md:col-span-2 bg-slate-800 rounded-lg shadow-lg border border-slate-700 h-[calc(100vh-15rem)] flex flex-col">
                        {selectedLog ? (
                            <>
                                <h3 className="text-lg font-bold text-amber-400 p-4 border-b border-slate-700 flex-shrink-0">{selectedLog.username} Sohbet Geçmişi</h3>
                                <div className="flex-grow overflow-y-auto p-4 pr-2 space-y-4">
                                    {selectedLog.messages.map(msg => (
                                        <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-sky-800 flex items-center justify-center flex-shrink-0">🤖</div>}
                                            <div className={`max-w-xl rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-sky-700' : 'bg-slate-700'}`}>
                                                {msg.parts.map((part, i) => {
                                                    if (part.text) return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                                                    if (part.inlineData) return <img key={i} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} className="max-w-xs rounded-md my-2" alt="Kullanıcı tarafından gönderilen resim" />;
                                                    return null;
                                                })}
                                            </div>
                                            {msg.role === 'user' && <UserIcon className="w-8 h-8 rounded-full bg-slate-600 p-1.5 flex-shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-slate-400">Detayları görmek için bir kullanıcı seçin.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
