import React, { useState, useEffect, useRef, useCallback } from 'react';
import { database } from '../firebaseConfig.ts';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { ChatMessage, Task } from '../types.ts';
import { Modal } from './Modal.tsx';
import { Trash2Icon, EditIcon, UsersIcon } from './Icons.tsx';
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

// --- Props ---
interface ChatRoomProps {
    username: string;
    tasks: Task[];
    activeUsers: string[];
    onAssignTask: (assignee: string, description: string) => void;
    onAcknowledgeTask: (taskId: string) => void;
    onRejectTask: (taskId: string) => void;
}


// --- Constants ---
const GOOGLE_SHEET_EMBED_URL = "https://docs.google.com/spreadsheets/d/1WContylOJGG3CGoS0YzncqLmBMzz8OfnNWdpH8ahmaY/edit?rm=minimal&amp;widget=false&amp;headers=false&amp;chrome=false";
const NOTIFICATION_SOUND_URL = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGliAv4uQxAAAAA021t4AAAAAE4AAACs6AAAAjIGxarmGCn8wEAc0TDE8AIAAAABn1dTEAAAAAAB4dW5nB4DAAABp5wIABkDAAABp5wIABkDAAAAAAADhhwAFwAA4TwAAgCXgDRABAADhPAACAFmADNARgAAAAAAAAB2dTYAAAANDg0ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg-L-LAAADSAQAGEEACAQDxAAAAAABA3AAAAAAW3///4AALm4AH/V3wfxP44e8u//AABbAAAADs/ABoAAAAAABvWAAAAAAAB9eAAAAAAAgB5v/v+AEiAgAAAAAAAAAAAAAAAAAAAAAYgCAAAAAAAAAAAAAAAAAAB2ZgAQAAADAyAAAAAAAAD2ZgAwAAAsAjIAAABmZgA4AAAAAwMiAAAAA2ZgBCgAAAMDIgAAAAxmZgA0AAAAAwMiAAAAFmZgECAAwMAyAAAHZmZgDAAAAAwMiAAAAgmZgDCAAAAMDIgAAAJmZgEIAAAAEwMiAAAAxZmYBAAAAAwMiAAABAAAAAPtmZgAAAAAAAwMiAAABAAAAANmZgEAAAAAAMAiAAABAAAAApmZgAAAAAAAwMiAAABAAAAAspmZgAAAAAAAwMiAAABAAAAA5mZgAAAAAAAwMiAAABAAAABFmZgAAAAAAAAAiAAACAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAD/LUL4HwAAENABoBAAAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACg==';
const CHAT_LAYOUTS_KEY = 'chat-layouts';

// --- Sub-components ---
const SHIFT_FORM_CATEGORIES = {
    RAMP: 'RAMP',
    SU: 'SU',
    PBB: 'PBB',
    DEVIR_NOTLARI: 'DEVİR NOTLARI',
};
type FormCategory = keyof typeof SHIFT_FORM_CATEGORIES;
type FormCategoryLowercase = 'ramp' | 'su' | 'pbb' | 'devir_notlari';

const ShiftReportForms: React.FC<{
    username: string;
    shiftNotes: { [key in FormCategoryLowercase]?: ChatMessage[] };
    onSendNote: (category: FormCategoryLowercase, text: string) => void;
    onDeleteNote: (category: FormCategoryLowercase, messageId: string) => void;
    onEditNote: (category: FormCategoryLowercase, messageId: string, newText: string) => void;
}> = ({ username, shiftNotes, onSendNote, onDeleteNote, onEditNote }) => {
    const [activeCategory, setActiveCategory] = useState<FormCategory>('RAMP');
    const [newMessage, setNewMessage] = useState('');
    const [editingMessage, setEditingMessage] = useState<{ id: string, text: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeCategoryLower = activeCategory.toLowerCase().replace(' ', '_') as FormCategoryLowercase;
    const currentMessages = shiftNotes[activeCategoryLower] || [];

    useEffect(() => {
        setNewMessage('');
        setEditingMessage(null);
    }, [activeCategory]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentMessages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendNote(activeCategoryLower, newMessage.trim());
            setNewMessage('');
        }
    };
    
    const handleSaveEdit = () => {
        if (editingMessage?.text.trim()) {
            onEditNote(activeCategoryLower, editingMessage.id, editingMessage.text.trim());
            setEditingMessage(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-800/90">
            <div className="flex-shrink-0 p-2 bg-slate-800 border-b border-slate-700 flex items-center flex-wrap">
                {(Object.keys(SHIFT_FORM_CATEGORIES) as FormCategory[]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-2 py-1 text-xs font-semibold rounded-md m-1 ${activeCategory === cat ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                    >
                        {SHIFT_FORM_CATEGORIES[cat]}
                    </button>
                ))}
            </div>
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                {currentMessages.length === 0 && <p className="text-center text-slate-400 pt-8 text-sm">Henüz bu kategoriye not eklenmemiş.</p>}
                {currentMessages.map(msg => {
                    const isSelf = msg.sender === username;
                    if (editingMessage?.id === msg.id) {
                         return (<div key={msg.id} className="flex flex-col items-end animate-fade-in"><div className="w-full p-2 rounded-lg bg-sky-900 border border-sky-700"><textarea value={editingMessage.text} onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })} className="w-full bg-slate-800 text-xs p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y" rows={1} autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } if (e.key === 'Escape') { setEditingMessage(null); } }} /><div className="flex justify-end gap-2 mt-2"><button onClick={() => setEditingMessage(null)} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">İptal (Esc)</button><button onClick={handleSaveEdit} className="text-xs px-2 py-1 bg-sky-600 hover:bg-sky-500 rounded-md transition-colors">Kaydet (Enter)</button></div></div></div>);
                    }
                    return (<div key={msg.id} className={`flex flex-col items-start`}><div className={`group flex items-start gap-2 w-full`}><div className={`flex-1 max-w-full p-1.5 rounded-md bg-slate-700`}><div className="flex justify-between items-center mb-1"><p className="text-xs font-bold text-amber-400">{msg.sender}</p><p className={`text-[11px] text-slate-500`}>{new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p></div><p className="text-xs text-slate-100 break-words whitespace-pre-wrap">{msg.text}</p></div>{isSelf && (<div className="flex-shrink-0 self-center flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"><button onClick={() => setEditingMessage({ id: msg.id, text: msg.text })} aria-label="Notu düzenle"><EditIcon className="w-3.5 h-3.5 text-slate-400 hover:text-sky-300" /></button><button onClick={() => onDeleteNote(activeCategoryLower, msg.id)} aria-label="Notu sil"><Trash2Icon className="w-3.5 h-3.5 text-slate-400 hover:text-red-400" /></button></div>)}</div></div>);
                })}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-2 border-t border-slate-700 flex-shrink-0">
                <div className="flex gap-2">
                    <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={`${SHIFT_FORM_CATEGORIES[activeCategory]} için notunuz...`} className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs" autoComplete="off" />
                    <button type="submit" className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed" disabled={!newMessage.trim()}>Gönder</button>
                </div>
            </form>
        </div>
    );
};


const TasksInterface: React.FC<{
    username: string;
    tasks: Task[];
    activeUsers: string[];
    onAssignTask: (assignee: string, description: string) => void;
    onAcknowledgeTask: (taskId: string) => void;
    onRejectTask: (taskId: string) => void;
}> = ({ username, tasks, activeUsers, onAssignTask, onAcknowledgeTask, onRejectTask }) => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [assignee, setAssignee] = useState('');
    const [description, setDescription] = useState('');

    const myTasks = tasks.filter(t => t.assignee === username);
    const assignedByMe = tasks.filter(t => t.assigner === username);

    const handleAssign = () => {
        if(assignee && description) {
            onAssignTask(assignee, description);
            setModalOpen(false);
            setAssignee('');
            setDescription('');
        }
    };

    return (
        <div className="h-full p-2 flex flex-col gap-2">
             <button onClick={() => setModalOpen(true)} className="w-full px-3 py-1.5 text-sm bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors">
                Yeni Görev Ata
            </button>
            <div className="flex-grow overflow-y-auto space-y-4">
                <div>
                    <h4 className="text-base font-bold text-sky-300 mb-1">Bana Atanan Görevler</h4>
                    <ul className="space-y-1.5">
                        {myTasks.length === 0 && <li className="text-slate-400 text-xs px-1.5">Size atanmış bir görev yok.</li>}
                        {myTasks.map(task => (
                            <li key={task.id} className="bg-slate-700 p-1.5 rounded-md">
                                <p className="text-sm"><span className="font-bold text-amber-400">{task.assigner}</span> tarafından: {task.description}</p>
                                {task.status === 'bekleniyor' ? (
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <button onClick={() => onAcknowledgeTask(task.id)} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1 px-3 rounded-md transition-colors">
                                            Onayla
                                        </button>
                                        <button onClick={() => onRejectTask(task.id)} className="text-xs bg-red-800 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-md transition-colors">
                                            Reddet
                                        </button>
                                    </div>
                                ) : task.status === 'onaylandı' ? (
                                    <p className="text-xs mt-1.5 text-emerald-400 font-semibold">Onaylandı</p>
                                ) : (
                                    <p className="text-xs mt-1.5 text-red-400 font-semibold">Reddedildi</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
                 <div>
                    <h4 className="text-base font-bold text-sky-300 mb-1">Atadığım Görevler</h4>
                    <ul className="space-y-1.5">
                         {assignedByMe.length === 0 && <li className="text-slate-400 text-xs px-1.5">Henüz bir görev atamadınız.</li>}
                        {assignedByMe.map(task => (
                            <li key={task.id} className="bg-slate-700/50 p-1.5 rounded-md">
                                 <p className="text-sm"><span className="font-bold text-amber-400">{task.assignee}</span> kişisine: {task.description}</p>
                                 <p className={`text-xs mt-1 font-semibold ${
                                     task.status === 'onaylandı' ? 'text-emerald-400' 
                                     : task.status === 'reddedildi' ? 'text-red-400'
                                     : 'text-amber-500'
                                 }`}>
                                    Durum: {
                                        task.status === 'bekleniyor' ? 'Bekleniyor' 
                                        : task.status === 'onaylandı' ? 'Onaylandı' 
                                        : 'Reddedildi'
                                    }
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
             <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Yeni Görev Ata">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="assignee" className="block text-sm font-medium text-slate-300 mb-1">Kime:</label>
                        <select id="assignee" value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <option value="">Kullanıcı Seçin</option>
                            {activeUsers.filter(u => u !== username).map(user => (
                                <option key={user} value={user}>{user}</option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">Görev Açıklaması:</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button onClick={handleAssign} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                            Görevi Ata
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const getInitialLayouts = () => {
    try {
        const savedLayouts = localStorage.getItem(CHAT_LAYOUTS_KEY);
        if (savedLayouts) {
            return JSON.parse(savedLayouts);
        }
    } catch (e) {
        console.error("Could not parse chat layouts from localStorage", e);
    }
    return {
        lg: [
            { i: 'main', x: 0, y: 0, w: 5, h: 10, minW: 3, minH: 6 },
            { i: 'users', x: 0, y: 10, w: 5, h: 4, minW: 2, minH: 3 },
            { i: 'sheet', x: 5, y: 0, w: 7, h: 14, minW: 4, minH: 8 },
        ],
    };
};

export const ChatRoom: React.FC<ChatRoomProps> = ({ username, tasks, activeUsers, onAssignTask, onAcknowledgeTask, onRejectTask }) => {
    const [shiftNotes, setShiftNotes] = useState<{ [key in FormCategoryLowercase]?: ChatMessage[] }>({});
    const [activeTab, setActiveTab] = useState<'notes' | 'tasks'>('notes');
    const [layouts, setLayouts] = useState(getInitialLayouts);
    
    const noteSoundRef = useRef<HTMLAudioElement | null>(null);
    const initialLoadDone = useRef(new Set<string>());
    
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }, []);

    const handleLayoutChange = useCallback((layout: any, allLayouts: any) => {
        try {
            localStorage.setItem(CHAT_LAYOUTS_KEY, JSON.stringify(allLayouts));
        } catch (e) {
             console.error("Could not save chat layouts to localStorage", e);
        }
        setLayouts(allLayouts);
    }, []);

    useEffect(() => {
        if (!username) return;

        noteSoundRef.current = new Audio(NOTIFICATION_SOUND_URL);

        const shiftFormsRef = ref(database, 'shift_forms');
        
        const notesUnsubscribe = onValue(shiftFormsRef, (snapshot) => {
            const allNotesData = snapshot.val() || {};
            const loadedNotes: { [key in FormCategoryLowercase]?: ChatMessage[] } = {};
            let playSound = false;
            
            for (const category in allNotesData) {
                const categoryData = allNotesData[category] || {};
                const messages = Object.keys(categoryData).map(key => ({
                    id: key, ...categoryData[key]
                })).sort((a, b) => a.timestamp - b.timestamp);
                
                loadedNotes[category as FormCategoryLowercase] = messages;

                if (initialLoadDone.current.has(category) && messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.sender !== username) {
                         playSound = true;
                    }
                } else {
                    initialLoadDone.current.add(category);
                }
            }
            
            setShiftNotes(loadedNotes);
            if(playSound) {
                noteSoundRef.current?.play().catch(e => console.error("Note sound play error:", e));
            }
        });

        return () => {
            notesUnsubscribe();
        };
    }, [username]);

    const handleSendNote = (category: FormCategoryLowercase, text: string) => {
        if (!username) return;
        const notesListRef = ref(database, `shift_forms/${category}`);
        const newNoteRef = push(notesListRef);
        set(newNoteRef, { sender: username, text, timestamp: Date.now() });
    };

    const handleDeleteNote = (category: FormCategoryLowercase, messageId: string) => {
        remove(ref(database, `shift_forms/${category}/${messageId}`));
    };

    const handleEditNote = (category: FormCategoryLowercase, messageId: string, newText: string) => {
        set(ref(database, `shift_forms/${category}/${messageId}/text`), newText);
    };
    
    return (
        <div className="w-full h-full animate-fade-in">
             <ResponsiveGridLayout 
                className="layout"
                layouts={layouts}
                onLayoutChange={handleLayoutChange}
                breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
                cols={{lg: 12, md: 10, sm: 6, xs: 4, xxs: 2}}
                rowHeight={30}
                draggableHandle=".drag-handle"
                draggableCancel=".no-drag"
             >
                <div key="main" className="bg-slate-800/90 rounded-lg shadow-2xl border border-slate-700 flex flex-col overflow-hidden">
                    <div className="drag-handle cursor-move flex-shrink-0 p-2 bg-slate-800 border-b border-slate-700 flex items-center">
                        <button onClick={() => setActiveTab('notes')} className={`no-drag px-3 py-1.5 text-sm font-semibold rounded-md ${activeTab === 'notes' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Sohbet</button>
                        <button onClick={() => setActiveTab('tasks')} className={`no-drag px-3 py-1.5 text-sm font-semibold rounded-md ${activeTab === 'tasks' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>Görevler</button>
                    </div>
                    <div className="flex-grow overflow-hidden">
                         {activeTab === 'notes' ? (
                             <ShiftReportForms 
                                username={username} 
                                shiftNotes={shiftNotes}
                                onSendNote={handleSendNote}
                                onDeleteNote={handleDeleteNote}
                                onEditNote={handleEditNote}
                             />
                        ) : (
                            <TasksInterface
                                username={username}
                                tasks={tasks}
                                activeUsers={activeUsers}
                                onAssignTask={onAssignTask}
                                onAcknowledgeTask={onAcknowledgeTask}
                                onRejectTask={onRejectTask}
                            />
                        )}
                    </div>
                </div>

                <div key="users" className="bg-slate-800/90 rounded-lg shadow-2xl border border-slate-700 flex flex-col p-2 overflow-hidden">
                    <h3 className="drag-handle cursor-move text-base font-bold text-sky-300 mb-2 flex items-center gap-2 flex-shrink-0">
                        <UsersIcon className="w-4 h-4" />
                        Aktif Kullanıcılar ({activeUsers.length})
                    </h3>
                    <ul className="space-y-1 overflow-y-auto flex-grow">
                        {activeUsers.length > 0 ? activeUsers.map(user => (
                            <li key={user} className="text-slate-300 text-sm px-2 py-0.5 bg-slate-700/50 rounded-md truncate">
                                {user} {user === username && '(Siz)'}
                            </li>
                        )) : (
                            <li className="text-slate-400 text-sm">Çevrimiçi kullanıcı yok.</li>
                        )}
                    </ul>
                </div>

                <div key="sheet" className="bg-slate-800/90 rounded-lg shadow-2xl border border-slate-700 flex flex-col overflow-hidden">
                     <div className="drag-handle cursor-move flex-shrink-0 bg-slate-800 p-2 border-b border-slate-700 flex items-center justify-center">
                        <span className="text-sm font-semibold text-slate-300">Çekim Listesi</span>
                     </div>
                    <div className="flex-grow w-full h-full">
                         <iframe
                            src={GOOGLE_SHEET_EMBED_URL}
                            className="w-full h-full border-none"
                            title="Çekim Listesi"
                        ></iframe>
                    </div>
                </div>
            </ResponsiveGridLayout>
        </div>
    );
};