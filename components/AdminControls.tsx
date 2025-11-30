import React from 'react';

interface AdminControlsProps {
    onSave: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onDiscard: () => void;
    canUndo: boolean;
    canRedo: boolean;
    hasChanges: boolean;
}

export const AdminControls: React.FC<AdminControlsProps> = ({
    onSave,
    onUndo,
    onRedo,
    onDiscard,
    canUndo,
    canRedo,
    hasChanges
}) => {
    const baseButtonClass = "px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2";

    return (
        <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm p-4 mb-6 rounded-lg shadow-lg border border-slate-700 animate-fade-in">
            <div className="flex flex-wrap justify-center items-center gap-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={`${baseButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-100`}
                        aria-label="Geri Al"
                    >
                        Geri Al
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className={`${baseButtonClass} bg-slate-700 hover:bg-slate-600 text-slate-100`}
                        aria-label="İleri Al"
                    >
                        İleri Al
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onDiscard}
                        disabled={!hasChanges}
                        className={`${baseButtonClass} bg-red-800 hover:bg-red-700 text-white`}
                        aria-label="Değişikliklerden Vazgeç"
                    >
                        Vazgeç
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!hasChanges}
                        className={`${baseButtonClass} bg-emerald-700 hover:bg-emerald-600 text-white`}
                        aria-label="Değişiklikleri Kaydet ve Yayınla"
                    >
                        Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
            {hasChanges && <p className="text-center text-xs text-amber-400 mt-3">Kaydedilmemiş değişiklikler var. İzleyiciler bu değişiklikleri görmüyor.</p>}
        </div>
    );
};