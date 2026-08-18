import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  MessageSquare, 
  Mail, 
  Phone, 
  Settings, 
  Bell, 
  AlertCircle, 
  CheckCircle, 
  RotateCcw, 
  History, 
  FileText, 
  Plus, 
  Trash2, 
  Users, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { 
  TeacherReminderSettings, 
  TeacherNotificationLog, 
  defaultTeacherReminderSettings, 
  defaultTeacherTemplates, 
  getTeacherReminderSettings, 
  saveTeacherReminderSettings, 
  getTeacherNotificationLogs, 
  sendTeacherNotificationWithFallback 
} from '../src/services/teacherNotificationService';

interface TeacherRemindersManagementProps {
  users: any[];
  classes: any[];
  subjects: any[];
  schoolSettings?: any;
  onClose?: () => void;
}

const TeacherRemindersManagement: React.FC<TeacherRemindersManagementProps> = ({
  users,
  classes,
  subjects,
  schoolSettings,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'send' | 'channels' | 'automations' | 'templates' | 'logs'>('send');
  const [settings, setSettings] = useState<TeacherReminderSettings>(getTeacherReminderSettings());
  const [logs, setLogs] = useState<TeacherNotificationLog[]>(getTeacherNotificationLogs());
  const [templates, setTemplates] = useState(defaultTeacherTemplates);

  // Form State for Sending
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [targetClass, setTargetClass] = useState<string>('all');
  const [targetSubject, setTargetSubject] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<'Auto' | 'SMS' | 'WhatsApp' | 'Email'>('Auto');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageTitle, setMessageTitle] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);

  // Sending status state
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; fallbackCount: number } | null>(null);

  // Filter teachers from users
  const teachers = useMemo(() => {
    return users.filter(u => u.role === 'Enseignant' || u.role === 'Professeur');
  }, [users]);

  // Filtered teachers list based on class/subject filter
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      if (targetClass !== 'all' && t.class && t.class !== targetClass) return false;
      return true;
    });
  }, [teachers, targetClass]);

  // Save settings when modified
  const handleSaveSettings = (updated: TeacherReminderSettings) => {
    setSettings(updated);
    saveTeacherReminderSettings(updated);
  };

  // Load template into message form
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = templates.find(t => t.id === templateId);
    if (tpl) {
      const schoolName = schoolSettings?.name || 'EDUCO';
      let title = tpl.subject
        .replace('{matiere}', targetSubject !== 'all' ? targetSubject : 'votre discipline')
        .replace('{classe}', targetClass !== 'all' ? targetClass : 'vos classes')
        .replace('{nom_ecole}', schoolName);
      
      let body = tpl.body
        .replace('{nom_enseignant}', '{nom_enseignant}')
        .replace('{matiere}', targetSubject !== 'all' ? targetSubject : 'votre matière')
        .replace('{classe}', targetClass !== 'all' ? targetClass : 'vos classes')
        .replace('{date_limite}', new Date(dueDate).toLocaleDateString('fr-FR'))
        .replace('{nom_ecole}', schoolName);

      setMessageTitle(title);
      setMessageBody(body);
    }
  };

  // Toggle teacher selection
  const handleToggleTeacher = (teacherId: string) => {
    setSelectedTeachers(prev => 
      prev.includes(teacherId) 
        ? prev.filter(id => id !== teacherId) 
        : [...prev, teacherId]
    );
  };

  // Select all or deselect all
  const handleSelectAllTeachers = () => {
    if (selectedTeachers.length === filteredTeachers.length) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers(filteredTeachers.map(t => String(t.id || t.email)));
    }
  };

  // Dispatch notifications with automatic fallback
  const handleSendNotification = async () => {
    if (selectedTeachers.length === 0) {
      alert('Veuillez sélectionner au moins un enseignant destinataire.');
      return;
    }
    if (!messageTitle.trim() || !messageBody.trim()) {
      alert('Veuillez saisir un objet et un contenu pour le message.');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    const targetTeacherObjects = teachers.filter(t => 
      selectedTeachers.includes(String(t.id || t.email))
    );

    let sentCount = 0;
    let fallbackCount = 0;

    for (const teacher of targetTeacherObjects) {
      const schoolName = schoolSettings?.name || 'EDUCO';
      const personalizedBody = messageBody
        .replace(/{nom_enseignant}/g, teacher.name || 'Cher(e) Enseignant(e)')
        .replace(/{classe}/g, teacher.class || targetClass || 'vos classes')
        .replace(/{matiere}/g, targetSubject !== 'all' ? targetSubject : 'votre matière')
        .replace(/{date_limite}/g, new Date(dueDate).toLocaleDateString('fr-FR'))
        .replace(/{nom_ecole}/g, schoolName);

      const result = await sendTeacherNotificationWithFallback({
        teacherId: teacher.id,
        teacherName: teacher.name || 'Enseignant',
        teacherEmail: teacher.email || 'enseignant@ecole.org',
        teacherPhone: teacher.contact || teacher.phone,
        subject: targetSubject !== 'all' ? targetSubject : undefined,
        className: teacher.class || targetClass,
        channel: selectedChannel,
        title: messageTitle,
        message: personalizedBody,
        dueDate: dueDate,
      }, settings);

      if (result.success) {
        sentCount++;
        if (result.fallbackTriggered) {
          fallbackCount++;
        }
      }
    }

    setIsSending(false);
    setLogs(getTeacherNotificationLogs());

    const resultMessage = fallbackCount > 0
      ? `Envoyé avec succès à ${sentCount} enseignant(s) dont ${fallbackCount} via le repli automatique par e-mail (canaux SMS/WhatsApp non configurés).`
      : `Envoyé avec succès à ${sentCount} enseignant(s) par le canal sélectionné.`;

    setSendResult({
      success: true,
      message: resultMessage,
      fallbackCount,
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-[#1F4A59] to-[#2B6377] text-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-xs rounded-xl text-white">
              <Bell className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Système de Rappels & Notifications Enseignants</h2>
              <p className="text-white/80 text-sm">
                Envoi multi-canal (SMS, WhatsApp, Mail) avec repli automatique par e-mail géré par le Directeur des Études (DE).
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="self-start sm:self-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              Fermer
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mt-6 border-t border-white/10 pt-4">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'send'
                ? 'bg-white text-[#1F4A59] shadow-sm font-bold'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Envoi & Rappels Directs</span>
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'channels'
                ? 'bg-white text-[#1F4A59] shadow-sm font-bold'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configuration des Canaux & Repli</span>
          </button>
          <button
            onClick={() => setActiveTab('automations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'automations'
                ? 'bg-white text-[#1F4A59] shadow-sm font-bold'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Rappels Automatisés</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'templates'
                ? 'bg-white text-[#1F4A59] shadow-sm font-bold'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Modèles de Messages</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'logs'
                ? 'bg-white text-[#1F4A59] shadow-sm font-bold'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Journal des Envois ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-6">
        {/* TAB 1: SEND NOTIFICATION */}
        {activeTab === 'send' && (
          <div className="space-y-6">
            {/* Auto fallback banner notification */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <span className="font-bold">Garantie de Délivrabilité Automatique : </span>
                Si le canal SMS ou WhatsApp sélectionné n'est pas encore configuré ou est indisponible, le système bascule
                <span className="font-semibold underline ml-1">automatiquement sur l'envoi d'un e-mail</span> avec accusé de notification sans bloquer votre envoi.
              </div>
            </div>

            {sendResult && (
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                sendResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">{sendResult.message}</span>
                </div>
                <button
                  onClick={() => setSendResult(null)}
                  className="text-xs underline font-semibold"
                >
                  Masquer
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Teacher Selection & Filters */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-800 flex items-center justify-between text-sm mb-3">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      Destinataires Enseignants
                    </span>
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                      {selectedTeachers.length} / {filteredTeachers.length}
                    </span>
                  </h3>

                  {/* Filters */}
                  <div className="space-y-3 mb-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Filtrer par Classe</label>
                      <select
                        value={targetClass}
                        onChange={(e) => setTargetClass(e.target.value)}
                        className="w-full text-xs rounded-lg border-gray-300 focus:ring-[#1F4A59] focus:border-[#1F4A59]"
                      >
                        <option value="all">Toutes les classes</option>
                        {classes.map((c, i) => (
                          <option key={i} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Matière concernée</label>
                      <select
                        value={targetSubject}
                        onChange={(e) => setTargetSubject(e.target.value)}
                        className="w-full text-xs rounded-lg border-gray-300 focus:ring-[#1F4A59] focus:border-[#1F4A59]"
                      >
                        <option value="all">Toutes matières</option>
                        {subjects.map((s, i) => (
                          <option key={i} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Select All Toggle */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAllTeachers}
                      className="font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      {selectedTeachers.length === filteredTeachers.length ? 'Tout désélectionner' : 'Sélectionner tous'}
                    </button>
                    <span className="text-gray-500">{filteredTeachers.length} enseignant(s)</span>
                  </div>

                  {/* Teacher Checkbox List */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {filteredTeachers.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">Aucun enseignant trouvé pour ces critères.</p>
                    ) : (
                      filteredTeachers.map(teacher => {
                        const idStr = String(teacher.id || teacher.email);
                        const isSelected = selectedTeachers.includes(idStr);
                        return (
                          <label
                            key={idStr}
                            className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border text-xs ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-medium'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTeacher(idStr)}
                              className="mt-0.5 rounded text-[#1F4A59] focus:ring-[#1F4A59]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{teacher.name}</div>
                              <div className="text-[11px] text-gray-500 truncate flex items-center gap-2">
                                <span>{teacher.email || 'Email indisponible'}</span>
                                {teacher.contact && <span>• {teacher.contact}</span>}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Message Composer & Channel Selection */}
              <div className="lg:col-span-2 space-y-4">
                {/* Channel & Template Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Canal de diffusion souhaité
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedChannel('Auto')}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          selectedChannel === 'Auto'
                            ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Intelligent (Auto)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedChannel('WhatsApp')}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          selectedChannel === 'WhatsApp'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedChannel('SMS')}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          selectedChannel === 'SMS'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-300" />
                        <span>SMS Direct</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedChannel('Email')}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          selectedChannel === 'Email'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5 text-purple-300" />
                        <span>E-mail</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Modèle pré-rempli (Optionnel)
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleSelectTemplate(e.target.value)}
                      className="w-full text-xs rounded-lg border-gray-300 focus:ring-[#1F4A59] focus:border-[#1F4A59] p-2.5"
                    >
                      <option value="">-- Choisir un modèle de rappel --</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                      ))}
                    </select>

                    <div className="mt-3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Date d'échéance / Date limite
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-xs rounded-lg border-gray-300 focus:ring-[#1F4A59] focus:border-[#1F4A59]"
                      />
                    </div>
                  </div>
                </div>

                {/* Message Object & Body */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Objet du Message / Titre de la Notification
                    </label>
                    <input
                      type="text"
                      value={messageTitle}
                      onChange={(e) => setMessageTitle(e.target.value)}
                      placeholder="Ex: Rappel de saisie des notes trimestrielles"
                      className="w-full text-sm rounded-lg border-gray-300 focus:ring-[#1F4A59] focus:border-[#1F4A59]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Contenu du Message
                      </label>
                      <span className="text-[11px] text-gray-500">
                        Balises autorisées: {'{nom_enseignant}'}, {'{classe}'}, {'{matiere}'}, {'{date_limite}'}, {'{nom_ecole}'}
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Tapez votre message ici ou appliquez un modèle..."
                      className="w-full text-sm rounded-lg border-gray-300 focus:ring-[#1F4A59] focus:border-[#1F4A59] font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Send Button & Feedback */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Repli automatique e-mail activé par défaut.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendNotification}
                    disabled={isSending || selectedTeachers.length === 0}
                    className="w-full sm:w-auto px-6 py-3 bg-[#1F4A59] hover:bg-[#2c5a6e] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" />
                        <span>Envoi et vérification en cours...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Envoyer aux {selectedTeachers.length} Enseignant(s)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHANNELS CONFIGURATION & FALLBACK SETTINGS */}
        {activeTab === 'channels' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-bold mb-0.5">Configuration des Passerelles de Communication & Repli Automatique</p>
                <p className="text-xs text-blue-800">
                  Définissez vos clés pour les SMS et WhatsApp. Dès qu'une passerelle est inactive ou non configurée, le système de notification prend le relais en utilisant instantanément le serveur de messagerie e-mail (Fallback garanti).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* SMS Config Card */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Phone className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-gray-800">Passerelle SMS</h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.sms.enabled}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            sms: { ...settings.sms, enabled: e.target.checked }
                          };
                          handleSaveSettings(updated);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Fournisseur SMS</label>
                      <select
                        value={settings.sms.provider}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            sms: { ...settings.sms, provider: e.target.value as any }
                          };
                          handleSaveSettings(updated);
                        }}
                        className="w-full text-xs rounded-lg border-gray-300"
                      >
                        <option value="brevo">Service SMS Intégré Direct</option>
                        <option value="twilio">Twilio SMS Gateway</option>
                        <option value="infobip">Infobip API</option>
                        <option value="custom">Passerelle Locale / GSM Modem</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Clé API / Token SMS</label>
                      <input
                        type="password"
                        value={settings.sms.apiKey}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            sms: { ...settings.sms, apiKey: e.target.value }
                          };
                          handleSaveSettings(updated);
                        }}
                        placeholder="xkeysib-..."
                        className="w-full text-xs rounded-lg border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Nom d'expéditeur (Sender ID)</label>
                      <input
                        type="text"
                        value={settings.sms.senderId}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            sms: { ...settings.sms, senderId: e.target.value }
                          };
                          handleSaveSettings(updated);
                        }}
                        placeholder="EDUCO_DE"
                        className="w-full text-xs rounded-lg border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    settings.sms.enabled && settings.sms.apiKey
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {settings.sms.enabled && settings.sms.apiKey ? '● SMS Prêt & Actif' : '● SMS Inactif (Repli Mail Auto)'}
                  </span>
                </div>
              </div>

              {/* WhatsApp Config Card */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-gray-800">Passerelle WhatsApp</h4>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.whatsapp.enabled}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            whatsapp: { ...settings.whatsapp, enabled: e.target.checked }
                          };
                          handleSaveSettings(updated);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">API WhatsApp</label>
                      <select
                        value={settings.whatsapp.provider}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            whatsapp: { ...settings.whatsapp, provider: e.target.value as any }
                          };
                          handleSaveSettings(updated);
                        }}
                        className="w-full text-xs rounded-lg border-gray-300"
                      >
                        <option value="meta_cloud">Meta Cloud API (Officiel)</option>
                        <option value="twilio">Twilio WhatsApp Business</option>
                        <option value="custom">Passerelle WhatsApp Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Jeton d'accès (API Token)</label>
                      <input
                        type="password"
                        value={settings.whatsapp.apiToken}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            whatsapp: { ...settings.whatsapp, apiToken: e.target.value }
                          };
                          handleSaveSettings(updated);
                        }}
                        placeholder="EAAB..."
                        className="w-full text-xs rounded-lg border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Phone Number ID</label>
                      <input
                        type="text"
                        value={settings.whatsapp.phoneNumberId}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            whatsapp: { ...settings.whatsapp, phoneNumberId: e.target.value }
                          };
                          handleSaveSettings(updated);
                        }}
                        placeholder="100654321..."
                        className="w-full text-xs rounded-lg border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    settings.whatsapp.enabled && settings.whatsapp.apiToken
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {settings.whatsapp.enabled && settings.whatsapp.apiToken ? '● WhatsApp Prêt & Actif' : '● WhatsApp Inactif (Repli Mail Auto)'}
                  </span>
                </div>
              </div>

              {/* Email Gateway & Auto Fallback Card */}
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                        <Mail className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-purple-900">E-mail & Repli de Secours</h4>
                    </div>
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-[10px] font-bold uppercase rounded-md">
                      Principal
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 text-purple-900 font-bold mb-1">
                        <Check className="w-4 h-4 text-purple-700" />
                        <span>Repli Automatique Activé</span>
                      </div>
                      <p className="text-[11px] text-purple-700">
                        Si un SMS ou WhatsApp échoue ou n'est pas configuré, le système envoie immédiatement un courriel officiel à l'enseignant.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">E-mail d'expédition DE</label>
                      <input
                        type="email"
                        value={settings.email.fromEmail}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            email: { ...settings.email, fromEmail: e.target.value }
                          };
                          handleSaveSettings(updated);
                        }}
                        placeholder="direction-etudes@educo.school"
                        className="w-full text-xs rounded-lg border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Nom d'expéditeur affiché</label>
                      <input
                        type="text"
                        value={settings.email.fromName}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            email: { ...settings.email, fromName: e.target.value }
                          };
                          handleSaveSettings(updated);
                        }}
                        placeholder="Direction des Études - EDUCO"
                        className="w-full text-xs rounded-lg border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-purple-200">
                  <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                    Canal E-mail 100% Opérationnel
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUTOMATED TRIGGERS & RULES */}
        {activeTab === 'automations' && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Règles de Déclenchement des Rappels Automatiques
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Le système surveille les échéances et les événements académiques pour envoyer les rappels aux enseignants aux moments opportuns.
              </p>

              <div className="space-y-4">
                {/* Rule 1: Grades Reminder */}
                <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Rappel de Saisie des Notes d'Évaluation</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Envoie un rappel aux enseignants n'ayant pas finalisé leurs notes avant la date limite de fin de trimestre.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span>Déclencher à J-</span>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={settings.autoTriggers.gradesReminderDaysBefore}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            autoTriggers: { ...settings.autoTriggers, gradesReminderDaysBefore: Number(e.target.value) }
                          };
                          handleSaveSettings(updated);
                        }}
                        className="w-14 p-1 text-xs border rounded text-center"
                      />
                      <span>jours</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoTriggers.gradesSubmissionReminder}
                      onChange={(e) => {
                        const updated = {
                          ...settings,
                          autoTriggers: { ...settings.autoTriggers, gradesSubmissionReminder: e.target.checked }
                        };
                        handleSaveSettings(updated);
                      }}
                      className="rounded text-[#1F4A59] h-5 w-5"
                    />
                  </div>
                </div>

                {/* Rule 2: Attendance threshold alert */}
                <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Alerte Absences Élevées en Classe</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Alerte le professeur principal et les enseignants de la classe si le nombre d'absents dépasse le seuil défini.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span>Seuil &gt;</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={settings.autoTriggers.attendanceThresholdAbsences}
                        onChange={(e) => {
                          const updated = {
                            ...settings,
                            autoTriggers: { ...settings.autoTriggers, attendanceThresholdAbsences: Number(e.target.value) }
                          };
                          handleSaveSettings(updated);
                        }}
                        className="w-14 p-1 text-xs border rounded text-center"
                      />
                      <span>absences</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoTriggers.attendanceThresholdAlert}
                      onChange={(e) => {
                        const updated = {
                          ...settings,
                          autoTriggers: { ...settings.autoTriggers, attendanceThresholdAlert: e.target.checked }
                        };
                        handleSaveSettings(updated);
                      }}
                      className="rounded text-[#1F4A59] h-5 w-5"
                    />
                  </div>
                </div>

                {/* Rule 3: Homework diary */}
                <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Rappel Hebdomadaire Cahier de Texte Numérique</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Notification automatique chaque vendredi après-midi pour inviter à la mise à jour des activités et devoirs.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoTriggers.homeworkDiaryReminder}
                    onChange={(e) => {
                      const updated = {
                        ...settings,
                        autoTriggers: { ...settings.autoTriggers, homeworkDiaryReminder: e.target.checked }
                      };
                      handleSaveSettings(updated);
                    }}
                    className="rounded text-[#1F4A59] h-5 w-5"
                  />
                </div>

                {/* Rule 4: Class Council */}
                <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Convocations aux Conseils de Classe</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Diffusion automatisée des dates et ordres du jour des conseils aux enseignants de chaque division.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoTriggers.classCouncilMeetingReminder}
                    onChange={(e) => {
                      const updated = {
                        ...settings,
                        autoTriggers: { ...settings.autoTriggers, classCouncilMeetingReminder: e.target.checked }
                      };
                      handleSaveSettings(updated);
                    }}
                    className="rounded text-[#1F4A59] h-5 w-5"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TEMPLATES MANAGEMENT */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Modèles de Rappels & Messages Pédagogiques</h3>
                <p className="text-xs text-gray-500">Personnalisez les messages types envoyés par la Direction des Études.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newTpl = {
                    id: 'tpl_' + Date.now(),
                    name: 'Nouveau modèle personnalisé',
                    category: 'Général',
                    subject: 'Information importante - {nom_ecole}',
                    body: 'Bonjour {nom_enseignant},\n\n[Votre message ici]\n\nDirection des Études - {nom_ecole}',
                  };
                  setTemplates(prev => [newTpl, ...prev]);
                }}
                className="px-3.5 py-2 bg-[#1F4A59] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-[#2B6377]"
              >
                <Plus className="w-4 h-4" />
                <span>Créer un modèle</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl, idx) => (
                <div key={tpl.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                      {tpl.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTemplates(prev => prev.filter(t => t.id !== t.id))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom du modèle</label>
                    <input
                      type="text"
                      value={tpl.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, name: val } : t));
                      }}
                      className="w-full text-xs rounded-lg border-gray-300 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Objet par défaut</label>
                    <input
                      type="text"
                      value={tpl.subject}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, subject: val } : t));
                      }}
                      className="w-full text-xs rounded-lg border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Corps du texte</label>
                    <textarea
                      rows={4}
                      value={tpl.body}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, body: val } : t));
                      }}
                      className="w-full text-xs rounded-lg border-gray-300 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: LOGS & HISTORY */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Journal & Historique des Notifications</h3>
                <p className="text-xs text-gray-500">Traçabilité complète des envois et replis automatiques par e-mail.</p>
              </div>
              <button
                type="button"
                onClick={() => setLogs(getTeacherNotificationLogs())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Actualiser le journal</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <History className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="font-semibold text-sm">Aucune notification envoyée pour le moment.</p>
                <p className="text-xs mt-1">Les messages et rappels envoyés apparaîtront ici avec leur statut de délivrabilité.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 border-b border-gray-200">
                      <th className="p-3 font-bold">Date & Heure</th>
                      <th className="p-3 font-bold">Enseignant</th>
                      <th className="p-3 font-bold">Canal Demandé</th>
                      <th className="p-3 font-bold">Canal Réel Utilisé</th>
                      <th className="p-3 font-bold">Objet / Message</th>
                      <th className="p-3 font-bold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-3 whitespace-nowrap text-gray-500">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-800">{log.teacherName}</div>
                          <div className="text-[11px] text-gray-500">{log.teacherEmail}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                            {log.requestedChannel}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            log.actualChannel === 'SMS'
                              ? 'bg-blue-100 text-blue-800'
                              : log.actualChannel === 'WhatsApp'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.actualChannel === 'Email (Repli automatique)'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {log.actualChannel}
                          </span>
                          {log.reason && (
                            <div className="text-[10px] text-amber-700 mt-0.5 font-medium">{log.reason}</div>
                          )}
                        </td>
                        <td className="p-3 max-w-xs truncate">
                          <div className="font-medium text-gray-800 truncate">{log.title}</div>
                          <div className="text-gray-500 truncate">{log.message}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] flex items-center gap-1 w-max ${
                            log.status === 'Envoyé'
                              ? 'bg-green-100 text-green-800'
                              : log.status === 'Repli Email effectué'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            <CheckCircle className="w-3 h-3" />
                            <span>{log.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherRemindersManagement;
