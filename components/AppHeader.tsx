import React from 'react';
import { HomeIcon, UsersIcon, MessageCircleIcon, GridIcon, UserIcon, UserCogIcon, LogOutIcon, ZapIcon, FileTextIcon, ExternalLinkIcon, MusicIcon } from './Icons.tsx';
import { ThemeSwitcher } from './ThemeSwitcher.tsx';
import { User, ActiveView } from '../types.ts';

type Theme = 'dark' | 'light' | 'blue';

interface AppHeaderProps {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    currentUser: User;
    onLogout: () => void;
    isMusicPlayerVisible: boolean;
    onToggleMusicPlayer: () => void;
}

const NavLink: React.FC<{
    onClick: () => void;
    isActive: boolean;
    children: React.ReactNode;
    icon: React.ReactNode;
    title: string;
}> = ({ onClick, isActive, children, icon, title }) => (
    <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
            isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'
        }`}
    >
        {icon}
        <span className="hidden lg:inline">{children}</span>
    </button>
);

export const AppHeader: React.FC<AppHeaderProps> = ({ activeView, setActiveView, theme, setTheme, currentUser, onLogout, isMusicPlayerVisible, onToggleMusicPlayer }) => {
    
    const navItems = [
        { view: 'schedule', label: 'Oturma Düzeni', icon: <UsersIcon className="w-4 h-4" /> },
        { view: 'ai_assistant', label: 'AI Asistan', icon: <ZapIcon className="w-4 h-4" /> },
        { view: 'chat', label: 'Sohbet', icon: <MessageCircleIcon className="w-4 h-4" /> },
        { view: 'spreadsheet', label: 'Excel', icon: <GridIcon className="w-4 h-4" /> },
        { view: 'account', label: 'Hesabım', icon: <UserIcon className="w-4 h-4" /> },
    ];
    
    if (currentUser.isAdmin) {
        navItems.push({ view: 'user_management', label: 'Yönetim', icon: <UserCogIcon className="w-4 h-4" /> });
        navItems.push({ view: 'links', label: 'Bağlantılar', icon: <ExternalLinkIcon className="w-4 h-4" /> });
        navItems.push({ view: 'ai_logs', label: 'AI Logları', icon: <FileTextIcon className="w-4 h-4" /> });
    }

  return (
    <header className="w-full p-2 fixed top-0 left-0 right-0 z-30 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="w-full max-w-7xl mx-auto flex justify-between items-center gap-4">
            {/* Left side: Logo/Home */}
            <div className="flex-shrink-0">
                 <button 
                    onClick={() => setActiveView('portal')} 
                    className="flex items-center gap-2 px-3 py-2 text-lg font-bold text-sky-300 hover:bg-slate-700/50 rounded-md transition-colors"
                 >
                    <HomeIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Ekip Portalı</span>
                </button>
            </div>
            
            {/* Center: Navigation */}
            <nav className="flex items-center gap-1 sm:gap-2">
                 {navItems.map(item => (
                    <NavLink
                        key={item.view}
                        onClick={() => setActiveView(item.view as ActiveView)}
                        isActive={activeView === item.view}
                        icon={item.icon}
                        title={item.label}
                    >
                        {item.label}
                    </NavLink>
                 ))}
            </nav>

            {/* Right side: Theme, User, Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
                 <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-700">
                    <ThemeSwitcher theme={theme} setTheme={setTheme} />
                     <button
                        onClick={onToggleMusicPlayer}
                        className={`p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 ${
                            isMusicPlayerVisible
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-600'
                        }`}
                        aria-label="Müzik Çaları Aç/Kapat"
                        title="Müzik Çaları Aç/Kapat"
                    >
                       <MusicIcon className="w-4 h-4" />
                    </button>
                </div>
                 <div className="hidden md:flex items-center gap-3">
                    <span className="text-sm text-slate-400">Hoş geldin, <span className="font-bold text-slate-200">{currentUser.username}</span>!</span>
                    <button 
                        onClick={onLogout}
                        className="px-3 py-1.5 text-sm font-semibold bg-red-800 hover:bg-red-700 text-white rounded-md transition-colors"
                    >
                        Çıkış Yap
                    </button>
                 </div>
                 <button 
                    onClick={onLogout}
                    className="md:hidden p-2 text-sm font-semibold bg-slate-700 hover:bg-red-800 text-white rounded-md transition-colors"
                    title="Çıkış Yap"
                 >
                    <LogOutIcon className="w-4 h-4" />
                 </button>
            </div>
        </div>
    </header>
  );
};