import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.tsx';
import { User } from '../types.ts';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Omit<User, 'id' | 'password_insecure' | 'forcePasswordChange'>) => void;
  userToEdit?: User | null;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [username, setUsername] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [includeInSchedule, setIncludeInSchedule] = useState(true);
    const [error, setError] = useState('');

    const isEditMode = !!userToEdit;

    useEffect(() => {
        if (isOpen && userToEdit) {
            setUsername(userToEdit.username);
            setIsAdmin(userToEdit.isAdmin);
            // FIX: Ensure includeInSchedule has a boolean value.
            // Default to `!userToEdit.isAdmin` if the property is missing,
            // which matches the initial data seeding logic. This prevents
            // sending `undefined` to Firebase during an update.
            setIncludeInSchedule(userToEdit.includeInSchedule ?? !userToEdit.isAdmin);
            setError('');
        } else if (isOpen && !userToEdit) {
            // Reset for new user
            setUsername('');
            setIsAdmin(false);
            setIncludeInSchedule(true);
            setError('');
        }
    }, [isOpen, userToEdit]);

    const handleSubmit = () => {
        if (!username.trim()) {
            setError('Kullanıcı adı boş bırakılamaz.');
            return;
        }
        setError('');
        onSave({ username: username.trim(), isAdmin, includeInSchedule });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}>
            <div className="space-y-4">
                {error && <p className="text-red-400 text-sm text-center bg-red-900/50 p-2 rounded-md">{error}</p>}
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">Kullanıcı Adı</label>
                    <input
                        type="text" id="username" value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-75"
                        disabled={isEditMode}
                    />
                    {isEditMode && <p className="text-xs text-slate-500 mt-1">Kullanıcı adı değiştirilemez (sistem kimliği olarak kullanılır).</p>}
                </div>
                
                <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-md">
                    <label htmlFor="includeInSchedule" className="text-sm font-medium text-slate-300 cursor-pointer">Oturma Düzenine Dahil Et</label>
                    <input
                        type="checkbox" id="includeInSchedule" checked={includeInSchedule}
                        onChange={(e) => setIncludeInSchedule(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:opacity-75"
                        disabled={isEditMode && userToEdit?.isAdmin}
                    />
                </div>
                
                <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-md">
                    <label htmlFor="isAdmin" className="text-sm font-medium text-slate-300 cursor-pointer">Admin Yetkisi</label>
                    <input
                        type="checkbox" id="isAdmin" checked={isAdmin}
                        onChange={(e) => setIsAdmin(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:opacity-75"
                        disabled={isEditMode && userToEdit?.username === 'gurkankose'}
                    />
                </div>

                <div className="pt-4 flex justify-end">
                    <button onClick={handleSubmit} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors">Kaydet</button>
                </div>
            </div>
        </Modal>
    );
};
