export type HigherEducationOwnership = 'PUBLIC' | 'PRIVATE';
export type HigherEducationFieldType = 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea' | 'date';

export interface HigherEducationRequestField {
  key: string;
  label: string;
  type: HigherEducationFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

export const CONGO_DEPARTMENTS = [
  'Bouenza', 'Brazzaville', 'Cuvette', 'Cuvette-Ouest', 'Kouilou', 'Lékoumou',
  'Likouala', 'Niari', 'Plateaux', 'Pointe-Noire', 'Pool', 'Sangha',
];

const field = (
  key: string,
  label: string,
  type: HigherEducationFieldType = 'text',
  options?: string[],
  required = true,
  placeholder?: string,
  helpText?: string,
): HigherEducationRequestField => ({ key, label, type, options, required, placeholder, helpText });

export const higherEducationCommonFields: HigherEducationRequestField[] = [
  field('officialName', "Dénomination officielle du projet d'établissement", 'text', undefined, true, 'Université, institut, école supérieure…'),
  field('requestType', 'Nature de la demande', 'select', ['CREATION', 'OPENING', 'REOPENING']),
  field('promoterOrInitiator', 'Promoteur / autorité initiatrice', 'text', undefined, true, 'Personne morale, administration ou organisme initiateur'),
  field('legalRepresentative', 'Représentant légal / responsable du dossier', 'text', undefined, true),
  field('officialEmail', 'E-mail officiel de correspondance', 'email', undefined, true, 'contact@institution.cg'),
  field('phone', 'Téléphone officiel', 'tel', undefined, true, '+242 …'),
  field('department', "Département d'implantation", 'select', CONGO_DEPARTMENTS),
  field('address', 'Adresse / localisation du site', 'textarea', undefined, true),
  field('plannedCapacity', "Capacité d'accueil prévisionnelle", 'number', undefined, true, 'Nombre d’étudiants'),
  field('lmdLevels', 'Niveaux académiques prévus', 'select', ['Licence', 'Licence + Master', 'Licence + Master + Doctorat', 'BTS / DUT', 'BTS / DUT + Licence', 'Autre']),
  field('programsSummary', 'Filières / programmes prévus', 'textarea', undefined, true, 'Une filière par ligne, avec diplôme visé si possible.'),
  field('staffPlan', 'Plan prévisionnel du personnel', 'textarea', undefined, true, 'Direction, enseignants/enseignants-chercheurs, administration, technique…'),
  field('infrastructureSummary', 'Infrastructures et équipements académiques', 'textarea', undefined, true, 'Salles, laboratoires, bibliothèque, ateliers, numérique, accessibilité…'),
  field('targetOpeningDate', "Date d'ouverture envisagée", 'date', undefined, false),
];

export const higherEducationPublicFields: HigherEducationRequestField[] = [
  field('publicInterestStudy', "Référence / résumé de l'étude préalable d'utilité publique", 'textarea', undefined, true, undefined,
    "Le cadre général des établissements publics administratifs prévoit une étude préalable justifiant l'utilité, la pertinence et la viabilité du projet."),
  field('creationRationale', 'Motifs justifiant la création', 'textarea', undefined, true),
  field('missions', "Missions de service public de l'établissement", 'textarea', undefined, true),
  field('nonDuplicationAnalysis', "Analyse de non-duplication avec les établissements publics existants", 'textarea', undefined, true),
  field('technicalTutelle', 'Tutelle technique envisagée', 'text', undefined, true, 'Ministère chargé de l’enseignement supérieur'),
  field('legalActDraft', 'Référence du projet de texte de création', 'text', undefined, false, 'Projet de loi / décret / acte préparatoire'),
  field('statutesDraft', 'Référence du projet de statuts', 'text', undefined, true, 'N° de dossier, version ou date du projet de statuts'),
  field('initialEndowment', 'Dotation initiale / financement de démarrage', 'text', undefined, true),
  field('governanceModel', 'Gouvernance proposée', 'textarea', undefined, true, 'Organes de direction, attributions et modalités de fonctionnement'),
  field('budgetProjection', 'Budget et plan de financement prévisionnels', 'textarea', undefined, true),
  field('academicQualityPlan', 'Assurance qualité et organisation académique', 'textarea', undefined, true, 'Organisation LMD, évaluation, recherche, qualité…'),
];

export const higherEducationPrivateFields: HigherEducationRequestField[] = [
  field('legalForm', 'Forme juridique / personnalité morale', 'text', undefined, true, 'Société, association, fondation, autre personne morale…'),
  field('applicantProfile', 'Profil juridique du promoteur', 'select', ['Congolais', 'Ressortissant CEMAC établi au Congo', 'Autre personne morale / situation']),
  field('creationAuthorizationRef', "Référence de l'autorisation de création (si déjà obtenue)", 'text', undefined, false),
  field('openingAuthorizationRef', "Référence de l'autorisation d'ouverture / réouverture (si déjà obtenue)", 'text', undefined, false),
  field('institutionalEvaluation', "Évaluation institutionnelle ex ante", 'select', ['À solliciter', 'Dossier déposé', 'Avis favorable obtenu', 'Non applicable à cette étape']),
  field('accreditedPrograms', 'Programmes déjà accrédités / en accréditation', 'textarea', undefined, true,
    'Indiquez au moins les programmes concernés et leur état d’accréditation.',
    "La régulation de l'initiative privée dans le supérieur conditionne l'ouverture à l'évaluation institutionnelle et à l'accréditation de programmes."),
  field('siteLegalBasis', "Titre de propriété / bail du site", 'select', ['Titre de propriété', 'Bail légalisé', 'Convention de mise à disposition', 'Autre']),
  field('siteArea', 'Superficie du site (m²)', 'number', undefined, true),
  field('leaseTerm', 'Durée restante du bail (années), si applicable', 'number', undefined, false),
  field('managementExperience', "Expérience de l'équipe dirigeante dans l'enseignement / la formation", 'textarea', undefined, true,
    undefined, 'Pour les dossiers relevant du décret n° 2024-231, la qualification et l’expérience de la direction font partie des éléments contrôlés.'),
  field('financialCapacity', 'Capacité financière / garantie de fonctionnement', 'textarea', undefined, true,
    'Précisez la source de financement et les justificatifs disponibles.'),
  field('environmentalSocialCertificate', "Étude / certificat environnemental et social, si applicable", 'text', undefined, false),
  field('didacticEquipment', 'Matériels didactiques et équipements spécialisés', 'textarea', undefined, true),
  field('complianceStatement', 'Conformité aux programmes, normes d’effectifs et exigences nationales', 'textarea', undefined, true),
];

export const getHigherEducationFields = (ownership: HigherEducationOwnership) => [
  ...higherEducationCommonFields,
  ...(ownership === 'PUBLIC' ? higherEducationPublicFields : higherEducationPrivateFields),
];
