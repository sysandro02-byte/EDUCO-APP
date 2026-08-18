import React from 'react';
import { Transaction } from '../App';
import { CheckCircleIcon, XCircleIcon } from './Icons';
import { ShieldAlert, ShieldCheck, Clock } from 'lucide-react';

interface OperationsValidationPageProps {
  transactions: Transaction[];
  onUpdateStatus: (transactionId: string, status: 'Approuvé' | 'Rejeté') => void;
  currentUserRole?: string;
  schoolSettings?: any;
}

const OperationsValidationPage: React.FC<OperationsValidationPageProps> = ({ 
  transactions, 
  onUpdateStatus, 
  currentUserRole,
  schoolSettings 
}) => {
  const pendingTransactions = transactions.filter(t => t.status === 'En attente');
  const validatedTransactions = transactions.filter(t => t.status === 'Approuvé' || t.status === 'Rejeté').slice(0, 10);
  const canValidate = currentUserRole === 'Responsable des finances' || currentUserRole === 'Promoteur' || currentUserRole === 'Admin';
  const currency = schoolSettings?.currency || 'FCFA';

  return (
    <div className="space-y-6">
      {!canValidate && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 text-sm">Mode Consultation - Accès restreint</h4>
            <p className="text-amber-800 text-xs mt-1">
              En tant que <strong>{currentUserRole}</strong>, vous pouvez consulter la liste des opérations. 
              <strong> Seuls le Responsable Administratif et Financier (RAF) et le Directeur Général (DG / Promoteur)</strong> ont l'autorisation légitime d'approuver ou rejeter les opérations financières.
            </p>
          </div>
        </div>
      )}

      {canValidate && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-bold text-emerald-900 text-sm">Espace d'Approbation RAF & DG</h4>
              <p className="text-emerald-700 text-xs mt-0.5">
                Vous êtes connecté en tant que <strong>{currentUserRole}</strong>. Vous pouvez valider ou rejeter les opérations de la caisse. Tout accord génère une notification au RAF, au DG et à la Caisse.
              </p>
            </div>
          </div>
          <span className="bg-emerald-200 text-emerald-900 font-bold px-3 py-1 rounded-full text-xs">
            {pendingTransactions.length} en attente
          </span>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Opérations à Valider</h2>
          <span className="text-xs text-gray-500">
            {pendingTransactions.length} transaction{pendingTransactions.length > 1 ? 's' : ''} en attente
          </span>
        </div>

        {pendingTransactions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
            <CheckCircleIcon className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-600 font-semibold text-sm">Toutes les opérations ont été traitées.</p>
            <p className="text-gray-400 text-xs mt-1">Aucune transaction en attente de validation par le RAF.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type / Catégorie</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut / Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="font-bold text-slate-800">{t.description}</div>
                      {t.paymentMethod && (
                        <div className="text-[11px] text-slate-500 font-normal mt-1 flex flex-wrap gap-1.5">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border text-[10px] font-semibold">
                            💳 {t.paymentMethod}
                          </span>
                          {(t as any).mobileOperator && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 text-[10px]">
                              📱 {(t as any).mobileOperator}: {t.mobileMoneyNumber}
                            </span>
                          )}
                          {(t as any).mobileTxRef && (
                            <span className="bg-indigo-50/70 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100/60 font-mono text-[9px]">
                              Réf: {(t as any).mobileTxRef}
                            </span>
                          )}
                          {(t as any).bankName && (
                            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 text-[10px]">
                              🏦 Banque: {(t as any).bankName}
                            </span>
                          )}
                          {(t as any).virementReference && (
                            <span className="bg-emerald-50/70 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100/60 font-mono text-[9px]">
                              Ref Virement: {(t as any).virementReference}
                            </span>
                          )}
                          {(t as any).chequeNumber && (
                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-mono text-[9px]">
                              Chèque N°: {(t as any).chequeNumber} {(t as any).issuingBank ? `(${ (t as any).issuingBank })` : ''}
                            </span>
                          )}
                          {t.notes && (
                            <span className="text-slate-400 italic font-light block w-full mt-1">
                              Note: {t.notes}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'Revenu' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {t.type}
                        </span>
                        {t.category && <span className="text-xs text-gray-500">({t.category})</span>}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${t.type === 'Revenu' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'Revenu' ? '+' : '-'} {t.amount.toLocaleString()} {currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {canValidate ? (
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => onUpdateStatus(t.id, 'Approuvé')} 
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold shadow-sm transition-colors" 
                            title="Approuver l'opération"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>Valider</span>
                          </button>
                          <button 
                            onClick={() => onUpdateStatus(t.id, 'Rejeté')} 
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-xs font-semibold shadow-sm transition-colors" 
                            title="Rejeter l'opération"
                          >
                            <XCircleIcon className="w-4 h-4" />
                            <span>Rejeter</span>
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>En attente de validation par le RAF</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History of validated transactions with Approver info */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Historique Récent des Validations (Auteur de l'approbation)</h3>
        {validatedTransactions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucune validation récente enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500 uppercase">Approuvé / Validé Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {validatedTransactions.map((vt) => (
                  <tr key={vt.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(vt.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{vt.description}</div>
                      {vt.paymentMethod && (
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 flex flex-wrap gap-1">
                          <span className="bg-slate-50 text-slate-600 px-1 py-0.2 rounded border text-[9px]">
                            {vt.paymentMethod}
                          </span>
                          {(vt as any).mobileOperator && (
                            <span className="bg-indigo-50/50 text-indigo-700 px-1 py-0.2 rounded border border-indigo-100/40 text-[9px]">
                              📱 {(vt as any).mobileOperator}
                            </span>
                          )}
                          {(vt as any).bankName && (
                            <span className="bg-emerald-50/50 text-emerald-700 px-1 py-0.2 rounded border border-emerald-100/40 text-[9px]">
                              🏦 {(vt as any).bankName}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">{vt.amount.toLocaleString()} {currency}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${vt.status === 'Approuvé' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {vt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">
                      {vt.approvedBy || (vt.status === 'Approuvé' ? 'Direction / RAF' : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationsValidationPage;