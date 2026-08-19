import React, { useState, useEffect } from 'react';
import { supabase, testSupabaseConnection, getStoredSupabaseConfig, getSupabaseClient, resetSupabaseClient, generateSupabaseSetupSQL, isValidSupabaseUrl } from '../src/lib/supabase';
import { Database, ShieldCheck, Key, Play, RefreshCw, CheckCircle2, AlertTriangle, X, Layers, Code, Copy, Check } from 'lucide-react';

interface SupabaseTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseTesterModal: React.FC<SupabaseTesterModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'test' | 'raw' | 'sql'>('test');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customTable, setCustomTable] = useState('users');
  const [rawQueryResult, setRawQueryResult] = useState<any>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Config state
  const config = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(config.url);
  const [supabaseKey, setSupabaseKey] = useState(config.key);
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const c = getStoredSupabaseConfig();
      setSupabaseUrl(c.url);
      setSupabaseKey(c.key);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (supabaseUrl && !isValidSupabaseUrl(supabaseUrl)) {
      alert("⚠️ L'URL Supabase est invalide (doit commencer par http:// ou https://). L'URL par défaut sera utilisée.");
    }
    resetSupabaseClient(supabaseUrl, supabaseKey);
    const updated = getStoredSupabaseConfig();
    setSupabaseUrl(updated.url);
    setSupabaseKey(updated.key);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  };

  const runAuthSessionTest = async () => {
    setLoading(true);
    try {
      const res = await testSupabaseConnection();
      const client = getSupabaseClient();
      const sessionRes = await client.auth.getSession().catch((err: any) => ({
        data: { session: null },
        error: { message: err?.message || 'Failed to fetch' }
      }));
      const sessionData = sessionRes?.data;
      const sessionErr = sessionRes?.error;
      const { data: usersData, error: usersErr } = await client.from('users').select('*').limit(10);
      const { data: schoolsData, error: schoolsErr } = await client.from('schools').select('*').limit(10);

      setTestResult({
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        urlUsed: supabaseUrl,
        getSession: {
          session: sessionData?.session ? { user: sessionData.session.user.email, expires_at: sessionData.session.expires_at } : null,
          hasSession: !!sessionData?.session,
          error: sessionErr?.message || null,
        },
        selectUsers: {
          count: usersData?.length || 0,
          data: usersData,
          error: usersErr?.message || (usersData?.length === 0 ? 'Table vide ou inexistante' : null),
        },
        selectSchools: {
          count: schoolsData?.length || 0,
          data: schoolsData,
          error: schoolsErr?.message || (schoolsData?.length === 0 ? 'Table vide ou inexistante' : null),
        }
      });
    } catch (err: any) {
      setTestResult({ error: err?.message || 'Erreur lors du test' });
    } finally {
      setLoading(false);
    }
  };

  const runCustomSelect = async () => {
    setLoading(true);
    try {
      const client = getSupabaseClient();
      const { data, error, count } = await client
        .from(customTable)
        .select('*', { count: 'exact' });

      setRawQueryResult({
        table: customTable,
        count: count ?? data?.length ?? 0,
        data,
        error: error?.message || null,
        timestamp: new Date().toLocaleTimeString('fr-FR'),
      });
    } catch (err: any) {
      setRawQueryResult({
        table: customTable,
        error: err?.message || 'Erreur requête SELECT',
      });
    } finally {
      setLoading(false);
    }
  };


  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(generateSupabaseSetupSQL());
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-fade-slide-up">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                Diagnostic & Console Supabase Avancée
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  Postgres + REST
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Configurez vos clés Supabase, testez <code className="text-emerald-300 font-mono">auth.getSession()</code>, créez les tables et peuplez les données.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Config Bar */}
        <form onSubmit={handleSaveConfig} className="bg-slate-950/60 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold shrink-0">
            <Key className="w-4 h-4 text-emerald-400" />
            <span>URL Projet Supabase :</span>
          </div>
          <input
            type="text"
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            placeholder="https://votre-projet.supabase.co"
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs flex-1 min-w-[260px] focus:outline-none focus:border-emerald-500"
          />
          <div className="flex items-center gap-1.5 text-slate-400 font-bold shrink-0">
            <span>Anon Key :</span>
          </div>
          <input
            type="password"
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
            placeholder="eyJhbGciOi..."
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs w-44 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer transition-all shadow-sm flex items-center gap-1.5"
          >
            {configSaved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{configSaved ? 'Enregistré !' : 'Appliquer & Connecter'}</span>
          </button>
        </form>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('test')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'test'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            1) Test Auth & Tables
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'sql'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-blue-400" />
            2) Script SQL & Création Tables
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'raw'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            4) Inspecteur de Table
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: TEST */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm">Tester la connexion Supabase et les requêtes SELECT</h4>
                  <p className="text-slate-400 mt-0.5">
                    Vérifie <code className="text-emerald-300 font-mono">supabase.auth.getSession()</code> et tente de récupérer les tables <code className="text-emerald-300 font-mono">users</code> & <code className="text-emerald-300 font-mono">schools</code>.
                  </p>
                </div>
                <button
                  onClick={runAuthSessionTest}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Test en cours...' : 'Lancer le diagnostic'}</span>
                </button>
              </div>

              {testResult && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Diagnostic effectué à {testResult.timestamp} sur <code className="text-emerald-300">{testResult.urlUsed}</code></span>
                    <span className="text-emerald-400 font-mono font-bold">Connecté</span>
                  </div>

                  {/* Session Card */}
                  <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-400 text-xs">supabase.auth.getSession()</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${testResult.getSession?.hasSession ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-300'}`}>
                        {testResult.getSession?.hasSession ? 'Session Active' : 'Aucune session active (Anonyme)'}
                      </span>
                    </div>
                    <pre className="p-3 bg-slate-900 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      {JSON.stringify(testResult.getSession, null, 2)}
                    </pre>
                  </div>

                  {/* SELECT users */}
                  <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-teal-400 text-xs">supabase.from('users').select('*')</span>
                      <span className="text-slate-400">
                        Total trouvé: <strong className="text-white font-bold">{testResult.selectUsers?.count ?? 0}</strong> ligne(s)
                      </span>
                    </div>
                    {testResult.selectUsers?.error ? (
                      <div className="p-3 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded-lg font-mono space-y-1">
                        <p className="font-bold">⚠️ Attention : {testResult.selectUsers.error}</p>
                        <p className="text-[11px] text-amber-200/80">
                          Si la table n'existe pas ou si RLS est actif, rendez-vous dans l'onglet <strong>« 2) Script SQL »</strong> pour créer vos tables dans Supabase.
                        </p>
                      </div>
                    ) : (
                      <pre className="p-3 bg-slate-900 rounded-lg text-emerald-300 font-mono text-[11px] max-h-40 overflow-y-auto border border-slate-800">
                        {JSON.stringify(testResult.selectUsers?.data, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* SELECT schools */}
                  <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400 text-xs">supabase.from('schools').select('*')</span>
                      <span className="text-slate-400">
                        Total trouvé: <strong className="text-white font-bold">{testResult.selectSchools?.count ?? 0}</strong> ligne(s)
                      </span>
                    </div>
                    {testResult.selectSchools?.error ? (
                      <div className="p-3 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded-lg font-mono space-y-1">
                        <p className="font-bold">⚠️ Attention : {testResult.selectSchools.error}</p>
                      </div>
                    ) : (
                      <pre className="p-3 bg-slate-900 rounded-lg text-emerald-300 font-mono text-[11px] max-h-40 overflow-y-auto border border-slate-800">
                        {JSON.stringify(testResult.selectSchools?.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SQL SETUP */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-950/80 to-slate-900 rounded-xl border border-blue-500/30 space-y-2">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Code className="w-4 h-4 text-blue-400" />
                  Étape indispensable si votre base Supabase est vide
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Supabase nécessite que les tables soient créées dans son schéma <code className="text-emerald-300 font-mono">public</code> et que RLS n'empêche pas l'accès. Copiez le script ci-dessous, allez dans votre tableau de bord Supabase ➔ <strong>SQL Editor</strong> ➔ <strong>New Query</strong>, collez et exécutez (Run).
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={copySqlToClipboard}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSql ? 'Copié dans le presse-papier !' : 'Copier le Script SQL'}</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-950 rounded-xl text-emerald-300 font-mono text-[11px] max-h-80 overflow-y-auto border border-slate-800 select-all">
                  {generateSupabaseSetupSQL()}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: RAW SELECT */}
          {activeTab === 'raw' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <label className="font-bold text-slate-300 text-xs block">
                  Choisir la table Supabase à inspecter (SELECT * FROM table) :
                </label>
                <div className="flex gap-2">
                  <select
                    value={customTable}
                    onChange={(e) => setCustomTable(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-mono flex-1 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="schools">schools</option>
                    <option value="users">users</option>
                    <option value="classes">classes</option>
                    <option value="personnel">personnel</option>
                    <option value="students">students</option>
                    <option value="fees">fees</option>
                    <option value="transactions">transactions</option>
                    <option value="subscriptions">subscriptions</option>
                    <option value="subjects">subjects</option>
                  </select>
                  <button
                    onClick={runCustomSelect}
                    disabled={loading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Exécuter SELECT</span>
                  </button>
                </div>
              </div>

              {rawQueryResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-mono text-xs">
                    <span>Table: <strong className="text-emerald-400">{rawQueryResult.table}</strong></span>
                    <span>Lignes trouvées: <strong className="text-emerald-400">{rawQueryResult.count}</strong></span>
                  </div>
                  <pre className="p-4 bg-slate-950 rounded-xl text-emerald-300 font-mono text-[11px] max-h-80 overflow-y-auto border border-slate-800">
                    {JSON.stringify(rawQueryResult.data || rawQueryResult.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Supabase Client connectée
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

