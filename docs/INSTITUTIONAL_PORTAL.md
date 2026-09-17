# Portail institutionnel EDUCO

Cette intégration ajoute le parcours hiérarchique demandé sans remplacer l'application scolaire existante.

## Parcours

- État → MEPSA / MES / METP → structure → authentification existante → contrôle du rôle → dashboard institutionnel.
- Écoles → Enseignement général / Enseignement technique → authentification existante.
- Université → Publique / Privée → authentification existante.

## Compatibilité

Le composant `InstitutionalEntryApp` encapsule l'ancien `App.tsx`. Les utilisateurs déjà authentifiés et les workflows scolaires existants continuent d'utiliser le même composant historique, les mêmes services API, les mêmes flux OTP, WebAuthn/Passkeys, création de compte parent et inscription d'établissement.

## Rôles gouvernementaux

La sélection d'une carte n'accorde aucun droit. Pour un espace gouvernemental, le rôle du compte doit correspondre au contexte sélectionné :

- `MEPSA_CABINET`, `MEPSA_DEP`, `MEPSA_DSIC`, etc.
- `MES_CABINET`, `MES_DGES`, `MES_DEP`, etc.
- `METP_CABINET`, `METP_DGET`, `METP_DGEP`, etc.

Un administrateur ministériel peut utiliser `MEPSA_ADMIN`, `MES_ADMIN` ou `METP_ADMIN`. `ETAT_ADMIN` est réservé à un futur compte transversal géré côté serveur.

## Données

Les nouveaux tableaux de bord n'affichent volontairement aucune statistique nationale fictive. Les cartes chiffrées restent à `—` jusqu'au raccordement aux agrégations réelles et aux règles RLS correspondantes.

## Suite de déploiement

1. Créer les comptes gouvernementaux avec des rôles explicites.
2. Ajouter les vues/agrégations nationales dans Supabase.
3. Protéger chaque nouvel endpoint côté serveur selon ministère + structure + permission.
4. Raccorder progressivement les modules institutionnels aux services existants.
5. Garder les modules écoles/universités actuels inchangés jusqu'à validation métier.
