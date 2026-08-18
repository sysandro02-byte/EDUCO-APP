
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PAYMENT_COLORS } from '../constants';

interface PaymentDistributionChartCardProps {
  payments?: any[];
  currency?: string;
}

const PaymentDistributionChartCard: React.FC<PaymentDistributionChartCardProps> = ({ payments = [], currency = 'FCFA' }) => {
  const computedData = useMemo(() => {
    const distribution = {
      'Lycée': 0,
      'Collège': 0,
      'Primaire': 0,
      'Maternelle': 0,
    };

    let hasData = false;
    payments.forEach(p => {
      const className = (p.class || '').toLowerCase();
      let cycle: 'Lycée' | 'Collège' | 'Primaire' | 'Maternelle' = 'Primaire';
      
      if (className.includes('seconde') || className.includes('pa4') || className.includes('pdc') || className.includes('ta4') || className.includes('td') || className.includes('lycée')) {
        cycle = 'Lycée';
      } else if (className.includes('6ème') || className.includes('5ème') || className.includes('4ème') || className.includes('3ème') || className.includes('collège')) {
        cycle = 'Collège';
      } else if (className.includes('p2') || className.includes('garderie') || className.includes('p1') || className.includes('p3') || className.includes('maternelle')) {
        cycle = 'Maternelle';
      } else {
        cycle = 'Primaire';
      }

      distribution[cycle] += p.amountPaid || 0;
      if (p.amountPaid > 0) hasData = true;
    });

    if (!hasData) {
      // Return a nominal breakdown if no actual data has been entered yet
      return [
        { name: 'Lycée', value: 0 },
        { name: 'Collège', value: 0 },
        { name: 'Primaire', value: 0 },
        { name: 'Maternelle', value: 0 },
      ];
    }

    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [payments]);

  // Only render segments with values > 0 or show empty placeholder if all values are 0
  const isDataEmpty = computedData.every(item => item.value === 0);
  const displayData = isDataEmpty ? [{ name: 'Aucun encaissement', value: 1 }] : computedData;
  const colors = isDataEmpty ? ['#E2E8F0'] : PAYMENT_COLORS;

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-md h-full flex flex-col justify-between">
      <h4 className="font-semibold text-gray-700 text-center mb-2">Répartition des Paiements par Cycle</h4>
      <div className="flex-grow" style={{minHeight: '200px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {displayData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => isDataEmpty ? '0' : `${value.toLocaleString()} ${currency}`} />
            </PieChart>
          </ResponsiveContainer>
      </div>
       <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 mt-2">
          {displayData.map((entry, index) => (
            <div key={entry.name} className="flex items-center">
              <span className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: colors[index] }}></span>
              <span className="text-sm text-gray-600">{entry.name} {!isDataEmpty && `(${entry.value.toLocaleString()} ${currency})`}</span>
            </div>
          ))}
        </div>
    </div>
  );
};

export default PaymentDistributionChartCard;