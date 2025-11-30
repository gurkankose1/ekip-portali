import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse, Modality, LiveServerMessage, Blob, LiveSession, FunctionDeclaration, Type } from '@google/genai';
import { UserIcon } from './Icons.tsx';
import { database } from '../firebaseConfig.ts';
import { ref, onValue, push, set } from 'firebase/database';
import { User } from '../types.ts';

// --- Helper Functions ---
const blobToBase64 = (blob: globalThis.Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface AiAssistantViewProps {
    currentUser: User;
}

const AiAssistantView: React.FC<AiAssistantViewProps> = ({ currentUser }) => {
    const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<Record<string, string | null>>({});
    const [apiKeySelected, setApiKeySelected] = useState(false);

    // --- Chat State ---
    const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'model'; parts: any[] }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatImage, setChatImage] = useState<{ file: File; preview: string } | null>(null);
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    const [useFastMode, setUseFastMode] = useState(false);

    // --- Image Generation State ---
    const [imagePrompt, setImagePrompt] = useState('Bir kumsalda oynayan sevimli bir robot');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    // --- Image Editing State ---
    const [editImage, setEditImage] = useState<{ file: File; preview: string } | null>(null);
    const [editPrompt, setEditPrompt] = useState('Resme retro bir filtre ekle');
    const [editedImage, setEditedImage] = useState<string | null>(null);

    // --- Video Generation State ---
    const [videoPrompt, setVideoPrompt] = useState('Hızlı giden bir arabanın neon hologramı');
    const [videoImage, setVideoImage] = useState<{ file: File; preview: string } | null>(null);
    const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [videoStatus, setVideoStatus] = useState('');

    // --- Advanced Tools State ---
    const [activeTool, setActiveTool] = useState<'transcribe' | 'analyze' | 'complex'>('transcribe');
    const [isRecording, setIsRecording] = useState(false);
    const [transcribedText, setTranscribedText] = useState('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [complexPrompt, setComplexPrompt] = useState('Bana 5 yaşındaki bir çocuk için 100 kelimelik bir hikaye anlat.');
    const [complexResponse, setComplexResponse] = useState('');
    
    // --- Live Conversation State ---
    const [isLive, setIsLive] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState<{user:string, model:string}[]>([]);
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (!currentUser) return;

        const chatRef = ref(database, `ai_assistant_chats/${currentUser.id}`);
        const unsubscribe = onValue(chatRef, (snapshot) => {
            const data = snapshot.val() || {};
            const loadedMessages = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => a.timestamp - b.timestamp);
            setChatMessages(loadedMessages);
        });

        return () => unsubscribe();
    }, [currentUser]);


    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const handleSelectApiKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        }
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const tools: any[] = [];
            if (useSearch) tools.push({googleSearch: {}});
            if (useMaps) tools.push({googleMaps: {}});
            
            const response = await ai.models.generateContent({
                model: useFastMode ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash',
                contents: { parts: userParts },
                config: tools.length > 0 ? { tools } : {},
            });

            const modelResponse = { 
                role: 'model' as const, 
                parts: [{text: response.text, grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []}],
                timestamp: Date.now()
            };
            const newModelMessageRef = push(chatRef);
            await set(newModelMessageRef, modelResponse);

        } catch (e: any) {
            console.error(e);
            const errorMessageText = e.message || 'Bilinmeyen bir hata oluştu.';
            setErrorState('chat', errorMessageText);

            if (errorMessageText.includes("Requested entity was not found.")) {
                setApiKeySelected(false);
            }

            const errorMessage = {
                role: 'model' as const, 
                parts: [{text: `Bir hata oluştu: ${errorMessageText}`}],
                timestamp: Date.now()
            };
            const newErrorMessageRef = push(chatRef);
            await set(newErrorMessageRef, errorMessage);
        } finally {
            setLoading('chat', false);
        }
    };
    
    // ... Other handlers ...

    if (!apiKeySelected) {
        return (
            <div className="animate-fade-in">
                <header className="text-center">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 pb-2">
                        Gemini AI Asistanı
                    </h1>
                </header>
                <div className="mt-8 text-center bg-slate-800 rounded-lg shadow-lg border border-slate-700 p-8 max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-sky-300 mb-4">API Anahtarı Gerekli</h2>
                    <p className="text-slate-400 mb-6">
                        AI Asistanı özelliklerini kullanmak için lütfen bir API anahtarı seçin.
                    </p>
                    <button
                        onClick={handleSelectApiKey}
                        className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors"
                    >
                        API Anahtarı Seç
                    </button>
                    <p className="text-xs text-slate-500 mt-4">
                        API kullanımıyla ilgili ücretlendirme bilgileri için lütfen <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Gemini API faturalandırma belgelerine</a> bakın.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8">
             <header className="text-center">
                 <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 pb-2">
                    Gemini AI Asistanı
                </h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Yapay zeka destekli araçlarla üretkenliğinizi artırın.
                </p>
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
                                        if (part.inlineData) return <img key={i} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} className="max-w-xs rounded-md my-2" />;
                                        return null;
                                    })}
                                    {msg.role === 'model' && msg.parts[0]?.grounding?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-600">
                                            <h4 className="text-xs font-semibold text-slate-400 mb-1">Kaynaklar:</h4>
                                            <ul className="text-xs space-y-1">
                                                {msg.parts[0].grounding.map((chunk: any, i: number) => {
                                                    const source = chunk.web || chunk.maps;
                                                    if(source) return <li key={i}><a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{source.title || source.uri}</a></li>
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
                        {chatImage && <div className="relative w-24"><img src={chatImage.preview} className="rounded-md" /><button onClick={() => setChatImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6">X</button></div>}
                        <div className="flex gap-2">
                            <input type="file" id="chat-file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setChatImage({file: e.target.files[0], preview: URL.createObjectURL(e.target.files[0])})} />
                            <button onClick={() => document.getElementById('chat-file')?.click()} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md">📷</button>
                            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSubmit()} placeholder="Mesajınızı yazın..." className="flex-1 bg-slate-700 rounded-md px-3" />
                            <button onClick={handleChatSubmit} disabled={isLoading.chat} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-md font-semibold disabled:opacity-50">Gönder</button>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useSearch} onChange={(e) => setUseSearch(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500" /> Google Arama</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useMaps} onChange={(e) => setUseMaps(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500" /> Google Haritalar</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useFastMode} onChange={(e) => setUseFastMode(e.target.checked)} className="rounded text-sky-500 focus:ring-sky-500" /> Hızlı Mod</label>
                        </div>
                    </div>
                </div>

                {/* More cards... */}
            </div>
        </div>
    );
};

export default AiAssistantView;