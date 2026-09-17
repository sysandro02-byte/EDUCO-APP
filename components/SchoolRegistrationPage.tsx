import React from 'react';
import SchoolEstablishmentRegistrationModal from './SchoolEstablishmentRegistrationModal';

interface SchoolRegistrationPageProps {
  onBackToLogin: () => void;
}

/**
 * Point d'entrée historique conservé pour compatibilité avec LoginPage.
 * Le dossier d'inscription unique exige désormais explicitement le statut
 * PUBLIC/PRIVATE et utilise le même parcours sécurisé quel que soit le bouton
 * depuis lequel le promoteur ou responsable ouvre le formulaire.
 */
const SchoolRegistrationPage: React.FC<SchoolRegistrationPageProps> = ({ onBackToLogin }) => (
  <SchoolEstablishmentRegistrationModal onClose={onBackToLogin} />
);

export default SchoolRegistrationPage;
