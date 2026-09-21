export type AccessSector = 'STATE' | 'SCHOOL' | 'UNIVERSITY';
export type MinistryCode = 'MEPSA' | 'MES' | 'METP';

export interface InstitutionalEntityConfig {
  code: string;
  label: string;
  shortLabel?: string;
  description: string;
  modules: string[];
  workflows: string[];
}

export interface MinistryConfig {
  code: MinistryCode;
  label: string;
  fullName: string;
  description: string;
  entities: InstitutionalEntityConfig[];
}

export interface InstitutionAccessContext {
  sector: AccessSector;
  ministry?: MinistryCode;
  entity?: string;
  schoolType?: 'GENERAL' | 'TECHNICAL';
  universityType?: 'PUBLIC' | 'PRIVATE';
  label: string;
}

const cabinetModules = [
  'Tableau de bord national',
  'Dossiers à valider',
  'Rapports & statistiques',
  'Alertes prioritaires',
  'Projets & décisions',
  'Agenda institutionnel',
  'Documents officiels',
];

export const MINISTRIES: MinistryConfig[] = [
  {
    code: 'MEPSA',
    label: 'MEPSA',
    fullName: "Ministère de l’Enseignement Préscolaire, Primaire, Secondaire et de l’Alphabétisation",
    description: 'Pilotage de l’éducation de base, de l’enseignement secondaire et de l’alphabétisation.',
    entities: [
      {
        code: 'CABINET',
        label: 'CABINET',
        description: 'Pilotage national, arbitrage, validation et coordination stratégique.',
        modules: [...cabinetModules, 'Établissements', 'Élèves', 'Enseignants', 'Examens & concours', 'Agrément du privé'],
        workflows: ['Valider un dossier', 'Suivre un projet prioritaire', 'Consulter les alertes nationales', 'Publier une décision'],
      },
      {
        code: 'DGEB',
        label: 'DG Éducation de base',
        shortLabel: 'DGEB',
        description: 'Préscolaire, primaire, capacités d’accueil et suivi de l’éducation de base.',
        modules: ['Préscolaire', 'Primaire', 'Établissements', 'Effectifs', 'Classes', 'Enseignants', 'Alimentation scolaire', 'Résultats', 'Inspections', 'Statistiques'],
        workflows: ['Analyser les effectifs', 'Identifier les classes surchargées', 'Suivre les besoins en enseignants', 'Éditer un rapport de couverture'],
      },
      {
        code: 'DGES',
        label: 'DG Enseignement secondaire',
        shortLabel: 'DGES',
        description: 'Collèges, lycées, programmes, orientation, résultats et suivi pédagogique.',
        modules: ['Collèges', 'Lycées', 'Élèves', 'Enseignants', 'Programmes', 'Orientation', 'BEPC', 'Baccalauréat', 'Inspections', 'Rapports'],
        workflows: ['Suivre les résultats', 'Analyser les besoins de personnel', 'Contrôler la couverture des programmes', 'Préparer un rapport annuel'],
      },
      {
        code: 'DCEG',
        label: 'Direction des collèges d’enseignement général',
        shortLabel: 'DCEG',
        description: 'Organisation des collèges, coordination pédagogique et évaluation.',
        modules: ['CEG', 'Effectifs 6e–3e', 'Personnel enseignant', 'Programmes', 'Suivi pédagogique', 'Évaluations', 'BEPC', 'Formation continue'],
        workflows: ['Suivre un CEG', 'Programmer une mission pédagogique', 'Analyser les évaluations', 'Produire un rapport DCEG'],
      },
      {
        code: 'DGRHAS',
        label: 'DG Ressources humaines & Administration scolaire',
        shortLabel: 'DGRHAS',
        description: 'Gestion des agents, carrières, affectations, mutations et postes.',
        modules: ['Agents', 'Enseignants', 'Administratifs', 'Affectations', 'Mutations', 'Promotions', 'Postes vacants', 'Recrutements', 'Congés', 'Carrières'],
        workflows: ['Traiter une mutation', 'Affecter un agent', 'Valider un mouvement RH', 'Analyser les postes vacants'],
      },
      {
        code: 'DGAENF',
        label: 'DG Alphabétisation & Éducation non formelle',
        shortLabel: 'DGAENF',
        description: 'Centres d’alphabétisation, rescolarisation et éducation non formelle.',
        modules: ['Centres', 'Apprenants', 'Animateurs', 'Campagnes', 'Présences', 'Progression', 'Rescolarisation', 'Statistiques', 'Rapports'],
        workflows: ['Créer une campagne', 'Suivre les apprenants', 'Évaluer un centre', 'Consolider les statistiques'],
      },
      {
        code: 'INSPECTION',
        label: 'Inspection générale',
        description: 'Contrôle pédagogique et administratif, conformité et plans correctifs.',
        modules: ['Planification', 'Missions', 'Établissements à contrôler', 'Rapports', 'Non-conformités', 'Recommandations', 'Plans correctifs', 'Historique'],
        workflows: ['Planifier une inspection', 'Affecter des inspecteurs', 'Publier un rapport', 'Suivre un plan correctif'],
      },
      {
        code: 'DEP',
        label: 'Études & Planification',
        shortLabel: 'DEP',
        description: 'Carte scolaire, projections, indicateurs, statistiques et aide à la décision.',
        modules: ['Carte scolaire', 'Statistiques', 'Prévisions', 'Effectifs', 'Capacité d’accueil', 'Infrastructures', 'Indicateurs', 'Annuaire statistique', 'Exports'],
        workflows: ['Produire une projection', 'Mettre à jour la carte scolaire', 'Générer un annuaire', 'Exporter un jeu de données'],
      },
      {
        code: 'DSIC',
        label: 'Systèmes d’information & Communication',
        shortLabel: 'DSIC',
        description: 'Applications, données, interopérabilité, sécurité et support numérique.',
        modules: ['Utilisateurs', 'Applications', 'Établissements connectés', 'Synchronisation', 'Qualité des données', 'API', 'Sécurité', 'Incidents', 'Sauvegardes', 'Support'],
        workflows: ['Lancer une synchronisation', 'Ouvrir un incident', 'Créer un accès', 'Contrôler la qualité des données'],
      },
      {
        code: 'EXAMENS',
        label: 'Examens & Concours',
        description: 'Inscriptions, centres, jurys, sessions, résultats et statistiques des examens.',
        modules: ['Candidats', 'Centres', 'Jurys', 'Sessions', 'Convocations', 'Résultats', 'Fraude', 'Statistiques', 'Archives'],
        workflows: ['Ouvrir une session', 'Valider un centre', 'Publier des résultats', 'Clôturer une session'],
      },
      {
        code: 'AGREMENTS',
        label: 'Agrément des établissements privés',
        description: 'Dossiers d’ouverture, conformité, décisions et suivi des établissements privés.',
        modules: ['Demandes', 'Dossiers', 'Pièces justificatives', 'Contrôle', 'Décisions', 'Historique', 'Cartographie', 'Statistiques'],
        workflows: ['Recevoir une demande', 'Contrôler un dossier', 'Soumettre à validation', 'Notifier une décision'],
      },
      {
        code: 'DDEPSA',
        label: 'Directions départementales',
        shortLabel: 'DDEPSA',
        description: 'Relais territoriaux du ministère et consolidation des données départementales.',
        modules: ['Établissements', 'Personnel', 'Examens', 'Planification', 'Alphabétisation', 'Patrimoine', 'Privé', 'Finances', 'Rapports'],
        workflows: ['Consolider un département', 'Transmettre un rapport', 'Suivre les besoins locaux', 'Remonter une alerte'],
      },
    ],
  },
  {
    code: 'MES',
    label: 'MES',
    fullName: "Ministère de l’Enseignement Supérieur",
    description: 'Pilotage de l’enseignement supérieur, de la recherche, des œuvres universitaires et de la coopération.',
    entities: [
      {
        code: 'CABINET',
        label: 'CABINET',
        description: 'Pilotage national du supérieur, arbitrages, décisions et coordination.',
        modules: [...cabinetModules, 'Établissements publics & privés', 'Étudiants', 'Enseignants-chercheurs', 'Diplômes', 'Agréments & homologations', 'Recherche'],
        workflows: ['Valider un agrément', 'Suivre une homologation', 'Arbitrer un projet universitaire', 'Consulter les indicateurs nationaux'],
      },
      {
        code: 'DGES',
        label: 'DG Enseignement supérieur',
        shortLabel: 'DGES',
        description: 'Établissements, filières, diplômes, programmes, accréditations et qualité académique.',
        modules: ['Universités', 'Instituts', 'Filières', 'Licence', 'Master', 'Doctorat', 'Programmes', 'Diplômes', 'Accréditations', 'Calendrier académique'],
        workflows: ['Créer une fiche filière', 'Suivre une accréditation', 'Contrôler un programme', 'Consolider les inscriptions'],
      },
      {
        code: 'DGASOU',
        label: 'DG Affaires sociales & Œuvres universitaires',
        shortLabel: 'DGASOU',
        description: 'Bourses, résidences, restauration, santé, aides sociales et vie étudiante.',
        modules: ['Bourses', 'Résidences', 'Restaurants universitaires', 'Santé', 'Aides sociales', 'Orientation', 'Insertion', 'Culture & sport'],
        workflows: ['Traiter une demande de bourse', 'Suivre les résidences', 'Gérer une aide sociale', 'Analyser la capacité d’accueil'],
      },
      {
        code: 'DEP',
        label: 'Études & Planification',
        shortLabel: 'DEP',
        description: 'Carte universitaire, prévisions, investissements et statistiques du supérieur.',
        modules: ['Carte universitaire', 'Effectifs', 'Prévisions', 'Capacité d’accueil', 'Filières', 'Infrastructures', 'Investissements', 'Indicateurs', 'Annuaire'],
        workflows: ['Mettre à jour la carte universitaire', 'Produire une projection', 'Suivre un investissement', 'Exporter les statistiques'],
      },
      {
        code: 'DIRCOOP',
        label: 'Coopération & Partenariats',
        shortLabel: 'DIRCOOP',
        description: 'Accords, partenariats, mobilités, bourses internationales et projets extérieurs.',
        modules: ['Partenaires', 'Conventions', 'Accords', 'Mobilité étudiante', 'Mobilité enseignants', 'Bourses internationales', 'UNESCO', 'CAMES', 'Financements'],
        workflows: ['Enregistrer une convention', 'Suivre une mobilité', 'Gérer une échéance partenaire', 'Consolider un projet international'],
      },
      {
        code: 'DSIC',
        label: 'Systèmes d’information & Communication',
        shortLabel: 'DSIC',
        description: 'Registre étudiant, services numériques, interopérabilité, sécurité et qualité des données.',
        modules: ['Registre étudiants', 'Identité numérique', 'Biométrie', 'Établissements connectés', 'Applications', 'API', 'Synchronisation', 'Qualité des données', 'Sécurité', 'Support'],
        workflows: ['Synchroniser les établissements', 'Gérer les accès', 'Contrôler les doublons', 'Ouvrir un incident'],
      },
      {
        code: 'DAEP',
        label: 'Administration, Équipement & Patrimoine',
        shortLabel: 'DAEP',
        description: 'Administration, inventaire, équipements, maintenance, bâtiments et patrimoine.',
        modules: ['Administration', 'Personnel', 'Équipements', 'Inventaire', 'Patrimoine', 'Maintenance', 'Achats', 'Bâtiments', 'Archives'],
        workflows: ['Enregistrer un équipement', 'Planifier une maintenance', 'Lancer un inventaire', 'Suivre une acquisition'],
      },
      {
        code: 'INSPECTION',
        label: 'Inspection générale',
        description: 'Contrôle académique, administratif, financier, patrimonial, gouvernance et assurance qualité.',
        modules: ['Inspections', 'Audits', 'Conformité académique', 'Gouvernance', 'Éthique', 'Finances', 'Patrimoine', 'Recommandations', 'Plans correctifs'],
        workflows: ['Planifier une inspection', 'Ouvrir un audit', 'Publier une recommandation', 'Suivre un plan correctif'],
      },
      {
        code: 'ACADEMIES',
        label: 'Académies',
        description: 'Suivi territorial du supérieur, carte universitaire, formations, investissements et œuvres universitaires.',
        modules: ['Établissements', 'Statistiques', 'Formations', 'Investissements', 'Partenariats', 'Œuvres universitaires', 'Rapports territoriaux'],
        workflows: ['Consolider une académie', 'Contrôler un établissement', 'Suivre un investissement', 'Transmettre un rapport'],
      },
    ],
  },
  {
    code: 'METP',
    label: 'METP',
    fullName: "Ministère de l’Enseignement Technique et Professionnel",
    description: 'Pilotage de l’enseignement technique, de la formation professionnelle et du développement des compétences.',
    entities: [
      {
        code: 'CABINET',
        label: 'CABINET',
        description: 'Pilotage national, projets prioritaires, décisions, coordination et partenariats.',
        modules: [...cabinetModules, 'Établissements techniques', 'Centres professionnels', 'Apprenants', 'Formateurs', 'Examens techniques', 'Projets & partenariats'],
        workflows: ['Suivre un projet prioritaire', 'Valider un dossier', 'Consulter les alertes', 'Préparer une réunion de coordination'],
      },
      {
        code: 'DGET',
        label: 'DG Enseignement technique',
        shortLabel: 'DGET',
        description: 'Lycées techniques, filières, curricula, enseignants, ateliers et carte scolaire.',
        modules: ['Lycées techniques', 'Filières', 'Élèves', 'Enseignants', 'Curricula', 'Programmes', 'Ateliers', 'Laboratoires', 'Examens', 'Carte scolaire'],
        workflows: ['Gérer une filière', 'Mettre à jour un curriculum', 'Suivre les ateliers', 'Planifier une inspection'],
      },
      {
        code: 'DGEP',
        label: 'DG Enseignement professionnel',
        shortLabel: 'DGEP',
        description: 'Centres de formation, métiers, programmes, stages, certification et insertion.',
        modules: ['Centres de formation', 'Apprenants', 'Formateurs', 'Métiers', 'Programmes', 'Stages', 'Entreprises partenaires', 'Certification', 'Insertion'],
        workflows: ['Gérer un centre', 'Mettre à jour un programme', 'Planifier un stage', 'Suivre l’insertion'],
      },
      {
        code: 'DGA_RH',
        label: 'Administration & Ressources humaines',
        shortLabel: 'DGA-RH',
        description: 'Personnel, formateurs, recrutements, affectations, carrières, formations et bourses.',
        modules: ['Personnel', 'Formateurs', 'Administratifs', 'Recrutements', 'Affectations', 'Mutations', 'Carrières', 'Formations', 'Postes vacants', 'Bourses'],
        workflows: ['Traiter une mutation', 'Planifier une formation', 'Gérer un recrutement', 'Voir les postes vacants'],
      },
      {
        code: 'EXAMENS_CONCOURS',
        label: 'Examens & Concours',
        description: 'BAC technique, BET, BEP, BTF, concours, centres, jurys, résultats et diplômes.',
        modules: ['BAC technique', 'BET', 'BEP', 'BTF', 'Concours', 'Candidats', 'Centres', 'Jurys', 'Résultats', 'Diplômes', 'Fraude', 'Archives'],
        workflows: ['Gérer les inscriptions', 'Générer les convocations', 'Saisir les résultats', 'Publier les résultats'],
      },
      {
        code: 'DSIC',
        label: 'Systèmes d’information & Communication',
        shortLabel: 'DSIC',
        description: 'Applications, SIGE, établissements connectés, interopérabilité, sécurité et support.',
        modules: ['Applications', 'SIGE', 'Établissements connectés', 'Synchronisation', 'Utilisateurs', 'Sécurité', 'API', 'Incidents', 'Sauvegardes', 'Communication'],
        workflows: ['Gérer les utilisateurs', 'Lancer une synchronisation', 'Ouvrir un incident', 'Contrôler les services'],
      },
      {
        code: 'INSPECTION',
        label: 'Inspection générale',
        description: 'Inspection pédagogique, administrative, ateliers, programmes, conformité et qualité.',
        modules: ['Planification', 'Inspections pédagogiques', 'Inspections administratives', 'Ateliers', 'Programmes', 'Équipements', 'Rapports', 'Recommandations'],
        workflows: ['Planifier une inspection', 'Saisir un rapport', 'Suivre une recommandation', 'Contrôler la conformité'],
      },
      {
        code: 'ETABLISSEMENTS_PRIVES',
        label: 'Direction des établissements privés',
        description: 'Création, ouverture, agrément, fonctionnement, modification et suivi des établissements privés de l’enseignement technique et professionnel.',
        modules: ['Demandes de création', 'Demandes d’ouverture', 'Agréments', 'Modifications', 'Contrôle', 'Établissements privés', 'Pièces justificatives', 'Commission d’agrément', 'Décisions', 'Statistiques'],
        workflows: ['Recevoir un dossier', 'Contrôler les pièces', 'Préparer la commission d’agrément', 'Notifier une décision'],
      },
      {
        code: 'EQUIPEMENT_PATRIMOINE',
        label: 'Équipement & Patrimoine',
        description: 'Ateliers, machines, laboratoires, inventaire, maintenance, bâtiments et acquisitions.',
        modules: ['Ateliers', 'Machines', 'Laboratoires', 'Équipements', 'Inventaire', 'Maintenance', 'Pièces détachées', 'Bâtiments', 'Achats', 'Réhabilitations'],
        workflows: ['Enregistrer un équipement', 'Planifier une maintenance', 'Lancer un inventaire', 'Suivre une acquisition'],
      },
    ],
  },
];

export const SCHOOL_ACCESS_OPTIONS = [
  { code: 'GENERAL' as const, label: 'Enseignement général', description: 'Écoles publiques et privées de l’enseignement général.' },
  { code: 'TECHNICAL' as const, label: 'Enseignement technique', description: 'Établissements scolaires de l’enseignement technique.' },
];

export const UNIVERSITY_ACCESS_OPTIONS = [
  { code: 'PUBLIC' as const, label: 'Université publique', description: 'Universités et établissements publics d’enseignement supérieur.' },
  { code: 'PRIVATE' as const, label: 'Université privée', description: 'Universités et établissements privés d’enseignement supérieur.' },
];

export const findMinistry = (code?: string | null) => MINISTRIES.find((ministry) => ministry.code === code);

export const findInstitutionEntity = (ministryCode?: string | null, entityCode?: string | null) =>
  findMinistry(ministryCode)?.entities.find((entity) => entity.code === entityCode);

export const accessContextLabel = (context: InstitutionAccessContext) => {
  if (context.sector === 'STATE') {
    const ministry = findMinistry(context.ministry);
    const entity = findInstitutionEntity(context.ministry, context.entity);
    return [entity?.shortLabel || entity?.label || context.entity, ministry?.label || context.ministry].filter(Boolean).join(' / ');
  }
  if (context.sector === 'SCHOOL') {
    return context.schoolType === 'TECHNICAL' ? 'Écoles / Enseignement technique' : 'Écoles / Enseignement général';
  }
  return context.universityType === 'PRIVATE' ? 'Université / Privée' : 'Université / Publique';
};
