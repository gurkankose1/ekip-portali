import React, { useState } from 'react';
import { Modal } from './Modal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'gurkankose' && password === 'Gg.113355') {
      setError('');
      onSuccess();
    } else {
      setError('Geçersiz kullanıcı adı veya şifre.');
    }
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Gürkan Girişi">
      <form onSubmit={handleLogin} className="space-y-4">
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
            Kullanıcı Adı
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="password" aria-label="Şifre" className="block text-sm font-medium text-slate-300 mb-1">
            Şifre
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
            autoComplete="current-password"
          />
        </div>
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
          >
            Giriş Yap
          </button>
        </div>
      </form>
    </Modal>
  );
};