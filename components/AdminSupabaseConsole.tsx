import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code,
  Database,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Table,
} from 'lucide-react';
import { checkDbConnection, requestSchoolApi } from '../src/services/api';

interface AdminSupabaseConsoleProps {
  onNavigate?: (page: string) => void;
}

type Tab = 'tables' | 'sql' | 'status';

const availableTables = [
  { name: 'users', label: 'Utilisateurs' },
  { name: 'schools', label: 'Établissements' },
  { name: 'classes', label: 'Classes' },
  { name: 'students', label: 'Élèves' },
  { name: 'payments', label: 'Paiements' },
  { name: 'transactions', label: 'Transactions' },
  { name: 'attendance', label: 'Présences' },
  { name: 'grades', label: 'Notes' },
  { name: 'subscriptions', label: 'Licences' },
  { name: 'personnel', label: 'Personnel' },
  { name: 'activity_logs', label: 'Journal d’activité' },
];

export const AdminSupabaseConsole: React.FC<AdminSupabaseConsoleProps> = () => {
  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const [selectedTable, setSelectedTable] = useState('users');
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableCount, setTableCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 20;');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const runReadOnlyQuery = async (query: string) => {
    const trimmed = query.trim();
    if (!/^select\b/i.test(trimmed)) {
      throw new Error('La console EDUCO autorise uniquement les requêtes SELECT en lecture seule.');
    }
    return requestSchoolApi('/api/db/query', { query: trimmed }, 'POST');
  };

  const loadTable = async (table: string) => {
    setLoading(true);
    setSqlError(null);
    try {
      const result = await runReadOnlyQuery(`SELECT * FROM ${table} LIMIT 50;`);
      setTableData(Array.isArray(result?.rows) ? result.rows : []);
      setTableCount(Number(result?.rowCount ?? result?.rows?.length ?? 0));
    } catch (error: any) {
      setTableData([]);
      setTableCount(0);
      setSqlError(error?.message || 'Lecture de la table impossible.');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      setConnection(await checkDbConnection());
    } catch (error: any) {
      setConnection({ connected: false, message: error?.message || 'Connexion impossible.' });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    void loadTable(selectedTable);
  }, [selectedTable]);

  useEffect(() => {
    void testConnection();
  }, []);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tableData;
    return tableData.filter((row) => Object.values(row || {}).some((value) =>
      String(value ?? '').toLowerCase().includes(query)
    ));
  }, [tableData, searchQuery]);

  const columns = useMemo(() => {
    if (!filteredRows.length) return [];
    return Object.keys(filteredRows[0]).slice(0, 10);
  }, [filteredRows]);

  const executeSql = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setSqlError(null);
    setSqlResult(null);
    const startedAt = performance.now();
    try {
      const result = await runReadOnlyQuery(sqlQuery);
      setSqlResult({ ...result, executionMs: Math.round(performance.now() - startedAt) });
    } catch (error: any) {
      setSqlError(error?.message || 'Requête impossible.');
    } finally {
      setLoading(false);
    }
  };

  const renderRows = (rows: any[], cols: string[]) => {
    if (loading) {
      return (
        <div className="py-14 text-center text-slate-500">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold">Lecture sécurisée via le serveur EDUCO…</p>
        </div>
      );
    }
    if (!rows.length) {
      return <div className="py-12 text-center text-xs text-slate-500">Aucune donnée à afficher.</div>;
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
            <tr>{cols.map((col) => <th key={col} className="px-3 py-2.5 font-black font-mono">{col}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, index) => (
              <tr key={row?.id ?? index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {cols.map((col) => (
                  <td key={col} className="px-3 py-2.5 max-w-72 truncate font-mono text-slate-700 dark:text-slate-200">
                    {typeof row?.[col] === 'object' && row?.[col] !== null
                      ? JSON.stringify(row[col])
                      : String(row?.[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="rounded-3xl bg-gradient-to-r from-slate-950 via-[#1F4A59] to-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Accès serveur sécurisé
            </div>
            <h1 className="text-xl font-black">Console Base de Données EDUCO</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-300">
              Les tables sont consultées via l’API EDUCO avec contrôle Admin/Co-admin. La clé de maintenance Supabase n’est jamais transmise au navigateur.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-black hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} /> Vérifier la connexion
          </button>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-slate-800">
        {([
          ['tables', 'Tables', Table],
          ['sql', 'Lecture SQL', Code],
          ['status', 'État', Database],
        ] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black ${activeTab === tab ? 'bg-[#1F4A59] text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {sqlError && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {sqlError}
        </div>
      )}

      {activeTab === 'tables' && (
        <div className="grid gap-5 lg:grid-cols-4">
          <aside className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            {availableTables.map((table) => (
              <button
                key={table.name}
                type="button"
                onClick={() => setSelectedTable(table.name)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold ${selectedTable === table.name ? 'bg-[#1F4A59] text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                {table.label}
              </button>
            ))}
          </aside>

          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black text-slate-900 dark:text-white">Table : <code>{selectedTable}</code></h2>
                <p className="text-[11px] text-slate-500">{tableCount} enregistrement(s) trouvés • aperçu limité à 50 lignes</p>
              </div>
              <label className="relative block w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Filtrer l’aperçu…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#1F4A59] dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
            {renderRows(filteredRows, columns)}
          </section>
        </div>
      )}

      {activeTab === 'sql' && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            <strong>Mode lecture seule :</strong> le serveur accepte uniquement <code>SELECT … FROM table … LIMIT n</code> sur une liste de tables autorisées.
          </div>
          <form onSubmit={executeSql} className="space-y-3">
            <textarea
              value={sqlQuery}
              onChange={(event) => setSqlQuery(event.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-xs text-emerald-300 outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1F4A59] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Exécuter la lecture
            </button>
          </form>
          {sqlResult && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500">
                {sqlResult.rowCount ?? sqlResult.rows?.length ?? 0} ligne(s) • {sqlResult.executionMs} ms • source {sqlResult.source || 'serveur'}
              </p>
              {renderRows(sqlResult.rows || [], Object.keys(sqlResult.rows?.[0] || {}).slice(0, 10))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'status' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            {connection?.connected
              ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
              : <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />}
            <div>
              <h2 className="font-black text-slate-900 dark:text-white">
                {connection?.connected ? 'Base de données connectée' : 'Connexion non confirmée'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{connection?.message || 'Diagnostic en attente.'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Stat label="Utilisateurs" value={connection?.recordCount} />
                <Stat label="Établissements" value={connection?.schoolsCount} />
                <Stat label="Personnel" value={connection?.personnelCount} />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value?: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{Number(value || 0)}</p>
  </div>
);

export default AdminSupabaseConsole;
