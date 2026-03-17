/**
 * Example assembly programs for the 8-bit CPU.
 */

import { BOOTLOADER_SOURCE } from "./bootloader";
import { ASM_FS_EDITOR_SOURCE } from "./asmFsEditor";
import { ASM_PLOTTER_SHELL_SOURCE } from "./asmPlotterShell";
import {
  BOOT_ARG_COUNT_ADDR,
  BOOT_ARG0_SIZE_ADDR,
  BOOT_ARG0_START_PAGE_ADDR,
} from "./bootArgs";

export interface Example {
  name: string;
  description: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: "Hello World",
    description: "Affiche 'HELLO' dans la console",
    code: `; Hello World - Affiche HELLO dans la console
  OUT 'H'
  OUT 'E'
  OUT 'L'
  OUT 'L'
  OUT 'O'
  HLT`,
  },
  {
    name: "Compteur 0-9",
    description: "Compte de 0 à 9 et affiche chaque chiffre",
    code: `; Compteur de 0 à 9
  LDA 0        ; A = 0
loop:
  ADD 48       ; A += '0' (ASCII)
  OUTA         ; affiche le caractère
  SUB 48       ; retire le décalage ASCII
  INC          ; A++
  CMP 10       ; compare avec 10
  JNZ loop     ; si A != 10, boucler
  HLT`,
  },
  {
    name: "Fibonacci",
    description: "Calcule les nombres de Fibonacci et les stocke en mémoire",
    code: `; Fibonacci - Stocke les résultats en mémoire à partir de 0x1000
  LDA 0        ; fib(0) = 0
  STA 0x1000   ; MEM[0x1000] = 0
  LDA 1        ; fib(1) = 1
  STA 0x1001   ; MEM[0x1001] = 1

  LDB 0        ; B = fib(n-2) = 0
  LDA 1        ; A = fib(n-1) = 1

fib_loop:
  PUSH          ; sauvegarder fib(n-1)
  ADDB          ; A = fib(n-1) + fib(n-2)
  JC done       ; si carry (overflow), arrêter
  ; Stocker le résultat — on utilise une adresse en mémoire
  STA 0x1010   ; temp: sauver A (nouveau fib)
  POP           ; A = ancien fib(n-1)
  TAB           ; B = ancien fib(n-1) = nouveau fib(n-2)
  LDM 0x1010   ; A = nouveau fib
  OUTD          ; afficher le nombre
  OUT ' '       ; espace
  JMP fib_loop

done:
  HLT`,
  },
  {
    name: "Addition",
    description: "Additionne deux nombres et affiche le résultat",
    code: `; Addition de deux nombres
  LDA 25       ; A = 25
  LDB 17       ; B = 17 (stocké dans registre B via LDB)
  ; On recharge B comme valeur pour l'addition
  ADD 17       ; A = 25 + 17 = 42
  OUTD         ; affiche 42
  HLT`,
  },
  {
    name: "Factorielle",
    description: "Calcule 5! = 120",
    code: `; Factorielle de 5
; Résultat: 5! = 120
; MEM[0x1010] = compteur, MEM[0x1011] = résultat
; MEM[0x1012] = additions restantes, MEM[0x1013] = accumulateur
  LDA 1
  STA 0x1011   ; résultat = 1
  LDA 5
  STA 0x1010   ; compteur = 5

mul_loop:
  LDM 0x1010   ; A = compteur
  CMP 1
  JZ done       ; si compteur <= 1, terminé

  ; Multiplier résultat par compteur (additions répétées)
  LDM 0x1010   ; A = compteur
  DEC           ; A = compteur - 1
  STA 0x1012   ; additions restantes = compteur - 1
  LDM 0x1011   ; A = résultat (accumulateur de départ)

add_loop:
  LBM 0x1011   ; B = résultat original
  ADDB          ; A += résultat original
  STA 0x1013   ; sauver accumulateur (STA ne touche pas les flags)
  LDM 0x1012   ; A = restantes
  DEC           ; restantes - 1 (DEC met le flag Z si résultat == 0)
  STA 0x1012   ; restantes-- (STA préserve le flag Z)
  JZ mul_next   ; si restantes == 0, sortir du add_loop
  LDM 0x1013   ; A = accumulateur
  JMP add_loop

mul_next:
  LDM 0x1013   ; A = résultat * compteur
  STA 0x1011   ; sauver nouveau résultat
  LDM 0x1010   ; A = compteur
  DEC
  STA 0x1010   ; compteur--
  JMP mul_loop

done:
  LDM 0x1011   ; A = résultat final
  OUTD          ; affiche 120
  HLT`,
  },
  {
    name: "Plotter - Carré",
    description: "Dessine un carré sur le plotter",
    code: `; Dessine un carré 50x50 sur le plotter
; Coin supérieur gauche: (20, 20)
; Coin inférieur droit: (70, 70)
  CLR           ; effacer le plotter

  ; --- Lignes horizontales (haut et bas) ---
  LDA 20       ; x = 20
  LDB 20       ; y = 20 (haut)
h_loop:
  DRAW          ; pixel(A, B)
  LDB 70       ; y = 70 (bas)
  DRAW          ; pixel(A, B)
  LDB 20       ; y = 20
  INC           ; x++
  CMP 71       ; x <= 70 ?
  JNZ h_loop

  ; --- Lignes verticales (gauche et droite) ---
  LDA 20       ; x = 20
  LDB 21       ; y = 21 (skip corners)
v_loop:
  DRAW          ; pixel(20, B)
  LDA 70       ; x = 70
  DRAW          ; pixel(70, B)
  LDA 20       ; x = 20
  TBA           ; A = B (y)
  INC           ; y++
  TAB           ; B = y
  CMP 70       ; y < 70 ?
  JNZ v_loop

  HLT`,
  },
  {
    name: "Echo (Saisie)",
    description: "Lit des caractères au clavier et les réaffiche",
    code: `; Echo - Lit des caracteres et les reaffiche
; Tapez du texte dans le champ de saisie et appuyez sur Entree
  OUT 'T'
  OUT 'a'
  OUT 'p'
  OUT 'e'
  OUT 'z'
  OUT ':'
  OUT ' '

loop:
  INA          ; lire un caractere du buffer
  CMP 0        ; buffer vide ?
  JZ loop      ; oui -> attendre
  CMP 10       ; newline ?
  JZ newline
  OUTA         ; afficher le caractere
  JMP loop

newline:
  OUT 10       ; saut de ligne
  JMP loop`,
  },
  {
    name: "Unix Bootloader",
    description: "Replica exacte du vrai bootloader assembleur du simulateur",
    code: BOOTLOADER_SOURCE,
  },
  {
    name: "Éditeur FS ASM",
    description: "Editeur texte ASM multi-fichier avec /o nom, fleches, sauvegarde et FS partage",
    code: ASM_FS_EDITOR_SOURCE,
  },
  {
    name: "Super Unix Shell Plotter",
    description: "Shell graphique ASM sur le plotter avec fontes LETTERS/DIGITS du FS partage",
    code: ASM_PLOTTER_SHELL_SOURCE,
  },
  {
    name: "Majuscules (Saisie)",
    description: "Convertit les minuscules en majuscules",
    code: `; Convertisseur majuscules
; Les lettres minuscules (a-z) deviennent majuscules (A-Z)
  OUT '>'
  OUT ' '

loop:
  INA          ; lire un caractere
  CMP 0
  JZ loop      ; attendre si vide
  CMP 10       ; newline ?
  JZ newline
  ; Verifier si c'est une minuscule (97-122)
  PUSH         ; sauvegarder le char
  SUB 97       ; A = char - 'a'
  JN not_lower ; si negatif, pas minuscule
  CMP 26       ; >= 26 ?
  JNC not_lower
  ; C'est une minuscule: convertir
  POP          ; A = char original
  SUB 32       ; A = majuscule (A-Z = a-z - 32)
  OUTA
  JMP loop

not_lower:
  POP          ; A = char original
  OUTA
  JMP loop

newline:
  OUT 10       ; nouvelle ligne
  OUT '>'
  OUT ' '
  JMP loop`,
  },
  {
    name: "Plotter RGB - Paysage",
    description: "Grand paysage coloré en assembleur avec ciel, soleil, montagnes et sapins",
    code: `; Paysage RGB plus ambitieux en assembleur
; Bandes de ciel, soleil, nuages, montagnes, reflets et sapins
; Temporaires: 0x1100=x0, 0x1101=x1, 0x1102=y
  CLR

  ; --- Ciel nocturne ---
  LDA 8
  COLR
  LDA 18
  COLG
  LDA 70
  COLB
  LDB 0
sky1_row:
  LDA 0
sky1_px:
  DRAW
  INC
  JNZ sky1_px
  TBA
  INC
  TAB
  CMP 32
  JNZ sky1_row

  ; --- Ciel bleu ---
  LDA 36
  COLR
  LDA 86
  COLG
  LDA 160
  COLB
sky2_row:
  LDA 0
sky2_px:
  DRAW
  INC
  JNZ sky2_px
  TBA
  INC
  TAB
  CMP 72
  JNZ sky2_row

  ; --- Horizon chaud ---
  LDA 255
  COLR
  LDA 132
  COLG
  LDA 82
  COLB
sky3_row:
  LDA 0
sky3_px:
  DRAW
  INC
  JNZ sky3_px
  TBA
  INC
  TAB
  CMP 112
  JNZ sky3_row

  ; --- Lac ---
  LDA 18
  COLR
  LDA 86
  COLG
  LDA 138
  COLB
lake_row:
  LDA 0
lake_px:
  DRAW
  INC
  JNZ lake_px
  TBA
  INC
  TAB
  CMP 192
  JNZ lake_row

  ; --- Prairie / avant-plan ---
  LDA 20
  COLR
  LDA 74
  COLG
  LDA 28
  COLB
meadow_row:
  LDA 0
meadow_px:
  DRAW
  INC
  JNZ meadow_px
  TBA
  INC
  TAB
  JNZ meadow_row

  ; --- Etoiles ---
  LDA 255
  COLR
  LDA 255
  COLG
  LDA 255
  COLB
  LDA 18   ; (18,14)
  LDB 14
  DRAW
  LDA 72   ; (72,10)
  LDB 10
  DRAW
  LDA 136  ; (136,12)
  LDB 12
  DRAW
  LDA 226  ; (226,16)
  LDB 16
  DRAW
  LDA 244  ; (244,26)
  LDB 26
  DRAW

  ; --- Nuages ---
  LDA 228
  COLR
  LDA 228
  COLG
  LDA 228
  COLB
  LDB 40
  LDA 34
cloud1a:
  DRAW
  CMP 62
  JZ cloud1b_go
  INC
  JMP cloud1a
cloud1b_go:
  LDB 44
  LDA 28
cloud1b:
  DRAW
  CMP 64
  JZ cloud1c_go
  INC
  JMP cloud1b
cloud1c_go:
  LDB 48
  LDA 38
cloud1c:
  DRAW
  CMP 70
  JZ cloud2_go
  INC
  JMP cloud1c

cloud2_go:
  LDB 54
  LDA 188
cloud2a:
  DRAW
  CMP 214
  JZ cloud2b_go
  INC
  JMP cloud2a
cloud2b_go:
  LDB 58
  LDA 180
cloud2b:
  DRAW
  CMP 216
  JZ cloud2c_go
  INC
  JMP cloud2b
cloud2c_go:
  LDB 62
  LDA 192
cloud2c:
  DRAW
  CMP 222
  JZ sun_outer_go
  INC
  JMP cloud2c

  ; --- Soleil externe ---
sun_outer_go:
  LDA 255
  COLR
  LDA 150
  COLG
  LDA 60
  COLB
  LDA 28
  STA 0x1102
sun1_row:
  LDM 0x1102
  TAB
  LDA 176
sun1_px:
  DRAW
  CMP 222
  JZ sun1_next
  INC
  JMP sun1_px
sun1_next:
  LDM 0x1102
  INC
  STA 0x1102
  CMP 69
  JNZ sun1_row

  ; --- Soleil moyen ---
  LDA 255
  COLR
  LDA 214
  COLG
  LDA 88
  COLB
  LDA 34
  STA 0x1102
sun2_row:
  LDM 0x1102
  TAB
  LDA 184
sun2_px:
  DRAW
  CMP 214
  JZ sun2_next
  INC
  JMP sun2_px
sun2_next:
  LDM 0x1102
  INC
  STA 0x1102
  CMP 63
  JNZ sun2_row

  ; --- Coeur du soleil ---
  LDA 255
  COLR
  LDA 245
  COLG
  LDA 190
  COLB
  LDA 40
  STA 0x1102
sun3_row:
  LDM 0x1102
  TAB
  LDA 191
sun3_px:
  DRAW
  CMP 207
  JZ sun3_next
  INC
  JMP sun3_px
sun3_next:
  LDM 0x1102
  INC
  STA 0x1102
  CMP 57
  JNZ sun3_row

  ; --- Montagne gauche ---
  LDA 26
  COLR
  LDA 18
  COLG
  LDA 50
  COLB
  LDA 96
  STA 0x1100
  STA 0x1101
  LDA 74
  STA 0x1102
m1_row:
  LDM 0x1100
m1_px:
  LBM 0x1102
  DRAW
  LBM 0x1101
  CMPB
  JZ m1_next
  INC
  JMP m1_px
m1_next:
  LDM 0x1100
  DEC
  STA 0x1100
  LDM 0x1101
  INC
  STA 0x1101
  LDM 0x1102
  INC
  STA 0x1102
  CMP 155
  JNZ m1_row

  ; --- Montagne droite ---
  LDA 44
  COLR
  LDA 24
  COLG
  LDA 68
  COLB
  LDA 188
  STA 0x1100
  STA 0x1101
  LDA 92
  STA 0x1102
m2_row:
  LDM 0x1100
m2_px:
  LBM 0x1102
  DRAW
  LBM 0x1101
  CMPB
  JZ m2_next
  INC
  JMP m2_px
m2_next:
  LDM 0x1100
  DEC
  STA 0x1100
  LDM 0x1101
  INC
  STA 0x1101
  LDM 0x1102
  INC
  STA 0x1102
  CMP 165
  JNZ m2_row

  ; --- Reflets sur le lac ---
  LDA 255
  COLR
  LDA 210
  COLG
  LDA 90
  COLB
  LDB 142
  LDA 184
refl1:
  DRAW
  CMP 208
  JZ refl2_go
  INC
  JMP refl1
refl2_go:
  LDB 150
  LDA 180
refl2:
  DRAW
  CMP 212
  JZ refl3_go
  INC
  JMP refl2
refl3_go:
  LDB 158
  LDA 176
refl3:
  DRAW
  CMP 216
  JZ refl4_go
  INC
  JMP refl3
refl4_go:
  LDA 255
  COLR
  LDA 255
  COLG
  LDA 220
  COLB
  LDB 146
  LDA 192
refl4:
  DRAW
  CMP 200
  JZ refl5_go
  INC
  JMP refl4
refl5_go:
  LDB 154
  LDA 190
refl5:
  DRAW
  CMP 202
  JZ trees_go
  INC
  JMP refl5

  ; --- Sapin gauche ---
trees_go:
  LDA 70
  COLR
  LDA 40
  COLG
  LDA 20
  COLB
  LDA 210
  STA 0x1102
tree1_trunk:
  LDM 0x1102
  TAB
  LDA 22
tree1_trunk_px:
  DRAW
  CMP 24
  JZ tree1_trunk_next
  INC
  JMP tree1_trunk_px
tree1_trunk_next:
  LDM 0x1102
  INC
  STA 0x1102
  CMP 240
  JNZ tree1_trunk

  LDA 10
  COLR
  LDA 70
  COLG
  LDA 25
  COLB
  LDB 198
  LDA 14
tree1_a:
  DRAW
  CMP 32
  JZ tree1_b_go
  INC
  JMP tree1_a
tree1_b_go:
  LDB 192
  LDA 16
tree1_b:
  DRAW
  CMP 30
  JZ tree1_c_go
  INC
  JMP tree1_b
tree1_c_go:
  LDB 186
  LDA 18
tree1_c:
  DRAW
  CMP 28
  JZ tree1_d_go
  INC
  JMP tree1_c
tree1_d_go:
  LDB 180
  LDA 20
tree1_d:
  DRAW
  CMP 26
  JZ tree2_go
  INC
  JMP tree1_d

  ; --- Sapin droit ---
tree2_go:
  LDA 70
  COLR
  LDA 40
  COLG
  LDA 20
  COLB
  LDA 214
  STA 0x1102
tree2_trunk:
  LDM 0x1102
  TAB
  LDA 230
tree2_trunk_px:
  DRAW
  CMP 232
  JZ tree2_trunk_next
  INC
  JMP tree2_trunk_px
tree2_trunk_next:
  LDM 0x1102
  INC
  STA 0x1102
  CMP 244
  JNZ tree2_trunk

  LDA 8
  COLR
  LDA 62
  COLG
  LDA 20
  COLB
  LDB 202
  LDA 222
tree2_a:
  DRAW
  CMP 240
  JZ tree2_b_go
  INC
  JMP tree2_a
tree2_b_go:
  LDB 196
  LDA 224
tree2_b:
  DRAW
  CMP 238
  JZ tree2_c_go
  INC
  JMP tree2_b
tree2_c_go:
  LDB 190
  LDA 226
tree2_c:
  DRAW
  CMP 236
  JZ tree2_d_go
  INC
  JMP tree2_c
tree2_d_go:
  LDB 184
  LDA 228
tree2_d:
  DRAW
  CMP 234
  JZ done_rgb_scene
  INC
  JMP tree2_d

done_rgb_scene:
  HLT`,
  },
  {
    name: "Boot Args - Cat",
    description: "Affiche le fichier passe a 'run bootcat nom' sans rescanner le FS",
    code: `; Utilisation:
;   run bootcat notes
; Le bootloader remplit 0x1018..0x101F avant le saut au programme.

  LDM ${BOOT_ARG_COUNT_ADDR}
  CMP 0
  JNZ have_file
  OUT 'N'
  OUT 'O'
  OUT ' '
  OUT 'A'
  OUT 'R'
  OUT 'G'
  OUT 10
  HLT

have_file:
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  DRVPG
  LDA 0
  STA 0x1100

read_loop:
  LDM 0x1100
  TAB
  LDM ${BOOT_ARG0_SIZE_ADDR}
  CMPB
  JZ done
  TBA
  DRVRD
  OUTA
  LDM 0x1100
  INC
  STA 0x1100
  JMP read_loop

done:
  HLT`,
  },
];
