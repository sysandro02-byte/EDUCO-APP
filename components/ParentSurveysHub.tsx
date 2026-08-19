import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Send, 
  Plus, 
  MessageSquare, 
  Mail, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Star, 
  Trash2, 
  FileText, 
  Download, 
  Printer, 
  Sparkles, 
  AlertCircle, 
  HelpCircle, 
  Clock, 
  Share2, 
  Copy, 
  ExternalLink,
  ChevronRight,
  Vote,
  RefreshCw,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { fetchSurveys, createSurvey, submitSurveyResponse, fetchSurveyReport, broadcastSurvey } from '../src/services/api';

interface Question {
  id: string;
  text: string;
  type: 'single_choice' | 'multiple_choice' | 'rating' | 'text';
  options?: string[];
}

interface Survey {
  id: number;
  title: string;
  description?: string;
  category: string;
  targetAudience: string;
  deadline?: string;
  status: string;
  questions: Question[];
  creatorName?: string;
  creatorRole?: string;
  createdAt: string;
  responsesCount?: number;
  latestResponseAt?: string;
}

interface SurveyReportData {
  survey: Survey;
  totalResponses: number;
  analytics: Array<{
    questionId: string;
    questionText: string;
    type: string;
    options: string[];
    totalAnswered: number;
    distribution: Record<string, number>;
    averageRating?: string | null;
    textResponses: string[];
  }>;
  channels: Record<string, number>;
  responses: any[];
}

const TEMPLATES = [
  {
    name: 'Activités Parascolaires du Samedi',
    category: 'Activités parascolaires',
    description: 'Consultation auprès des parents pour choisir les ateliers parascolaires prioritaires du week-end (Robotique, Théâtre, Échecs, Natation, Arts).',
    targetAudience: 'all',
    questions: [
      {
        id: 'q1',
        text: 'Quelles activités parascolaires souhaiteriez-vous pour votre enfant ce trimestre ?',
        type: 'multiple_choice' as const,
        options: ['Robotique & Codage', 'Théâtre & Prise de parole', 'Club d\'Échecs & Logique', 'Arts Plastiques & Dessin', 'Musique & Chorale', 'Arts Martiaux / Judo']
      },
      {
        id: 'q2',
        text: 'Quel créneau horaire vous conviendrait le mieux le samedi matin ?',
        type: 'single_choice' as const,
        options: ['08h30 - 10h30', '10h30 - 12h30', 'Après-midi (15h00 - 17h00)']
      },
      {
        id: 'q3',
        text: 'Niveau d\'intérêt global pour les sorties culturelles le week-end (1 à 5 étoiles) :',
        type: 'rating' as const,
        options: []
      },
      {
        id: 'q4',
        text: 'Avez-vous des suggestions particulières pour enrichir nos activités ?',
        type: 'text' as const,
        options: []
      }
    ]
  },
  {
    name: 'Organisation Journée Portes Ouvertes 2026',
    category: 'Journées portes ouvertes',
    description: 'Sondage rapide pour planifier les créneaux de visite et les thèmes d\'ateliers lors de notre prochaine Journée Portes Ouvertes.',
    targetAudience: 'all',
    questions: [
      {
        id: 'q1',
        text: 'Comptez-vous participer à la Journée Portes Ouvertes annuelle ?',
        type: 'single_choice' as const,
        options: ['Oui, absolument', 'Probablement', 'Non, indisponible']
      },
      {
        id: 'q2',
        text: 'Quels aspects de l\'école souhaitez-vous découvrir en priorité ?',
        type: 'multiple_choice' as const,
        options: ['Démonstration des salles numériques & IA', 'Rencontre avec le corps professoral', 'Visite des infrastructures sportives & cantine', 'Présentation des clubs parascolaires']
      },
      {
        id: 'q3',
        text: 'Avis général sur l\'organisation des événements scolaires précédents :',
        type: 'rating' as const,
        options: []
      }
    ]
  },
  {
    name: 'Restauration & Cantine Scolaire',
    category: 'Restauration',
    description: 'Recueil des retours des parents sur la qualité des repas, la variété des menus et les préférences alimentaires.',
    targetAudience: 'primaire',
    questions: [
      {
        id: 'q1',
        text: 'Votre enfant mange-t-il régulièrement à la cantine ?',
        type: 'single_choice' as const,
        options: ['Tous les jours scolaires', '2 à 3 fois par semaine', 'Occasionnellement', 'Non']
      },
      {
        id: 'q2',
        text: 'Comment évaluez-vous la qualité et l\'équilibre des menus proposés ?',
        type: 'rating' as const,
        options: []
      },
      {
        id: 'q3',
        text: 'Souhaitez-vous davantage de fruits locaux et options végétariennes ?',
        type: 'single_choice' as const,
        options: ['Oui, tout à fait', 'Le menu actuel est suffisant', 'Sans avis']
      }
    ]
  }
];

const ParentSurveysHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'report' | 'vote_tester'>('list');
  const [surveysList, setSurveysList] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [reportData, setReportData] = useState<SurveyReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Broadcast modal state
  const [broadcastModalSurvey, setBroadcastModalSurvey] = useState<Survey | null>(null);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [customBroadcastNote, setCustomBroadcastNote] = useState('');

  // Form State for creating survey
  const [newSurvey, setNewSurvey] = useState<{
    title: string;
    description: string;
    category: string;
    targetAudience: string;
    deadline: string;
    questions: Question[];
  }>({
    title: '',
    description: '',
    category: 'Activités parascolaires',
    targetAudience: 'all',
    deadline: '',
    questions: [
      {
        id: 'q1',
        text: 'Quelle option préférez-vous ?',
        type: 'single_choice',
        options: ['Option A', 'Option B', 'Option C']
      }
    ]
  });

  // Vote simulator state
  const [votingSurvey, setVotingSurvey] = useState<Survey | null>(null);
  const [voteForm, setVoteForm] = useState({
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    studentName: '',
    studentClass: 'CM2',
    channel: 'whatsapp' as const,
    answers: {} as Record<string, any>,
    comment: ''
  });
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  const loadSurveys = async () => {
    setIsLoading(true);
    try {
      const res = await fetchSurveys();
      if (res && res.surveys && res.surveys.length > 0) {
        setSurveysList(res.surveys);
      } else {
        setSurveysList([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSurveys();
  }, []);

  const handleOpenReport = async (surveyId: number) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('report');
    setIsLoadingReport(true);

    try {
      const res = await fetchSurveyReport(surveyId);
      if (res && res.analytics) {
        setReportData(res);
      } else {
        setReportData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleExportCSV = (customReport?: SurveyReportData) => {
    const report = customReport || reportData;
    if (!report) {
      showToast("Aucune donnée de rapport disponible pour l'export.");
      return;
    }

    const { survey, totalResponses, analytics, channels } = report;
    const lines: string[] = [];

    // En-tête officiel
    lines.push(`"RAPPORT DE SONDAGE PARENTS - DIRECTION DE L'ÉTABLISSEMENT"`);
    lines.push(`"Établissement";"EduCo - Plateforme Intégrée de Gestion Scolaire"`);
    lines.push(`"Date d'extraction";"${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}"`);
    lines.push(`"Titre du Sondage";"${survey.title.replace(/"/g, '""')}"`);
    lines.push(`"Catégorie";"${(survey.category || '').replace(/"/g, '""')}"`);
    lines.push(`"Statut";"${survey.status === 'active' ? 'En cours de consultation' : 'Clôturé'}"`);
    lines.push(`"Audience Cible";"${(survey.targetAudience || 'Toutes les familles').replace(/"/g, '""')}"`);
    lines.push(`"Total des Participants";"${totalResponses}"`);
    lines.push(`"Canal WhatsApp";"${channels?.whatsapp || 0} réponses"`);
    lines.push(`"Canal E-mail";"${channels?.email || 0} réponses"`);
    lines.push(``);

    // Synthèse par Question
    lines.push(`"--- SYNTHÈSE ANALYTIQUE DÉTAILLÉE PAR QUESTION ---"`);
    lines.push(`"N°";"Question";"Type de Question";"Total Réponses";"Option / Modalité";"Nombre de Votes";"Pourcentage (%)";"Moyenne / Observation"`);

    analytics.forEach((item, idx) => {
      const qNum = idx + 1;
      const qText = item.questionText.replace(/"/g, '""');
      const qType = item.type === 'single_choice' 
        ? 'Choix Unique' 
        : item.type === 'multiple_choice' 
        ? 'Choix Multiple' 
        : item.type === 'rating' 
        ? 'Évaluation (1 à 5 Étoiles)' 
        : 'Réponse Libre / Texte';
      const totalAns = item.totalAnswered;

      if (item.type === 'rating') {
        lines.push(`"${qNum}";"${qText}";"${qType}";"${totalAns}";"Score Moyen";"${totalAns}";"100%";"${item.averageRating || 'N/A'} / 5.0"`);
        if (item.distribution) {
          Object.entries(item.distribution).forEach(([star, count]) => {
            const pct = totalAns > 0 ? Math.round((Number(count) / totalAns) * 100) : 0;
            lines.push(`"";"";"";"";"${star}";"${count}";"${pct}%";""`);
          });
        }
      } else if (item.distribution && Object.keys(item.distribution).length > 0) {
        Object.entries(item.distribution).forEach(([opt, rawCount], optIdx) => {
          const count = Number(rawCount) || 0;
          const pct = totalAns > 0 ? Math.round((count / totalAns) * 100) : 0;
          if (optIdx === 0) {
            lines.push(`"${qNum}";"${qText}";"${qType}";"${totalAns}";"${opt.replace(/"/g, '""')}";"${count}";"${pct}%";""`);
          } else {
            lines.push(`"";"";"";"";"${opt.replace(/"/g, '""')}";"${count}";"${pct}%";""`);
          }
        });
      } else if (item.textResponses && item.textResponses.length > 0) {
        lines.push(`"${qNum}";"${qText}";"${qType}";"${totalAns}";"Commentaires qualitatifs";"${item.textResponses.length}";"100%";"${(item.textResponses[0] || '').replace(/"/g, '""')}"`);
        item.textResponses.slice(1).forEach((comment) => {
          lines.push(`"";"";"";"";"";"";"";"${comment.replace(/"/g, '""')}"`);
        });
      } else {
        lines.push(`"${qNum}";"${qText}";"${qType}";"${totalAns}";"Aucune donnée";"0";"0%";""`);
      }
    });

    lines.push(``);
    lines.push(`"--- FIN DU RAPPORT DE SONDAGE ---"`);

    const csvData = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanTitle = survey.title.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 35);
    link.setAttribute('href', url);
    link.setAttribute('download', `sondage_parents_${cleanTitle}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Rapport CSV "${survey.title}" téléchargé avec succès !`);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setNewSurvey({
      title: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      targetAudience: tmpl.targetAudience,
      deadline: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      questions: tmpl.questions.map((q, idx) => ({ ...q, id: `q${idx + 1}` }))
    });
    showToast(`Modèle « ${tmpl.name} » chargé avec succès !`);
  };

  const handleAddQuestion = () => {
    const nextId = `q${newSurvey.questions.length + 1}`;
    setNewSurvey(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: nextId,
          text: 'Nouvelle question pour les parents',
          type: 'single_choice',
          options: ['Option 1', 'Option 2']
        }
      ]
    }));
  };

  const handleRemoveQuestion = (idx: number) => {
    if (newSurvey.questions.length <= 1) return;
    setNewSurvey(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx)
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSurvey.title.trim()) {
      alert('Veuillez spécifier le titre du sondage.');
      return;
    }

    try {
      const res = await createSurvey(newSurvey);
      if (res && res.survey) {
        showToast(`Sondage "${newSurvey.title}" créé avec succès !`);
        loadSurveys();
        setActiveTab('list');
      } else {
        // Fallback local add
        const created: Survey = {
          id: Date.now(),
          title: newSurvey.title,
          description: newSurvey.description,
          category: newSurvey.category,
          targetAudience: newSurvey.targetAudience,
          deadline: newSurvey.deadline,
          status: 'active',
          questions: newSurvey.questions,
          creatorName: 'Direction',
          creatorRole: 'Promoteur',
          createdAt: new Date().toISOString(),
          responsesCount: 0
        };
        setSurveysList(prev => [created, ...prev]);
        showToast(`Sondage "${newSurvey.title}" créé !`);
        setActiveTab('list');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenBroadcastModal = (survey: Survey) => {
    setBroadcastModalSurvey(survey);
    const msg = encodeURIComponent(
      `🏫 *${survey.title}*\n\nChers parents,\n${survey.description || 'Votre avis compte pour la réussite de nos élèves ! Merci de bien vouloir répondre à ce court sondage.'}\n\n👉 *Participez directement ici :* ${window.location.origin}/?survey=${survey.id}\n\n_Direction de l'Établissement_`
    );
    setWhatsappLink(`https://api.whatsapp.com/send?text=${msg}`);
  };

  const handleOpenVoteTester = (survey: Survey) => {
    setVotingSurvey(survey);
    setVoteForm({
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      studentName: '',
      studentClass: '',
      channel: 'whatsapp',
      answers: {},
      comment: ''
    });
    setActiveTab('vote_tester');
  };

  const handleVoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!votingSurvey) return;

    setIsSubmittingVote(true);
    try {
      await submitSurveyResponse(votingSurvey.id, voteForm);
      showToast(`Réponse de ${voteForm.parentName} enregistrée avec succès !`);
      
      // Update local count
      setSurveysList(prev => prev.map(s => {
        if (s.id === votingSurvey.id) {
          return { ...s, responsesCount: (s.responsesCount || 0) + 1 };
        }
        return s;
      }));

      // Open report
      handleOpenReport(votingSurvey.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-900 text-white border border-emerald-700 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1F4A59] via-[#275e71] to-[#1F4A59] rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-black tracking-wide uppercase border border-white/25">
              Module Direction
            </span>
            <span className="text-xs text-sky-200 font-semibold">Consultation & Enquêtes Parents</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Sondages Rapides & Rapports Parents
          </h1>
          <p className="text-xs sm:text-sm text-sky-100/90 max-w-2xl font-medium">
            Diffusez en un clic des sondages par WhatsApp et E-mail (activités parascolaires, portes ouvertes, cantine) et exploitez les résultats en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Sondage</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'list'
              ? 'bg-[#1F4A59] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Vote className="w-4 h-4" />
          <span>Sondages Actifs & Historique ({surveysList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'create'
              ? 'bg-[#1F4A59] text-white shadow-xs'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Créer un Sondage</span>
        </button>

        {reportData && (
          <button
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'report'
                ? 'bg-[#1F4A59] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            <span>Rapport : {reportData.survey.title.substring(0, 25)}...</span>
          </button>
        )}

        {votingSurvey && (
          <button
            onClick={() => setActiveTab('vote_tester')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'vote_tester'
                ? 'bg-[#1F4A59] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-amber-500" />
            <span>R�ponse Parent</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LISTE DES SONDAGES ACTIFS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surveysList.map((survey) => (
              <div 
                key={survey.id} 
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-4 hover:border-sky-500/50 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-950/80 text-[#1F4A59] dark:text-sky-300 text-[10px] font-black rounded-lg uppercase border border-sky-200 dark:border-sky-800">
                      {survey.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3" />
                      <span>{survey.status === 'active' ? 'En cours' : 'Clôturé'}</span>
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100 line-clamp-2">
                    {survey.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {survey.description || "Aucune description renseignée."}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                      <Users className="w-3.5 h-3.5 text-sky-500" />
                      <span>{survey.responsesCount || 0} réponses reçues</span>
                    </span>
                    <span>{survey.questions.length} question(s)</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    onClick={() => handleOpenBroadcastModal(survey)}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Diffuser</span>
                  </button>

                  <button
                    onClick={() => handleOpenVoteTester(survey)}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Vote className="w-3.5 h-3.5" />
                    <span>Saisir réponse</span>
                  </button>

                  <button
                    onClick={() => handleOpenReport(survey.id)}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-[#1F4A59] text-white hover:bg-[#285d70] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Résultats</span>
                  </button>
                </div>

              </div>
            ))}
          </div>

          {surveysList.length === 0 && (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Vote className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Aucun sondage actif</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Créez votre première enquête ou chargez un modèle préconçu pour sonder les familles.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 bg-[#1F4A59] text-white text-xs font-bold rounded-xl"
              >
                Créer un sondage
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CRÉATION D'UN SONDAGE AVEC MODÈLES PRÉ-REMPLIS                     */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <div className="space-y-6 max-w-4xl">
          
          {/* Quick Pre-filled Templates */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Modèles Prêts à l'Emploi (Chargement en 1 Clic)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TEMPLATES.map((tmpl, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-slate-700/50 cursor-pointer transition-all space-y-1"
                >
                  <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{tmpl.name}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{tmpl.description}</p>
                  <span className="inline-block text-[10px] font-black text-sky-600 dark:text-sky-400 mt-1">
                    {tmpl.questions.length} questions pré-configurées →
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleCreateSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-6">
            
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Paramètres du Sondage</h2>
              <p className="text-xs text-slate-500">Configurez l'intitulé, la catégorie et la cible des parents consultés.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Titre du Sondage <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSurvey.title}
                  onChange={(e) => setNewSurvey(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Choix des activités parascolaires du samedi matin"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Catégorie
                </label>
                <select
                  value={newSurvey.category}
                  onChange={(e) => setNewSurvey(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="Activités parascolaires">Activités parascolaires</option>
                  <option value="Journées portes ouvertes">Journées portes ouvertes</option>
                  <option value="Restauration">Restauration & Cantine</option>
                  <option value="Sorties pédagogiques">Sorties pédagogiques</option>
                  <option value="Discipline & Organisation">Discipline & Organisation</option>
                  <option value="Général">Autre / Général</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Cible des Parents
                </label>
                <select
                  value={newSurvey.targetAudience}
                  onChange={(e) => setNewSurvey(prev => ({ ...prev, targetAudience: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="all">Toutes les classes de l'école</option>
                  <option value="maternelle">Maternelle uniquement</option>
                  <option value="primaire">Primaire uniquement</option>
                  <option value="college">Collège uniquement</option>
                  <option value="lycee">Lycée uniquement</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Description / Message d'accompagnement pour les parents
                </label>
                <textarea
                  value={newSurvey.description}
                  onChange={(e) => setNewSurvey(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Chers parents, votre avis nous aide à offrir la meilleure expérience éducative..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none"
                />
              </div>
            </div>

            {/* Questions Builder */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Questions du Sondage ({newSurvey.questions.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="flex items-center gap-1 text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une question</span>
                </button>
              </div>

              <div className="space-y-4">
                {newSurvey.questions.map((q, qIdx) => (
                  <div key={q.id || qIdx} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-slate-500">Question {qIdx + 1}</span>
                      {newSurvey.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSurvey(prev => ({
                              ...prev,
                              questions: prev.questions.map((item, idx) => idx === qIdx ? { ...item, text: val } : item)
                            }));
                          }}
                          placeholder="Intitulé de la question..."
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setNewSurvey(prev => ({
                              ...prev,
                              questions: prev.questions.map((item, idx) => idx === qIdx ? { ...item, type: val } : item)
                            }));
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-2 text-xs font-medium text-slate-800 dark:text-slate-100"
                        >
                          <option value="single_choice">Choix Unique (Radio)</option>
                          <option value="multiple_choice">Choix Multiple (Cases)</option>
                          <option value="rating">Évaluation (1 à 5 Étoiles)</option>
                          <option value="text">Réponse Libre / Texte</option>
                        </select>
                      </div>
                    </div>

                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Options de réponse (séparées par des virgules) :
                        </label>
                        <input
                          type="text"
                          value={(q.options || []).join(', ')}
                          onChange={(e) => {
                            const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                            setNewSurvey(prev => ({
                              ...prev,
                              questions: prev.questions.map((item, idx) => idx === qIdx ? { ...item, options: opts } : item)
                            }));
                          }}
                          placeholder="Ex: Robotique, Théâtre, Échecs, Natation"
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#1F4A59] hover:bg-[#285d70] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Créer & Publier le Sondage
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INTERFACE DE RAPPORT DÉDIÉE & ANALYSE STATISTIQUE                  */}
      {/* ========================================================================= */}
      {activeTab === 'report' && reportData && (
        <div className="space-y-6">
          
          {/* Report Header Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase">
                  Rapport Officiel
                </span>
                <span className="text-xs text-slate-400">Généré en temps réel</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{reportData.survey.title}</h2>
              <p className="text-xs text-slate-500 max-w-2xl">{reportData.survey.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleExportCSV()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Exporter les résultats détaillés au format Excel / CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exporter CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer"
                title="Imprimer ou enregistrer le rapport en PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer / PDF</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleOpenBroadcastModal(reportData.survey)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1F4A59] text-white rounded-xl text-xs font-bold hover:bg-[#285d70] transition-all cursor-pointer shadow-2xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Relancer Diffusion</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase">Participation Globale</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{reportData.totalResponses}</span>
                <span className="text-xs text-emerald-600 font-bold">parents participants</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase">Canaux de Réponse</span>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp ({reportData.channels.whatsapp || 0})
                </span>
                <span className="flex items-center gap-1 font-bold text-sky-600">
                  <Mail className="w-3.5 h-3.5" />
                  E-mail ({reportData.channels.email || 0})
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase">Statut de la consultation</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Actif & Ouvert</span>
                <span className="text-[11px] text-slate-400">Clôture dans 12j</span>
              </div>
            </div>
          </div>

          {/* Detailed Question Analytics */}
          <div className="space-y-4">
            {reportData.analytics.map((item, idx) => (
              <div key={item.questionId || idx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase">Question {idx + 1}</span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{item.questionText}</h3>
                  </div>
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold shrink-0">
                    {item.totalAnswered} réponses
                  </span>
                </div>

                {/* Rating Display */}
                {item.type === 'rating' && item.averageRating && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Note Moyenne de Satisfaction</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="w-5 h-5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-amber-900 dark:text-amber-200">{item.averageRating}</span>
                      <span className="text-xs text-amber-700 dark:text-amber-400"> / 5.0</span>
                    </div>
                  </div>
                )}

                {/* Distribution Bar Chart */}
                {Object.keys(item.distribution).length > 0 && (
                  <div className="space-y-3 pt-2">
                    {Object.entries(item.distribution).map(([optName, rawCount]) => {
                      const count = Number(rawCount) || 0;
                      const percentage = item.totalAnswered > 0 ? Math.round((count / item.totalAnswered) * 100) : 0;
                      return (
                        <div key={optName} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-800 dark:text-slate-200">{optName}</span>
                            <span className="text-slate-500 font-mono">{count} votes ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#1F4A59] dark:bg-sky-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Text responses list */}
                {item.textResponses && item.textResponses.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Commentaires et suggestions des parents :</span>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {item.textResponses.map((txt, tIdx) => (
                        <div key={tIdx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 italic">
                          « {txt} »
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: R�PONSE PARENT / VOTE DIRECT                            */}
      {/* ========================================================================= */}
      {activeTab === 'vote_tester' && votingSurvey && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
            <span className="text-[10px] font-black text-amber-500 uppercase">R�ponse Parent</span>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">{votingSurvey.title}</h2>
            <p className="text-xs text-slate-500">{votingSurvey.description}</p>
          </div>

          <form onSubmit={handleVoteSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <label className="font-bold text-slate-500">Nom du Parent :</label>
                <input
                  type="text"
                  value={voteForm.parentName}
                  onChange={(e) => setVoteForm(prev => ({ ...prev, parentName: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 mt-1 text-slate-900 dark:text-slate-100 font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-500">Classe de l'Élève :</label>
                <input
                  type="text"
                  value={voteForm.studentClass}
                  onChange={(e) => setVoteForm(prev => ({ ...prev, studentClass: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 mt-1 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Questions to answer */}
            <div className="space-y-4">
              {votingSurvey.questions.map((q, qIdx) => (
                <div key={q.id || qIdx} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{qIdx + 1}. {q.text}</p>
                  
                  {q.type === 'single_choice' && (
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={voteForm.answers[q.id] === opt}
                            onChange={() => setVoteForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: opt } }))}
                            className="text-[#1F4A59]"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.type === 'multiple_choice' && (
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt) => {
                        const currentArr = (voteForm.answers[q.id] as string[]) || [];
                        const isChecked = currentArr.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const newArr = e.target.checked
                                  ? [...currentArr, opt]
                                  : currentArr.filter(i => i !== opt);
                                setVoteForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: newArr } }));
                              }}
                              className="text-[#1F4A59]"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'rating' && (
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setVoteForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: starVal } }))}
                          className={`p-2 rounded-lg border cursor-pointer ${
                            (Number(voteForm.answers[q.id]) || 0) >= starVal 
                              ? 'bg-amber-100 border-amber-400 text-amber-600' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'text' && (
                    <input
                      type="text"
                      placeholder="Votre avis en quelques mots..."
                      value={voteForm.answers[q.id] || ''}
                      onChange={(e) => setVoteForm(prev => ({ ...prev, answers: { ...prev.answers, [q.id]: e.target.value } }))}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmittingVote}
              className="w-full py-3 bg-[#1F4A59] hover:bg-[#285d70] text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isSubmittingVote ? 'Enregistrement en cours...' : 'Envoyer la Réponse Parent'}
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : DIFFUSION MULTICANALE (WHATSAPP / EMAIL)                          */}
      {/* ========================================================================= */}
      {broadcastModalSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden space-y-4 p-6 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Diffusion Immédiate aux Parents</h3>
              </div>
              <button
                onClick={() => setBroadcastModalSurvey(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Partagez le lien du sondage <strong>"{broadcastModalSurvey.title}"</strong> dans les groupes WhatsApp des parents ou envoyez une notification mail.
            </p>

            {/* WhatsApp Share Box */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <MessageSquare className="w-4 h-4" />
                <span>Message Prêt pour WhatsApp :</span>
              </div>
              <textarea
                readOnly
                rows={4}
                value={`🏫 *${broadcastModalSurvey.title}*\nChers parents, votre avis compte pour nous. Répondez en 1 minute ici :\n👉 ${window.location.origin}/?survey=${broadcastModalSurvey.id}`}
                className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 resize-none font-mono"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`🏫 *${broadcastModalSurvey.title}*\nChers parents, votre avis compte pour nous. Répondez en 1 minute ici :\n👉 ${window.location.origin}/?survey=${broadcastModalSurvey.id}`);
                    showToast("Message WhatsApp copié dans le presse-papier !");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-300 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le texte</span>
                </button>

                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ouvrir WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Email Broadcast Simulation */}
            <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-300 dark:border-sky-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300 font-bold text-xs">
                <Mail className="w-4 h-4" />
                <span>Diffusion par E-mail aux 154 familles enregistrées</span>
              </div>
              <button
                onClick={() => {
                  showToast("E-mail envoyé avec succès aux 154 parents d'élèves !");
                  setBroadcastModalSurvey(null);
                }}
                className="px-3 py-1.5 bg-[#1F4A59] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Envoyer par Mail
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ParentSurveysHub;


