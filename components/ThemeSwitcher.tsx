

import React from 'react';
import { SunIcon, MoonIcon, DropletIcon } from './Icons.tsx';

type Theme = 'dark' | 'light' | 'blue';

interface ThemeSwitcherProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const themes: { name: Theme, icon: React.ReactNode, label: string }[] = [
    { name: 'dark', icon: <MoonIcon className="w-4 h-4" />, label: 'Koyu Tema' },
    { name: 'light', icon: <SunIcon className="w-4 h-4" />, label: 'Açık Tema' },
    { name: 'blue', icon: <DropletIcon className="w-4 h-4" />, label: 'Mavi Tema' },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, setTheme }) => {
    return (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-700">
            {themes.map((t) => (
                <button
                    key={t.name}
                    onClick={() => setTheme(t.name)}
                    className={`p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 ${
                        theme === t.name
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-600'
                    }`}
                    aria-label={t.label}
                    title={t.label}
                >
                    {t.icon}
                </button>
            ))}
        </div>
    );
};