import React, { useMemo, useState } from 'react';
import { FileDownloadIcon } from './Icons';
import Modal from './Modal';
import Bulletin from './Bulletin';
import { User } from './UserForm';
import { Grade } from './GradeForm';
import { ReportCardComments } from './ReportCardCommentsForm';
import { Subject } from './SubjectForm';

interface StudentGradesPageProps {
    student: User | undefined;
    grades: Grade[];
    comments: ReportCardComments | undefined;
    subjects: Subject[];
    schoolSettings: any;
}


const StudentGradesPage: React.FC<StudentGradesPageProps> = ({ student, grades, comments, subjects, schoolSettings }) => {
  const [isBulletinOpen, setIsBulletinOpen] = useState(false);
  
  const gradesBySubject = useMemo(() => {
    const grouped = new Map<string, Grade[]>();
    subjects.forEach(subject => grouped.set(subject.name, []));
    
    grades.forEach(grade => {
      if (!grouped.has(grade.subject)) {
        grouped.set(grade.subject, []);
      }
      grouped.get(grade.subject)!.push(grade);
    });
    return grouped;
  }, [grades, subjects]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
       <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Mes Notes</h2>
        <button 
          onClick={() => setIsBulletinOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
        >
            <FileDownloadIcon className="w-4 h-4" />
            <span>Afficher / Imprimer le bulletin</span>
        </button>
      </div>

      <div className="space-y-6">
        {Array.from(gradesBySubject.entries()).map(([subject, subjectGrades]) => {
          if (subjectGrades.length === 0) return null;

          const average = subjectGrades.reduce((sum, g) => sum + g.score, 0) / subjectGrades.length;

          return (
            <div key={subject} className="p-4 border rounded-lg bg-gray-50">
              <div className="flex justify-between items-baseline mb-3">
                 <h3 className="text-lg font-semibold text-gray-700">{subject}</h3>
                 <p className="text-md font-bold text-blue-700">Moyenne: {average.toFixed(2)} / 20</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Devoir</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Note</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {subjectGrades.map(grade => (
                      <tr key={grade.id} className="border-b">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">{grade.assignment}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 text-right">{grade.score} / 20</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      <Modal isOpen={isBulletinOpen} onClose={() => setIsBulletinOpen(false)} title="Bulletin de Notes - Trimestre 1" size="4xl">
        {student && (
          <Bulletin
            student={student}
            gradesBySubject={gradesBySubject}
            comments={comments}
            schoolSettings={schoolSettings}
            onClose={() => setIsBulletinOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
};

export default StudentGradesPage;