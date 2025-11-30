import React, { useState } from 'react';
import { Megaphone, X, Edit2, Check } from 'lucide-react';

interface AnnouncementBarProps {
    message: string;
    isAdmin: boolean;
    onUpdateMessage: (newMessage: string) => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ message, isAdmin, onUpdateMessage }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [tempMessage, setTempMessage] = useState(message);

    if (!isVisible && !isEditing) return null;

    const handleSave = () => {
        onUpdateMessage(tempMessage);
        setIsEditing(false);
    };

    return (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 shadow-md relative animate-slide-down">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                    <div className="bg-white/20 p-2 rounded-full animate-pulse">
                        <Megaphone className="w-5 h-5 text-white" />
                    </div>

                    {isEditing ? (
                        <input
                            type="text"
                            value={tempMessage}
                            onChange={(e) => setTempMessage(e.target.value)}
                            className="bg-white/10 border border-white/30 rounded px-3 py-1 text-white placeholder-white/50 w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                            placeholder="Duyuru metnini giriniz..."
                            autoFocus
                        />
                    ) : (
                        <p className="font-medium text-sm md:text-base">
                            {message || "Hoş geldiniz! Yeni vardiya çizelgesi yayında."}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                    {isAdmin && (
                        <button
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                            title={isEditing ? "Kaydet" : "Duyuruyu Düzenle"}
                        >
                            {isEditing ? <Check className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                        </button>
                    )}
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                        title="Kapat"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
