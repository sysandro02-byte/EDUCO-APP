import React from 'react';
import { InfoIcon } from './Icons';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'green' | 'teal' | 'blue' | 'red' | 'purple' | 'orange';
  info?: string;
  currency?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, info, currency }) => {
  const colorClasses = {
    green: {
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badge: 'bg-emerald-100/60 text-emerald-800',
    },
    teal: {
      iconBg: 'bg-teal-50 text-teal-700 border-teal-200',
      badge: 'bg-teal-100/60 text-teal-800',
    },
    blue: {
      iconBg: 'bg-sky-50 text-sky-700 border-sky-200',
      badge: 'bg-sky-100/60 text-sky-800',
    },
    red: {
      iconBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badge: 'bg-rose-100/60 text-rose-800',
    },
    purple: {
      iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badge: 'bg-indigo-100/60 text-indigo-800',
    },
    orange: {
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
      badge: 'bg-amber-100/60 text-amber-800',
    },
  };

  const selectedColor = colorClasses[color] || colorClasses.green;

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex items-center justify-between group">
      <div className="flex items-center gap-3.5">
        <div className={`p-3 rounded-xl border ${selectedColor.iconBg} shadow-2xs group-hover:scale-105 transition-transform duration-200`}>
          {icon}
        </div>
        <div>
          <p className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
            {value} {currency && <span className="text-xs font-semibold text-slate-500 ml-1">{currency}</span>}
          </p>
          <p className="text-xs font-semibold text-slate-600 mt-1">{title}</p>
        </div>
      </div>
      {info && (
        <div className="relative group/info self-start">
          <div className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <InfoIcon />
          </div>
          <div className="absolute bottom-full right-0 mb-2 w-52 p-2.5 text-[11px] text-white bg-slate-900 rounded-xl shadow-xl opacity-0 group-hover/info:opacity-100 transition-opacity duration-200 z-20 pointer-events-none font-medium">
            {info}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatCard;
