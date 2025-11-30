import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.tsx';
import { ExternalLink } from '../types.ts';

interface LinkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkData: Omit<ExternalLink, 'id'>) => void;
  linkToEdit?: ExternalLink | null;
}

export const LinkEditModal: React.FC<LinkEditModalProps> = ({ isOpen, onClose, onSave, linkToEdit }) => {
    const [title, setTitle] = useState('');
    const [href, setHref] = useState('');
    const [order, setOrder] = useState(100);
    const [maskHref, setMaskHref] = useState(false);
    const [error, setError] = useState('');

    const isEditMode = !!linkToEdit;

    useEffect(() => {
        if (isOpen && linkToEdit) {
            setTitle(linkToEdit.title);
            setHref(linkToEdit.href);
            setOrder(linkToEdit.order);
            setMaskHref(linkToEdit.maskHref || false);
            setError('');
        } else if (isOpen && !linkToEdit) {
            setTitle('');
            setHref('');
            setOrder(100);
            setMaskHref(false);
            setError('');
        }
    }, [isOpen, linkToEdit]);

    const handleSubmit = () => {
        if (!title.trim() || !href.trim()) {
            setError('Başlık ve URL alanları boş bırakılamaz.');
            return;
        }
        try {
            new URL(href);
        } catch (_) {
            setError('Lütfen geçerli bir URL girin (örn: https://www.google.com).');
            return;
        }
        setError('');
        onSave({ title: title.trim(), href: href.trim(), order: Number(order), maskHref });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Bağlantıyı Düzenle' : 'Yeni Bağlantı Ekle'}>
            <div className="space-y-4">
                {error && <p className="text-red-400 text-sm text-center bg-red-900/50 p-2 rounded-md">{error}</p>}
                
                <div>
                    <label htmlFor="link-title" className="block text-sm font-medium text-slate-300 mb-1">Başlık</label>
                    <input
                        type="text" id="link-title" value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>
                
                <div>
                    <label htmlFor="link-href" className="block text-sm font-medium text-slate-300 mb-1">URL</label>
                    <input
                        type="url" id="link-href" value={href}
                        placeholder="https://example.com"
                        onChange={(e) => setHref(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                </div>

                <div>
                    <label htmlFor="link-order" className="block text-sm font-medium text-slate-300 mb-1">Sıralama</label>
                    <input
                        type="number" id="link-order" value={order}
                        onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                     <p className="text-xs text-slate-500 mt-1">Düşük numaralar ana sayfada daha önce görünür.</p>
                </div>

                <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-md">
                    <label htmlFor="mask-href" className="text-sm font-medium text-slate-300 cursor-pointer flex-1">
                        Bağlantıyı maskele (Erişim sorunları için)
                        <p className="text-xs text-slate-400 font-normal">Bu seçenek, kurumsal ağlar tarafından engellenen sitelere erişime yardımcı olabilir.</p>
                    </label>
                    <input
                        type="checkbox" id="mask-href" checked={maskHref}
                        onChange={(e) => setMaskHref(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                </div>

                <div className="pt-4 flex justify-end">
                    <button onClick={handleSubmit} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-md transition-colors">Kaydet</button>
                </div>
            </div>
        </Modal>
    );
};
