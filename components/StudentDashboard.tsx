import React from 'react';
import { GradesIcon, PaymentsIcon } from './Icons';

const StudentDashboard = ({ user, classes, setActivePage }) => {
  if (!user) {
    return <div>Chargement des informations de l'élève...</div>;
  }

  const studentClass = classes.find(c => c.name === user.class);

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Bienvenue, {user.name} !</h2>
      <p className="text-gray-600 mb-6">Ceci est votre espace personnel. Consultez vos notes et paiements ici.</p>

      <div className="bg-blue-50 border-2 border-blue-100 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800">Vos Informations Scolaires</h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <p><span className="font-medium text-gray-600">Matricule:</span> {user.studentId}</p>
          <p><span className="font-medium text-gray-600">Classe:</span> {user.class}</p>
          <p><span className="font-medium text-gray-600">Professeur Principal:</span> {studentClass?.mainTeacher || 'Non assigné'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => setActivePage('Mes Notes')}
          className="p-6 bg-green-50 border-2 border-green-200 rounded-lg text-center cursor-pointer hover:bg-green-100 hover:border-green-300 transition-all"
        >
          <div className="flex justify-center text-green-600 mb-3">
            <GradesIcon />
          </div>
          <h3 className="text-lg font-semibold text-green-800">Consulter Mes Notes</h3>
          <p className="text-sm text-green-700 mt-1">Accédez à vos résultats et à votre moyenne.</p>
        </div>
        
        <div 
          onClick={() => setActivePage('Paiements')}
          className="p-6 bg-purple-50 border-2 border-purple-200 rounded-lg text-center cursor-pointer hover:bg-purple-100 hover:border-purple-300 transition-all"
        >
          <div className="flex justify-center text-purple-600 mb-3">
            <PaymentsIcon />
          </div>
          <h3 className="text-lg font-semibold text-purple-800">Suivi des Paiements</h3>
          <p className="text-sm text-purple-700 mt-1">Consultez votre solde et l'historique de vos paiements.</p>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;