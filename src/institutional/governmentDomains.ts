export type GovernmentDomain =
  | 'inspections'
  | 'national_exams'
  | 'accreditations'
  | 'hr_movements'
  | 'infrastructures'
  | 'assets'
  | 'validation_cases'
  | 'projects'
  | 'decisions'
  | 'school_map';

export type GovernmentFieldType = 'text' | 'number' | 'date';

export interface GovernmentDomainField {
  key: string;
  label: string;
  type?: GovernmentFieldType;
  placeholder?: string;
}

export interface GovernmentDomainConfig {
  domain: GovernmentDomain;
  label: string;
  description: string;
  fields: GovernmentDomainField[];
}

export const GOVERNMENT_DOMAIN_CONFIG: Record<GovernmentDomain, GovernmentDomainConfig> = {
  inspections: {
    domain: 'inspections',
    label: 'Inspections & contrôle',
    description: 'Missions, constats, recommandations et suivi des plans correctifs.',
    fields: [
      { key: 'inspectionType', label: "Type d’inspection" },
      { key: 'inspectionDate', label: 'Date de mission', type: 'date' },
      { key: 'inspector', label: 'Inspecteur / équipe' },
      { key: 'location', label: 'Lieu / structure contrôlée' },
    ],
  },
  national_exams: {
    domain: 'national_exams',
    label: 'Examens & concours',
    description: 'Sessions, centres, candidats, jurys, résultats et suivi opérationnel.',
    fields: [
      { key: 'examName', label: 'Examen / concours' },
      { key: 'session', label: 'Session' },
      { key: 'centerName', label: "Centre d’examen" },
      { key: 'candidates', label: 'Nombre de candidats', type: 'number' },
    ],
  },
  accreditations: {
    domain: 'accreditations',
    label: 'Agréments & homologations',
    description: 'Demandes, conformité, décisions, homologations et accréditations.',
    fields: [
      { key: 'establishmentName', label: 'Établissement demandeur' },
      { key: 'requestType', label: 'Type de demande' },
      { key: 'submittedAt', label: 'Date de dépôt', type: 'date' },
      { key: 'decisionAt', label: 'Date de décision', type: 'date' },
    ],
  },
  hr_movements: {
    domain: 'hr_movements',
    label: 'Mouvements RH',
    description: 'Affectations, mutations, recrutements, promotions et suivi de carrière.',
    fields: [
      { key: 'personName', label: 'Agent / personnel' },
      { key: 'matricule', label: 'Matricule' },
      { key: 'movementType', label: 'Type de mouvement' },
      { key: 'fromStructure', label: 'Structure d’origine' },
      { key: 'toStructure', label: 'Structure de destination' },
      { key: 'effectiveDate', label: "Date d’effet", type: 'date' },
    ],
  },
  infrastructures: {
    domain: 'infrastructures',
    label: 'Infrastructures',
    description: 'Bâtiments, salles, ateliers, laboratoires et capacités d’accueil.',
    fields: [
      { key: 'facilityType', label: "Type d’infrastructure" },
      { key: 'locality', label: 'Localité' },
      { key: 'condition', label: 'État' },
      { key: 'capacity', label: 'Capacité', type: 'number' },
    ],
  },
  assets: {
    domain: 'assets',
    label: 'Équipements & patrimoine',
    description: 'Inventaire, équipements, maintenance, acquisitions et patrimoine.',
    fields: [
      { key: 'assetType', label: "Type d’équipement" },
      { key: 'assetCode', label: 'Code inventaire' },
      { key: 'quantity', label: 'Quantité', type: 'number' },
      { key: 'condition', label: 'État' },
      { key: 'value', label: 'Valeur estimée (FCFA)', type: 'number' },
    ],
  },
  validation_cases: {
    domain: 'validation_cases',
    label: 'Dossiers de validation',
    description: 'Circuit de traitement des demandes et dossiers soumis à validation.',
    fields: [
      { key: 'caseType', label: 'Type de dossier' },
      { key: 'applicant', label: 'Demandeur / porteur' },
      { key: 'priority', label: 'Priorité' },
      { key: 'assignedTo', label: 'Responsable du traitement' },
    ],
  },
  projects: {
    domain: 'projects',
    label: 'Projets & investissements',
    description: 'Planification, budget, responsables, avancement et échéances.',
    fields: [
      { key: 'owner', label: 'Responsable / porteur' },
      { key: 'startDate', label: 'Date de début', type: 'date' },
      { key: 'endDate', label: 'Date de fin', type: 'date' },
      { key: 'budget', label: 'Budget (FCFA)', type: 'number' },
      { key: 'progress', label: 'Avancement (%)', type: 'number' },
    ],
  },
  decisions: {
    domain: 'decisions',
    label: 'Décisions administratives',
    description: 'Décisions, actes, références documentaires et dates d’effet.',
    fields: [
      { key: 'decisionType', label: 'Type de décision' },
      { key: 'signatory', label: 'Signataire' },
      { key: 'signedAt', label: 'Date de signature', type: 'date' },
      { key: 'effectiveAt', label: "Date d’effet", type: 'date' },
      { key: 'documentRef', label: 'Référence du document' },
    ],
  },
  school_map: {
    domain: 'school_map',
    label: 'Carte scolaire / universitaire',
    description: 'Référentiel territorial des établissements, capacités et localisations.',
    fields: [
      { key: 'institutionName', label: 'Établissement' },
      { key: 'institutionType', label: "Type d’établissement" },
      { key: 'department', label: 'Département' },
      { key: 'locality', label: 'Localité' },
      { key: 'capacity', label: 'Capacité', type: 'number' },
    ],
  },
};

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export function getGovernmentDomainForModule(moduleName: string): GovernmentDomain | null {
  const value = normalize(moduleName);

  if (/inspection|audit|non-conform|recommandation|plan correctif|gouvernance|ethique/.test(value)) return 'inspections';
  if (/examen|concours|bepc|baccalaureat|bac technique|bet|bep|btf|candidat|jury|convocation|fraude/.test(value)) return 'national_exams';
  if (/agrement|accreditation|homologation/.test(value)) return 'accreditations';
  if (/affectation|mutation|promotion|recrutement|poste vacant|carriere|conge|agents?$|personnel|formateur/.test(value)) return 'hr_movements';
  if (/infrastructure|batiment|atelier|laboratoire|capacite d'accueil|residence|restaurant universitaire/.test(value)) return 'infrastructures';
  if (/equipement|inventaire|patrimoine|maintenance|achats?/.test(value)) return 'assets';
  if (/dossiers? a valider|demandes?$|pieces justificatives/.test(value)) return 'validation_cases';
  if (/projet|investissement|financement|partenariat|convention|accord/.test(value)) return 'projects';
  if (/decision|documents? officiels?/.test(value)) return 'decisions';
  if (/carte scolaire|carte universitaire|cartographie/.test(value)) return 'school_map';

  return null;
}
