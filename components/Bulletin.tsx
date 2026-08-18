import React, { useState } from 'react';
import { PrinterIcon } from './Icons';
import { User } from './UserForm';
import { Grade } from './GradeForm';
import { ReportCardComments } from './ReportCardCommentsForm';

interface BulletinProps {
  student: User;
  gradesBySubject: Map<string, Grade[]>;
  comments: ReportCardComments | undefined;
  schoolSettings: any;
  onClose: () => void;
}

const Bulletin: React.FC<BulletinProps> = ({ student, gradesBySubject, comments, schoolSettings, onClose }) => {
  const [format, setFormat] = useState<'A4' | 'A5'>('A4');

  const handlePrint = () => {
    const printContent = document.getElementById('bulletin-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<html><head><title>Bulletin de Notes - ${student.name}</title>`);
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write(`<style>
        @page { size: ${format} portrait; margin: 5mm !important; }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          #bulletin-content {
            box-shadow: none !important;
            width: 100% !important;
            min-height: auto !important;
            padding: 5mm !important;
            transform: none !important;
          }
        }
      </style>`);
      printWindow.document.write('</head><body class="bg-white">');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };
  
  const allGrades: Grade[] = (Array.from(gradesBySubject.values()) as Grade[][]).flat();
  const overallAverage = allGrades.length > 0
    ? (allGrades.reduce((sum, g) => sum + g.score, 0) / allGrades.length).toFixed(2)
    : 'N/A';

  return (
    <div className="flex flex-col h-[85vh] bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
      <div className="flex-grow overflow-y-auto p-8 scrollbar-hide">
        <div id="bulletin-content" className="bg-white mx-auto shadow-2xl w-[210mm] min-h-[297mm] p-[20mm] text-slate-800 font-sans rounded-sm transform origin-top scale-90 sm:scale-100 transition-transform">
          {/* Header */}
          <header className="flex justify-between items-center border-b-[6px] border-slate-900 pb-6 mb-8">
            <div className="max-w-[70%]">
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">{schoolSettings.name}</h1>
              <p className="text-sm font-bold text-slate-500 italic mt-1">{schoolSettings.slogan}</p>
              <div className="flex items-center gap-4 mt-4">
                <p className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded uppercase tracking-widest">{schoolSettings.address}</p>
                <p className="text-[10px] font-black border-2 border-slate-900 px-2 py-0.5 rounded uppercase tracking-widest">TEL: {schoolSettings.contact}</p>
              </div>
            </div>
            {schoolSettings.logo && (
              <img src={schoolSettings.logo} alt="Logo" className="h-28 w-28 object-contain" />
            )}
          </header>

          {/* Title */}
          <div className="text-center my-10 relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative">
              <span className="bg-white px-6 text-3xl font-black uppercase tracking-[0.3em] text-slate-900">Bulletin de Notes</span>
            </div>
            <p className="text-xl font-black text-slate-500 mt-4 uppercase tracking-widest">{comments?.period || 'Trimestre 1'} — {comments?.year || schoolSettings.currentYear}</p>
          </div>

          {/* Student Info Card */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 border-2 border-slate-900 p-6 rounded-2xl bg-slate-50/50 text-sm mb-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/5 -mr-10 -mt-10 rounded-full"></div>
            <div className="space-y-1 relative">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</p>
              <p className="text-lg font-black text-slate-900 uppercase">{student.name}</p>
            </div>
            <div className="space-y-1 relative">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe</p>
              <p className="text-lg font-black text-slate-900 uppercase">{student.class}</p>
            </div>
            <div className="space-y-1 relative">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matricule</p>
              <p className="font-bold text-slate-700">{student.studentId}</p>
            </div>
            <div className="space-y-1 relative">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de Naissance</p>
              <p className="font-bold text-slate-700">{student.dob ? new Date(student.dob).toLocaleDateString('fr-FR') : 'N/A'}</p>
            </div>
          </div>

          {/* Grades Table */}
          <table className="w-full text-sm mb-10 border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-4 border-r border-white/20 text-left font-black uppercase tracking-widest">Matières</th>
                <th className="p-4 border-r border-white/20 text-center font-black uppercase tracking-widest">Notes</th>
                <th className="p-4 border-r border-white/20 text-center font-black uppercase tracking-widest">Moyenne</th>
                <th className="p-4 text-left font-black uppercase tracking-widest">Appréciations</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(gradesBySubject.entries()).map(([subject, gradesData]) => {
                const grades = gradesData;
                const average = grades.length > 0
                  ? (grades.reduce((sum, g) => sum + g.score, 0) / grades.length).toFixed(2)
                  : '-';
                const subjectComment = comments?.subjectComments?.find(c => c.subject === subject)?.comment || ' ';
                
                return (
                  <tr key={subject} className="border-b-2 border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 border-x-2 border-slate-100 font-black text-slate-900 uppercase">{subject}</td>
                    <td className="p-4 border-r-2 border-slate-100 text-center font-bold text-slate-600">{grades.map(g => g.score).join(' — ')}</td>
                    <td className="p-4 border-r-2 border-slate-100 text-center">
                      <span className="inline-block px-3 py-1 rounded-lg bg-slate-900 text-white font-black text-base">{average}</span>
                    </td>
                    <td className="p-4 border-r-2 border-slate-100 text-xs font-bold italic text-slate-500 leading-relaxed">{subjectComment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Summary and Appreciations */}
          <div className="mt-10 grid grid-cols-3 gap-8 items-start">
            <div className="col-span-2 space-y-6">
                <div className="border-2 border-slate-100 p-6 rounded-2xl bg-white shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Appréciation Générale du Conseil</h4>
                    <p className="text-sm font-bold italic text-slate-700 leading-relaxed">« {comments?.generalAppreciation || 'Aucune appréciation pour le moment.'} »</p>
                </div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-8 h-[2px] bg-slate-200"></span>
                    Fait à {schoolSettings.address.split(',')[1] || schoolSettings.address}, le {new Date().toLocaleDateString('fr-FR')}
                </div>
            </div>
            <div className="border-4 border-slate-900 p-8 rounded-[2rem] bg-white text-center flex flex-col justify-center shadow-xl shadow-slate-200 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-slate-900 transition-all group-hover:h-4"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Moyenne Générale</h4>
                <div className="flex items-baseline justify-center gap-1">
                  <p className="text-5xl font-black text-slate-900 tracking-tighter">{overallAverage}</p>
                  <p className="text-xl font-black text-slate-300">/20</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">Admis</span>
                </div>
            </div>
          </div>

           {/* Footer */}
           <footer className="mt-20 flex justify-between items-start pt-10 border-t-[6px] border-slate-900">
               <div className="text-center w-1/2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-16">Le Directeur des Études</p>
                   <div className="h-20 border-b-2 border-slate-100 mx-10 italic text-slate-300 text-xs font-bold">Signature & Cachet</div>
               </div>
               <div className="text-center w-1/2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-16">Le Directeur Général</p>
                   <div className="h-20 border-b-2 border-slate-100 mx-10 italic text-slate-300 text-xs font-bold">Signature & Cachet</div>
               </div>
           </footer>

           <div className="mt-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] py-6 border-t border-slate-100">
               <p className="hover:text-slate-900 transition-colors cursor-default tracking-widest">{schoolSettings.name} — SOLUTION DE GESTION SCOLAIRE INTELLIGENTE</p>
           </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-8 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 text-center flex items-center justify-center gap-6 no-print shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Format Impression</span>
          <select 
            value={format} 
            onChange={(e) => setFormat(e.target.value as 'A4' | 'A5')}
            className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs focus:ring-2 focus:ring-[#1F4A59] transition-all outline-none"
          >
            <option value="A4">Standard A4</option>
            <option value="A5">Carnet A5</option>
          </select>
        </div>
        
        <button 
          onClick={handlePrint} 
          className="px-8 py-4 bg-[#1F4A59] text-white rounded-2xl hover:bg-[#153540] font-black text-xs uppercase tracking-[0.2em] inline-flex items-center gap-3 transition-all shadow-xl shadow-[#1F4A59]/20 active:scale-95"
        >
          <PrinterIcon className="w-5 h-5" /> 
          Imprimer le Bulletin Officiel
        </button>
        
        <button 
          onClick={onClose} 
          className="px-8 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 font-black text-xs uppercase tracking-widest transition-all active:scale-95"
        >
          Fermer l'aperçu
        </button>
      </div>
    </div>
  );
};

export default Bulletin;