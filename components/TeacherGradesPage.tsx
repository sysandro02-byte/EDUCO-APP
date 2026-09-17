import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import GradeForm, { Grade } from './GradeForm';
import ReportCardCommentsForm, { ReportCardComments } from './ReportCardCommentsForm';
import Bulletin from './Bulletin';
import { PlusCircleIcon, PencilIcon } from './Icons';
import { Class } from './ClassForm';
import { User } from './UserForm';
import { Subject } from './SubjectForm';

interface GradesManagementPageProps {
  currentUserRole: string;
  currentUserId: number | null;
  classes: Class[];
  students: User[];
  grades: Grade[];
  onSaveGrade: (grade: Grade) => void;
  reportCardComments: ReportCardComments[];
  onSaveReportCardComments: (comments: ReportCardComments) => void;
  subjects: Subject[];
  schoolSettings: any;
}

const GradesManagementPage: React.FC<GradesManagementPageProps> = ({
  currentUserRole, currentUserId, classes, students, grades, onSaveGrade,
  reportCardComments, onSaveReportCardComments, subjects, schoolSettings
}) => {
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isBulletinOpen, setIsBulletinOpen] = useState(false);
  const [selectedStudentForComments, setSelectedStudentForComments] = useState<User | null>(null);

  const visibleClasses = useMemo(() => {
    if (currentUserRole !== 'Enseignant') return classes;
    return classes.filter((schoolClass: any) =>
      Number(schoolClass.teacherId ?? schoolClass.teacher_id) === Number(currentUserId)
    );
  }, [currentUserRole, currentUserId, classes]);

  const visibleSubjects = useMemo(() => {
    if (currentUserRole !== 'Enseignant') return subjects;
    return subjects.filter((subject) => {
      const assigned = Array.isArray(subject.teacherIds) ? subject.teacherIds : [];
      return assigned.length === 0 || assigned.some((id) => Number(id) === Number(currentUserId));
    });
  }, [currentUserRole, currentUserId, subjects]);

  const [selectedClassId, setSelectedClassId] = useState<number | ''>(visibleClasses[0]?.id || '');
  const [selectedSubject, setSelectedSubject] = useState(visibleSubjects[0]?.name || '');

  useEffect(() => {
    const stillVisible = visibleClasses.some((schoolClass) => Number(schoolClass.id) === Number(selectedClassId));
    if (!stillVisible) setSelectedClassId(visibleClasses[0]?.id || '');
  }, [visibleClasses, selectedClassId]);

  useEffect(() => {
    const stillVisible = visibleSubjects.some((subject) => subject.name === selectedSubject);
    if (!stillVisible) setSelectedSubject(visibleSubjects[0]?.name || '');
  }, [visibleSubjects, selectedSubject]);

  const selectedClass = visibleClasses.find((schoolClass) => Number(schoolClass.id) === Number(selectedClassId));
  const studentsInClass = students.filter((student: any) => {
    if (!selectedClassId) return false;
    if (student.classId != null) return Number(student.classId) === Number(selectedClassId);
    return student.class === selectedClass?.name;
  });

  const gradesByStudent = useMemo(() => {
    const studentAverages = new Map<number, { total: number; count: number; grades: Grade[] }>();

    grades
      .filter(g => Number(g.classId) === Number(selectedClassId) && g.subject === selectedSubject)
      .forEach(grade => {
        if (!studentAverages.has(grade.studentId)) {
          studentAverages.set(grade.studentId, { total: 0, count: 0, grades: [] });
        }
        const current = studentAverages.get(grade.studentId)!;
        current.total += grade.score;
        current.count += 1;
        current.grades.push(grade);
      });

    return studentAverages;
  }, [grades, selectedClassId, selectedSubject]);

  const selectedStudentGradesBySubject = useMemo(() => {
    if (!selectedStudentForComments) return new Map<string, Grade[]>();
    const grouped = new Map<string, Grade[]>();
    subjects.forEach(subject => grouped.set(subject.name, []));

    grades
      .filter(g => Number(g.studentId) === Number(selectedStudentForComments.id))
      .forEach(grade => {
        if (!grouped.has(grade.subject)) grouped.set(grade.subject, []);
        grouped.get(grade.subject)!.push(grade);
      });
    return grouped;
  }, [grades, selectedStudentForComments, subjects]);

  const handleSaveGrade = (grade: Grade) => {
    if (!selectedClassId || !selectedSubject) return;
    onSaveGrade({ ...grade, classId: selectedClassId as number, subject: selectedSubject });
    setIsGradeModalOpen(false);
  };

  const handleOpenCommentsModal = (student: User) => {
    setSelectedStudentForComments(student);
    setIsCommentsModalOpen(true);
  };

  const handleSaveComments = (comments: ReportCardComments) => {
    onSaveReportCardComments(comments);
    setIsCommentsModalOpen(false);
  };

  const existingComments = selectedStudentForComments
    ? reportCardComments.find(c => Number(c.studentId) === Number(selectedStudentForComments.id))
    : undefined;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des Notes</h2>
        <button
          onClick={() => setIsGradeModalOpen(true)}
          disabled={!selectedClassId || !selectedSubject || studentsInClass.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors disabled:bg-gray-400"
        >
          <PlusCircleIcon />
          <span>Ajouter une note</span>
        </button>
      </div>

      {currentUserRole === 'Enseignant' && visibleClasses.length === 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Aucune classe ne vous est affectée. La saisie des notes reste désactivée jusqu’à l’affectation d’une classe.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
        <div>
          <label htmlFor="class-select" className="block text-sm font-medium text-gray-700">Classe</label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {visibleClasses.length === 0 && <option value="">Aucune classe affectée</option>}
            {visibleClasses.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700">Matière</label>
          <select
            id="subject-select"
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="mt-1 block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {visibleSubjects.length === 0 && <option value="">Aucune matière affectée</option>}
            {visibleSubjects.map(s => <option key={s.id ?? s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom de l'Élève</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Moyenne</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bulletin</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {studentsInClass.map(student => {
              const studentData = gradesByStudent.get(student.id!);
              const average = studentData && studentData.count > 0 ? (studentData.total / studentData.count).toFixed(2) : '-';
              return (
                <tr key={student.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {studentData?.grades.length
                      ? studentData.grades.map(g => (
                        <span key={g.id} className="mr-2 p-1 bg-gray-200 rounded-md" title={g.assignment}>{g.score}</span>
                      ))
                      : 'Aucune note'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-800">{average}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button onClick={() => handleOpenCommentsModal(student)} className="text-indigo-600 hover:text-indigo-800" title="Gérer les appréciations du bulletin">
                      <PencilIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
            {selectedClassId && studentsInClass.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Aucun élève inscrit dans cette classe.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isGradeModalOpen} onClose={() => setIsGradeModalOpen(false)} title={`Ajouter une note en ${selectedSubject}`}>
        <GradeForm
          students={studentsInClass}
          subject={selectedSubject}
          onSave={handleSaveGrade}
          onCancel={() => setIsGradeModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isCommentsModalOpen} onClose={() => setIsCommentsModalOpen(false)} title={`Appréciations pour ${selectedStudentForComments?.name}`}>
        {selectedStudentForComments && (
          <ReportCardCommentsForm
            student={selectedStudentForComments}
            subjects={subjects}
            existingComments={existingComments}
            onSave={handleSaveComments}
            onCancel={() => setIsCommentsModalOpen(false)}
            onGenerateBulletin={() => {
              setIsCommentsModalOpen(false);
              setIsBulletinOpen(true);
            }}
          />
        )}
      </Modal>

      <Modal isOpen={isBulletinOpen} onClose={() => setIsBulletinOpen(false)} title={`Bulletin de Notes - ${selectedStudentForComments?.name}`} size="4xl">
        {selectedStudentForComments && (
          <Bulletin
            student={selectedStudentForComments}
            gradesBySubject={selectedStudentGradesBySubject}
            comments={existingComments}
            schoolSettings={schoolSettings}
            onClose={() => setIsBulletinOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
};

export default GradesManagementPage;
