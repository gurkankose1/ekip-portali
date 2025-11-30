import React from 'react';
import { UsersIcon, MessageCircleIcon, ExternalLinkIcon, GridIcon, UserIcon, UserCogIcon, ZapIcon } from './Icons.tsx';
import { User, ExternalLink, ActiveView } from '../types.ts';

interface PortalViewProps {
    setActiveView: (view: ActiveView) => void;
    currentUser: User;
    externalLinks: ExternalLink[];
}

const PortalCard: React.FC<{ title: string, description: string, icon: React.ReactNode, onClick: () => void }> = ({ title, description, icon, onClick }) => (
    <button
        onClick={onClick}
        className="group bg-slate-800 rounded-lg shadow-lg p-6 text-left w-full hover:bg-slate-700/50 transition-all duration-300 transform hover:-translate-y-1 border border-slate-700"
    >
        <div className="flex items-start gap-4">
            <div className="bg-sky-900/50 p-3 rounded-lg text-sky-400">
                {icon}
            </div>
            <div>
                <h3 className="text-lg font-bold text-sky-300 group-hover:text-sky-200">{title}</h3>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
            </div>
        </div>
    </button>
);

const LinkCard: React.FC<{ link: ExternalLink }> = ({ link }) => {
    const { title, href, maskHref } = link;
    const finalHref = maskHref ? `https://tinyurl.com/api-create.php?url=${encodeURIComponent(href)}` : href;

    return (
        <a
            href={finalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-slate-800 rounded-lg shadow-lg p-4 text-left w-full hover:bg-slate-700/50 transition-all duration-300 transform hover:-translate-y-1 flex justify-between items-center border border-slate-700"
        >
            <span className="font-semibold text-slate-300 group-hover:text-sky-300">{title}</span>
            <ExternalLinkIcon className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors" />
        </a>
    );
};


export const PortalView: React.FC<PortalViewProps> = ({ setActiveView, currentUser, externalLinks }) => {
    const standardLinks = externalLinks.filter(link => link.id !== 'music_player_url');
    
    return (
        <div className="animate-fade-in space-y-12">
            <header className="text-center">
                 <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 pb-2">
                    Vardiya Yönetim Portalı
                </h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Uygulama modüllerine ve sık kullanılan bağlantılara buradan erişin.
                </p>
            </header>

            <main className="max-w-4xl mx-auto space-y-10">
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b border-slate-700 pb-2 text-amber-400">Uygulama Modülleri</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <PortalCard
                            title="Ekip Oturma Düzeni"
                            description="Yıllık görev ve istasyon dağılımını görüntüleyin ve yönetin."
                            icon={<UsersIcon className="w-8 h-8" />}
                            onClick={() => setActiveView('schedule')}
                        />
                         <PortalCard
                            title="AI Asistanı"
                            description="Yapay zeka ile sohbet edin, içerik üretin ve analiz yapın."
                            icon={<ZapIcon className="w-8 h-8" />}
                            onClick={() => setActiveView('ai_assistant')}
                        />
                         <PortalCard
                            title="Sohbet & Çekim Listesi"
                            description="Ekip içi anlık iletişim kurun ve çekim listesini görüntüleyin."
                            icon={<MessageCircleIcon className="w-8 h-8" />}
                            onClick={() => setActiveView('chat')}
                        />
                        <PortalCard
                            title="Yedek Excel"
                            description="Ekip içi anlık, ortak çalışılabilen online excel tablosu."
                            icon={<GridIcon className="w-8 h-8" />}
                            onClick={() => setActiveView('spreadsheet')}
                        />
                         <PortalCard
                            title="Hesabım"
                            description="Şifrenizi ve hesap ayarlarınızı yönetin."
                            icon={<UserIcon className="w-8 h-8" />}
                            onClick={() => setActiveView('account')}
                        />
                         {currentUser.isAdmin && (
                            <>
                                <PortalCard
                                    title="Kullanıcı Yönetimi"
                                    description="Kullanıcıları ve şifrelerini yönetin."
                                    icon={<UserCogIcon className="w-8 h-8" />}
                                    onClick={() => setActiveView('user_management')}
                                />
                           </>
                        )}
                    </div>
                </section>
                <section>
                    <h2 className="text-2xl font-bold mb-4 border-b border-slate-700 pb-2 text-amber-400">Harici Bağlantılar</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {standardLinks.map(link => (
                            <LinkCard key={link.id} link={link} />
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};