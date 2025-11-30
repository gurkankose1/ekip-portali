import React, { useState } from 'react';
import { User } from '../types.ts';
import { UserEditModal } from './UserEditModal.tsx';
import { PlusCircleIcon, EditIcon, Trash2Icon } from './Icons.tsx';

interface UserManagementViewProps {
  onResetPassword: (userId: string) => void;
  onCreateUser: (userData: Omit<User, 'id' | 'password_insecure' | 'forcePasswordChange'>) => void;
  onUpdateUser: (userId: string, updates: Partial<Omit<User, 'id'>>) => void;
  onDeleteUser: (userId: string) => void;
  allUsers: User[];
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ 
    onResetPassword,
    onCreateUser,
    onUpdateUser,
    onDeleteUser,
    allUsers 
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const isLoading = allUsers.length === 0;

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleSaveUser = (userData: Omit<User, 'id' | 'password_insecure' | 'forcePasswordChange'>) => {
        if (editingUser) { // Edit mode
            onUpdateUser(editingUser.id, userData);
        } else { // Create mode
            onCreateUser(userData);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (user: User) => {
        if (window.confirm(`'${user.username}' kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            onDeleteUser(user.id);
        }
    };
    
  return (
    <div className="animate-fade-in max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-sky-300">Kullanıcı Yönetimi</h2>
        <button onClick={handleOpenCreateModal} className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors">
            <PlusCircleIcon className="w-5 h-5" />
            Yeni Kullanıcı Ekle
        </button>
      </div>

      <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-center text-slate-400">Kullanıcılar yükleniyor...</p>
        ) : (
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-sky-300 uppercase bg-slate-700/50">
              <tr>
                <th scope="col" className="px-6 py-3">Kullanıcı Adı</th>
                <th scope="col" className="px-6 py-3">Rol</th>
                <th scope="col" className="px-6 py-3 text-center">Oturma Düzeninde mi?</th>
                <th scope="col" className="px-6 py-3 text-center">Şifre Değişikliği Gerekli</th>
                <th scope="col" className="px-6 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(user => (
                <tr key={user.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="px-6 py-4 font-medium text-slate-100">{user.username}</td>
                  <td className="px-6 py-4">{user.isAdmin ? 'Admin' : 'Kullanıcı'}</td>
                  <td className="px-6 py-4 text-center">
                     {user.includeInSchedule ? 
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-900 text-emerald-300">Evet</span> :
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-600 text-slate-300">Hayır</span>
                     }
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.forcePasswordChange ? 
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-900 text-amber-300">Evet</span> : 
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-900 text-emerald-300">Hayır</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-4">
                        <button onClick={() => handleOpenEditModal(user)} className="text-slate-400 hover:text-sky-300" title="Düzenle"><EditIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(user)} disabled={user.username === 'gurkankose'} className="text-slate-400 hover:text-red-400 disabled:opacity-50" title="Sil"><Trash2Icon className="w-4 h-4" /></button>
                        <button
                          onClick={() => onResetPassword(user.id)}
                          className="font-medium text-sky-400 hover:text-sky-300 disabled:opacity-50"
                          disabled={user.username === 'gurkankose'}
                          title={user.username === 'gurkankose' ? 'Admin şifresi buradan sıfırlanamaz' : 'Şifreyi Sıfırla'}
                        >
                          Şifreyi Sıfırla
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <UserEditModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        userToEdit={editingUser}
      />
    </div>
  );
};
