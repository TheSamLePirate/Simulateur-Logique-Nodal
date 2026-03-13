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
    code: `; Fibonacci - Stocke les résultats en mémoire à partir de 0x80
  LDA 0        ; fib(0) = 0
  STA 0x80     ; MEM[0x80] = 0
  LDA 1        ; fib(1) = 1
  STA 0x81     ; MEM[0x81] = 1
  LDB 0x82     ; B = adresse courante (0x82)

  LDA 0        ; A = fib(n-2) = 0
  TAB           ; sauvegarde adresse dans B
  LDB 0        ; B = fib(n-2) = 0
  LDA 1        ; A = fib(n-1) = 1

fib_loop:
  PUSH          ; sauvegarder fib(n-1)
  ADDB          ; A = fib(n-1) + fib(n-2)
  JC done       ; si carry (overflow), arrêter
  ; Stocker le résultat — on utilise un compteur en mémoire
  STA 0xF0     ; temp: sauver A (nouveau fib)
  POP           ; A = ancien fib(n-1)
  TAB           ; B = ancien fib(n-1) = nouveau fib(n-2)
  LDM 0xF0     ; A = nouveau fib
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
; Résultat dans A (5! = 120)
  LDA 1        ; A = résultat = 1
  LDB 5        ; B = compteur = 5
  STB 0xF0     ; MEM[0xF0] = compteur

mul_loop:
  LBM 0xF0     ; B = compteur
  CMP 0        ; A utilise CMP pour vérifier B... non
  ; Vérifier si compteur == 0
  PUSH          ; sauver résultat
  TBA           ; A = compteur
  CMP 1        ; compteur <= 1 ?
  POP           ; restaurer résultat dans A
  JZ done       ; si compteur == 1, terminé

  ; Multiplier: résultat = résultat * compteur
  ; On simule la multiplication par additions répétées
  TAB           ; B = résultat actuel
  STA 0xF1     ; sauver résultat
  LBM 0xF0     ; B = compteur
  DEC           ; compteur - 1 fois ajouter
  TAB           ; B = compteur - 1
  STB 0xF2     ; MEM[0xF2] = nombre d'additions restantes
  LDM 0xF1     ; A = résultat original

add_loop:
  LBM 0xF2     ; B = additions restantes
  PUSH
  TBA           ; A = additions restantes
  CMP 0
  POP           ; restaurer A
  JZ mul_next   ; si 0, passer au compteur suivant

  LBM 0xF1     ; B = résultat original
  ADDB          ; A += résultat original
  PUSH
  LBM 0xF2
  TBA
  DEC
  TAB
  STB 0xF2     ; décrémenter additions restantes
  POP
  JMP add_loop

mul_next:
  ; A contient résultat * compteur
  STA 0xF1     ; sauver nouveau résultat
  LBM 0xF0     ; compteur
  TBA
  DEC
  TAB
  STB 0xF0     ; décrémenter compteur
  LDM 0xF1     ; A = résultat
  JMP mul_loop

done:
  OUTD          ; affiche 120
  HLT`,
  },
];
