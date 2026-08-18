import React, { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, TrendingUp, ChevronDown, ChevronUp, ArrowRight, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { Transaction } from '../App';

export interface BudgetCategory {
  name: string;
  amount: number;
}

export interface BudgetData {
  total: number;
  categories?: BudgetCategory[];
}

interface BudgetCategoryAlertsProps {
  budget?: BudgetData | null;
  transactions: Transaction[];
  currency?: string;
  onNavigateToReports?: () => void;
  onNavigateToAccounting?: () => void;
  onAdjustBudget?: () => void;
  roleTitle?: string;
  compact?: boolean;
}

export interface CategoryAlertInfo {
  name: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
  isOverrun: boolean; // >= 100%
  isWarning: boolean; // >= 90% and < 100%
}

export const useBudgetCategoryAlerts = (budget: BudgetData | null | undefined, transactions: Transaction[]) => {
  return useMemo(() => {
    const categories: BudgetCategory[] = budget?.categories || [
      { name: 'Salaires', amount: 200000 },
      { name: 'Fournitures', amount: 25000 },
      { name: 'Maintenance', amount: 30000 },
      { name: 'Factures', amount: 45000 },
      { name: 'Marketing', amount: 10000 },
      { name: 'Autres', amount: 40000 },
    ];

    const approvedExpenses = transactions.filter(
      t => t.type === 'Dépense' && t.status === 'Approuvé'
    );

    const spendingByCategory: { [key: string]: number } = {};
    approvedExpenses.forEach(t => {
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + t.amount;
    });

    const analyzedCategories: CategoryAlertInfo[] = categories.map(cat => {
      const spent = spendingByCategory[cat.name] || 0;
      const budgetAmount = cat.amount || 1;
      const percentage = (spent / budgetAmount) * 100;
      const remaining = cat.amount - spent;
      return {
        name: cat.name,
        budget: cat.amount,
        spent,
        remaining,
        percentage,
        isOverrun: percentage >= 100,
        isWarning: percentage >= 90 && percentage < 100,
      };
    });

    const alertCategories = analyzedCategories.filter(c => c.percentage >= 90);
    const criticalOverruns = alertCategories.filter(c => c.isOverrun);
    const warningAlerts = alertCategories.filter(c => c.isWarning);

    return {
      allCategories: analyzedCategories,
      alertCategories,
      criticalOverruns,
      warningAlerts,
      hasAlerts: alertCategories.length > 0,
      totalSpent: approvedExpenses.reduce((sum, t) => sum + t.amount, 0),
      totalBudget: budget?.total || categories.reduce((sum, c) => sum + c.amount, 0),
    };
  }, [budget, transactions]);
};

export const BudgetCategoryAlerts: React.FC<BudgetCategoryAlertsProps> = ({
  budget,
  transactions,
  currency = '€',
  onNavigateToReports,
  onNavigateToAccounting,
  onAdjustBudget,
  roleTitle,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { alertCategories, criticalOverruns, warningAlerts, hasAlerts } = useBudgetCategoryAlerts(budget, transactions);

  if (!hasAlerts) {
    if (compact) return null;
    return (
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 mb-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-900">
              Contrôle Budgétaire Optimal
            </h4>
            <p className="text-xs text-emerald-700">
              Toutes les catégories de dépenses sont sous le seuil de vigilance (inférieures à 90% du budget alloué).
            </p>
          </div>
        </div>
        {onNavigateToReports && (
          <button
            onClick={onNavigateToReports}
            className="text-xs font-medium text-emerald-800 hover:text-emerald-950 flex items-center gap-1 underline"
          >
            Voir les analyses
          </button>
        )}
      </div>
    );
  }

  const hasCritical = criticalOverruns.length > 0;

  return (
    <div
      className={`rounded-2xl mb-6 border transition-all duration-300 shadow-md overflow-hidden ${
        hasCritical
          ? 'bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-red-300 shadow-red-100'
          : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-amber-300 shadow-amber-100'
      }`}
    >
      {/* Header Banner */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-black/5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              hasCritical ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-white'
            }`}
          >
            {hasCritical ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  hasCritical ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                {hasCritical ? '🚨 Dépassement Budgétaire Critique' : '⚠️ Alerte Seuil Budgétaire (≥ 90%)'}
              </span>
              {roleTitle && (
                <span className="text-xs text-gray-500 font-medium">
                  • Vue {roleTitle}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
              {alertCategories.length === 1
                ? `Poste budgétaire sous tension critique (${alertCategories[0].name})`
                : `${alertCategories.length} catégories budgétaires ont atteint le seuil d'alerte (≥ 90%)`}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {hasCritical
                ? `${criticalOverruns.length} catégorie(s) ont excédé leur budget alloué et ${warningAlerts.length} approchent de l'épuisement.`
                : `Vigilance requise : les dépenses ont consommé plus de 90% des fonds alloués pour ces postes.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {onAdjustBudget && (
            <button
              onClick={onAdjustBudget}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Ajuster le budget
            </button>
          )}
          {onNavigateToReports && (
            <button
              onClick={onNavigateToReports}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm text-white flex items-center gap-1 transition-colors ${
                hasCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <span>Voir le rapport</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-black/5 transition-colors"
            title={isExpanded ? 'Réduire' : 'Développer'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Categories Cards List */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-white/60 backdrop-blur-xs grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {alertCategories.map(cat => {
            const isOverrun = cat.isOverrun;
            const progressWidth = Math.min(cat.percentage, 100);

            return (
              <div
                key={cat.name}
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isOverrun
                    ? 'bg-red-50/90 border-red-200 hover:border-red-300'
                    : 'bg-amber-50/90 border-amber-200 hover:border-amber-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isOverrun ? 'bg-red-600 animate-ping' : 'bg-amber-500'
                      }`}
                    />
                    <h4 className="font-bold text-sm text-gray-900">{cat.name}</h4>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isOverrun
                        ? 'bg-red-200/80 text-red-900 font-mono'
                        : 'bg-amber-200/80 text-amber-900 font-mono'
                    }`}
                  >
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200/80 h-2.5 rounded-full overflow-hidden mb-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverrun
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : 'bg-gradient-to-r from-amber-400 to-orange-500'
                    }`}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>

                <div className="flex justify-between items-baseline text-xs">
                  <div className="text-gray-600">
                    <span className="font-semibold text-gray-800">
                      {cat.spent.toLocaleString()} {currency}
                    </span>{' '}
                    / {cat.budget.toLocaleString()} {currency}
                  </div>
                  <div className="text-right">
                    {isOverrun ? (
                      <span className="text-red-700 font-semibold">
                        Dépassement : +{Math.abs(cat.remaining).toLocaleString()} {currency}
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium">
                        Reste : {cat.remaining.toLocaleString()} {currency}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BudgetCategoryAlerts;
