# C Program Size Comparison

This document compares the assembled size of every bundled C example between:

- baseline commit: `56f938c0df8094c15b2e4046e0e4a57c38a701f2`
- current workspace state

Method:

- use the compiler and assembler from each revision
- compile the bundled `C_EXAMPLES` from each revision
- match programs by example name
- compare final assembled byte size
- generate the report with `npm run compare:c-sizes -- 56f938c0df8094c15b2e4046e0e4a57c38a701f2 --md docs/c-program-size-comparison-56f938c0-to-now.md`

Summary:

- common programs compared: `36`
- total size at `56f938c0df8094c15b2e4046e0e4a57c38a701f2`: `45299` bytes
- total size now: `31220` bytes
- total gain: `-14079` bytes
- relative gain: `-31.1%`
- programs smaller now: `36`
- programs larger now: `0`

## Full Table

| Program | Old Size | New Size | Delta | Delta % |
|---|---:|---:|---:|---:|
| Boot Args - Cat | 110 | 81 | -29 | -26.4% |
| Calcul | 222 | 199 | -23 | -10.4% |
| Calculatrice | 2959 | 1786 | -1173 | -39.6% |
| Calculatrice Graphique | 2486 | 1686 | -800 | -32.2% |
| Cercle | 302 | 193 | -109 | -36.1% |
| Clavier | 450 | 312 | -138 | -30.7% |
| Compteur | 54 | 38 | -16 | -29.6% |
| Compteur de lettres | 202 | 136 | -66 | -32.7% |
| Const et String | 775 | 675 | -100 | -12.9% |
| Courbe | 142 | 108 | -34 | -23.9% |
| Démo Ultime | 2436 | 1792 | -644 | -26.4% |
| Echo (Saisie) | 115 | 73 | -42 | -36.5% |
| Éditeur Multi-fichier FS | 4089 | 2605 | -1484 | -36.3% |
| Éditeur Texte FS | 2183 | 1444 | -739 | -33.9% |
| Étoiles | 160 | 99 | -61 | -38.1% |
| Factorielle | 103 | 88 | -15 | -14.6% |
| Fibonacci | 92 | 72 | -20 | -21.7% |
| FS Disque Externe | 3774 | 2426 | -1348 | -35.7% |
| Hello World | 41 | 40 | -1 | -2.4% |
| Horloge | 155 | 114 | -41 | -26.5% |
| HTTP JSONPlaceholder | 273 | 252 | -21 | -7.7% |
| Meteo Ales | 4090 | 2857 | -1233 | -30.1% |
| Mini Shell | 4026 | 2597 | -1429 | -35.5% |
| Paysage RGB | 2939 | 2255 | -684 | -23.3% |
| Plotter | 164 | 118 | -46 | -28.0% |
| Pong | 855 | 498 | -357 | -41.8% |
| Spirale | 329 | 229 | -100 | -30.4% |
| Système Solaire 255 | 2819 | 1964 | -855 | -30.3% |
| Tableau (Fonction) | 278 | 232 | -46 | -16.5% |
| Tableau (Nouvelles Fonctionnalites) | 581 | 463 | -118 | -20.3% |
| Tableau (Tri) | 437 | 303 | -134 | -30.7% |
| Tableau de nombres premiers | 305 | 234 | -71 | -23.3% |
| Test Mémoire | 718 | 511 | -207 | -28.8% |
| Traceur de droite | 665 | 421 | -244 | -36.7% |
| writeDigits | 3215 | 2350 | -865 | -26.9% |
| writeLetters | 2755 | 1969 | -786 | -28.5% |

## Biggest Wins

| Program | Delta |
|---|---:|
| Éditeur Multi-fichier FS | -1484 |
| Mini Shell | -1429 |
| FS Disque Externe | -1348 |
| Meteo Ales | -1233 |
| Calculatrice | -1173 |
| writeDigits | -865 |
| Système Solaire 255 | -855 |
| Calculatrice Graphique | -800 |
| writeLetters | -786 |
| Éditeur Texte FS | -739 |
