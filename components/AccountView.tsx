import React from 'react';

interface AccountViewProps {
  onChangePassword: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({ onChangePassword }) => {
  return (
    <div className="animate-fade-in max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-center mb-6 text-sky-300">
        Hesabım
      </h2>
      <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Güvenlik</h3>
        <button
          onClick={onChangePassword}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors"
        >
          Şifreyi Değiştir
        </button>
      </div>
    </div>
  );
};