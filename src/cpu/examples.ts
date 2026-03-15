/**
 * Example assembly programs for the 8-bit CPU.
 */

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
    code: `; Fibonacci - Stocke les résultats en mémoire à partir de 0x400
  LDA 0        ; fib(0) = 0
  STA 0x400    ; MEM[0x400] = 0
  LDA 1        ; fib(1) = 1
  STA 0x401    ; MEM[0x401] = 1

  LDB 0        ; B = fib(n-2) = 0
  LDA 1        ; A = fib(n-1) = 1

fib_loop:
  PUSH          ; sauvegarder fib(n-1)
  ADDB          ; A = fib(n-1) + fib(n-2)
  JC done       ; si carry (overflow), arrêter
  ; Stocker le résultat — on utilise une adresse en mémoire
  STA 0x410    ; temp: sauver A (nouveau fib)
  POP           ; A = ancien fib(n-1)
  TAB           ; B = ancien fib(n-1) = nouveau fib(n-2)
  LDM 0x410    ; A = nouveau fib
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
; MEM[0x410] = compteur, MEM[0x411] = résultat
; MEM[0x412] = additions restantes, MEM[0x413] = accumulateur
  LDA 1
  STA 0x411    ; résultat = 1
  LDA 5
  STA 0x410    ; compteur = 5

mul_loop:
  LDM 0x410    ; A = compteur
  CMP 1
  JZ done       ; si compteur <= 1, terminé

  ; Multiplier résultat par compteur (additions répétées)
  LDM 0x410    ; A = compteur
  DEC           ; A = compteur - 1
  STA 0x412    ; additions restantes = compteur - 1
  LDM 0x411    ; A = résultat (accumulateur de départ)

add_loop:
  LBM 0x411    ; B = résultat original
  ADDB          ; A += résultat original
  STA 0x413    ; sauver accumulateur (STA ne touche pas les flags)
  LDM 0x412    ; A = restantes
  DEC           ; restantes - 1 (DEC met le flag Z si résultat == 0)
  STA 0x412    ; restantes-- (STA préserve le flag Z)
  JZ mul_next   ; si restantes == 0, sortir du add_loop
  LDM 0x413    ; A = accumulateur
  JMP add_loop

mul_next:
  LDM 0x413    ; A = résultat * compteur
  STA 0x411    ; sauver nouveau résultat
  LDM 0x410    ; A = compteur
  DEC
  STA 0x410    ; compteur--
  JMP mul_loop

done:
  LDM 0x411    ; A = résultat final
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
];
