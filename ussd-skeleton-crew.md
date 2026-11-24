# Projet : USSD-Skeleton-Crew
**Catégorie Kiroween 2026 :** Skeleton Crew (5 000 $ USD + éligible Grand Prix)  
**Objectif :** Démontrer qu'un squelette léger (< 400 lignes) permet de déployer deux services USSD radicalement différents à partir de simples manifestes déclaratifs.

---

## 1. Architecture du Squelette (`core/`)
Le noyau commun gère toute la plomberie télécom et l'interface utilisateur sans aucune logique métier codée en dur :
- **`core/session_engine.py` :** Stack de navigation, gestion des états `CON` / `END`, historique des saisies (`1*2*1`).
- **`core/gsm_compressor.py` :** Troncature intelligente, pagination automatique à 160 caractères et normalisation ASCII.
- **`core/webhook_adapter.py` :** Compatibilité simultanée `application/x-www-form-urlencoded` (passerelle télécom) et `application/json` (simulateur web).
- **`frontend/` :** Simulateur web universel doté d'un sélecteur instantané **App 1 ↔ App 2** adaptant le code court, la palette visuelle et l'arbre de décision.

## 2. Les Deux Applications Distinctes (Obligatoire pour Skeleton Crew)
### Application 1 : `apps/agripulse` (`*384*1#`)
- **Domaine :** Agriculture & Marchés vivriers au Cameroun.
- **Fonctionnalités :** Consultation des prix du jour par marché, diagnostic rapide des maladies du cacaoyer, alertes météo agricoles courtes.
- **Identité UI :** Thème vert phosphore / terre.

### Application 2 : `apps/tontine-check` (`*384*2#`)
- **Domaine :** Finance communautaire & Tontines.
- **Fonctionnalités :** Vérification du tour de bénéficiaire, calcul automatique des pénalités de retard, consultation du solde de la caisse de secours et vérification d'un code de quittance.
- **Identité UI :** Thème ambre / or.

## 3. Intégration Kiro (`.kiro/`)
- **`.kiro/specs/skeleton-contract/` :** Définition du schéma JSON que chaque application enfant doit respecter.
- **`.kiro/steering/zero-hardcoding.md` :** Règle interdisant toute référence métier (agricole ou financière) à l'intérieur du dossier `core/`.
- **`.kiro/hooks/validate-manifests.json` :** Hook vérifiant automatiquement la validité des manifestes des 2 apps et les contraintes de longueur GSM à chaque édition.
