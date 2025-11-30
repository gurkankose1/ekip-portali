import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { UserIcon } from './Icons.tsx';
import { database } from '../firebaseConfig.ts';
import { ref, onValue, push, set } from 'firebase/database';
import { User } from '../types.ts';

// --- Helper Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

interface AiAssistantViewProps {
    currentUser: User;
}

const AiAssistantView: React.FC<AiAssistantViewProps> = ({ currentUser }) => {
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<Record<string, string | null>>({});

    // API Key State
    const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
    const [showKeyInput, setShowKeyInput] = useState(!localStorage.getItem('gemini_api_key'));

    // Chat State
    const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'model'; parts: any[] }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatImage, setChatImage] = useState<{ file: File; preview: string } | null>(null);
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const [useFastMode, setUseFastMode] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const chatRef = ref(database, `ai_assistant_chats/${currentUser.id}`);
        const unsubscribe = onValue(chatRef, (snapshot) => {
            const data = snapshot.val() || {};
            const loadedMessages = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a: any, b: any) => a.timestamp - b.timestamp);
            setChatMessages(loadedMessages);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleSaveKey = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey);
            setShowKeyInput(false);
        }
    };

    const handleClearKey = () => {
        localStorage.removeItem('gemini_api_key');
        setApiKey('');
        setShowKeyInput(true);
    };

    const setLoading = (key: string, value: boolean) => setIsLoading(prev => ({ ...prev, [key]: value }));
    const setErrorState = (key: string, value: string | null) => setError(prev => ({ ...prev, [key]: value }));

    const handleChatSubmit = async () => {
        if ((!chatInput.trim() && !chatImage) || !currentUser) return;

        setLoading('chat', true);
        setErrorState('chat', null);

        const userParts = [];
        if (chatInput.trim()) userParts.push({ text: chatInput });
        if (chatImage) {
            const base64Data = await blobToBase64(chatImage.file);
            userParts.push({ inlineData: { mimeType: chatImage.file.type, data: base64Data } });
        }

        const userMessage = {
            role: 'user' as const,
            parts: userParts,
            timestamp: Date.now()
        };
        const chatRef = ref(database, `ai_assistant_chats/${currentUser.id}`);
        const newUserMessageRef = push(chatRef);
        await set(newUserMessageRef, userMessage);

        setChatInput('');
        setChatImage(null);

        try {
            // @ts-ignore - GoogleGenAI constructor might differ in version
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const tools: any[] = [];
            if (useSearch) tools.push({ googleSearch: {} });
            if (useMaps) tools.push({ googleMaps: {} });

            const response = await ai.models.generateContent({
                model: useFastMode ? 'gemini-2.0-flash-lite' : 'gemini-2.0-flash',
                contents: { parts: userParts },
                config: tools.length > 0 ? { tools } : {},
            });

            const modelResponse = {
                role: 'model' as const,
                parts: [{ text: response.text, grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] }],
                timestamp: Date.now()
            };
            const newModelMessageRef = push(chatRef);
            await set(newModelMessageRef, modelResponse);

        } catch (e: any) {
            console.error(e);
            const errorMessageText = e.message || 'Bilinmeyen bir hata oluştu.';
            setErrorState('chat', errorMessageText);

            if (errorMessageText.includes("API key not valid") || errorMessageText.includes("403")) {
                setShowKeyInput(true);
            }

            const errorMessage = {
                role: 'model' as const,
                parts: [{ text: `Bir hata oluştu: ${errorMessageText}` }],
                timestamp: Date.now()
            };
            const newErrorMessageRef = push(chatRef);
            await set(newErrorMessageRef, errorMessage);
        } finally {
            setLoading('chat', false);
        }
    };

    if (showKeyInput) {
        return (
            <div className="animate-fade-in">
                <header className="text-center">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 pb-2">
                        Gemini AI Asistanı
                    </h1>
                </header>
                <div className="mt-8 text-center bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-8 max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-sky-300 mb-4">Gemini API Anahtarı Gerekli</h2>
                    <p className="text-slate-400 mb-6">
                        AI Asistanı özelliklerini kullanmak için lütfen Google Gemini API anahtarınızı girin.
                        Anahtarınız sadece tarayıcınızda saklanır.
                    </p>
                    <div className="flex gap-2 max-w-md mx-auto">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="API Anahtarınızı buraya yapıştırın"
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                            onClick={handleSaveKey}
                            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors"
                        >
                            Kaydet
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        API anahtarınızı <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Google AI Studio</a> üzerinden alabilirsiniz.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8">
            <header className="text-center relative">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 pb-2">
                    Gemini AI Asistanı
                </h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Yapay zeka destekli araçlarla üretkenliğinizi artırın.
                </p>
                <button
                    onClick={handleClearKey}
                    className="absolute top-0 right-0 text-xs text-slate-500 hover:text-slate-300 underline"
                >
                    API Anahtarını Değiştir
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* --- CHAT CARD --- */}
                <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 lg:col-span-2">
                    <h3 className="text-lg font-bold text-sky-300 p-4 border-b border-slate-700">Sohbet Asistanı</h3>
                    <div className="p-4 h-96 overflow-y-auto flex flex-col gap-4">
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-sky-800 flex items-center justify-center flex-shrink-0">🤖</div>}
                                <div className={`max-w-xl rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-sky-700' : 'bg-slate-700'}`}>
                                    {msg.parts.map((part, i) => {
                                        if (part.text) return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                                        if (part.inlineData) return <img key={i} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} className="max-w-xs rounded-md my-2" alt="Uploaded content" />;
                                        return null;
                                    })}
                                    {msg.role === 'model' && msg.parts[0]?.grounding?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-600">
                                            <h4 className="text-xs font-semibold text-slate-400 mb-1">Kaynaklar:</h4>
                                            <ul className="text-xs space-y-1">
                                                {msg.parts[0].grounding.map((chunk: any, i: number) => {
                                                    const source = chunk.web || chunk.maps;
                                                    if (source) return <li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{source.title || source.uri}</a></li>
                                                    return null;
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && <UserIcon className="w-8 h-8 rounded-full bg-slate-600 p-1.5 flex-shrink-0" />}
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-slate-700 space-y-3">
                        {chatImage && <div className="relative w-24"><img src={chatImage.preview} className="rounded-md" alt="Preview" /><button onClick={() => setChatImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6">X</button></div>}
                        <div className="flex gap-2">
                            <input type="file" id="chat-file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setChatImage({ file: e.target.files[0], preview: URL.createObjectURL(e.target.files[0]) })} />
                            <button onClick={() => document.getElementById('chat-file')?.click()} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md">📷</button>
                            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSubmit()} placeholder="Mesajınızı yazın..." className="flex-1 bg-slate-700 rounded-md px-3 text-white" />
                            <button onClick={handleChatSubmit} disabled={isLoading.chat} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-md font-semibold disabled:opacity-50 text-white">Gönder</button>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-300">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500" /> Google Arama</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useMaps} onChange={(e) => setUseMaps(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500" /> Google Haritalar</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useFastMode} onChange={(e) => setUseFastMode(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500" /> Hızlı Mod</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiAssistantView;