import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { studentsPerClassData } from '../constants';

const StudentsPerClassChart: React.FC = () => {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-full">
      <h4 className="font-semibold text-gray-700 mb-2">Number of Students per Class</h4>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={studentsPerClassData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={80} 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false}
              interval={0}
            />
            <Tooltip 
              cursor={{ fill: '#f3f4f6' }}
              formatter={(value: number) => `${value} students`}
            />
            <Bar dataKey="students" fill="#1F4A59" barSize={10} radius={[0, 10, 10, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StudentsPerClassChart;