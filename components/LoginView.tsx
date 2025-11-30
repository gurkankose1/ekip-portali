import React, { useState } from 'react';
import { User } from '../types';

interface LoginViewProps {
  onLogin: (username: string, password_insecure: string) => void;
  error: string | null;
  allUsers: User[];
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, error, allUsers }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username && password) {
            onLogin(username, password);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 animate-fade-in">
            <div className="w-full max-w-sm mx-auto bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-2xl p-8 border border-slate-700">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-sky-300">Ekip Portalı Girişi</h1>
                        <p className="text-slate-400 mt-2">Devam etmek için giriş yapın.</p>
                    </div>
                    {error && <p className="text-red-400 text-sm text-center bg-red-900/50 p-2 rounded-md">{error}</p>}
                    <div>
                        <label htmlFor="username-select" className="block text-sm font-medium text-slate-300 mb-1">
                            Kullanıcı Adı
                        </label>
                        <select
                            id="username-select"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            required
                        >
                            <option value="" disabled>Kullanıcı Seçin</option>
                            {allUsers
                                .sort((a, b) => a.username.localeCompare(b.username))
                                .map(user => (
                                <option key={user.id} value={user.username}>
                                    {user.username}
                                </option>
                            ))}
                        </select>
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
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500"
                        >
                            Giriş Yap
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};