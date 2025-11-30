import React from 'react';
import { UserRole } from '../types';

interface RoleSwitcherProps {
  role: UserRole;
  onRoleSelect: (role: UserRole) => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ role, onRoleSelect }) => {
  const getButtonClass = (buttonRole: UserRole) => {
    const baseClass = "px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500";
    if (role === buttonRole) {
      return `${baseClass} bg-sky-600 text-white`;
    }
    return `${baseClass} bg-slate-700 text-slate-300 hover:bg-slate-600`;
  };

  return (
    <div className="mt-6 flex justify-center items-center gap-2 p-1 bg-slate-800 rounded-lg animate-fade-in">
        <span className="text-sm font-medium text-slate-400 mr-2">Kullanıcı Rolü:</span>
        <button onClick={() => onRoleSelect('admin')} className={getButtonClass('admin')}>
            Gürkan
        </button>
        <button onClick={() => onRoleSelect('viewer')} className={getButtonClass('viewer')}>
            Ekip Üyeleri
        </button>
    </div>
  );
};