import React, { useState, useMemo } from 'react';
import { User } from './UserForm';
import { Class } from './ClassForm';
import { Fee } from './FeeForm';
import { GraduationCapIcon, CheckCircleIcon, SearchIcon, UsersIcon } from './Icons';
import { SinglePaymentData } from '../App';
import Modal from './Modal';
import { Eye, Printer, ArrowLeft, FileText, CheckCircle2, Camera, Trash2, User as UserIcon, ShieldAlert } from 'lucide-react';
import StudentPhotoCaptureModal from './StudentPhotoCaptureModal';
import ControlMatrixStatus, { ControlRule } from './ControlMatrixStatus';
import LoadingDots from './LoadingDots';

export type StudentPaymentInfo = {
    id: number;
    studentId: string;
    name: string;
    class: string;
    totalFees: number;
    amountPaid: number;
    familyId?: number;
    isLargeFamily?: boolean;
    siblings?: string;
}

interface PaymentFormProps {
  onSave: (paymentData: SinglePaymentData) => void;
  onCancel: () => void;
  payments: StudentPaymentInfo[];
  users: User[];
  currency: string;
  classes?: Class[];
  fees?: Fee[];
  currentUserRole?: string;
}

const OptionButton: React.FC<{ label: string; active: boolean; onClick: () => void; className?: string; icon?: React.ReactNode }> = ({ label, active, onClick, className, icon }) => (
    <button 
      type="button" 
      onClick={onClick} 
      className={`px-3 py-2 text-sm font-medium rounded-lg border flex items-center justify-center gap-2 transition-all ${
        active 
          ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-sm ring-2 ring-[#1F4A59]/20' 
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
      } ${className || ''}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const PaymentForm: React.FC<PaymentFormProps> = ({ 
    onSave, onCancel, payments, users, currency, classes = [], fees = [], currentUserRole 
}) => {
    // Payment Mode: 'Frais Mensuels' | 'Inscription' | 'Réinscription' | 'Frais de dossier d\'examen'
    const [paymentType, setPaymentType] = useState<'Frais Mensuels' | 'Inscription' | 'Réinscription' | 'Frais de dossier d\'examen'>('Frais Mensuels');

    // Common fields
    const [paymentMode, setPaymentMode] = useState<string>('Espèces');
    const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    // --- 1) FRAIS MENSUELS STATE ---
    const [filterClass, setFilterClass] = useState<string>('');
    const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [amountToPay, setAmountToPay] = useState<string>('');

    // --- 2) INSCRIPTION (NOUVEL ÉLÈVE) STATE ---
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentGender, setNewStudentGender] = useState<'Masculin' | 'Féminin'>('Masculin');
    const [newStudentClass, setNewStudentClass] = useState('');
    const [newStudentDob, setNewStudentDob] = useState('');
    const [newStudentContact, setNewStudentContact] = useState('');
    const [newStudentAddress, setNewStudentAddress] = useState('');
    const [studentAvatar, setStudentAvatar] = useState<string>('');
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    
    // Family options
    const [isLargeFamily, setIsLargeFamily] = useState(false);
    const [familyNameOrSiblings, setFamilyNameOrSiblings] = useState('');
    const [registrationAmount, setRegistrationAmount] = useState('');

    // --- NEW REQUESTED FIELDS FOR INSCRIPTION & RÉINSCRIPTION ---
    const [classeAnterieure, setClasseAnterieure] = useState('');
    const [isAncienEleve, setIsAncienEleve] = useState(false);
    const [bilingue, setBilingue] = useState(false);
    const [matricule, setMatricule] = useState('');
    const [parentTuteur, setParentTuteur] = useState('');
    const [piecesJointes, setPiecesJointes] = useState<string>('');
    const [freresSoeurs, setFreresSoeurs] = useState('');

    // --- 3) FRAIS DE DOSSIER D'EXAMEN STATE ---
    const [selectedExamClass, setSelectedExamClass] = useState<string>('');
    const [selectedExamStudentId, setSelectedExamStudentId] = useState<string>('');
    const [examFeeAmount, setExamFeeAmount] = useState<string>('');

    // --- PREVIEW MODAL STATE ---
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [pendingPaymentData, setPendingPaymentData] = useState<SinglePaymentData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- MATRICE DE CONTRÔLE FINANCIER (VALIDATION MATRIX) ---
    const validationRules = useMemo((): ControlRule[] => {
        const commonRules: ControlRule[] = [
            {
                id: 'date',
                label: 'Date d\'encaissement renseignée',
                isValid: !!paymentDate,
            },
            {
                id: 'mode',
                label: paymentMode === 'Mobile Money' ? 'N° Mobile Money (min 6 chiffres)' : 'Mode de règlement sélectionné',
                isValid: paymentMode !== 'Mobile Money' || (!!mobileMoneyNumber && mobileMoneyNumber.trim().length >= 6),
            }
        ];

        if (paymentType === 'Frais Mensuels') {
            const amount = parseFloat(amountToPay);
            return [
                {
                    id: 'student',
                    label: 'Élève sélectionné',
                    isValid: !!selectedStudentId && Number(selectedStudentId) > 0,
                },
                {
                    id: 'amount',
                    label: 'Montant de scolarité valide (> 0)',
                    isValid: !isNaN(amount) && amount > 0,
                },
                ...commonRules,
            ];
        }

        if (paymentType === 'Inscription') {
            const amount = parseFloat(registrationAmount);
            return [
                {
                    id: 'name',
                    label: 'Nom complet de l\'élève (≥ 2 car.)',
                    isValid: newStudentName.trim().length >= 2,
                },
                {
                    id: 'class',
                    label: 'Classe d\'affectation sélectionnée',
                    isValid: !!newStudentClass,
                },
                {
                    id: 'amount',
                    label: "Frais d'inscription valides (> 0)",
                    isValid: !isNaN(amount) && amount > 0,
                },
                ...(isLargeFamily ? [{
                    id: 'family',
                    label: 'Nom de famille / Fratrie renseigné',
                    isValid: familyNameOrSiblings.trim().length > 0 || freresSoeurs.trim().length > 0,
                }] : []),
                ...commonRules,
            ];
        }

        if (paymentType === 'Réinscription') {
            const amount = parseFloat(registrationAmount);
            return [
                {
                    id: 'student',
                    label: 'Élève à réinscrire sélectionné',
                    isValid: !!selectedStudentId && Number(selectedStudentId) > 0,
                },
                {
                    id: 'amount',
                    label: 'Frais de réinscription valides (> 0)',
                    isValid: !isNaN(amount) && amount > 0,
                },
                ...(isLargeFamily ? [{
                    id: 'family',
                    label: 'Nom de famille / Fratrie renseigné',
                    isValid: familyNameOrSiblings.trim().length > 0 || freresSoeurs.trim().length > 0,
                }] : []),
                ...commonRules,
            ];
        }

        if (paymentType === 'Frais de dossier d\'examen') {
            const amount = parseFloat(examFeeAmount);
            return [
                {
                    id: 'examClass',
                    label: "Classe d'examen sélectionnée",
                    isValid: !!selectedExamClass,
                },
                {
                    id: 'examStudent',
                    label: 'Élève candidat sélectionné',
                    isValid: !!selectedExamStudentId && Number(selectedExamStudentId) > 0,
                },
                {
                    id: 'amount',
                    label: 'Montant du dossier d\'examen (> 0)',
                    isValid: !isNaN(amount) && amount > 0,
                },
                ...commonRules,
            ];
        }

        return commonRules;
    }, [
        paymentType, 
        selectedStudentId, 
        amountToPay, 
        paymentDate, 
        paymentMode, 
        mobileMoneyNumber, 
        newStudentName, 
        newStudentClass, 
        registrationAmount, 
        isLargeFamily, 
        familyNameOrSiblings, 
        freresSoeurs, 
        selectedExamClass, 
        selectedExamStudentId, 
        examFeeAmount
    ]);

    const isFormValid = useMemo(() => {
        return validationRules.every(r => r.isValid || r.isWarningOnly);
    }, [validationRules]);

    // List of exam classes
    const examClasses = useMemo(() => {
        const examFeeClasses = fees.filter(f => f.type === 'Frais de dossier d\'examen').map(f => f.class);
        if (examFeeClasses.length > 0) {
            return classes.filter(c => examFeeClasses.includes(c.name));
        }
        return classes.filter(c => c.name.includes('CM2') || c.name.includes('3ème') || c.level === 'Lycée' || c.level === 'Collège');
    }, [classes, fees]);

    // Available students filtered by class and search
    const filteredStudents = useMemo(() => {
        let list = (users || []).filter(u => u.role === 'Élève');

        if (filterClass) {
            list = list.filter(s => s.class === filterClass);
        }

        if (searchStudentTerm.trim() !== '') {
            const term = searchStudentTerm.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(term) || 
                (s.studentId && s.studentId.toLowerCase().includes(term)) ||
                (s.class && s.class.toLowerCase().includes(term))
            );
        }

        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [users, filterClass, searchStudentTerm]);

    // Selected Student for Frais Mensuels / Réinscription
    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return (users || []).find(u => u.id === Number(selectedStudentId));
    }, [selectedStudentId, users]);

    const selectedStudentPayment = useMemo(() => {
        if (!selectedStudentId) return null;
        return (payments || []).find(p => p.id === Number(selectedStudentId));
    }, [selectedStudentId, payments]);

    // Students in selected exam class
    const examClassStudents = useMemo(() => {
        if (!selectedExamClass) return [];
        return (users || [])
            .filter(u => u.role === 'Élève' && u.class === selectedExamClass)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, selectedExamClass]);

    // Update auto exam fee amount when exam class changes
    const handleExamClassChange = (className: string) => {
        setSelectedExamClass(className);
        setSelectedExamStudentId('');
        const matchingFee = fees.find(f => f.class === className && f.type === 'Frais de dossier d\'examen');
        if (matchingFee) {
            setExamFeeAmount(matchingFee.amount.toString());
        } else {
            if (className.includes('3ème')) setExamFeeAmount('15000');
            else if (className.includes('CM2')) setExamFeeAmount('10000');
            else setExamFeeAmount('20000');
        }
    };

    // Remaining balance calculation
    const remainingBalance = useMemo(() => {
        if (!selectedStudentPayment) return 0;
        const paidNow = parseFloat(amountToPay) || 0;
        return Math.max(0, (selectedStudentPayment.totalFees || 0) - (selectedStudentPayment.amountPaid || 0) - paidNow);
    }, [selectedStudentPayment, amountToPay]);

    // Validate inputs & build PaymentData object
    const validateAndBuildPaymentData = (): SinglePaymentData | null => {
        if (paymentType === 'Frais Mensuels') {
            if (!selectedStudentId) {
                alert("Veuillez sélectionner un élève.");
                return null;
            }
            const amount = parseFloat(amountToPay);
            if (!amount || amount <= 0) {
                alert("Veuillez saisir un montant valide à payer.");
                return null;
            }

            return {
                studentId: Number(selectedStudentId),
                amount,
                paymentMethod: paymentMode,
                mobileMoneyNumber: paymentMode === 'Mobile Money' ? mobileMoneyNumber : undefined,
                notes,
                paymentType: 'Frais Mensuels',
            };
        } 
        else if (paymentType === 'Inscription') {
            if (!newStudentName.trim()) {
                alert("Veuillez saisir le nom du nouvel élève.");
                return null;
            }
            if (!newStudentClass) {
                alert("Veuillez sélectionner la classe du nouvel élève.");
                return null;
            }
            const amount = parseFloat(registrationAmount);
            if (isNaN(amount) || amount < 0) {
                alert("Veuillez indiquer le montant des frais d'inscription.");
                return null;
            }
            if (isLargeFamily && !familyNameOrSiblings.trim()) {
                alert("Veuillez préciser le nom de la famille ou des frères/sœurs inscrits.");
                return null;
            }

            return {
                amount,
                paymentMethod: paymentMode,
                mobileMoneyNumber: paymentMode === 'Mobile Money' ? mobileMoneyNumber : undefined,
                notes,
                paymentType: 'Inscription',
                newStudentData: {
                    name: newStudentName,
                    class: newStudentClass,
                    dob: newStudentDob,
                    gender: newStudentGender,
                    contact: newStudentContact,
                    address: newStudentAddress,
                    avatar: studentAvatar,
                    classeAnterieure,
                    isAncienEleve,
                    bilingue,
                    matricule,
                    parentTuteur,
                    piecesJointes,
                    freresSoeurs,
                },
                isLargeFamily,
                familyNameOrSiblings: isLargeFamily ? familyNameOrSiblings : undefined,
            };
        } 
        else if (paymentType === 'Réinscription') {
            if (!selectedStudentId) {
                alert("Veuillez sélectionner l'élève qui se réinscrit.");
                return null;
            }
            const amount = parseFloat(registrationAmount);
            if (isNaN(amount) || amount < 0) {
                alert("Veuillez indiquer le montant des frais de réinscription.");
                return null;
            }
            if (isLargeFamily && !familyNameOrSiblings.trim()) {
                alert("Veuillez préciser le nom de la famille ou des frères/sœurs inscrits.");
                return null;
            }

            return {
                studentId: Number(selectedStudentId),
                amount,
                paymentMethod: paymentMode,
                mobileMoneyNumber: paymentMode === 'Mobile Money' ? mobileMoneyNumber : undefined,
                notes,
                paymentType: 'Réinscription',
                isLargeFamily,
                familyNameOrSiblings: isLargeFamily ? familyNameOrSiblings : undefined,
                classeAnterieure,
                isAncienEleve,
                bilingue,
                matricule,
                parentTuteur,
                piecesJointes,
                freresSoeurs,
            };
        } 
        else if (paymentType === 'Frais de dossier d\'examen') {
            if (!selectedExamClass) {
                alert("Veuillez d'abord sélectionner la classe d'examen.");
                return null;
            }
            if (!selectedExamStudentId) {
                alert("Veuillez sélectionner l'élève qui règle son dossier d'examen.");
                return null;
            }
            const amount = parseFloat(examFeeAmount);
            if (!amount || amount <= 0) {
                alert("Le montant du dossier d'examen doit être valide.");
                return null;
            }

            return {
                studentId: Number(selectedExamStudentId),
                amount,
                paymentMethod: paymentMode,
                mobileMoneyNumber: paymentMode === 'Mobile Money' ? mobileMoneyNumber : undefined,
                notes,
                paymentType: 'Frais de dossier d\'examen',
                examClass: selectedExamClass,
            };
        }

        return null;
    };

    // Open Modal Preview
    const handleOpenPreviewModal = (e: React.FormEvent) => {
        e.preventDefault();
        const data = validateAndBuildPaymentData();
        if (data) {
            setPendingPaymentData(data);
            setShowPreviewModal(true);
        }
    };

    // Finalize save and print receipt
    const handleConfirmAndPrint = async () => {
        if (pendingPaymentData && !isSubmitting) {
            setIsSubmitting(true);
            try {
                // Perform the transaction and await completion
                await new Promise(resolve => setTimeout(resolve, 600));
                await Promise.resolve(onSave(pendingPaymentData));
                setShowPreviewModal(false);
            } catch (error) {
                console.error("Erreur lors de la validation du paiement vers Supabase:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // Helper to get preview student name and class
    const previewDetails = useMemo(() => {
        if (!pendingPaymentData) return { name: '', class: '' };
        
        if (pendingPaymentData.paymentType === 'Inscription' && pendingPaymentData.newStudentData) {
            return {
                name: pendingPaymentData.newStudentData.name,
                class: pendingPaymentData.newStudentData.class,
            };
        }
        
        let st = null;
        if (pendingPaymentData.paymentType === 'Frais de dossier d\'examen') {
            st = users.find(u => u.id === pendingPaymentData.studentId);
            return {
                name: st ? st.name : 'Élève candidat',
                class: pendingPaymentData.examClass || (st ? st.class : ''),
            };
        }

        st = selectedStudent || users.find(u => u.id === pendingPaymentData.studentId);
        return {
            name: st ? st.name : 'Élève',
            class: st ? st.class || '' : '',
        };
    }, [pendingPaymentData, selectedStudent, users]);

    return (
        <div className="bg-slate-50 p-0 rounded-xl overflow-hidden shadow-sm border border-gray-200">
            {/* Header */}
            <div className="bg-[#1F4A59] text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <GraduationCapIcon className="w-7 h-7 text-emerald-300"/>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Guichet de Paiement & Encaissement Caisse</h2>
                        <p className="text-xs text-slate-200 mt-0.5">Saisissez les informations puis affichez l'aperçu du reçu avant impression</p>
                    </div>
                </div>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-400/30 font-semibold hidden sm:inline-block">
                   Caisse Ouverte
                </span>
            </div>

            <form onSubmit={handleOpenPreviewModal} className="p-6 space-y-6">
                {/* Mode Selector Tabs */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        1. Motif & Type de Versement
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <OptionButton 
                            label="Frais Mensuels" 
                            active={paymentType === 'Frais Mensuels'} 
                            onClick={() => setPaymentType('Frais Mensuels')} 
                        />
                        <OptionButton 
                            label="Inscription (Nouveau)" 
                            active={paymentType === 'Inscription'} 
                            onClick={() => setPaymentType('Inscription')} 
                        />
                        <OptionButton 
                            label="Réinscription" 
                            active={paymentType === 'Réinscription'} 
                            onClick={() => setPaymentType('Réinscription')} 
                        />
                        <OptionButton 
                            label="Dossier d'Examen" 
                            active={paymentType === 'Frais de dossier d\'examen'} 
                            onClick={() => setPaymentType('Frais de dossier d\'examen')} 
                        />
                    </div>
                </div>

                {/* ==================== CASE 1: FRAIS MENSUELS ==================== */}
                {paymentType === 'Frais Mensuels' && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-xs">
                        <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                            <span>Saisie des Frais Mensuels (Écolage / Scolarité)</span>
                        </h3>

                        {/* Search & Class Filter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Filtrer par Classe (Optionnel)</label>
                                <select 
                                    value={filterClass} 
                                    onChange={(e) => setFilterClass(e.target.value)}
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59] focus:border-[#1F4A59]"
                                >
                                    <option value="">-- Toutes les classes --</option>
                                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher le nom ou matricule de l'élève</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={searchStudentTerm}
                                        onChange={(e) => setSearchStudentTerm(e.target.value)}
                                        placeholder="Taper le nom de l'élève..."
                                        className="block w-full pl-9 pr-3 py-2 rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59] focus:border-[#1F4A59]"
                                    />
                                    <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                                </div>
                            </div>
                        </div>

                        {/* Student Dropdown */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Sélectionner l'Élève *</label>
                            <select 
                                value={selectedStudentId} 
                                onChange={(e) => setSelectedStudentId(e.target.value)} 
                                required 
                                className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59] focus:border-[#1F4A59] py-2.5 font-medium"
                            >
                                <option value="" disabled>-- Choisir l'élève dans la liste ({filteredStudents.length} élèves) --</option>
                                {filteredStudents.map(s => (
                                    <option key={s.id} value={s.id!}>
                                        {s.name} — Classe : {s.class || 'N/A'} {s.studentId ? `(${s.studentId})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Selected Student Financial Overview Card */}
                        {selectedStudent && (
                            <div className="p-4 bg-slate-100/80 rounded-xl border border-slate-200 text-xs space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-800 text-sm">{selectedStudent.name}</span>
                                    <span className="px-2 py-0.5 bg-[#1F4A59] text-white rounded text-[11px] font-medium">Classe: {selectedStudent.class}</span>
                                </div>
                                {selectedStudentPayment && (
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-500">Scolarité Totale</p>
                                            <p className="font-bold text-gray-900 mt-0.5">{selectedStudentPayment.totalFees.toLocaleString()} {currency}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-500">Déjà Payé</p>
                                            <p className="font-bold text-emerald-700 mt-0.5">{selectedStudentPayment.amountPaid.toLocaleString()} {currency}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <p className="text-gray-500">Reste Avant Versement</p>
                                            <p className="font-bold text-red-600 mt-0.5">{Math.max(0, selectedStudentPayment.totalFees - selectedStudentPayment.amountPaid).toLocaleString()} {currency}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Amount Input */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Montant à Verser ({currency}) *</label>
                            <input 
                                type="number" 
                                value={amountToPay} 
                                onChange={(e) => setAmountToPay(e.target.value)} 
                                required 
                                min="1"
                                placeholder="0" 
                                className="block w-full rounded-lg border-gray-300 text-lg font-bold text-[#1F4A59] focus:ring-[#1F4A59] focus:border-[#1F4A59]" 
                            />
                            {selectedStudentPayment && amountToPay && (
                                <p className="text-xs text-blue-700 font-medium mt-1">
                                    Solde restant après ce paiement : <strong className="text-blue-900">{remainingBalance.toLocaleString()} {currency}</strong>
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ==================== CASE 2: INSCRIPTION (NOUVEL ÉLÈVE) ==================== */}
                {paymentType === 'Inscription' && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-xs">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <span>Informations du Nouvel Élève à Inscrire</span>
                            </h3>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">Nouveau Dossier</span>
                        </div>

                        {/* Photo capture banner for Cashier */}
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative w-16 h-20 rounded-lg overflow-hidden bg-gray-200 border-2 border-indigo-200 flex items-center justify-center shrink-0">
                                {studentAvatar ? (
                                    <img src={studentAvatar} alt="Photo" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-8 h-8 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <p className="text-xs font-bold text-gray-800">Photo de l'Élève / Carte Photo</p>
                                <p className="text-[11px] text-gray-500">Prise de vue instantanée par caméra ou import d'un fichier photo.</p>
                                <div className="flex items-center gap-2 mt-1.5 justify-center sm:justify-start">
                                    <button
                                        type="button"
                                        onClick={() => setIsPhotoModalOpen(true)}
                                        className="px-2.5 py-1 bg-[#1F4A59] hover:bg-[#2c5a6e] text-white text-[11px] font-bold rounded-md flex items-center gap-1 shadow-2xs"
                                    >
                                        <Camera className="w-3 h-3" />
                                        <span>{studentAvatar ? 'Modifier la photo' : 'Prendre / Insérer photo'}</span>
                                    </button>
                                    {studentAvatar && (
                                        <button
                                            type="button"
                                            onClick={() => setStudentAvatar('')}
                                            className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-semibold rounded-md"
                                        >
                                            Effacer
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* New Student Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Nom & Prénom de l'Élève *</label>
                                <input 
                                    type="text" 
                                    value={newStudentName} 
                                    onChange={(e) => setNewStudentName(e.target.value)} 
                                    required 
                                    placeholder="Ex: Kouamé K. Emmanuel"
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Sexe *</label>
                                <select 
                                    value={newStudentGender} 
                                    onChange={(e) => setNewStudentGender(e.target.value as 'Masculin' | 'Féminin')}
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                >
                                    <option value="Masculin">Masculin</option>
                                    <option value="Féminin">Féminin</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Classe d'Affectation *</label>
                                <select 
                                    value={newStudentClass} 
                                    onChange={(e) => setNewStudentClass(e.target.value)} 
                                    required
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                >
                                    <option value="" disabled>-- Sélectionner la classe --</option>
                                    {classes.map(c => <option key={c.id} value={c.name}>{c.name} ({c.level})</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Date de Naissance (Optionnel)</label>
                                <input 
                                    type="date" 
                                    value={newStudentDob} 
                                    onChange={(e) => setNewStudentDob(e.target.value)}
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone Tuteur / Parent</label>
                                <input 
                                    type="tel" 
                                    value={newStudentContact} 
                                    onChange={(e) => setNewStudentContact(e.target.value)} 
                                    placeholder="+242 06 XXX XX XX"
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Adresse Domicile</label>
                                <input 
                                    type="text" 
                                    value={newStudentAddress} 
                                    onChange={(e) => setNewStudentAddress(e.target.value)} 
                                    placeholder="Quartier, Rue..."
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                />
                            </div>
                        </div>

                        {/* Famille Nombreuse */}
                        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isLargeFamily} 
                                    onChange={(e) => setIsLargeFamily(e.target.checked)}
                                    className="w-4 h-4 text-[#1F4A59] border-gray-300 rounded focus:ring-[#1F4A59]"
                                />
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                    <UsersIcon className="w-4 h-4 text-amber-600" />
                                    Cocher si c'est une Famille Nombreuse (Fratrie s'inscrivant ensemble)
                                </span>
                            </label>

                            {isLargeFamily && (
                                <div className="pt-2">
                                    <label className="block text-xs font-medium text-amber-900 mb-1">
                                        Nom de la Famille & Prénoms des Frères / Sœurs également inscrits *
                                    </label>
                                    <input 
                                        type="text" 
                                        value={familyNameOrSiblings} 
                                        onChange={(e) => setFamilyNameOrSiblings(e.target.value)} 
                                        required={isLargeFamily}
                                        placeholder="Ex: Famille KOUASSI — Frères: Marc (6ème) & Pierre (CP1)"
                                        className="block w-full rounded-lg border-amber-300 text-sm focus:ring-amber-500 bg-white"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dossier Scolaire Complémentaire */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                📂 Dossier d'Inscription & Options Scolaires
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Classe antérieure</label>
                                    <input 
                                        type="text" 
                                        value={classeAnterieure} 
                                        onChange={(e) => setClasseAnterieure(e.target.value)}
                                        placeholder="Ex: CM2"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">N° Matricule</label>
                                    <input 
                                        type="text" 
                                        value={matricule} 
                                        onChange={(e) => setMatricule(e.target.value)}
                                        placeholder="Ex: MAT2026101"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom des Parents ou Tuteur</label>
                                    <input 
                                        type="text" 
                                        value={parentTuteur} 
                                        onChange={(e) => setParentTuteur(e.target.value)}
                                        placeholder="Ex: M. & Mme Kouassi"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Frères & Sœurs scolarisé(e)s à l'établissement</label>
                                    <input 
                                        type="text" 
                                        value={freresSoeurs} 
                                        onChange={(e) => setFreresSoeurs(e.target.value)}
                                        placeholder="Ex: Kouassi Marc (6e), Kouassi Pierre (CP1)"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Pièces jointes (justificatifs, bulletins, etc.)</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="file" 
                                            id="piecesJointesFile_ins"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setPiecesJointes(file.name);
                                                }
                                            }}
                                            className="hidden" 
                                        />
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('piecesJointesFile_ins')?.click()}
                                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all cursor-pointer"
                                        >
                                            📎 Choisir un fichier
                                        </button>
                                        <span className="text-xs text-slate-500 font-mono">
                                            {piecesJointes || "Aucun fichier choisi"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={isAncienEleve} 
                                        onChange={(e) => setIsAncienEleve(e.target.checked)}
                                        className="w-4 h-4 text-[#1F4A59] border-gray-300 rounded focus:ring-[#1F4A59]"
                                    />
                                    <span className="text-xs font-bold text-slate-700">
                                        Ancien(ne) élève
                                    </span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={bilingue} 
                                        onChange={(e) => setBilingue(e.target.checked)}
                                        className="w-4 h-4 text-[#1F4A59] border-gray-300 rounded focus:ring-[#1F4A59]"
                                    />
                                    <span className="text-xs font-bold text-slate-700">
                                        Souhaite intégrer l'enseignement bilingue
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Registration Fee Amount */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Montant des Frais d'Inscription ({currency}) *</label>
                            <input 
                                type="number" 
                                value={registrationAmount} 
                                onChange={(e) => setRegistrationAmount(e.target.value)} 
                                required 
                                placeholder="Montant d'inscription..."
                                className="block w-full rounded-lg border-gray-300 text-lg font-bold text-[#1F4A59] focus:ring-[#1F4A59]"
                            />
                        </div>
                    </div>
                )}

                {/* ==================== CASE 3: RÉINSCRIPTION ==================== */}
                {paymentType === 'Réinscription' && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-xs">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <span>Sélection de l'Élève Existant pour Réinscription</span>
                            </h3>
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">Réinscription</span>
                        </div>

                        {/* Search & Class Filter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Filtrer par Classe</label>
                                <select 
                                    value={filterClass} 
                                    onChange={(e) => setFilterClass(e.target.value)}
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                >
                                    <option value="">-- Toutes les classes --</option>
                                    {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Recherche rapide par Nom</label>
                                <input 
                                    type="text" 
                                    value={searchStudentTerm}
                                    onChange={(e) => setSearchStudentTerm(e.target.value)}
                                    placeholder="Chercher le nom..."
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Choisir l'Élève *</label>
                            <select 
                                value={selectedStudentId} 
                                onChange={(e) => setSelectedStudentId(e.target.value)} 
                                required 
                                className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59] py-2.5 font-medium"
                            >
                                <option value="" disabled>-- Choisir l'élève à réinscrire --</option>
                                {filteredStudents.map(s => (
                                    <option key={s.id} value={s.id!}>{s.name} — Classe : {s.class || 'N/A'}</option>
                                ))}
                            </select>
                        </div>

                        {/* Famille Nombreuse for Réinscription */}
                        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isLargeFamily} 
                                    onChange={(e) => setIsLargeFamily(e.target.checked)}
                                    className="w-4 h-4 text-[#1F4A59] border-gray-300 rounded focus:ring-[#1F4A59]"
                                />
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                    <UsersIcon className="w-4 h-4 text-amber-600" />
                                    Cocher si la famille est nombreuse (Réinscription groupée)
                                </span>
                            </label>

                            {isLargeFamily && (
                                <div className="pt-2">
                                    <label className="block text-xs font-medium text-amber-900 mb-1">
                                        Nom de la Famille & Frères/Sœurs enregistrés *
                                    </label>
                                    <input 
                                        type="text" 
                                        value={familyNameOrSiblings} 
                                        onChange={(e) => setFamilyNameOrSiblings(e.target.value)} 
                                        required={isLargeFamily}
                                        placeholder="Ex: Famille Martin — Frères: Jean & Paul"
                                        className="block w-full rounded-lg border-amber-300 text-sm focus:ring-amber-500 bg-white"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dossier Scolaire Complémentaire */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                📂 Dossier de Réinscription & Options Scolaires
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Classe antérieure</label>
                                    <input 
                                        type="text" 
                                        value={classeAnterieure} 
                                        onChange={(e) => setClasseAnterieure(e.target.value)}
                                        placeholder="Ex: CM2"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">N° Matricule</label>
                                    <input 
                                        type="text" 
                                        value={matricule} 
                                        onChange={(e) => setMatricule(e.target.value)}
                                        placeholder="Ex: MAT2026101"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom des Parents ou Tuteur</label>
                                    <input 
                                        type="text" 
                                        value={parentTuteur} 
                                        onChange={(e) => setParentTuteur(e.target.value)}
                                        placeholder="Ex: M. & Mme Kouassi"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Frères & Sœurs scolarisé(e)s à l'établissement</label>
                                    <input 
                                        type="text" 
                                        value={freresSoeurs} 
                                        onChange={(e) => setFreresSoeurs(e.target.value)}
                                        placeholder="Ex: Kouassi Marc (6e), Kouassi Pierre (CP1)"
                                        className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Pièces jointes (justificatifs, bulletins, etc.)</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="file" 
                                            id="piecesJointesFile_rein"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setPiecesJointes(file.name);
                                                }
                                            }}
                                            className="hidden" 
                                        />
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('piecesJointesFile_rein')?.click()}
                                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all cursor-pointer"
                                        >
                                            📎 Choisir un fichier
                                        </button>
                                        <span className="text-xs text-slate-500 font-mono">
                                            {piecesJointes || "Aucun fichier choisi"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={isAncienEleve} 
                                        onChange={(e) => setIsAncienEleve(e.target.checked)}
                                        className="w-4 h-4 text-[#1F4A59] border-gray-300 rounded focus:ring-[#1F4A59]"
                                    />
                                    <span className="text-xs font-bold text-slate-700">
                                        Ancien(ne) élève
                                    </span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={bilingue} 
                                        onChange={(e) => setBilingue(e.target.checked)}
                                        className="w-4 h-4 text-[#1F4A59] border-gray-300 rounded focus:ring-[#1F4A59]"
                                    />
                                    <span className="text-xs font-bold text-slate-700">
                                        Souhaite intégrer l'enseignement bilingue
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Montant de Réinscription ({currency}) *</label>
                            <input 
                                type="number" 
                                value={registrationAmount} 
                                onChange={(e) => setRegistrationAmount(e.target.value)} 
                                required 
                                placeholder="0"
                                className="block w-full rounded-lg border-gray-300 text-lg font-bold text-[#1F4A59] focus:ring-[#1F4A59]"
                            />
                        </div>
                    </div>
                )}

                {/* ==================== CASE 4: FRAIS DE DOSSIER D'EXAMEN ==================== */}
                {paymentType === 'Frais de dossier d\'examen' && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-xs">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <span>Paiement des Frais de Dossier d'Examen</span>
                            </h3>
                            <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">Examen d'État</span>
                        </div>

                        {/* Step 1: Select Exam Class */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Étape 1 : Sélectionner la Classe d'Examen *</label>
                            <select 
                                value={selectedExamClass} 
                                onChange={(e) => handleExamClassChange(e.target.value)} 
                                required 
                                className="block w-full rounded-lg border-gray-300 text-sm font-medium focus:ring-[#1F4A59] py-2.5"
                            >
                                <option value="" disabled>-- Choisir la classe d'examen --</option>
                                {examClasses.map(c => (
                                    <option key={c.id} value={c.name}>
                                        🎓 {c.name} ({c.level})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Step 2: Select Student in Exam Class */}
                        {selectedExamClass && (
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Étape 2 : Sélectionner l'Élève de la classe {selectedExamClass} *
                                </label>
                                <select 
                                    value={selectedExamStudentId} 
                                    onChange={(e) => setSelectedExamStudentId(e.target.value)} 
                                    required 
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59] py-2.5"
                                >
                                    <option value="" disabled>-- Choisir l'élève candidat au dossier --</option>
                                    {examClassStudents.map(s => (
                                        <option key={s.id} value={s.id!}>{s.name} ({s.studentId || 'N/A'})</option>
                                    ))}
                                </select>
                                {examClassStudents.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">Aucun élève trouvé dans la classe {selectedExamClass}.</p>
                                )}
                            </div>
                        )}

                        {/* Step 3: Exam Fee Amount specified by RAF/DG */}
                        {selectedExamClass && (
                            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-indigo-900">
                                        Montant du Dossier d'Examen Fixé ({currency})
                                    </label>
                                    <span className="text-[11px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-medium">
                                        Fixé par la Direction / RAF
                                    </span>
                                </div>
                                <input 
                                    type="number" 
                                    value={examFeeAmount} 
                                    onChange={(e) => setExamFeeAmount(e.target.value)} 
                                    required 
                                    className="block w-full rounded-lg border-indigo-300 text-lg font-bold text-indigo-900 focus:ring-indigo-500 bg-white"
                                />
                                <p className="text-[11px] text-indigo-700">
                                    Ce montant est pré-paramétré par le Responsable des Affaires Financières (RAF) et la Direction Générale (DG).
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Common Payment Details: Mode, Date, Notes */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        2. Mode de Règlement & Validation
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode de Paiement</label>
                            <div className="flex flex-wrap gap-2">
                                {['Espèces', 'Mobile Money', 'Carte Bancaire', 'Virement'].map(mode => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setPaymentMode(mode)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                            paymentMode === mode 
                                                ? 'bg-[#1F4A59] text-white border-[#1F4A59]' 
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="paymentDate" className="block text-xs font-medium text-gray-600 mb-1">Date d'Encaissement</label>
                            <div className="relative">
                                <input 
                                    type="date" 
                                    id="paymentDate" 
                                    value={paymentDate} 
                                    onChange={e => setPaymentDate(e.target.value)} 
                                    required 
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59] py-2"
                                />
                            </div>
                        </div>
                    </div>

                    {paymentMode === 'Mobile Money' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Numéro Mobile Money de la Transaction</label>
                            <input 
                                type="text" 
                                value={mobileMoneyNumber} 
                                onChange={(e) => setMobileMoneyNumber(e.target.value)} 
                                placeholder="Ex: +242 06 123 4567"
                                className="block w-full rounded-lg border-gray-300 text-sm focus:ring-[#1F4A59]"
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="notes" className="block text-xs font-medium text-gray-600 mb-1">Observations / Remarques sur le Reçu (Facultatif)</label>
                        <textarea 
                            id="notes" 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            rows={2} 
                            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59]" 
                            placeholder="Mentions particulières sur le reçu..."
                        />
                    </div>
                </div>

                {/* Matrice de Contrôle de Saisie */}
                <ControlMatrixStatus rules={validationRules} className="mt-4" />

                {/* Footer Action Buttons */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-200">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button 
                        type="submit" 
                        disabled={!isFormValid || isSubmitting}
                        className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-md ${
                            !isFormValid || isSubmitting
                                ? 'bg-slate-400 opacity-60 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg cursor-pointer'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <span>Traitement en cours</span>
                                <LoadingDots />
                            </>
                        ) : (
                            <>
                                <Eye className="w-4 h-4" />
                                <span>Aperçu du Reçu avant Impression</span>
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* ================= MODAL D'APERÇU DU REÇU AVANT IMPRESSION ================= */}
            <Modal 
                isOpen={showPreviewModal} 
                onClose={() => !isSubmitting && setShowPreviewModal(false)} 
                title="🔍 Aperçu du Reçu Officiel de Caisse" 
                size="2xl"
            >
                {pendingPaymentData && (
                    <div className="space-y-6 p-2">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                            <span className="font-semibold flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-amber-600" />
                                Ceci est un APERÇU AVANT IMPRESSION. Vérifiez les données saisies avant validation finale.
                            </span>
                            <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">PREVIEW</span>
                        </div>

                        {/* Simulated Ticket Receipt Card */}
                        <div className="bg-slate-50 p-6 rounded-xl border-2 border-dashed border-slate-300 max-w-xl mx-auto font-mono text-xs text-slate-800 space-y-4 shadow-sm">
                            <div className="text-center border-b border-slate-300 pb-3 space-y-1">
                                <p className="font-extrabold text-base tracking-wide text-slate-900 uppercase">COMPLEXE SCOLAIRE Saint-Exupéry</p>
                                <p className="text-[11px] text-slate-600">Avenue de l'Indépendance, Brazzaville</p>
                                <p className="text-[11px] text-slate-600">Tél: +242 06 600 0000 | Caisse Principale</p>
                            </div>

                            <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">REÇU PROVISOIRE N°:</span>
                                    <span className="font-bold text-slate-900">SIMUL-{Date.now().toString().slice(-6)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Date & Heure:</span>
                                    <span>{new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Motif de versement:</span>
                                    <span className="font-bold text-emerald-700">{pendingPaymentData.paymentType}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between border-b pb-1">
                                    <span className="text-slate-500">Élève Payeur:</span>
                                    <span className="font-bold text-slate-900">{previewDetails.name}</span>
                                </div>
                                <div className="flex justify-between border-b pb-1">
                                    <span className="text-slate-500">Classe:</span>
                                    <span className="font-semibold">{previewDetails.class || 'N/A'}</span>
                                </div>

                                {pendingPaymentData.isLargeFamily && (
                                    <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-900">
                                        <p className="font-bold">✓ Famille Nombreuse enregistrée :</p>
                                        <p>{pendingPaymentData.familyNameOrSiblings}</p>
                                    </div>
                                )}

                                {(pendingPaymentData.newStudentData?.classeAnterieure || pendingPaymentData.classeAnterieure) && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">Classe Antérieure:</span>
                                        <span className="font-semibold">{pendingPaymentData.newStudentData?.classeAnterieure || pendingPaymentData.classeAnterieure}</span>
                                    </div>
                                )}

                                {(pendingPaymentData.newStudentData?.matricule || pendingPaymentData.matricule) && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">N° Matricule:</span>
                                        <span className="font-mono font-semibold">{pendingPaymentData.newStudentData?.matricule || pendingPaymentData.matricule}</span>
                                    </div>
                                )}

                                {(pendingPaymentData.newStudentData?.parentTuteur || pendingPaymentData.parentTuteur) && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">Parent / Tuteur:</span>
                                        <span className="font-semibold">{pendingPaymentData.newStudentData?.parentTuteur || pendingPaymentData.parentTuteur}</span>
                                    </div>
                                )}

                                {(pendingPaymentData.newStudentData?.isAncienEleve || pendingPaymentData.isAncienEleve) && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">Ancien Élève:</span>
                                        <span className="font-semibold text-emerald-700">✓ Oui</span>
                                    </div>
                                )}

                                {(pendingPaymentData.newStudentData?.bilingue || pendingPaymentData.bilingue) && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">Ens. Bilingue:</span>
                                        <span className="font-semibold text-indigo-700">✓ Souhaité</span>
                                    </div>
                                )}

                                {(pendingPaymentData.newStudentData?.piecesJointes || pendingPaymentData.piecesJointes) && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">Pièces Jointes:</span>
                                        <span className="font-mono text-[10px] text-slate-600">📎 {pendingPaymentData.newStudentData?.piecesJointes || pendingPaymentData.piecesJointes}</span>
                                    </div>
                                )}

                                <div className="flex justify-between border-b pb-1">
                                    <span className="text-slate-500">Mode de Règlement:</span>
                                    <span className="font-semibold">{pendingPaymentData.paymentMethod}</span>
                                </div>

                                {pendingPaymentData.mobileMoneyNumber && (
                                    <div className="flex justify-between border-b pb-1">
                                        <span className="text-slate-500">N° Mobile Money:</span>
                                        <span className="font-semibold">{pendingPaymentData.mobileMoneyNumber}</span>
                                    </div>
                                )}

                                {pendingPaymentData.notes && (
                                    <div className="p-2 bg-slate-100 rounded text-[11px]">
                                        <span className="font-semibold text-slate-600">Note: </span>
                                        <span>{pendingPaymentData.notes}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-center text-sm">
                                <span className="font-extrabold text-slate-900">NET ENCAISSÉ :</span>
                                <span className="font-black text-lg text-emerald-800 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                                    {pendingPaymentData.amount.toLocaleString('fr-FR')} {currency}
                                </span>
                            </div>

                            <div className="text-center pt-2 text-[10px] text-slate-500">
                                *** Exemplaires Établissement et Client générés automatiquement ***
                            </div>
                        </div>

                        {/* Action buttons inside preview modal */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                            <button 
                                type="button" 
                                onClick={() => !isSubmitting && setShowPreviewModal(false)} 
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Modifier la saisie</span>
                            </button>

                            <button 
                                type="button" 
                                onClick={handleConfirmAndPrint} 
                                disabled={isSubmitting}
                                className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-md ${
                                    isSubmitting 
                                        ? 'bg-emerald-700 opacity-90 cursor-wait' 
                                        : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg cursor-pointer'
                                }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span>Validation & Synchronisation Serveur</span>
                                        <LoadingDots />
                                    </>
                                ) : (
                                    <>
                                        <Printer className="w-4 h-4" />
                                        <span>Valider & Imprimer le Reçu Officiel</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Student Photo Capture Modal for Cashier Inscription / Re-inscription */}
            <StudentPhotoCaptureModal
                isOpen={isPhotoModalOpen}
                onClose={() => setIsPhotoModalOpen(false)}
                onPhotoCaptured={(photoBase64) => {
                    setStudentAvatar(photoBase64);
                }}
                currentPhoto={studentAvatar}
                studentName={newStudentName}
            />
        </div>
    );
};

export default PaymentForm;
