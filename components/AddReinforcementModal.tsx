import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.tsx';

interface AddReinforcementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (personnel: string, station: string) => void;
}

export const AddReinforcementModal: React.FC<AddReinforcementModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [station, setStation] = useState('');

  useEffect(() => {
    if (!isOpen) {
      // Modal kapandığında state'i temizle
      setName('');
      setStation('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && station.trim()) {
      onSubmit(name.trim(), station.trim());
    } else {
      alert("Personel adı ve istasyon boş bırakılamaz.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Takviye Personel Ekle">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="personnel-name" className="block text-sm font-medium text-slate-300 mb-1">
            Personel Adı
          </label>
          <input
            type="text"
            id="personnel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="station-name" className="block text-sm font-medium text-slate-300 mb-1">
            Atanacak İstasyon
          </label>
          <input
            type="text"
            id="station-name"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
            autoComplete="off"
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