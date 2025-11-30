import React, { useState, useEffect } from 'react';
import { ExternalLink } from '../types.ts';
import { PlusCircleIcon, EditIcon, Trash2Icon } from './Icons.tsx';
import { LinkEditModal } from './LinkEditModal.tsx';

interface LinkManagementViewProps {
  links: ExternalLink[];
  onCreate: (linkData: Omit<ExternalLink, 'id'>) => void;
  onUpdate: (linkId: string, updates: Partial<Omit<ExternalLink, 'id'>>) => void;
  onDelete: (linkId: string) => void;
}

const MusicPlayerSettings: React.FC<{
    musicLink: ExternalLink | undefined;
    onUpdate: (linkId: string, updates: Partial<Omit<ExternalLink, 'id'>>) => void;
}> = ({ musicLink, onUpdate }) => {
    const [url, setUrl] = useState(musicLink?.href || '');
    
    useEffect(() => {
        setUrl(musicLink?.href || '');
    }, [musicLink]);
    
    const handleSave = () => {
        try {
            if (url) new URL(url);
            onUpdate('music_player_url', { href: url });
            alert('Müzik çalar URL\'si güncellendi.');
        } catch (_) {
            alert('Lütfen geçerli bir URL girin.');
        }
    };

    return (
        <div className="mb-8 p-4 bg-slate-800 rounded-lg shadow-lg border border-slate-700">
            <h3 className="text-xl font-bold text-amber-400 mb-2">Müzik Çalar Ayarı</h3>
            <p className="text-sm text-slate-400 mb-4">Uygulama genelinde çalacak olan YouTube videosunun veya çalma listesinin "Embed" linkini buraya yapıştırın.</p>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.youtube.com/embed/VIDEO_ID"
                    className="flex-grow px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button 
                    onClick={handleSave}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-md transition-colors"
                >
                    Kaydet
                </button>
            </div>
        </div>
    );
}

export const LinkManagementView: React.FC<LinkManagementViewProps> = ({ 
    links,
    onCreate,
    onUpdate,
    onDelete,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<ExternalLink | null>(null);

    const handleOpenCreateModal = () => {
        setEditingLink(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (link: ExternalLink) => {
        setEditingLink(link);
        setIsModalOpen(true);
    };

    const handleSave = (linkData: Omit<ExternalLink, 'id'>) => {
        if (editingLink) {
            onUpdate(editingLink.id, linkData);
        } else {
            onCreate(linkData);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (link: ExternalLink) => {
        if (window.confirm(`'${link.title}' bağlantısını silmek istediğinizden emin misiniz?`)) {
            onDelete(link.id);
        }
    };
    
    const standardLinks = links.filter(link => link.id !== 'music_player_url');
    const musicLink = links.find(link => link.id === 'music_player_url');
    
  return (
    <div className="animate-fade-in max-w-4xl mx-auto w-full">
      <MusicPlayerSettings musicLink={musicLink} onUpdate={onUpdate} />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-sky-300">Harici Bağlantılar</h2>
        <button onClick={handleOpenCreateModal} className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-md transition-colors">
            <PlusCircleIcon className="w-5 h-5" />
            Yeni Bağlantı Ekle
        </button>
      </div>

      <div className="bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
        {standardLinks.length === 0 ? (
          <p className="p-4 text-center text-slate-400">Henüz harici bağlantı eklenmemiş.</p>
        ) : (
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-sky-300 uppercase bg-slate-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 w-16">Sıra</th>
                <th scope="col" className="px-6 py-3">Başlık</th>
                <th scope="col" className="px-6 py-3">URL</th>
                <th scope="col" className="px-6 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {standardLinks.map(link => (
                <tr key={link.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                  <td className="px-6 py-4 text-center">{link.order}</td>
                  <td className="px-6 py-4 font-medium text-slate-100">{link.title}</td>
                  <td className="px-6 py-4 truncate max-w-xs" title={link.href}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:underline">{link.href}</a>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-4">
                        <button onClick={() => handleOpenEditModal(link)} className="text-slate-400 hover:text-sky-300" title="Düzenle"><EditIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(link)} className="text-slate-400 hover:text-red-400" title="Sil"><Trash2Icon className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <LinkEditModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        linkToEdit={editingLink}
      />
    </div>
  );
};
