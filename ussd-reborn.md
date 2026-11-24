# Projet : USSD-Reborn (GhostSignal)
**Catégorie Kiroween 2026 :** Resurrection / Skeleton Crew  
**Localisation & Contexte :** Cameroun (Douala / Yaoundé) — Accès aux services intelligents sans connexion internet ni smartphone.

---

## 1. Problème Réel
Au Cameroun et dans toute l'Afrique subsaharienne, des millions d'utilisateurs dépendent quotidiennement du protocole **USSD** (`*126#`, `#150#`) pour leurs opérations essentielles, car la data mobile est coûteuse ou instable hors des centres urbains. Cependant, les menus USSD traditionnels sont rigides, statiques et incapables de répondre à des besoins contextuels (diagnostic agricole, orientation pharmaceutique, suivi des prix des vivres).

## 2. Solution Technique
**USSD-Reborn** ressuscite le protocole télécom GSM/USSD en le couplant à un moteur d'IA conversationnelle optimisé pour les contraintes extrêmes des réseaux 2G :
- **Machine à états universelle (`CON` / `END`) :** Gestion fine des sessions, retours arrière (`0`), pagination automatique (`99. Suite`) et gestion des délais d'expiration télécom.
- **Compresseur sémantique GSM (≤ 160 caractères) :** Pipeline IA qui reformule toute réponse en texte clair, sans caractères spéciaux incompatibles, respectant strictement la limite de 160 caractères par écran USSD, avec repli déterministe local en cas de latence réseau.
- **Double interface d'entrée :** Un adaptateur webhook standard (compatible Africa's Talking / opérateurs télécoms) et un **simulateur de téléphone rétro interactif sur le web** permettant aux juges de tester le flux complet en 15 secondes sans carte SIM locale.

## 3. Architecture & Stack
- **Backend :** Python 3.12 + FastAPI + SQLite (stockage léger des sessions).
- **Frontend :** Next.js (App Router) + TypeScript + Tailwind CSS (simulateur téléphone phosphore vert + inspecteur de trames USSD en direct).
- **IA :** LLM avec contrainte de formatage stricte et cache/fallback déterministe.

## 4. Cas d'Usage Cameroun (MVP)
1. **AgriPulse (`*384*1#`) :** Repères de prix des vivres (plantain, manioc, macabo, huile de palme) sur les marchés de Douala (Sandaga) et Yaoundé (Mfoundi) + conseils rapides sur les cultures (cacao).
2. **MediGuide (`*384*2#`) :** Rappels de posologie simples, consignes d'hydratation et orientation vers les zones de pharmacies de garde (Akwa, Bonapriso, Makepe).

## 5. Intégration Kiro (`.kiro/`)
- **`.kiro/specs/ussd-gateway/` :** Spécification formelle des états de session, codes de contrôle et gestion des erreurs.
- **`.kiro/steering/gsm-constraints.md` :** Règle permanente interdisant toute sortie USSD supérieure à 160 caractères ou dépourvue du préfixe `CON`/`END`.
- **`.kiro/hooks/test-ussd-length.json` :** Exécution automatique de `pytest` sur les limites de caractères à chaque sauvegarde.
