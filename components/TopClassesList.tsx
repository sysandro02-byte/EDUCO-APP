import React, { useState } from 'react';
import { topClassesData } from '../constants';
import { Trophy, Users, Award, CheckCircle2, Info } from 'lucide-react';

type TopClass = typeof topClassesData[0] & {
  studentsCount?: number;
  recoveryRate?: number;
  averageGrade?: number;
};

interface TopClassesListProps {
  classes: TopClass[];
}

const TopClassesList: React.FC<TopClassesListProps> = ({ classes = [] }) => {
  const [hoveredClassId, setHoveredClassId] = useState<number | string | null>(null);

  const displayClasses = classes.length > 0 ? classes : topClassesData;

  const getPerformanceBadge = (perf: number) => {
    if (perf >= 90) return { label: 'Excellente', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' };
    if (perf >= 80) return { label: 'Très Bonne', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300' };
    if (perf >= 70) return { label: 'Satisfaisante', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300' };
    return { label: 'À encourager', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' };
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-md h-full flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h4 className="font-bold text-gray-800 dark:text-slate-100 text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Classes les Plus Performantes
          </h4>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Survolez chaque barre pour afficher les détails exacts de performance
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          Top {displayClasses.length}
        </span>
      </div>

      <ul className="space-y-4 my-auto relative">
        {displayClasses.map((item, index) => {
          const badge = getPerformanceBadge(item.performance);
          const isHovered = hoveredClassId === item.id;
          const studentsCount = item.studentsCount || (30 + (index * 3));
          const recoveryRate = item.recoveryRate || Math.min(100, Math.round(item.performance * 0.95));
          const averageGrade = item.averageGrade || (12 + (item.performance / 15)).toFixed(1);

          return (
            <li 
              key={item.id} 
              className="relative group p-2.5 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              onMouseEnter={() => setHoveredClassId(item.id)}
              onMouseLeave={() => setHoveredClassId(null)}
            >
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Enseignant : <strong className="text-gray-700 dark:text-slate-300">{item.teacher}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                    {badge.label}
                  </span>
                  <p className="font-black text-sm text-[#1F4A59] dark:text-sky-400 min-w-[42px] text-right">
                    {item.performance}%
                  </p>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60 dark:border-slate-600">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHovered 
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 shadow-md scale-y-110' 
                      : 'bg-gradient-to-r from-teal-500 to-blue-600'
                  }`}
                  style={{ width: `${item.performance}%` }}
                />
              </div>

              {/* Interactive Tooltip Card on Hover */}
              {isHovered && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                    <span className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      Classe : {item.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.color}`}>
                      {item.performance}% Perf.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Moyenne Générale</span>
                      <strong className="text-emerald-400 text-sm">{averageGrade} / 20</strong>
                    </div>

                    <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Effectif Élèves</span>
                      <strong className="text-sky-300 text-sm flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 inline" /> {studentsCount}
                      </strong>
                    </div>

                    <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Taux Recouvrement</span>
                      <strong className="text-amber-300 text-sm">{recoveryRate}%</strong>
                    </div>

                    <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                      <span className="text-slate-400 block text-[10px]">Responsable</span>
                      <strong className="text-slate-200 text-xs truncate block">{item.teacher}</strong>
                    </div>
                  </div>

                  {/* Tooltip Down Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/95" />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-blue-500" /> Survol interactif activé
        </span>
        <span className="font-semibold text-[#1F4A59] dark:text-sky-400">
          Supervision Académique
        </span>
      </div>
    </div>
  );
};

export default TopClassesList;