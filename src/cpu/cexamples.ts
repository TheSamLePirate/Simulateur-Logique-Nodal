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
  {
    name: "Calculatrice",
    description: "Calculatrice interactive : tapez a op b",
    code: `// Calculatrice interactive (8-bit)
// Tapez: chiffre op chiffre (ex: 3+5)
// Operateurs: + - * /
// Valeurs: 0-9 (un seul chiffre)

int main() {
  int a;
  int b;
  int op;
  int r;

  while (1) {
    print("> ");

    a = getchar() - 48;
    putchar(a + 48);

    op = getchar();
    putchar(op);

    b = getchar() - 48;
    putchar(b + 48);

    getchar();
    putchar(10);

    r = 0;
    if (op == 43) { r = a + b; }
    if (op == 45) { r = a - b; }
    if (op == 42) { r = a * b; }
    if (op == 47) { r = a / b; }

    print("= ");
    print_num(r);
    putchar(10);
  }
  return 0;
}`,
  },
  {
    name: "Horloge",
    description: "Chronomètre MM:SS qui défile",
    code: `// Chronometre MM:SS
// Affiche chaque seconde sur une nouvelle ligne

int print_2d(int n) {
  putchar(48 + n / 10);
  putchar(48 + n % 10);
  return 0;
}

int main() {
  int m;
  int s;
  int t;

  m = 0;
  s = 0;

  while (m < 60) {
    print_2d(m);
    putchar(58);
    print_2d(s);
    putchar(10);

    s = s + 1;
    if (s >= 60) {
      s = 0;
      m = m + 1;
    }
  }
  return 0;
}`,
  },
  {
    name: "Spirale",
    description: "Dessine une spirale carrée sur le plotter",
    code: `// Spirale carree sur le plotter
// 4 bras par tour, longueur croissante

int main() {
  int x;
  int y;
  int s;
  int i;

  clear();
  x = 128;
  y = 128;
  s = 4;

  while (s < 120) {
    for (i = 0; i < s; i++) { draw(x, y); x = x + 1; }
    for (i = 0; i < s; i++) { draw(x, y); y = y + 1; }
    s = s + 4;
    for (i = 0; i < s; i++) { draw(x, y); x = x - 1; }
    for (i = 0; i < s; i++) { draw(x, y); y = y - 1; }
    s = s + 4;
  }
  return 0;
}`,
  },
  {
    name: "Tableau de nombres premiers",
    description: "Trouve et affiche les nombres premiers",
    code: `// Trouve les nombres premiers jusqu'a 100

int is_prime(int n) {
  int d;
  if (n < 2) { return 0; }
  for (d = 2; d * d <= n; d++) {
    if (n % d == 0) { return 0; }
  }
  return 1;
}

int main() {
  int i;
  int count;
  count = 0;

  print("Nombres premiers:");
  putchar(10);

  for (i = 2; i <= 100; i++) {
    if (is_prime(i)) {
      print_num(i);
      putchar(32);
      count = count + 1;
    }
  }

  putchar(10);
  print("Total: ");
  print_num(count);
  putchar(10);
  return 0;
}`,
  },
];
