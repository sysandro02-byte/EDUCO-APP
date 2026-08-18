import React, { useState, useEffect } from 'react';
import { User } from './UserForm';
import { Subject } from './SubjectForm';

export interface ReportCardComments {
    id?: string;
    studentId: number;
    period: string;
    year: string;
    generalAppreciation?: string;
    subjectComments?: { subject: string; comment: string; }[];
    studentName?: string;
    teacherComment?: string;
    principalComment?: string;
    conductGrade?: string;
}

interface ReportCardCommentsFormProps {
    student: User;
    subjects: Subject[];
    existingComments: ReportCardComments | undefined;
    onSave: (comments: ReportCardComments) => void;
    onCancel: () => void;
    onGenerateBulletin?: () => void;
}

const ReportCardCommentsForm: React.FC<ReportCardCommentsFormProps> = ({ student, subjects, existingComments, onSave, onCancel, onGenerateBulletin }) => {
    const [formData, setFormData] = useState<ReportCardComments>({
        studentId: student.id!,
        period: 'Trimestre 1',
        year: '2023-2024',
        generalAppreciation: '',
        subjectComments: []
    });

    useEffect(() => {
        if (existingComments) {
            setFormData(existingComments);
        } else {
            // Initialize with all subjects
            const initialComments = subjects.map(s => ({ subject: s.name, comment: '' }));
            setFormData(prev => ({ ...prev, subjectComments: initialComments }));
        }
    }, [existingComments, subjects]);

    const handleGeneralChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, generalAppreciation: e.target.value }));
    };

    const handleSubjectCommentChange = (subject: string, comment: string) => {
        setFormData(prev => ({
            ...prev,
            subjectComments: prev.subjectComments.map(sc => 
                sc.subject === subject ? { ...sc, comment } : sc
            )
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
                <label className="block text-sm font-medium text-gray-700">Appréciation Générale</label>
                <textarea
                    value={formData.generalAppreciation}
                    onChange={handleGeneralChange}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    placeholder="Évaluation globale du trimestre..."
                />
            </div>
            
            <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Appréciations par Matière</h4>
                {subjects.map(subject => {
                    const comment = formData.subjectComments.find(sc => sc.subject === subject.name)?.comment || '';
                    return (
                        <div key={subject.id}>
                            <label className="block text-sm font-medium text-gray-700">{subject.name}</label>
                            <input
                                type="text"
                                value={comment}
                                onChange={(e) => handleSubjectCommentChange(subject.name, e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                placeholder={`Commentaire pour ${subject.name}...`}
                            />
                        </div>
                    )
                })}
            </div>

            <div className="flex justify-end items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                {onGenerateBulletin && (
                    <button 
                        type="button" 
                        onClick={onGenerateBulletin} 
                        className="px-3.5 py-2 bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
                    >
                        Générer le Bulletin
                    </button>
                )}
                <button 
                    type="button" 
                    onClick={onCancel} 
                    className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                >
                    Annuler
                </button>
                <button 
                    type="submit" 
                    className="px-3.5 py-2 bg-[#1F4A59] dark:bg-sky-500 hover:bg-[#163844] dark:hover:bg-sky-600 text-white dark:text-slate-950 text-xs font-bold rounded-xl transition-all active:scale-95 shadow-xs shrink-0 cursor-pointer"
                >
                    Sauvegarder
                </button>
            </div>
        </form>
    );
};

export default ReportCardCommentsForm;
