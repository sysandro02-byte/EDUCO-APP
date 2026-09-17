# Checklist de déploiement institutionnel

## Avant fusion

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npx tsx --test tests/institutional-access.test.ts`
- [ ] Vérifier le parcours État → MEPSA/MES/METP → structure → login
- [ ] Vérifier Écoles → Général/Technique → login
- [ ] Vérifier Université → Publique/Privée → login
- [ ] Vérifier la connexion e-mail
- [ ] Vérifier la connexion téléphone + OTP
- [ ] Vérifier WebAuthn/Passkeys
- [ ] Vérifier la création de compte parent
- [ ] Vérifier l'inscription d'établissement
- [ ] Vérifier qu'une session scolaire existante ouvre toujours l'application historique
- [ ] Vérifier qu'un rôle non autorisé ne peut pas ouvrir un dashboard ministériel

## Avant activation des données gouvernementales

- [ ] Ajouter les organisations et affectations côté base de données
- [ ] Ajouter les politiques RLS par ministère/structure
- [ ] Ajouter les contrôles serveur sur chaque endpoint gouvernemental
- [ ] Créer les vues d'agrégation nationales réelles
- [ ] Auditer les journaux d'accès
- [ ] Valider les rôles avec chaque ministère

Les indicateurs nationaux restent volontairement vides tant que ces étapes ne sont pas validées.
