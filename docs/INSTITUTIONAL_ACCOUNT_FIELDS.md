# EDUCO — champs de demande de compte institutionnel

Ce document explique la base administrative utilisée pour adapter le formulaire de demande de compte aux entités de l'État congolais présentes dans EDUCO.

> Le code produit `MEPSA` est conservé dans EDUCO pour compatibilité avec les parcours existants, même lorsque des textes officiels emploient la dénomination ministérielle plus récente avec « préscolaire ».

## Principes de sécurité et de minimisation

Une demande de compte institutionnel ne crée pas automatiquement un compte privilégié. Elle reste `PENDING` jusqu'à vérification. Le formulaire ne demande ni mot de passe, ni clé API, ni secret, ni copie de pièce d'identité. La vérification s'appuie prioritairement sur l'identité professionnelle, le matricule/identifiant administratif, la fonction, le service et la référence de nomination/affectation/prise de service.

## MEPSA

Le Secrétariat général du Gouvernement référence notamment :

- le décret n° 2017-514 du 29 décembre 2017 portant organisation du ministère ;
- le décret n° 2017-516 portant attributions et organisation de la Direction générale de l'éducation de base ;
- le décret n° 2017-517 portant attributions et organisation de la Direction générale des ressources humaines et de l'administration scolaire ;
- le décret n° 2017-518 portant attributions et organisation de la Direction générale de l'alphabétisation et de l'éducation non formelle ;
- l'arrêté n° 15351 du 11 juillet 2024 relatif aux services des directions départementales.

Source : https://www.sgg.cg/fr/recherche.html?page=637&row=123566

Des textes 2024-2025 confirment également l'existence des directions générales de l'éducation de base, de l'enseignement secondaire et des ressources humaines/administration scolaire, ainsi que des directions départementales.

Sources :
- https://www.sgg.cg/fr/recherche.html?page=53&row=125303
- https://www.sgg.cg/fr/recherche.html?action=Rechercher&field_titre=DECRET+2010-377&page=3&row=34765

Conséquences dans EDUCO : champs dédiés aux cycles d'enseignement, à la gestion RH, à l'alphabétisation/éducation non formelle, aux inspections, aux examens, aux agréments, à la planification, aux SI et au périmètre départemental.

## MES

Le Journal officiel cite le décret n° 2021-533 du 14 décembre 2021 portant organisation du ministère de l'enseignement supérieur, ainsi que le décret n° 2003-182 portant attributions et organisation de la Direction générale de l'enseignement supérieur. Les actes d'agrément des établissements privés font également référence aux programmes de BTS/DUT/licence/master et aux commissions d'agrément.

Source : https://www.sgg.cg/JO/2024/congo-jo-2024-25.pdf

Le même Journal officiel distingue notamment le programme « enseignement supérieur » et le programme « vie de l'étudiant », avec la direction des bourses et des œuvres universitaires.

Conséquences dans EDUCO : champs dédiés aux établissements/filières/diplômes/accréditations, aux bourses et œuvres universitaires, à la coopération et aux partenariats, à la carte universitaire/planification, aux SI, à l'administration-équipement-patrimoine, à l'inspection et aux périmètres académiques/territoriaux.

## METP

Le site officiel du ministère et les textes du SGG confirment le cadre de l'enseignement technique et professionnel. Le décret n° 2022-118 du 22 mars 2022 porte organisation du ministère. Les textes citent notamment la Direction générale de l'enseignement technique, la Direction générale de l'enseignement professionnel, la Direction générale de l'administration et des ressources humaines, la Direction générale de l'équipement et du patrimoine, l'inspection générale et les directions départementales.

Sources :
- https://www.enseignement-technique.gouv.cg/
- https://www.sgg.cg/textes-officiels/decrets/2023/congo-decret-2023-1745.pdf
- https://www.enseignement-technique.gouv.cg/Livre/84f7b1fd3a4637170dbc35c2cdc1104d.pdf

L'arrêté n° 25564 relatif aux structures rattachées au cabinet cite notamment les études et la planification, les examens et concours techniques et professionnels, les systèmes d'information et la communication, la coopération et le partenariat, ainsi que les établissements privés de l'enseignement technique et professionnel.

Conséquences dans EDUCO : champs dédiés aux filières/curricula, centres/métiers/stages/certification, RH, BAC technique/BET/BEP/BTF/concours, SI, inspection, ateliers/machines/laboratoires, inventaire, maintenance et patrimoine.

## Règle d'évolution

Lorsqu'une structure administrative est renommée ou réorganisée par un nouveau texte officiel, mettre à jour simultanément :

1. `src/institutional/accessConfig.ts` ;
2. `src/institutional/accountRequestConfig.ts` ;
3. la contrainte d'entité dans la migration/table de demandes de compte ;
4. les tests d'intégrité du portail institutionnel.
