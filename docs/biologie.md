# Dossier biologique : *Lasius niger*, la fourmi noire des jardins

Recherche faite le 5 novembre 2026 pour AntSim. Chaque fait est relié au paramètre de simulation qu'il justifie. Les constantes vivent dans `src/config.ts`.

## Pourquoi cette espèce

L'espèce la plus commune d'Europe (dont la Belgique), la mieux étudiée en laboratoire (ULiège, ULB, Regensburg, Groningue publient dessus), et son cycle correspond à l'arc du jeu : une reine seule, fondation sans sortir du nid, premières ouvrières naines, croissance sur plusieurs années, puis production de sexués.

Alternative écartée : *Formica rufa* (fourmi rousse des bois). Spectaculaire, mais la reine fonde en parasitant un nid d'une autre espèce.

## 1. Cycle de vie et chronologie

| Fait | Valeur | Paramètre de jeu |
|---|---|---|
| Vol nuptial | juillet-août en Europe, fin d'après-midi après un orage, des milliers d'ailés | `swarmLogic` : été, 15 h-19 h, > 17 °C |
| Fondation | claustrale : la reine creuse une loge, la bouche, ne sort plus, ne mange pas, vit sur ses muscles alaires, perd ~50 % de son poids, mange parfois ses propres œufs | `queenReserve`, `queenDrainTicks`, la reine mange un œuf sous 1 unité |
| Pléométrose | 2-3 reines peuvent fonder ensemble, puis combat jusqu'à une seule | pas en v1 |
| Œuf → ouvrière | 8-10 semaines ; par stade : œuf 10-18 j, larve 10-15 j, nymphe 10-24 j (fiches d'élevage) | `egg: 14 j`, `larva: 13 j`, `pupa: 17 j`, divisés par `BIO_SPEED` |
| Premières ouvrières | naines ("nanitiques"), nettement plus petites | taille 0,7 avant fondation |
| Fin de la 1re saison | ~20-60 ouvrières | `claustralMaxBrood: 20` |
| Croissance | exponentielle si nourriture ; 4 000-7 000 à maturité (jusqu'à 40 000) | intervalle de ponte décroissant avec la population |
| Premiers sexués | après plusieurs années, vers ~4 000 ouvrières (Evolution 2004) | `alateMinWorkers: 150` (compressé pour le jeu) |
| Vie de la reine | ~15-20 ans, record 28 ans 8 mois (Kutter & Stumper 1969) | `queenLife: 15 ans` |
| Vie d'une ouvrière | 1-2 ans ; plus courte avec régime riche en protéines (Kramer 2016) | `workerLife: 400 j` |
| Mâles | meurent 1-2 jours après le vol | disparaissent après le vol |

## 2. Castes et répartition du travail

- Monogyne (une reine), monomorphe : pas de soldats. Les ouvrières grossissent au fil des générations (taille 0,8 → 1,15 selon la population).
- Polyéthisme d'âge : jeunes = nourrices, puis entretien du nid, puis fourrageage. Les fourrageuses redeviennent nourrices si elles manquent. → `assignRoles` : tri par âge, quotas selon le couvain.

## 3. Nourriture, eau, fourrageage

- Deux ressources : sucres (miellat de pucerons, nectar) et protéines (insectes). Les larves tirent la demande en protéines (Insects 2012). → `lookForFood` préfère les proies quand il y a des larves.
- Élevage de pucerons : les ouvrières protègent les pucerons et récoltent le miellat (Detrain 2010). → plante = source de sucre continue.
- Recrutement par piste de phéromone : une éclaireuse trouve, rentre en marquant, les suiveuses renforcent. → grille `phero` par colonie, dépôt au retour, évaporation.
- Eau : besoin d'humidité pour le couvain. → `water` accélère le développement.

## 4. Nid

- Sous terre, sous pierres et dalles ; chambres en bulles reliées (PNAS 2016). Plus profond quand il fait chaud (J. Anim. Ecol. 2024). → creusement émergent, tunnel ou élargissement.
- Couvain trié par stade. → cibles œufs / larves / nymphes à des profondeurs différentes, nourrices qui déplacent.
- Hygiène : cadavres sortis du nid en tas. → `ucorpses`, dépotoir à 36 px de l'entrée.

## 5. Saisons

- Diapause fin octobre → fin mars : ponte stoppée, larves figées, ouvrières immobiles. → `diapause` sous 8 °C dans le nid, réveil au-dessus de 10 °C.
- Développement du couvain dépendant de la température (Kipyatkov). → `devRate = (T - 8) / 12`.
- Climat de Liège : ~3 °C en janvier, ~21 °C en juillet (été chaud), amplitude jour/nuit ±4 °C.

## 6. Interactions avec les autres

- Entre colonies *L. niger* : agressives, territoriales (Czaczkes 2023). Exception : complexes de nids géants à faible agression interne (Stukalyuk 2025). → combat entre colonies différentes.
- Hiérarchie compétitive : *L. niger* en niveau intermédiaire avec *Tetramorium* ; *Myrmica rubra* et *Formica fusca* plutôt dominées. → *Myrmica* : pv 10, dégâts 2 (plus dangereuse individuellement, mais moins nombreuse).
- Parasites sociaux : *Lasius umbratus* s'infiltre, tue la reine, la colonie change d'espèce. → idée pour une version future.
- Prédateurs : pas de source spécifique trouvée. → pas en v1.

## 7. Jeux de référence

SimAnt (1991, coupe + surface), Empires of the Undergrowth (marqueurs de phéromone), Antopolis (prévu fin 2026).

## Sources

- Wikipédia EN *Black garden ant*, FR *Lasius niger*
- Detrain et al. 2010, ULiège (sucres du miellat et dépôt de piste)
- *Insects* 2012, 3(1):120 (demande en protéines des larves et pucerons)
- Kramer et al. 2016, *Exp. Gerontol.* (durée de vie des ouvrières)
- Kipyatkov & Lopatina 2015, *Entomol. Sci.* (développement et température)
- Czaczkes et al. 2023, *Ecol. Entomol.* (agression entre voisines)
- Stukalyuk 2025, *Zoodiversity* (complexes de nids)
- *J. Anim. Ecol.* 2024 (architecture du nid et température), PNAS 2016 (nid 3D)
- Fiches d'élevage (antstore, ant-shack, formiculture) pour les durées en terrarium
