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
; Résultat: 5! = 120
; MEM[0xF0] = compteur, MEM[0xF1] = résultat, MEM[0xF2] = additions restantes
  LDA 1
  STA 0xF1     ; résultat = 1
  LDA 5
  STA 0xF0     ; compteur = 5

mul_loop:
  LDM 0xF0     ; A = compteur
  CMP 1
  JZ done       ; si compteur <= 1, terminé

  ; Multiplier résultat par compteur (additions répétées)
  LDM 0xF0     ; A = compteur
  DEC           ; A = compteur - 1
  STA 0xF2     ; additions restantes = compteur - 1
  LDM 0xF1     ; A = résultat (accumulateur)

add_loop:
  LBM 0xF1     ; B = résultat original
  ADDB          ; A += résultat original
  PUSH          ; sauver A
  LDM 0xF2     ; A = restantes
  DEC
  STA 0xF2     ; restantes--
  CMP 0
  POP           ; A = accumulateur
  JNZ add_loop  ; continuer si restantes > 0

  ; A = résultat * compteur
  STA 0xF1     ; sauver nouveau résultat
  LDM 0xF0     ; A = compteur
  DEC
  STA 0xF0     ; compteur--
  JMP mul_loop

done:
  LDM 0xF1     ; A = résultat final
  OUTD          ; affiche 120
  HLT`,
  },
];
