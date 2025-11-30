import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Trash2Icon, PlusCircleIcon } from './Icons';

interface PersonnelManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPersonnel: string[];
  onSave: (updatedPersonnel: string[]) => void;
}

export const PersonnelManagementModal: React.FC<PersonnelManagementModalProps> = ({ isOpen, onClose, initialPersonnel, onSave }) => {
  const [personnel, setPersonnel] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPersonnel([...initialPersonnel]);
    }
  }, [isOpen, initialPersonnel]);

  const handleNameChange = (index: number, newName: string) => {
    const updatedPersonnel = [...personnel];
    updatedPersonnel[index] = newName;
    setPersonnel(updatedPersonnel);
  };

  const handleRemovePersonnel = (index: number) => {
    const updatedPersonnel = personnel.filter((_, i) => i !== index);
    setPersonnel(updatedPersonnel);
  };

  const handleAddPersonnel = () => {
    setPersonnel([...personnel, '']);
  };

  const handleSaveChanges = () => {
    const finalPersonnel = personnel
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    const uniquePersonnel = new Set(finalPersonnel);
    if (uniquePersonnel.size !== finalPersonnel.length) {
        alert("Personel isimleri benzersiz olmalıdır.");
        return;
    }
      
    onSave(finalPersonnel);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Personel Listesini Yönet">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {personnel.map((name, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              className="flex-grow px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Personel Adı"
              aria-label={`Personel ${index + 1} adı`}
            />
            <button
              onClick={() => handleRemovePersonnel(index)}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-full transition-colors"
              aria-label={`${name} personelini sil`}
            >
              <Trash2Icon className="w-5 h-5" />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddPersonnel}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-md text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
        >
          <PlusCircleIcon className="w-5 h-5" />
          Yeni Personel Ekle
        </button>
      </div>
      <div className="pt-6 flex justify-end">
        <button
          onClick={handleSaveChanges}
          className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200"
        >
          Değişiklikleri Kaydet
        </button>
      </div>
    </Modal>
  );
};