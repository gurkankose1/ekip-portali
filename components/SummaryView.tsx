
import React from 'react';
import { SummaryData } from '../types.ts';
import { STATIONS, SPECIAL_PERSONNEL } from '../constants.ts';

interface SummaryViewProps {
  summary: SummaryData | null;
  monthName?: string;
  personnel: string[];
}

// Renk paletini daha canlı ve tema ile uyumlu hale getirelim
const STATION_COLORS: { [key: string]: string } = {
  'Planlama': 'bg-sky-500',
  'Frekans': 'bg-emerald-500',
  'Su Anons': 'bg-cyan-400',
  'Board1': 'bg-indigo-500',
  'Board2': 'bg-purple-500',
  'Board3': 'bg-pink-500',
  'Board4': 'bg-amber-500',
};

const StationLegend: React.FC = () => (
  <div className="mt-6 border-t border-slate-700 pt-4">
    <h3 className="text-sm font-semibold text-center text-slate-400 mb-3">İstasyon Renkleri</h3>
    <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs">
      {STATIONS.map(station => (
        <div key={station} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${STATION_COLORS[station]}`}></div>
          <span className="text-slate-300">{station}</span>
        </div>
      ))}
    </div>
  </div>
);


export const SummaryView: React.FC<SummaryViewProps> = ({ summary, monthName, personnel }) => {
  if (!summary) {
    return null;
  }

  const allPersonnel = Object.keys(summary).sort((a, b) => {
    const isAMain = personnel.includes(a) || a === SPECIAL_PERSONNEL;
    const isBMain = personnel.includes(b) || b === SPECIAL_PERSONNEL;
    if (isAMain && !isBMain) return -1;
    if (!isAMain && isBMain) return 1;
    return a.localeCompare(b);
  });

  const hasData = allPersonnel.some(p => summary[p]?.total > 0);

  return (
    <div className="mt-12 w-full animate-fade-in">
      <h2 className="text-2xl font-bold text-center mb-6 text-sky-300">
        {monthName ? `${monthName} ` : ''}Görev Dağılım Özeti
      </h2>
      <div className="overflow-x-auto bg-slate-800 rounded-lg shadow-lg p-4">
        {hasData ? (
          <table className="w-full min-w-max text-sm text-left text-slate-300">
            <thead className="text-xs text-sky-300 uppercase bg-slate-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 rounded-l-lg w-1/5">Personel</th>
                {STATIONS.map(station => (
                  <th key={station} scope="col" className="px-6 py-3 text-center">{station}</th>
                ))}
                <th scope="col" className="px-6 py-3 rounded-r-lg text-center font-extrabold w-1/4">Toplam Görev & Dağılım</th>
              </tr>
            </thead>
            <tbody>
              {allPersonnel.map(personnelName => {
                const personData = summary[personnelName];
                if (!personData || personData.total === 0) return null;

                const totalTasks = personData.total;

                const distributionTooltip = STATIONS
                  .map(station => {
                    const count = personData.stations[station] || 0;
                    if (count === 0) return null;
                    const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(0) : 0;
                    return `${station}: ${count} (${percentage}%)`;
                  })
                  .filter(Boolean)
                  .join('\n');

                return (
                  <tr key={personnelName} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors duration-200">
                    <th scope="row" className="px-6 py-4 font-medium whitespace-nowrap text-slate-100">{personnelName}</th>
                    {STATIONS.map(station => {
                      const count = personData.stations[station] || 0;
                      const percentage = totalTasks > 0 ? ((count / totalTasks) * 100).toFixed(0) : 0;
                      const tooltip = count > 0 ? `${count} görev (${percentage}%)` : 'Görev yok';
                      return (
                        <td key={`${personnelName}-${station}`} className="px-6 py-4 text-center font-mono" title={tooltip}>
                          {count}
                        </td>
                      )
                    })}
                    <td className="px-6 py-4 text-center font-mono font-extrabold text-amber-400">
                      <div className="flex items-center justify-center gap-4">
                        <span className="text-lg">{totalTasks}</span>
                        <div className="w-full flex-1 h-4 bg-slate-700 rounded-full overflow-hidden flex" title={distributionTooltip}>
                          {STATIONS.map(station => {
                            const count = personData.stations[station] || 0;
                            if (count === 0) return null;
                            const percentage = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                            return (
                              <div
                                key={`${personnelName}-${station}-bar`}
                                className={`${STATION_COLORS[station]}`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            )
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-slate-400 py-4">Bu ay için görüntülenecek görev verisi bulunmamaktadır.</p>
        )}
      </div>
      {hasData && <StationLegend />}
    </div>
  );
};