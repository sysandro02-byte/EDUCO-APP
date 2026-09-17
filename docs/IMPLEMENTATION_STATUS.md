# État d'implémentation

## Implémenté dans cette branche

- Portail d'entrée État / Écoles / Université.
- Sous-parcours État avec sigles MEPSA / MES / METP.
- Grandes modales de sélection des structures ministérielles.
- Sous-parcours Écoles : Enseignement général / Enseignement technique.
- Sous-parcours Université : Publique / Privée.
- Réutilisation intégrale du LoginPage existant après sélection.
- Conservation de la biométrie WebAuthn, e-mail, téléphone/OTP, mot de passe oublié, création de compte parent et inscription d'établissement.
- Tableau de bord institutionnel générique configuré par ministère/structure.
- Blocage client des espaces État si le rôle ne correspond pas au contexte choisi.
- Aucun chiffre national fictif : indicateurs laissés à « — » jusqu'au raccordement aux données réelles.
- Tests de la hiérarchie et des frontières de rôles.
- Workflow CI dédié lint + build + tests.

## Non activé volontairement dans cette branche

- Migration des comptes scolaires existants.
- Modification des tables scolaires existantes.
- Remplacement des dashboards scolaires existants.
- Exposition d'API ministérielles sensibles sans contrôle serveur/RLS.
- Statistiques nationales de démonstration présentées comme réelles.

Cette stratégie rend l'intégration additive et réversible afin de réduire le risque de régression.
