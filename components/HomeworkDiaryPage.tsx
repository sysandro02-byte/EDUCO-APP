import React, { useState, useMemo } from 'react';
import { PlusCircleIcon } from './Icons';
import Modal from './Modal';
import { Class } from './ClassForm';
import { Subject } from './SubjectForm';

export interface HomeworkDiaryEntry {
    id: string;
    classId: number;
    date: string;
    subjectId: number;
    contentCovered: string;
    homework: string;
    className?: string;
    subject?: string;
    dueDate?: string;
    task?: string;
}

interface HomeworkDiaryFormProps {
    onSave: (entry: Omit<HomeworkDiaryEntry, 'id'>) => void;
    onCancel: () => void;
    classes: Class[];
    subjects: Subject[];
}

const HomeworkDiaryForm: React.FC<HomeworkDiaryFormProps> = ({ onSave, onCancel, classes, subjects }) => {
    const [classId, setClassId] = useState<number | ''>(classes[0]?.id || '');
    const [subjectId, setSubjectId] = useState<number | ''>(subjects[0]?.id || '');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [contentCovered, setContentCovered] = useState('');
    const [homework, setHomework] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(classId && subjectId && date && contentCovered) {
            onSave({ classId, subjectId, date, contentCovered, homework });
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium">Classe</label><select value={classId} onChange={e => setClassId(Number(e.target.value))} required className="mt-1 w-full input-style"><option value="" disabled>Choisir</option>{classes.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium">Matière</label><select value={subjectId} onChange={e => setSubjectId(Number(e.target.value))} required className="mt-1 w-full input-style"><option value="" disabled>Choisir</option>{subjects.map(s => <option key={s.id} value={s.id!}>{s.name}</option>)}</select></div>
            </div>
            <div><label className="block text-sm font-medium">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 w-full input-style" /></div>
            <div><label className="block text-sm font-medium">Contenu du cours</label><textarea value={contentCovered} onChange={e => setContentCovered(e.target.value)} required rows={4} className="mt-1 w-full input-style" placeholder="Décrivez les points clés abordés pendant le cours..."></textarea></div>
            <div><label className="block text-sm font-medium">Devoirs à faire</label><textarea value={homework} onChange={e => setHomework(e.target.value)} rows={3} className="mt-1 w-full input-style" placeholder="Indiquez les devoirs, leçons à apprendre..."></textarea></div>
            <div className="flex justify-end gap-2 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">Annuler</button><button type="submit" className="btn-primary">Sauvegarder</button></div>
        </form>
    );
}

interface HomeworkDiaryPageProps {
    currentUserRole: string;
    homeworkDiary: HomeworkDiaryEntry[];
    classes: Class[];
    subjects: Subject[];
    onSave: (entry: Omit<HomeworkDiaryEntry, 'id'>) => void;
}

const HomeworkDiaryPage: React.FC<HomeworkDiaryPageProps> = ({ currentUserRole, homeworkDiary, classes, subjects, onSave }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClassId, setSelectedClassId] = useState<number | ''>(classes[0]?.id || '');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const isTeacher = currentUserRole === 'Enseignant' || currentUserRole === 'Admin';

    const filteredEntries = useMemo(() => {
        return homeworkDiary
            .filter(entry => entry.classId === selectedClassId && entry.date === selectedDate)
            .sort((a, b) => a.subjectId - b.subjectId);
    }, [homeworkDiary, selectedClassId, selectedDate]);
    
    const handleSave = (entry: Omit<HomeworkDiaryEntry, 'id'>) => {
        onSave(entry);
        setIsModalOpen(false);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <style>{`.input-style{display: block;width: 100%;border-radius: 0.375rem;border-width: 1px;border-color: #D1D5DB;padding: 0.5rem 0.75rem;}.btn-primary{padding: 0.5rem 1rem;background-color: #1F4A59;color: white;border-radius: 0.375rem;}.btn-primary:hover{background-color: #2c5a6e;}.btn-secondary{padding: 0.5rem 1rem;background-color: #E5E7EB;color: #1F2937;border-radius: 0.375rem;}`}</style>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Cahier de Texte Numérique</h2>
                {isTeacher && <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 btn-primary"><PlusCircleIcon /><span>Nouvelle Entrée</span></button>}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                <div><label className="block text-sm font-medium">Classe</label><select value={selectedClassId} onChange={e => setSelectedClassId(Number(e.target.value))} className="mt-1 sm:w-64 input-style"><option value="" disabled>Choisir</option>{classes.map(c => <option key={c.id} value={c.id!}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium">Date</label><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-1 sm:w-48 input-style" /></div>
            </div>

            <div className="space-y-4">
                {filteredEntries.length > 0 ? filteredEntries.map(entry => {
                    const subject = subjects.find(s => s.id === entry.subjectId);
                    return (
                        <div key={entry.id} className="p-4 border rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-700">{subject?.name}</h3>
                            <div className="mt-2 pl-4 border-l-4">
                                <h4 className="font-semibold text-gray-600">Contenu du cours :</h4>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.contentCovered}</p>
                                {entry.homework && <>
                                    <h4 className="font-semibold text-gray-600 mt-2">Devoirs :</h4>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.homework}</p>
                                </>}
                            </div>
                        </div>
                    );
                }) : (
                    <p className="text-center text-gray-500 py-8">Aucune entrée dans le cahier de texte pour cette classe à cette date.</p>
                )}
            </div>
            
             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Ajouter au Cahier de Texte">
                <HomeworkDiaryForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} classes={classes} subjects={subjects} />
            </Modal>
        </div>
    );
};

export default HomeworkDiaryPage;
