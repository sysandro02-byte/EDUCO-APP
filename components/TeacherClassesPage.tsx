import React, { useState, useEffect, useMemo } from 'react';
import { Class } from './ClassForm';
import { User } from './UserForm';

type AttendanceStatus = 'Présent' | 'Absent' | 'En Retard';
type AttendanceRecord = { studentId: number; status: AttendanceStatus; };
type AttendanceData = { studentId: number; classId: number; date: string; status: AttendanceStatus; };

interface TeacherClassesPageProps {
  classes: Class[];
  students: User[];
  attendance: AttendanceData[];
  onSaveAttendance: (classId: number, date: string, records: AttendanceRecord[]) => void;
}

const TeacherClassesPage: React.FC<TeacherClassesPageProps> = ({ classes, students, attendance, onSaveAttendance }) => {
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(classes[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Map<number, AttendanceStatus>>(new Map());

  // FIX: Memoize studentsInClass to prevent re-computation on every render and ensure a stable reference for useEffect.
  const studentsInClass = useMemo(() => students.filter(s => s.class === classes.find(c => c.id === selectedClassId)?.name), [students, classes, selectedClassId]);

  // FIX: Updated useEffect dependencies to correctly react to changes in the memoized studentsInClass list.
  useEffect(() => {
    if (selectedClassId) {
      const recordsForDate = attendance.filter(a => a.classId === selectedClassId && a.date === selectedDate);
      const newRecords = new Map<number, AttendanceStatus>();
      studentsInClass.forEach(student => {
        const existingRecord = recordsForDate.find(r => r.studentId === student.id);
        newRecords.set(student.id!, existingRecord ? existingRecord.status : 'Présent');
      });
      setAttendanceRecords(newRecords);
    }
  }, [selectedClassId, selectedDate, attendance, studentsInClass]);
  

  const handleStatusChange = (studentId: number, status: AttendanceStatus) => {
    setAttendanceRecords(prev => new Map(prev).set(studentId, status));
  };

  const handleSave = () => {
    if (selectedClassId) {
      const recordsToSave = Array.from(attendanceRecords.entries()).map(([studentId, status]) => ({ studentId, status }));
      onSaveAttendance(selectedClassId, selectedDate, recordsToSave);
      alert('Présences enregistrées avec succès !');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestion des Présences</h2>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
        <div>
          <label htmlFor="class-select" className="block text-sm font-medium text-gray-700">Classe</label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(Number(e.target.value))}
            className="mt-1 block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {classes.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="date-select" className="block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            id="date-select"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="mt-1 block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom de l'Élève</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {studentsInClass.map(student => (
              <tr key={student.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex justify-center items-center space-x-4">
                    {(['Présent', 'Absent', 'En Retard'] as AttendanceStatus[]).map(status => (
                      <label key={status} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`status-${student.id}`}
                          value={status}
                          checked={attendanceRecords.get(student.id!) === status}
                          onChange={() => handleStatusChange(student.id!, status)}
                          className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                        />
                        <span>{status}</span>
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={!selectedClassId}
          className="px-6 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors disabled:bg-gray-400"
        >
          Sauvegarder les Présences
        </button>
      </div>
    </div>
  );
};

export default TeacherClassesPage;
