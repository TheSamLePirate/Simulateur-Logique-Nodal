# Guide Utilisateur Simple

Cette application est un terrain de jeu informatique complet et compréhensible.

Elle permet d’explorer l’informatique du bas vers le haut :

- des **transistors**
- aux **portes logiques**
- à un **ordinateur 8 bits**
- à l’**assembleur**
- à un petit **langage C**
- jusqu’à un bootloader et un minuscule **userland de type Linux**

Toute la machine virtuelle est écrite en **TypeScript**, donc chaque couche peut être lue et comprise. Elle se comporte comme un petit ordinateur de style 1983, avec quelques extras modernes comme un pont HTTP, un simulateur très rapide et des outils visuels intégrés.

---

## Démarrage Rapide

La meilleure manière de comprendre l’application rapidement est la suivante :

1. ouvrir l’onglet `Matériel`
2. appuyer sur le bouton `Scènes`
3. sélectionner `1. Va-et-vient`
4. suivre le tutoriel pas à pas
5. aller ensuite voir la partie CPU / matériel
6. revenir enfin dans `Logiciel`

### Pourquoi ce démarrage rapide est le bon

`1. Va-et-vient` est une scène très petite et très pédagogique.

Elle permet de découvrir l’application dans le bon ordre :

- d’abord, comment un circuit simple réagit
- ensuite, comment les signaux circulent
- ensuite, de quoi sont faits les blocs matériels plus gros
- enfin, comment la partie logicielle repose sur ce matériel

Le parcours recommandé est donc :

1. commencer par `Matériel -> Scènes -> 1. Va-et-vient`
2. suivre le tutoriel jusqu’à ce que le comportement devienne évident
3. passer à `Matériel` pour regarder les éléments orientés CPU
4. revenir à `Logiciel` pour lancer de vrais programmes

Cette progression est bien meilleure qu’un saut immédiat dans l’ordinateur complet, parce qu’elle construit d’abord une intuition sur un exemple minuscule, puis monte vers le CPU, puis vers la programmation.

---

## 1. Ce Qu’est Cette Application

Il y a en réalité **deux applications en une**.

### Côté matériel

On construit et inspecte la machine elle-même :

- transistors
- portes logiques
- registres
- ALU
- RAM
- horloge
- CPU 8 bits complet

### Côté logiciel

On utilise cette machine comme un ordinateur :

- écrire de l’ASM
- écrire de petits programmes en C
- lancer le bootloader
- installer le disque userland de type Linux
- utiliser la console, le plotter, le disque et le réseau

---

## 2. Pourquoi C’est Spécial

Ce n’est pas un émulateur boîte noire.

L’objectif est d’être **compréhensible** :

- on peut voir les blocs matériels
- on peut inspecter la RAM, les registres et les flags
- on peut lire l’assembleur et le compilateur
- on peut suivre comment un programme devient du code machine
- on peut voir le bootloader et le disque userland comme de vrais fichiers du projet

En bref : c’est une petite **machine virtuelle** avec l’esprit d’un micro-ordinateur ancien, mais plus facile à inspecter qu’un vrai matériel.

Elle possède l’essentiel de ce qu’on attend d’une machine 8 bits classique :

- console texte
- entrée clavier
- plotter graphique
- disque persistant
- bootloader
- programmes sur disque
- compilateur C simple

Et aussi quelques éléments qu’un vrai micro-ordinateur de 1983 n’avait généralement pas :

- un pont **HTTP**
- une exécution logicielle très rapide
- une interface moderne de type débogueur visuel
- une implémentation TypeScript entièrement lisible

---

## 3. Premier Repère

Quand on utilise l’application, on peut la voir comme ceci :

- **scène Hardware / matériel** : apprendre ou inspecter comment l’ordinateur est construit
- **vue Software / logicielle** : programmer réellement la machine et l’utiliser

Si on débute, le chemin le plus simple est :

1. regarder rapidement la scène matérielle de base
2. passer à la vue logicielle
3. lancer un petit programme en C
4. booter le bootloader
5. installer le disque Linux-like
6. essayer quelques commandes userland

---

## 4. Comment Utiliser la Scène Matérielle de Base

La scène matérielle est la partie visuelle et nodale de l’application.

On y voit des composants reliés par des fils. Ces composants peuvent être :

- des entrées et sorties
- des transistors
- des portes logiques
- des registres
- des blocs ALU
- l’horloge et la logique de contrôle
- la mémoire
- des modules CPU/périphériques

### Que faire dans cette vue

Commencer simple :

1. basculer une entrée
2. regarder la couleur du fil changer
3. observer le nœud de sortie

Puis monter d’un niveau :

1. ouvrir une scène avec des transistors ou des portes
2. changer les entrées
3. vérifier le comportement de la table de vérité

Puis regarder la scène ordinateur par défaut :

1. trouver le CPU, la RAM et les blocs d’E/S
2. lancer l’horloge ou avancer pas à pas
3. regarder les valeurs circuler dans le système

### Ce que signifient les couleurs

- les signaux actifs / hauts s’allument
- les signaux inactifs / bas restent atténués
- les fils animés montrent l’activité

### La meilleure manière d’apprendre

Utiliser la scène matérielle pour répondre à des questions comme :

- Que fait un transistor ?
- Comment fonctionne une porte AND ?
- Que contient une ALU ?
- Comment un registre stocke une valeur ?
- Comment l’horloge fait avancer la machine ?

C’est la partie “du transistor à l’ordinateur” de l’application.

---

## 5. Comment Utiliser la Vue Logicielle

La vue logicielle est l’endroit où l’on utilise la machine comme programmeur.

Ici on peut :

- éditer du code ASM ou C
- l’assembler / le compiler
- lancer, mettre en pause, reset ou avancer pas à pas
- inspecter les registres et la mémoire
- voir la sortie console
- dessiner sur le plotter
- utiliser le disque externe

La zone d’exécution à droite a maintenant deux modes :

- `Computer` montre une vue live non éditable de la même machine en cours d’exécution utilisée par la vue logicielle
- `Classic` garde les anciens panneaux séparés pour registres, mémoire, console et plotter

Le panneau `Computer` peut passer en plein écran et sert à voir toute la machine d’un coup sans redescendre au niveau de granularité de la scène hardware. Il regroupe :

- l’état du CPU, les registres, les flags, le résumé des bus/états et l’activité de pile
- l’état mémoire et les arguments du bootloader
- la sortie console et plotter
- l’entrée clavier immédiate, avec un clavier visuel repliable
- le disque externe avec les conventions du système de fichiers du bootloader
- le contrôleur réseau, y compris les dernières requêtes terminées

### Workflow de base

1. choisir `ASM` ou `C`
2. écrire ou charger un programme
3. compiler / assembler
4. l’exécuter
5. inspecter la sortie et l’état

Si quelque chose ne va pas, utiliser :

- la sortie console
- la vue des registres
- la vue mémoire
- le rapport de test généré dans `report/index.html`

Si on veut la vue live la plus large de la machine en cours d’exécution, il faut passer la zone runtime en mode `Computer`. C’est particulièrement utile en mode bootloader, car l’état du disque, du clavier, de la console, du plotter et du réseau y est visible ensemble.
Cette vue `Computer` contient aussi le `Computer Architecture Flow` en direct : un SVG de la machine complète montrant les chemins du CPU, de l’ALU, du bus mémoire, de la console, du clavier, du disque, du réseau et du plotter avec le même renderer que celui utilisé par les snapshots automatisés.

---

## 6. Comment Écrire un Petit Programme en C

Le programme C le plus simple est :

```c
int main() {
  print("Hello World!");
  return 0;
}
```

### Comment le lancer

1. ouvrir la vue logicielle
2. passer le langage de l’éditeur sur `C`
3. coller le programme
4. le compiler
5. l’exécuter

### Un autre tout petit exemple

```c
int main() {
  int a, b;
  a = 7;
  b = 5;
  print("Result: ");
  print_num(a + b);
  putchar(10);
  return 0;
}
```

### Ce que le mini C supporte

Le langage est volontairement petit et facile à comprendre :

- `int`
- `string`
- `const`
- `if`, `else`, `while`, `for`
- fonctions
- tableaux
- paramètres tableau
- chaînes littérales
- built-ins plotter et console

### Point important à retenir

`int` est **non signé sur 8 bits**, donc les valeurs vont de `0` à `255`.

Cela signifie :

- `255 + 1` devient `0`
- `0 - 1` devient `255`

Cela fait partie du charme de la machine : elle se comporte comme un vrai petit système 8 bits.

---

## 7. Comment Utiliser le Bootloader et le Disque Linux-like

L’application inclut un bootloader et un petit userland sur disque de type Linux.

Ce n’est pas un vrai Linux, mais cela ressemble à un petit OS de machine classique :

- les programmes vivent sur disque
- le bootloader les lance
- les fichiers peuvent être lus et écrits
- un prompt shell permet d’explorer le disque

### Flux de boot de base

1. ouvrir la vue logicielle
2. activer ou booter le bootloader
3. installer le disque Linux
4. attendre le prompt shell

Puis essayer :

```text
ls
run hello
run sysinfo
run bootcat readme
run wget url
cat result
```

### Fichiers et programmes utiles fournis

Selon l’image disque courante, on peut y trouver des éléments comme :

- `readme`
- `story`
- `url`
- `result`
- `hello`
- `sysinfo`
- `wget`
- `cp`
- `mv`
- `grep`
- `jsonp`
- `glxsh`
- `glxnano`

### `wget`

Le fichier `url` par défaut pointe vers :

```text
https://jsonplaceholder.typicode.com/todos/1
```

Donc une bonne première démo est :

```text
run wget url
cat result
```

Si on garde la vue logicielle sur le panneau `Computer` pendant l’exécution de `wget`, la carte réseau montre :

- la requête en cours
- le dernier statut terminé
- la dernière URL terminée
- le dernier corps de requête terminé
- le dernier corps de réponse terminé
- un historique récent des requêtes

Cet historique est volontairement court afin que les outils rapides restent inspectables même lorsqu’ils reviennent très vite au shell du bootloader.

### `glxnano`

`glxnano` est l’éditeur de texte graphique.

On le lance ainsi :

```text
run glxnano readme
```

Ensuite on tape directement. Le clavier est immédiat pendant l’exécution du programme.

Dans le panneau runtime `Computer`, la carte clavier reflète ce comportement avec une surface d’entrée repliable, tandis que les cartes plotter et console montrent la sortie live de l’éditeur dans le même tableau de bord plein écran.

Touches typiques :

- flèches pour se déplacer
- `Enter` pour un retour à la ligne
- `Backspace` pour effacer
- `Tab` pour le zoom
- `&` pour le thème
- `\` pour sauvegarder
- `@` pour quitter

---

## 8. Une Bonne Première Visite

Si on veut la visite utile la plus courte de toute l’application :

### Visite A — Comprendre la machine

1. ouvrir la scène matérielle
2. regarder une scène de transistor
3. regarder une scène de porte logique
4. regarder la scène complète de l’ordinateur 8 bits
5. avancer l’horloge et inspecter l’état

### Visite B — Utiliser la machine

1. ouvrir la vue logicielle
2. lancer un petit programme en C
3. dessiner quelque chose sur le plotter
4. booter le bootloader
5. installer le disque Linux
6. lancer `ls`, `run hello`, `run wget url`
7. ouvrir `glxnano`

Cela donne les deux moitiés du projet :

- comment l’ordinateur est construit
- comment l’ordinateur est utilisé

---

## 9. Que Lire Ensuite

Après ce guide utilisateur, les docs plus profondes sont :

- `docs/how-the-hardware-works.md`
- `docs/how-the-computer-works.md`
- `docs/c-language-guide.md`
- `docs/compiler-bugfixes-and-tests.md`

Si on veut voir rapidement le résultat visuel des tests automatisés, il faut ouvrir :

- `report/index.html`

Ce rapport contient maintenant :

- les suites d’images plotter
- les snapshots SVG de l’architecture ordinateur
- les copies PNG de ces snapshots d’architecture
- les exécutions complètes bootloader/Linux en architecture
- un snapshot d’architecture pour chaque exemple C fourni

Règle de test du projet :

- tout ce que l’utilisateur peut lancer sur l’ordinateur doit être testé
- chaque programme exemple fourni doit être exercé via plusieurs workflows si possible
- pour les programmes du userland Linux-like, la suite CPU directe et la suite Computer Architecture Flow doivent couvrir le même ensemble exécutable
- dans ce projet, c’est le sens pratique de `100% test coverage`

---

## 10. Modèle Mental Final

Cette application est :

- un outil pédagogique “du transistor à l’ordinateur”
- une petite machine rétro 8 bits
- une machine virtuelle TypeScript lisible
- un terrain de jeu de programmation avec ASM, C, bootloader, disque, graphismes et HTTP

Si on veut une seule phrase :

**C’est un ordinateur 8 bits entièrement compréhensible, construit en TypeScript, qui permet d’apprendre l’informatique depuis les transistors jusqu’à un petit userland de type système d’exploitation.**
