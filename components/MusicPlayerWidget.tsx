import React, { useState, useMemo } from 'react';
import { MusicIcon } from './Icons';

interface MusicPlayerWidgetProps {
    url: string | null;
    isVisible: boolean;
}

export const MusicPlayerWidget: React.FC<MusicPlayerWidgetProps> = ({ url, isVisible }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const videoId = useMemo(() => {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            // Handles youtube.com/embed/VIDEO_ID format
            if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
                const pathParts = urlObj.pathname.split('/');
                if (pathParts[1] === 'embed') {
                    return pathParts[2];
                }
            }
        } catch (e) {
            console.error("Invalid music URL:", url);
        }
        return null; // Return null if URL is not a valid embed URL or parsing fails
    }, [url]);

    if (!isVisible || !url || !videoId) {
        return null;
    }

    const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=1&modestbranding=1`;

    return (
        <div 
            className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 h-64' : 'w-14 h-14'}`}
        >
            <div className="relative w-full h-full bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-2xl border border-slate-700 overflow-hidden">
                {isExpanded ? (
                    <>
                        <div className="absolute top-0 left-0 right-0 p-2 bg-slate-900/50 flex justify-between items-center z-10">
                             <h4 className="text-xs font-semibold text-white truncate">Müzik Çalar</h4>
                             <button onClick={() => setIsExpanded(false)} className="text-white hover:text-sky-300 text-xs font-bold">
                                Daralt
                            </button>
                        </div>
                        <iframe
                            src={embedSrc}
                            title="YouTube Music Player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full pt-8"
                        ></iframe>
                    </>
                ) : (
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="w-full h-full flex items-center justify-center text-sky-400 hover:text-sky-300 hover:bg-slate-700/50 transition-colors"
                        aria-label="Müzik çaları genişlet"
                        title="Müzik çaları genişlet"
                    >
                        <MusicIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
};