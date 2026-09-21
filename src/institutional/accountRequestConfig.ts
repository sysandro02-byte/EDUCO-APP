import type { InstitutionAccessContext, MinistryCode } from './accessConfig';

export type InstitutionalAccountFieldType = 'text' | 'email' | 'tel' | 'select' | 'textarea';

export interface InstitutionalAccountField {
  key: string;
  label: string;
  type: InstitutionalAccountFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

export interface InstitutionalAccountRequestConfig {
  title: string;
  description: string;
  fields: InstitutionalAccountField[];
}

const CONGO_DEPARTMENTS = [
  'Bouenza',
  'Brazzaville',
  'Cuvette',
  'Cuvette-Ouest',
  'Kouilou',
  'Lékoumou',
  'Likouala',
  'Niari',
  'Plateaux',
  'Pointe-Noire',
  'Pool',
  'Sangha',
];

const baseFields: InstitutionalAccountField[] = [
  {
    key: 'fullName',
    label: 'Nom et prénom(s)',
    type: 'text',
    required: true,
    placeholder: 'Nom complet de l’agent',
  },
  {
    key: 'officialEmail',
    label: 'Adresse e-mail professionnelle',
    type: 'email',
    required: true,
    placeholder: 'prenom.nom@institution.cg',
    helpText: 'Utilisez de préférence l’adresse professionnelle communiquée par votre administration.',
  },
  {
    key: 'phone',
    label: 'Téléphone professionnel',
    type: 'tel',
    required: true,
    placeholder: '+242 …',
  },
  {
    key: 'employeeNumber',
    label: 'Matricule agent / identifiant administratif',
    type: 'text',
    required: true,
    placeholder: 'Matricule ou identifiant interne',
    helpText: 'Cet identifiant sert à rapprocher la demande du registre administratif de l’entité.',
  },
  {
    key: 'functionTitle',
    label: 'Fonction officielle',
    type: 'text',
    required: true,
    placeholder: 'Ex. directeur, chef de service, inspecteur, chargé d’études…',
  },
  {
    key: 'serviceUnit',
    label: 'Direction / service / bureau',
    type: 'text',
    required: true,
    placeholder: 'Unité administrative de rattachement',
  },
  {
    key: 'appointmentReference',
    label: 'Référence de nomination, affectation ou prise de service',
    type: 'text',
    required: true,
    placeholder: 'N° et date de l’acte administratif',
    helpText: 'Aucun document d’identité personnel n’est demandé ici : seule la référence administrative est utilisée pour la vérification.',
  },
  {
    key: 'justification',
    label: 'Motif de la demande d’accès',
    type: 'textarea',
    required: true,
    placeholder: 'Indiquez les missions EDUCO qui nécessitent cet accès.',
  },
];

const field = (
  key: string,
  label: string,
  type: InstitutionalAccountFieldType = 'text',
  options?: string[],
  required = true,
  placeholder?: string,
  helpText?: string,
): InstitutionalAccountField => ({ key, label, type, options, required, placeholder, helpText });

const ministryEntityFields: Record<MinistryCode, Record<string, InstitutionalAccountField[]>> = {
  MEPSA: {
    CABINET: [
      field('responsibilityArea', 'Domaine de responsabilité au cabinet', 'select', [
        'Coordination du cabinet', 'Conseil / expertise', 'Secrétariat', 'Communication', 'Protocole', 'Suivi des dossiers', 'Autre',
      ]),
    ],
    DGEB: [
      field('responsibilityArea', 'Périmètre éducation de base', 'select', [
        'Préscolaire', 'Primaire', 'Alimentation scolaire', 'Suivi pédagogique', 'Carte scolaire / capacités', 'Statistiques / planification', 'Administration',
      ]),
      field('department', 'Département couvert', 'select', CONGO_DEPARTMENTS, false),
    ],
    DGES: [
      field('responsibilityArea', 'Périmètre enseignement secondaire', 'select', [
        'Collèges', 'Lycées', 'Programmes', 'Orientation', 'Examens / résultats', 'Suivi pédagogique', 'Statistiques',
      ]),
      field('department', 'Département couvert', 'select', CONGO_DEPARTMENTS, false),
    ],
    DCEG: [
      field('responsibilityArea', 'Périmètre des collèges d’enseignement général', 'select', [
        'Organisation des CEG', 'Suivi pédagogique', 'Programmes', 'Évaluations', 'BEPC', 'Formation continue', 'Effectifs / personnel',
      ]),
      field('department', 'Département couvert', 'select', CONGO_DEPARTMENTS, false),
    ],
    DGRHAS: [
      field('responsibilityArea', 'Domaine RH / administration scolaire', 'select', [
        'Gestion des agents', 'Affectations', 'Mutations', 'Recrutements', 'Carrières / promotions', 'Congés', 'Postes vacants', 'Administration scolaire',
      ]),
      field('administrativeGrade', 'Corps / cadre / grade administratif', 'text', undefined, false, 'Corps ou grade, si applicable'),
    ],
    DGAENF: [
      field('responsibilityArea', 'Domaine alphabétisation / éducation non formelle', 'select', [
        'Centres d’alphabétisation', 'Rescolarisation', 'Campagnes', 'Animateurs', 'Suivi des apprenants', 'Évaluation', 'Statistiques',
      ]),
      field('programOrCenter', 'Programme, centre ou zone suivie', 'text', undefined, false, 'Nom du programme, centre ou zone'),
    ],
    INSPECTION: [
      field('inspectionSpecialty', 'Spécialité d’inspection', 'select', [
        'Pédagogique', 'Administrative', 'Conformité des établissements', 'Programmes', 'Ressources humaines', 'Autre',
      ]),
      field('inspectionZone', 'Zone / département d’inspection', 'select', CONGO_DEPARTMENTS, false),
    ],
    DEP: [
      field('responsibilityArea', 'Domaine études & planification', 'select', [
        'Carte scolaire', 'Statistiques', 'Prévisions', 'Effectifs', 'Capacité d’accueil', 'Infrastructures', 'Indicateurs', 'Annuaire statistique',
      ]),
      field('geographicScope', 'Périmètre géographique suivi', 'text', undefined, false, 'National, département ou zone'),
    ],
    DSIC: [
      field('responsibilityArea', 'Responsabilité numérique', 'select', [
        'Applications', 'Données / SIGE', 'Interopérabilité / API', 'Sécurité', 'Synchronisation', 'Qualité des données', 'Support', 'Sauvegardes', 'Communication numérique',
      ]),
      field('systemsScope', 'Applications ou systèmes suivis', 'text', undefined, false, 'Noms des systèmes concernés — sans mot de passe ni clé API'),
    ],
    EXAMENS: [
      field('examResponsibility', 'Responsabilité examens & concours', 'select', [
        'Inscriptions', 'Centres', 'Jurys', 'Sessions', 'Convocations', 'Résultats', 'Contrôle / fraude', 'Statistiques / archives',
      ]),
      field('examZone', 'Zone, centre ou session suivie', 'text', undefined, false, 'Zone, centre ou session'),
    ],
    AGREMENTS: [
      field('responsibilityArea', 'Responsabilité agrément du privé', 'select', [
        'Réception des demandes', 'Instruction des dossiers', 'Pièces justificatives', 'Contrôle de conformité', 'Commission / validation', 'Décisions', 'Cartographie / statistiques',
      ]),
    ],
    DDEPSA: [
      field('department', 'Direction départementale', 'select', CONGO_DEPARTMENTS),
      field('responsibilityArea', 'Domaine territorial suivi', 'select', [
        'Établissements', 'Personnel', 'Examens', 'Planification', 'Alphabétisation', 'Patrimoine', 'Enseignement privé', 'Finances', 'Rapports',
      ]),
    ],
  },
  MES: {
    CABINET: [
      field('responsibilityArea', 'Domaine de responsabilité au cabinet', 'select', [
        'Coordination du cabinet', 'Enseignement supérieur', 'Vie étudiante', 'Recherche / innovation', 'Coopération', 'Suivi des dossiers', 'Communication', 'Autre',
      ]),
    ],
    DGES: [
      field('responsibilityArea', 'Périmètre enseignement supérieur', 'select', [
        'Universités / instituts', 'Filières', 'Licence', 'Master', 'Doctorat', 'Programmes', 'Diplômes', 'Accréditation / qualité académique', 'Calendrier académique',
      ]),
      field('institutionScope', 'Établissement(s) ou zone suivie', 'text', undefined, false, 'Université, institut ou périmètre'),
    ],
    DGASOU: [
      field('responsibilityArea', 'Domaine affaires sociales / œuvres universitaires', 'select', [
        'Bourses', 'Résidences universitaires', 'Restauration', 'Santé', 'Aides sociales', 'Orientation', 'Insertion', 'Culture / sport',
      ]),
      field('institutionScope', 'Campus / établissement couvert', 'text', undefined, false, 'Campus, établissement ou zone'),
    ],
    DEP: [
      field('responsibilityArea', 'Domaine études & planification', 'select', [
        'Carte universitaire', 'Effectifs', 'Prévisions', 'Capacité d’accueil', 'Filières', 'Infrastructures', 'Investissements', 'Indicateurs', 'Annuaire',
      ]),
      field('geographicScope', 'Périmètre universitaire suivi', 'text', undefined, false, 'National, zone ou établissement'),
    ],
    DIRCOOP: [
      field('responsibilityArea', 'Domaine coopération & partenariats', 'select', [
        'Conventions', 'Accords', 'Mobilité étudiante', 'Mobilité des enseignants', 'Bourses internationales', 'Organisations internationales', 'Financements / projets',
      ]),
      field('partnerScope', 'Partenaire(s), pays ou zone suivis', 'text', undefined, false, 'Partenaire, pays ou portefeuille de coopération'),
    ],
    DSIC: [
      field('responsibilityArea', 'Responsabilité numérique', 'select', [
        'Registre étudiants', 'Identité numérique / biométrie', 'Applications', 'Interopérabilité / API', 'Synchronisation', 'Qualité des données', 'Sécurité', 'Support',
      ]),
      field('systemsScope', 'Applications ou systèmes suivis', 'text', undefined, false, 'Noms des systèmes concernés — sans mot de passe ni clé API'),
    ],
    DAEP: [
      field('responsibilityArea', 'Domaine administration / équipement / patrimoine', 'select', [
        'Administration', 'Personnel', 'Équipements', 'Inventaire', 'Patrimoine', 'Maintenance', 'Achats', 'Bâtiments', 'Archives',
      ]),
      field('siteScope', 'Site / bâtiment / établissement couvert', 'text', undefined, false, 'Site ou établissement'),
    ],
    INSPECTION: [
      field('inspectionSpecialty', 'Spécialité d’inspection / audit', 'select', [
        'Académique', 'Administrative', 'Financière', 'Patrimoniale', 'Gouvernance', 'Éthique', 'Assurance qualité',
      ]),
      field('institutionScope', 'Établissement(s) ou zone d’intervention', 'text', undefined, false, 'Université, institut ou zone'),
    ],
    ACADEMIES: [
      field('academyArea', 'Académie / zone territoriale', 'text', undefined, true, 'Académie ou zone suivie'),
      field('responsibilityArea', 'Domaine territorial suivi', 'select', [
        'Établissements', 'Statistiques', 'Formations', 'Investissements', 'Partenariats', 'Œuvres universitaires', 'Rapports territoriaux',
      ]),
      field('institutionScope', 'Établissements couverts', 'text', undefined, false, 'Université(s) ou institut(s)'),
    ],
  },
  METP: {
    CABINET: [
      field('responsibilityArea', 'Domaine de responsabilité au cabinet', 'select', [
        'Coordination du cabinet', 'Études / planification', 'Examens & concours', 'Systèmes d’information', 'Coopération / partenariat', 'Établissements privés', 'Suivi des projets', 'Autre',
      ]),
    ],
    DGET: [
      field('responsibilityArea', 'Périmètre enseignement technique', 'select', [
        'Lycées techniques', 'Filières', 'Curricula / programmes', 'Enseignants', 'Ateliers / laboratoires', 'Examens', 'Carte scolaire',
      ]),
      field('institutionScope', 'Établissement(s) ou zone suivie', 'text', undefined, false, 'Lycée technique ou zone'),
    ],
    DGEP: [
      field('responsibilityArea', 'Périmètre enseignement professionnel', 'select', [
        'Centres de formation', 'Métiers / programmes', 'Formateurs', 'Stages', 'Entreprises partenaires', 'Certification', 'Insertion',
      ]),
      field('institutionScope', 'Centre(s) ou zone suivie', 'text', undefined, false, 'Centre de formation ou zone'),
    ],
    DGA_RH: [
      field('responsibilityArea', 'Domaine administration / ressources humaines', 'select', [
        'Personnel', 'Formateurs', 'Administratifs', 'Recrutements', 'Affectations', 'Mutations', 'Carrières', 'Formations', 'Postes vacants', 'Bourses',
      ]),
      field('administrativeGrade', 'Corps / cadre / grade administratif', 'text', undefined, false, 'Corps ou grade, si applicable'),
    ],
    EXAMENS_CONCOURS: [
      field('examType', 'Examen / concours principal suivi', 'select', ['BAC technique', 'BET', 'BEP', 'BTF', 'Concours', 'Plusieurs examens']),
      field('examResponsibility', 'Responsabilité examens & concours', 'select', [
        'Inscriptions', 'Centres', 'Jurys', 'Convocations', 'Résultats', 'Diplômes', 'Contrôle / fraude', 'Archives',
      ]),
      field('examZone', 'Centre, département ou session suivie', 'text', undefined, false, 'Centre, département ou session'),
    ],
    DSIC: [
      field('responsibilityArea', 'Responsabilité numérique', 'select', [
        'Applications / SIGE', 'Établissements connectés', 'Synchronisation', 'Utilisateurs', 'Sécurité', 'Interopérabilité / API', 'Incidents', 'Sauvegardes', 'Communication numérique',
      ]),
      field('systemsScope', 'Applications ou systèmes suivis', 'text', undefined, false, 'Noms des systèmes concernés — sans mot de passe ni clé API'),
    ],
    INSPECTION: [
      field('inspectionSpecialty', 'Spécialité d’inspection', 'select', [
        'Pédagogique', 'Administrative', 'Ateliers / laboratoires', 'Programmes', 'Équipements', 'Conformité / qualité',
      ]),
      field('inspectionZone', 'Zone / département d’inspection', 'select', CONGO_DEPARTMENTS, false),
    ],
    ETABLISSEMENTS_PRIVES: [
      field('responsibilityArea', 'Responsabilité établissements privés', 'select', [
        'Réception des demandes', 'Création / ouverture', 'Agréments', 'Modification / extension',
        'Contrôle de fonctionnement', 'Commission d’agrément', 'Décisions', 'Statistiques / suivi',
      ]),
      field('institutionScope', 'Établissement(s) ou zone suivie', 'text', undefined, false, 'Établissement privé, département ou zone'),
    ],
    EQUIPEMENT_PATRIMOINE: [
      field('responsibilityArea', 'Domaine équipement & patrimoine', 'select', [
        'Ateliers', 'Machines', 'Laboratoires', 'Inventaire', 'Maintenance', 'Pièces détachées', 'Bâtiments', 'Achats', 'Réhabilitations',
      ]),
      field('siteScope', 'Site / établissement / patrimoine suivi', 'text', undefined, false, 'Site, établissement ou parc d’équipements'),
    ],
  },
};

export const getInstitutionalAccountRequestConfig = (
  context: InstitutionAccessContext,
): InstitutionalAccountRequestConfig | null => {
  if (context.sector !== 'STATE' || !context.ministry || !context.entity) return null;
  const contextual = ministryEntityFields[context.ministry]?.[context.entity] || [];
  return {
    title: 'Demander un compte institutionnel',
    description: 'La demande sera vérifiée avant activation. La sélection d’une entité ne crée jamais automatiquement un rôle privilégié.',
    fields: [...baseFields, ...contextual],
  };
};

export const institutionalAccountEntityFields = ministryEntityFields;
