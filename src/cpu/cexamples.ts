/**
 * Example C programs for the simple C compiler.
 */

export interface CExample {
  name: string;
  description: string;
  code: string;
}

export const C_EXAMPLES: CExample[] = [
  {
    name: "Hello World",
    description: "Affiche Hello World!",
    code: `// Mon premier programme C
int main() {
  print("Hello World!");
  return 0;
}`,
  },
  {
    name: "Compteur",
    description: "Boucle for de 0 à 9",
    code: `// Compteur de 0 à 9
int main() {
  int i;
  for (i = 0; i < 10; i++) {
    putchar(48 + i);  // '0' = 48
  }
  return 0;
}`,
  },
  {
    name: "Fibonacci",
    description: "Suite de Fibonacci",
    code: `// Calcule et affiche la suite de Fibonacci
int main() {
  int a = 0;
  int b = 1;
  int i;
  int temp;

  for (i = 0; i < 10; i++) {
    print_num(a);
    putchar(32);  // espace
    temp = a + b;
    a = b;
    b = temp;
  }
  return 0;
}`,
  },
  {
    name: "Factorielle",
    description: "Fonction récursive fact(n)",
    code: `// Calcul de factorielle avec récursion
int fact(int n) {
  if (n <= 1) {
    return 1;
  }
  return n * fact(n - 1);
}

int main() {
  print("5! = ");
  print_num(fact(5));
  return 0;
}`,
  },
  {
    name: "Calcul",
    description: "Arithmétique avec variables",
    code: `// Démonstration d'opérations arithmétiques
#define MAX 20

int main() {
  int x = 10;
  int y = 3;

  print("x = ");
  print_num(x);
  putchar(10);

  print("y = ");
  print_num(y);
  putchar(10);

  print("x+y = ");
  print_num(x + y);
  putchar(10);

  print("x-y = ");
  print_num(x - y);
  putchar(10);

  print("x*y = ");
  print_num(x * y);
  putchar(10);

  print("x/y = ");
  print_num(x / y);
  putchar(10);

  print("x%y = ");
  print_num(x % y);
  putchar(10);

  return 0;
}`,
  },
  {
    name: "Plotter",
    description: "Dessine une diagonale et un cadre",
    code: `// Dessine sur le plotter
int main() {
  int i;

  clear();

  // Diagonale
  for (i = 0; i < 80; i++) {
    draw(i, i);
  }

  // Cadre
  for (i = 0; i < 100; i++) {
    draw(i, 0);
    draw(i, 99);
    draw(0, i);
    draw(99, i);
  }

  return 0;
}`,
  },
  {
    name: "Sinusoïdes",
    description: "Synthèse harmonique (fondamentale + harm. 4)",
    code: `// Synthese harmonique : fondamentale + harmonique 4
// Approximation parabolique des demi-ondes

int sq(int t) {
  // Quart d'onde longue (t: 0..63 -> 0..124)
  int a;
  int b;
  a = t >> 1;
  b = (128 - t) >> 4;
  return a * b;
}

int hw(int t) {
  // Demi-onde courte (t: 0..31 -> 0..64)
  int a;
  int b;
  a = t >> 1;
  b = (32 - t) >> 1;
  return a * b;
}

int main() {
  int x;
  int y;
  int p;
  int f;
  int h;

  clear();

  // Axe central
  for (x = 0; x < 255; x++) {
    draw(x, 128);
  }
  draw(255, 128);

  // Onde composite
  p = 0;
  for (x = 0; x < 255; x++) {
    // Fondamentale (T=256, A=62)
    if (x < 64) {
      f = sq(x) >> 1;
      y = 128 - f;
    } else if (x < 128) {
      f = sq(127 - x) >> 1;
      y = 128 - f;
    } else if (x < 192) {
      f = sq(x - 128) >> 1;
      y = 128 + f;
    } else {
      f = sq(255 - x) >> 1;
      y = 128 + f;
    }

    // Harmonique 4 (T=64, A=32)
    if (p < 32) {
      h = hw(p) >> 1;
      y = y - h;
    } else {
      h = hw(p - 32) >> 1;
      y = y + h;
    }

    draw(x, y);
    p = p + 1;
    if (p > 63) {
      p = 0;
    }
  }
  draw(255, 128);

  return 0;
}`,
  },
  {
    name: "Echo (Saisie)",
    description: "Lit et réaffiche les caractères saisis",
    code: `// Echo - lit et reaffiche les caracteres
// Tapez du texte et appuyez sur Entree
int main() {
  int c;
  print("Tapez: ");

  while (1) {
    c = getchar();
    if (c == 10) {
      putchar(10);
    } else {
      putchar(c);
    }
  }
  return 0;
}`,
  },
  {
    name: "Compteur de lettres",
    description: "Compte les caractères dans une ligne saisie",
    code: `// Compte les caracteres dans la saisie
// Tapez du texte et appuyez sur Entree

int main() {
  int c;
  int count;

  while (1) {
    count = 0;
    print("> ");

    c = getchar();
    while (c != 10) {
      count += 1;
      putchar(c);
      c = getchar();
    }

    putchar(10);
    print("Longueur: ");
    print_num(count);
    putchar(10);
  }
  return 0;
}`,
  },
];
