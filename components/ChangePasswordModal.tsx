import React, { useState } from 'react';
import { Modal } from './Modal.tsx';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  isFirstLogin?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSubmit, isFirstLogin = false }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError('Şifre en az 4 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (isFirstLogin && newPassword === '12345') {
        setError('Lütfen varsayılan şifreden farklı bir şifre seçin.');
        return;
    }
    setError('');
    onSubmit(newPassword);
  };
  
  const handleClose = () => {
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      if (!isFirstLogin) {
        onClose();
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isFirstLogin ? 'Yeni Şifre Belirleyin' : 'Şifre Değiştir'}>
        {isFirstLogin && (
            <p className="text-center text-amber-400 bg-slate-700/50 p-3 rounded-md mb-4 text-sm">
                Güvenliğiniz için, ilk girişinizde şifrenizi güncellemeniz gerekmektedir.
            </p>
        )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <div>
          <label htmlFor="new-password" aria-label="Yeni Şifre" className="block text-sm font-medium text-slate-300 mb-1">
            Yeni Şifre
          </label>
          <input
            type="password"
            id="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-password" aria-label="Yeni Şifreyi Onayla" className="block text-sm font-medium text-slate-300 mb-1">
            Yeni Şifreyi Onayla
          </label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
          />
        </div>
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
          >
            Kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
};
