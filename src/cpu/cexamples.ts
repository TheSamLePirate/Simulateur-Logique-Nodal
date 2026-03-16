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
    name: "Courbe",
    description: "Onde parabolique approchant une sinusoïde",
    code: `// Onde parabolique sur le plotter
// Approxime une sinusoide par des arches de paraboles
// Formule : h = (t/4) * ((127-t)/4) pour chaque demi-onde
// Le produit reste dans [0..240] : pas de depassement 8 bits

int main() {
  int x;
  int y;
  int t;
  int h;

  clear();

  // Courbe parabolique
  for (x = 0; x < 255; x++) {
    // Position dans la demi-onde (0..127)
    t = x & 127;

    // Hauteur parabolique (max 240, rentre dans 8 bits)
    h = (t >> 2) * ((127 - t) >> 2);

    // Alterner arche haute et arche basse
    if (x < 128) {
      y = 128 - (h >> 1);
    } else {
      y = 128 + (h >> 1);
    }

    draw(x, y);
  }

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
    if (c == 64) {
      putchar(10);
      return 0;
    }
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
    if (c == 64) {
      putchar(10);
      return 0;
    }
    while (c != 10) {
      count += 1;
      putchar(c);
      c = getchar();
      if (c == 64) {
        putchar(10);
        return 0;
      }
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
    description: "Calculatrice interactive avec 2 decimales",
    code: `// Calculatrice interactive (8-bit)
// Tapez: nombre op nombre (ex: 2.14+3.24)
// Operateurs: + - * / %
// Nombres entiers ou avec 2 decimales

int last;
int last_frac;
int last_has_frac;
int quit_flag;

int print_2d(int n) {
  putchar(48 + n / 10);
  putchar(48 + n % 10);
  return 0;
}

int read_num() {
  int n;
  int c;
  int frac;
  int digits;
  n = 0;
  frac = 0;
  digits = 0;
  quit_flag = 0;
  last_has_frac = 0;
  c = getchar();
  if (c == 64) {
    last = 64;
    last_frac = 0;
    quit_flag = 1;
    return 0;
  }
  while (c >= 48) {
    if (c > 57) { break; }
    putchar(c);
    n = n * 10 + (c - 48);
    c = getchar();
  }
  if (c == 46) {
    last_has_frac = 1;
    putchar(c);
    c = getchar();
    while (digits < 2) {
      if (c < 48) { break; }
      if (c > 57) { break; }
      putchar(c);
      frac = frac * 10 + (c - 48);
      digits = digits + 1;
      c = getchar();
    }
    if (digits == 1) {
      frac = frac * 10;
    }
    while (c >= 48) {
      if (c > 57) { break; }
      putchar(c);
      c = getchar();
    }
  }
  if (c == 64) {
    quit_flag = 1;
  }
  last = c;
  last_frac = frac;
  return n;
}

int main() {
  int ai;
  int af;
  int bi;
  int bf;
  int a_dec;
  int b_dec;
  int op;
  int neg;
  int show_frac;
  int ri;
  int rf;
  int i;
  int d1;
  int d2;
  int t;
  int tf;
  int tmp;

  while (1) {
    print("> ");
    ai = read_num();
    if (quit_flag) {
      putchar(10);
      return 0;
    }
    af = last_frac;
    a_dec = last_has_frac;
    op = last;
    if (op == 64) {
      putchar(10);
      return 0;
    }
    putchar(op);
    bi = read_num();
    if (quit_flag) {
      putchar(10);
      return 0;
    }
    bf = last_frac;
    b_dec = last_has_frac;
    putchar(10);

    neg = 0;
    ri = 0;
    rf = 0;

    if (op == 43) {
      ri = ai + bi;
      rf = af + bf;
      if (rf >= 100) {
        rf = rf - 100;
        ri = ri + 1;
      }
    }

    if (op == 45) {
      if (ai < bi) {
        neg = 1;
        tmp = ai;
        ai = bi;
        bi = tmp;
        tmp = af;
        af = bf;
        bf = tmp;
      } else {
        if (ai == bi) {
          if (af < bf) {
            neg = 1;
            tmp = ai;
            ai = bi;
            bi = tmp;
            tmp = af;
            af = bf;
            bf = tmp;
          }
        }
      }
      ri = ai;
      rf = af;
      if (rf < bf) {
        rf = rf + 100;
        ri = ri - 1;
      }
      rf = rf - bf;
      ri = ri - bi;
    }

    if (op == 42) {
      i = 0;
      while (i < ai) {
        rf = rf + bf;
        if (rf >= 100) {
          rf = rf - 100;
          ri = ri + 1;
        }
        ri = ri + bi;
        i = i + 1;
      }

      i = 0;
      while (i < bi) {
        rf = rf + af;
        if (rf >= 100) {
          rf = rf - 100;
          ri = ri + 1;
        }
        i = i + 1;
      }

      t = 0;
      tf = 0;
      i = 0;
      while (i < af) {
        tf = tf + bf;
        if (tf >= 100) {
          tf = tf - 100;
          t = t + 1;
        }
        i = i + 1;
      }
      rf = rf + t;
      if (rf >= 100) {
        rf = rf - 100;
        ri = ri + 1;
      }
    }

    if (op == 47) {
      if (bi != 0 || bf != 0) {
        t = ai;
        tf = af;
        while (1) {
          if (t < bi) { break; }
          if (t == bi) {
            if (tf < bf) { break; }
          }
          if (tf < bf) {
            tf = tf + 100;
            t = t - 1;
          }
          tf = tf - bf;
          t = t - bi;
          ri = ri + 1;
        }

        d1 = 0;
        d2 = 0;

        if (t != 0 || tf != 0) {
          ai = 0;
          af = 0;
          i = 0;
          while (i < 10) {
            af = af + tf;
            if (af >= 100) {
              af = af - 100;
              ai = ai + 1;
            }
            ai = ai + t;
            i = i + 1;
          }

          while (1) {
            if (ai < bi) { break; }
            if (ai == bi) {
              if (af < bf) { break; }
            }
            if (af < bf) {
              af = af + 100;
              ai = ai - 1;
            }
            af = af - bf;
            ai = ai - bi;
            d1 = d1 + 1;
          }

          if (ai != 0 || af != 0) {
            t = 0;
            tf = 0;
            i = 0;
            while (i < 10) {
              tf = tf + af;
              if (tf >= 100) {
                tf = tf - 100;
                t = t + 1;
              }
              t = t + ai;
              i = i + 1;
            }

            while (1) {
              if (t < bi) { break; }
              if (t == bi) {
                if (tf < bf) { break; }
              }
              if (tf < bf) {
                tf = tf + 100;
                t = t - 1;
              }
              tf = tf - bf;
              t = t - bi;
              d2 = d2 + 1;
            }
          }
        }

        rf = d1 * 10 + d2;
      }
    }

    if (op == 37) {
      if (bi != 0 || bf != 0) {
        t = ai;
        tf = af;
        while (1) {
          if (t < bi) { break; }
          if (t == bi) {
            if (tf < bf) { break; }
          }
          if (tf < bf) {
            tf = tf + 100;
            t = t - 1;
          }
          tf = tf - bf;
          t = t - bi;
        }
        ri = t;
        rf = tf;
      }
    }

    show_frac = 0;
    if (a_dec || b_dec) {
      show_frac = 1;
    }
    if (rf != 0) {
      show_frac = 1;
    }

    print("= ");
    if (neg) {
      putchar(45);
    }
    print_num(ri);
    if (show_frac) {
      putchar(46);
      print_2d(rf);
    }
    putchar(10);
  }
  return 0;
}`,
  },
  {
    name: "Traceur de droite",
    description: "Trace y=a*x/b+c sur le plotter",
    code: `// Traceur de droite y=a*x/b+c
// Saisir a, b, c (chiffres 0-9)
// Algorithme DDA : accumule la pente
// sans jamais calculer a*x (overflow)

int main() {
  int a;
  int b;
  int c;
  int x;
  int y;
  int err;

  print("a=");
  a = getchar();
  while (a != 64) {
    if (a >= 48) {
      if (a <= 57) { break; }
    }
    a = getchar();
  }
  if (a == 64) { return 0; }
  a = a - 48;
  putchar(a + 48);
  putchar(10);

  print("b=");
  b = getchar();
  while (b != 64) {
    if (b >= 48) {
      if (b <= 57) { break; }
    }
    b = getchar();
  }
  if (b == 64) { return 0; }
  b = b - 48;
  putchar(b + 48);
  putchar(10);

  if (b == 0) {
    print("Err: b=0");
    return 0;
  }

  print("c=");
  c = getchar();
  while (c != 64) {
    if (c >= 48) {
      if (c <= 57) { break; }
    }
    c = getchar();
  }
  if (c == 64) { return 0; }
  c = c - 48;
  putchar(c + 48);
  putchar(10);

  clear();

  y = c;
  err = 0;
  for (x = 0; x < 255; x++) {
    draw(x, y);
    err = err + a;
    while (err >= b) {
      err = err - b;
      y = y + 1;
    }
  }

  return 0;
}`,
  },
  {
    name: "Cercle",
    description: "Dessine un cercle sur le plotter",
    code: `// Cercle sur le plotter

int main()
{
    int x;
    int y;
    int ax;
    int ay;
    int sx;
    int sy;
    int d;
    x = 0;
    while (x < 255)
    {
        y = 0;
print_num(x);
putchar(10);
        while (y < 255)
        {
            if (x < 128)
            {
                ax = 128 - x;
            }
            else
            {
                ax = x - 128;
            }
            if (y < 128)
            {
                ay = 128 - y;
            }
            else
            {
                ay = y - 128;
            }
            sx = ax / 16;
            sy = ay / 16;
            d = (sx * sx) + (sy * sy);
            if (d > 12)
            {
                if (d < 20)
                {
                    draw(x, y);
                }
            }
            y = y + 1;
        }
        x = x + 1;
    }
}`,
  },
  {
    name: "Clavier",
    description: "Déplace un curseur avec les flèches du clavier",
    code: `// Vaisseau triangle + laser projectile
// Fleches = deplacer, Enter = tirer
// Le laser monte chaque frame jusqu'en haut

int main() {
  int x;
  int y;
  int x1;
  int x2;
  int y1;
  int lx;
  int ly;
  int lf;
  int ch;

  x = 127;
  y = 200;
  lf = 0;

  while (1) {
    ch = getchar_nb();
    if (ch == 64) { return 0; }
    clear();

    // Lecture clavier
    if (getKey(0)) {
      if (x > 0) { x = x - 1; }
    }
    if (getKey(1)) {
      if (x < 252) { x = x + 1; }
    }
    if (getKey(2)) {
      if (y > 2) { y = y - 1; }
    }
    if (getKey(3)) {
      if (y < 253) { y = y + 1; }
    }

    // Pre-calcul
    x1 = x + 1; x2 = x + 2; y1 = y + 1;

    // Triangle (pointe en haut)
    draw(x1, y);
    draw(x, y1); draw(x1, y1); draw(x2, y1);

    // Tir: Enter lance un laser
    if (lf == 0) {
      if (getKey(4)) {
        lf = 1;
        lx = x1;
        ly = y - 1;
      }
    }

    // Laser actif: monte et disparait
    if (lf) {
      draw(lx, ly);
      draw(lx, ly + 1);
      if (ly > 0) {
        ly = ly - 1;
      } else {
        lf = 0;
      }
    }
  }
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
  {
    name: "Étoiles",
    description: "Ciel étoilé aléatoire (rand, sleep, break)",
    code: `// Ciel etoile aleatoire
// Dessine 64 etoiles a des positions aleatoires
// Utilise rand(), sleep() et break

int main() {
  int i;
  int x;
  int y;

  i = 0;
  while (1) {
    if (i >= 64) {
      break;
    }
    x = rand();
    y = rand();

    // Saute les coins (continue)
    if (x < 10) {
      if (y < 10) {
        continue;
      }
    }

    draw(x, y);
    sleep(5);
    i = i + 1;
  }

  print("Stars: ");
  print_num(i);
  return 0;
}`,
  },
  {
    name: "Test Mémoire",
    description: "Teste les zones mémoire: globales, locales, pile",
    code: `// Test Memoire
// Teste: 16 globales, 488 locales, ~1024 code, pile
// Verifie l'integrite apres appels de fonction
// Attendu: =MEM 2K= g0=42 gf=15 r1=57 r2=5 PASS

// -- 16 globales (zone 0x1000-0x100F) --
int g0; int g1; int g2; int g3;
int g4; int g5; int g6; int g7;
int g8; int g9; int ga; int gb;
int gc; int gd; int ge; int gf;

// -- Fonction testee (utilise la pile) --
int add(int a, int b) {
  return a + b;
}

// -- Remplissage zone locales --
// Chaque fonction reserve 25 slots (1 param + 24 locals)
// 19 fonctions x 25 = 475 slots reserves
int _1(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _2(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _3(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _4(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _5(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _6(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _7(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _8(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _9(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _A(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _B(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _C(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _D(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _E(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _F(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _G(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _H(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _I(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}
int _J(int z){int a;int b;int c;int d;int e;int f;int g;int h;int i;int j;int k;int l;int m;int n;int o;int p;int q;int r;int s;int t;int u;int v;int w;int x;return z;}

int main() {
  // 11 locales dans main (total: 2+475+11=488)
  int r1;
  int r2;
  int ok;
  int v1;
  int v2;
  int v3;
  int v4;
  int v5;
  int v6;
  int v7;
  int v8;

  // Initialise les 16 globales
  g0=42; g1=1; g2=2; g3=3;
  g4=4; g5=5; g6=6; g7=7;
  g8=8; g9=9; ga=10; gb=11;
  gc=12; gd=13; ge=14; gf=15;

  print("=MEM 2K=");
  putchar(10);

  // Utilise les locales
  v1 = g0 + g1;
  v2 = g2 + g3;
  v3 = g4 + g5;
  v4 = g6 + g7;
  v5 = g8 + g9;
  v6 = ga + gb;

  // Appels fonction (pile: save 11 vars + 6 temps)
  r1 = add(g0, gf);
  r2 = add(g2, g3);

  // Affiche
  print("g0=");
  print_num(g0);
  putchar(32);
  print("gf=");
  print_num(gf);
  putchar(10);
  print("r1=");
  print_num(r1);
  putchar(32);
  print("r2=");
  print_num(r2);
  putchar(10);

  // Verification
  ok = 1;
  if (r1 != 57) { ok = 0; }
  if (r2 != 5) { ok = 0; }
  if (g0 != 42) { ok = 0; }
  if (gf != 15) { ok = 0; }
  if (v1 != 43) { ok = 0; }

  if (ok) {
    print("PASS");
  } else {
    print("FAIL");
  }
  putchar(10);

  // Padding pour remplir la zone code
  print("=CODE:1024=DATA:512=PILE:512=OK");
  return 0;
}`,
  },
  {
    name: "Tableau (Tri)",
    description: "Tri à bulles d'un tableau de 8 éléments",
    code: `// Tri a bulles (Bubble Sort)
// Remplit un tableau, le trie, puis l'affiche

int main() {
  int t[8];
  int i;
  int j;
  int tmp;

  t[0] = 64;
  t[1] = 25;
  t[2] = 12;
  t[3] = 22;
  t[4] = 11;
  t[5] = 90;
  t[6] = 33;
  t[7] = 44;

  print("Avant: ");
  for (i = 0; i < 8; i++) {
    print_num(t[i]);
    putchar(32);
  }
  putchar(10);

  for (i = 0; i < 7; i++) {
    for (j = 0; j < 7 - i; j++) {
      if (t[j] > t[j + 1]) {
        tmp = t[j];
        t[j] = t[j + 1];
        t[j + 1] = tmp;
      }
    }
  }

  print("Apres: ");
  for (i = 0; i < 8; i++) {
    print_num(t[i]);
    putchar(32);
  }
  putchar(10);

  return 0;
}`,
  },
  {
    name: "Pong",
    description: "Pong 1 joueur contre IA (UP/DOWN)",
    code: `// Pong - 1 joueur contre ordinateur
// UP/DOWN pour la raquette gauche
// Vitesse: ~2000 instr/tick

int main() {
  int bx; int by;
  int bdx; int bdy;
  int py; int ay;
  int i; int tmp; int ch;

  bx = 128; by = 128;
  bdx = 1; bdy = 1;
  py = 118; ay = 118;

  while (1) {
    ch = getchar_nb();
    if (ch == 64) { return 0; }
    clear();

    // Joueur (vitesse 2)
    if (getKey(2)) { if (py > 1) { py -= 2; } }
    if (getKey(3)) { if (py < 236) { py += 2; } }

    // IA (vitesse 1)
    tmp = ay + 10;
    if (by > tmp) { if (ay < 236) { ay++; } }
    if (by < tmp) { if (ay > 0) { ay--; } }

    // Balle
    if (bdx) { bx++; } else { bx--; }
    if (bdy) { by++; } else { by--; }

    // Murs haut/bas
    if (by < 2) { bdy = 1; }
    if (by > 253) { bdy = 0; }

    // Raquette joueur (x=8)
    if (bx < 10) {
      if (by >= py) {
        tmp = py + 20;
        if (by < tmp) { bdx = 1; bx = 10; }
      }
    }

    // Raquette IA (x=248)
    if (bx > 246) {
      if (by >= ay) {
        tmp = ay + 20;
        if (by < tmp) { bdx = 0; bx = 246; }
      }
    }

    // But: reset balle
    if (bx < 1) { bx = 128; by = 128; bdx = 1; }
    if (bx > 254) { bx = 128; by = 128; bdx = 0; }

    // Raquettes (1x20)
    for (i = 0; i < 20; i++) {
      draw(8, py + i);
      draw(248, ay + i);
    }

    // Balle
    draw(bx, by);

    sleep(255);
  }
  return 0;
}`,
  },
  {
    name: "Démo Ultime",
    description: "Console, clavier, hasard, tableaux, recursion et plotter",
    code: `// Demo ultime du petit ordinateur
// Utilise: input console, clavier, hasard, sleep, plotter,
// fonctions, recursion, tableaux globaux et locaux, tri, bitwise

int seed;
int mode;
int values[8];
int quit_flag;

int read_digit() {
  int c;
  c = getchar();
  while (c != 64) {
    if (c >= 48) {
      if (c <= 57) { break; }
    }
    c = getchar();
  }
  if (c == 64) {
    quit_flag = 1;
    return 0;
  }
  putchar(c);
  putchar(10);
  return c - 48;
}

int sum_to(int n) {
  if (n <= 0) { return 0; }
  return n + sum_to(n - 1);
}

int absdiff(int a, int b) {
  if (a >= b) { return a - b; }
  return b - a;
}

int read_mode() {
  int m;
  m = 0;
  if (getKey(0)) { m += 1; }
  if (getKey(1)) { m += 2; }
  if (getKey(2)) { m += 4; }
  if (getKey(3)) { m += 8; }
  if (getKey(4)) { m += 16; }
  return m;
}

int fill_data() {
  int i;
  int v;
  i = 0;
  while (i < 8) {
    v = (((seed + (i * 3)) << 2) ^ rand()) % 90;
    if (v < 10) { v += 10; }
    if ((mode & 1) && v > 60) { v -= 7; }
    if ((mode & 2) && v < 40) { v += 9; }
    values[i] = v;
    i++;
  }
  return 0;
}

int sort_data() {
  int i;
  int j;
  int tmp;
  i = 0;
  while (i < 7) {
    j = 0;
    while (j < 7 - i) {
      if (values[j] > values[j + 1]) {
        tmp = values[j];
        values[j] = values[j + 1];
        values[j + 1] = tmp;
      }
      j++;
    }
    i++;
  }
  return 0;
}

int print_values() {
  int i;
  i = 0;
  while (i < 8) {
    print_num(values[i]);
    putchar(32);
    i++;
  }
  putchar(10);
  return 0;
}

int draw_frame() {
  int x;
  int y;
  x = 0;
  while (x < 128) {
    draw(x, 0);
    draw(x, 99);
    x++;
  }
  y = 0;
  while (y < 100) {
    draw(0, y);
    draw(127, y);
    y++;
  }
  return 0;
}

int draw_ship(int x, int y) {
  draw(x, y);
  draw(x + 1, y);
  draw(x + 2, y);
  draw(x + 1, y - 1);
  draw(x + 1, y + 1);
  return 0;
}

int show_scene() {
  int stars[16];
  int frame;
  int i;
  int x;
  int y;
  int shipx;
  int shipy;
  int h;
  int by;
  i = 0;
  while (i < 16) {
    stars[i] = rand();
    i++;
  }

  frame = 0;
  while (frame < 6) {
    clear();
    draw_frame();

    i = 0;
    while (i < 16) {
      if ((stars[i] & 1) == 0) {
        i++;
        continue;
      }
      x = (stars[i] + (frame * 5)) & 127;
      y = ((stars[i] >> 1) + (i * 3)) % 100;
      if (y > 94) {
        i++;
        continue;
      }
      draw(x, y);
      i++;
    }

    i = 0;
    while (i < 8) {
      x = 8 + (i * 14);
      h = values[i] / 3;
      by = 98;
      while (h > 0) {
        draw(x, by);
        draw(x + 1, by);
        by--;
        h--;
      }
      i++;
    }

    shipx = 60 + ((mode & 3) * 8);
    shipy = 50 + ((mode >> 2) & 3) * 6;
    if (getKey(0)) { shipx -= 8; }
    if (getKey(1)) { shipx += 8; }
    if (getKey(2)) { shipy -= 6; }
    if (getKey(3)) { shipy += 6; }
    draw_ship(shipx, shipy);

    if (getKey(4)) {
      draw(shipx + 1, shipy - 4);
      draw(shipx + 1, shipy - 6);
    }

    sleep(3);
    frame++;
  }
  return 0;
}

int main() {
  int local[4];
  int i;
  int total;
  int avg;
  int rem;
  int spread;
  int chk;

  print("=== DEMO ULTIME ===");
  putchar(10);
  print("Entrez un chiffre 0-9: ");
  seed = read_digit();
  if (quit_flag) { return 0; }

  mode = read_mode();
  print("Mode clavier=");
  print_num(mode);
  putchar(10);

  print("Somme recursive=");
  print_num(sum_to(seed));
  putchar(10);

  fill_data();
  print("Brut: ");
  print_values();

  sort_data();
  print("Trie: ");
  print_values();

  total = 0;
  i = 0;
  while (i < 8) {
    total += values[i];
    i++;
  }

  avg = total / 8;
  rem = total % 8;
  spread = absdiff(values[7], values[0]);

  local[0] = avg;
  local[1] = rem;
  local[2] = spread;
  local[3] = (avg ^ spread) & 63;

  print("Moy=");
  print_num(local[0]);
  print(" R=");
  print_num(local[1]);
  print(" Amp=");
  print_num(local[2]);
  putchar(10);

  print("Mix=");
  print_num(local[3]);
  putchar(10);

  show_scene();

  chk = local[0] + local[1] + local[2] + local[3];
  print("Checksum=");
  print_num(chk);
  putchar(10);
  print("FIN");
  return 0;
}`,
  },
  {
    name: "Calculatrice Graphique",
    description: "Mode Y= style TI-83 sur tout le plotter, avec trace et zoom",
    code: `// Calculatrice graphique style TI-83
// Entrez A, B, C pour Y = A*(X/8)^2 + B*X + C
// LEFT/RIGHT = trace, UP/DOWN = zoom, ENTER = fenetre standard

int a;
int b;
int c;
int zoom;
int cx;
int enter_prev;
int quit_flag;

int read_digit() {
  int ch;
  ch = getchar();
  while (ch != 64) {
    if (ch >= 48) {
      if (ch <= 57) { break; }
    }
    ch = getchar();
  }
  if (ch == 64) {
    quit_flag = 1;
    return 0;
  }
  putchar(ch);
  putchar(10);
  return ch - 48;
}

int eval_y(int sx) {
  int mag;
  int quad;
  int lin;
  int y;

  y = 128 - (c * 4);

  if (sx >= 128) {
    mag = (sx - 128) / zoom;
    lin = (b * mag) / 5;
    y = y - lin;
  } else {
    mag = (128 - sx) / zoom;
    lin = (b * mag) / 5;
    y = y + lin;
  }

  quad = mag / 8;
  quad = quad * quad;
  quad = quad * a;
  y = y - quad;

  return y;
}

int draw_frame() {
  int i;

  i = 0;
  while (i < 255) {
    draw(i, 0);
    draw(i, 255);
    draw(i, 128);
    if ((i & 31) == 0) {
      draw(i, 127);
      draw(i, 129);
      draw(i, 126);
      draw(i, 130);
    }
    i = i + 1;
  }
  draw(255, 0);
  draw(255, 255);
  draw(255, 128);

  i = 0;
  while (i < 255) {
    draw(0, i);
    draw(255, i);
    draw(128, i);
    if ((i & 31) == 0) {
      draw(127, i);
      draw(129, i);
      draw(126, i);
      draw(130, i);
    }
    i = i + 1;
  }
  draw(0, 255);
  draw(255, 255);
  draw(128, 255);

  return 0;
}

int draw_grid() {
  int x;
  int y;

  x = 32;
  while (1) {
    if (x != 128) {
      y = 4;
      while (1) {
        draw(x, y);
        if (y > 246) { break; }
        y = y + 8;
      }
    }
    if (x > 223) { break; }
    x = x + 32;
  }

  y = 32;
  while (1) {
    if (y != 128) {
      x = 4;
      while (1) {
        draw(x, y);
        if (x > 246) { break; }
        x = x + 8;
      }
    }
    if (y > 223) { break; }
    y = y + 32;
  }

  return 0;
}

int plot_curve() {
  int x;
  int y;
  int py;
  int t;

  py = 255;
  x = 0;
  while (x < 255) {
    y = eval_y(x);
    if (y > 0) {
      draw(x, y);
      if (py > 0) {
        if (y > py) {
          t = py;
          while (t < y) {
            draw(x, t);
            t = t + 1;
          }
        } else {
          t = y;
          while (t < py) {
            draw(x, t);
            t = t + 1;
          }
        }
      }
    }
    py = y;
    x = x + 1;
  }
  y = eval_y(255);
  if (y > 0) { draw(255, y); }

  return 0;
}

int draw_cursor() {
  int y;
  int i;

  y = eval_y(cx);
  if (y == 0) { return 0; }

  i = 0;
  while (i < 255) {
    if ((i & 7) == 0) {
      draw(cx, i);
    }
    i = i + 1;
  }
  draw(cx, 255);

  i = 0;
  while (i < 255) {
    if ((i & 7) == 0) {
      draw(i, y);
    }
    i = i + 1;
  }
  draw(255, y);

  draw(cx, y);
  if (cx > 2) { draw(cx - 1, y); draw(cx - 2, y); }
  if (cx < 253) { draw(cx + 1, y); draw(cx + 2, y); }
  if (y > 2) { draw(cx, y - 1); draw(cx, y - 2); }
  if (y < 253) { draw(cx, y + 1); draw(cx, y + 2); }

  return 0;
}

int main() {
  int key;
  int dirty;

  print("=== TI GRAPH ===");
  putchar(10);
  print("Y1 = A*(X/8)^2 + B*X + C");
  putchar(10);
  print("A=");
  a = read_digit();
  if (quit_flag) { return 0; }
  print("B=");
  b = read_digit();
  if (quit_flag) { return 0; }
  print("C=");
  c = read_digit();
  if (quit_flag) { return 0; }
  print("TRACE L/R  ZOOM U/D  ENTER=STD");
  putchar(10);

  zoom = 6;
  cx = 128;
  enter_prev = 0;
  dirty = 1;

  while (1) {
    key = getchar_nb();
    if (key == 64) { return 0; }
    if (dirty) {
      clear();
      draw_grid();
      draw_frame();
      plot_curve();
      draw_cursor();
      dirty = 0;
    }

    if (getKey(0)) {
      if (cx > 1) {
        cx = cx - 1;
        dirty = 1;
      }
    }
    if (getKey(1)) {
      if (cx < 254) {
        cx = cx + 1;
        dirty = 1;
      }
    }
    if (getKey(2)) {
      if (zoom > 4) {
        zoom = zoom - 1;
        dirty = 1;
      }
    }
    if (getKey(3)) {
      if (zoom < 12) {
        zoom = zoom + 1;
        dirty = 1;
      }
    }

    key = getKey(4);
    if (key) {
      if (enter_prev == 0) {
        zoom = 6;
        cx = 128;
        dirty = 1;
      }
      enter_prev = 1;
    } else {
      enter_prev = 0;
    }

    sleep(3);
  }
  return 0;
}`,
  },
  {
    name: "Mini Shell",
    description: "Shell RAM avec variables, fichiers, >, cat, add/max/min/avg",
    code: `// Mini shell en memoire
// Variables: set a=42, vars, add, max, min, avg
// Fichiers RAM: touch f, hi>f, cat f

int main() {
  int line[32];
  int var_name[4];
  int var_value[4];
  int var_used[4];
  int file_name[4];
  int file_len[4];
  int file_used[4];
  int file_data[64];
  int i;
  int j;
  int ch;
  int lp;
  int gt;
  int slot;
  int free_slot;
  int fname;
  int base;
  int value;
  int found;
  int copied;

  i = 0;
  while (i < 4) {
    var_used[i] = 0;
    file_used[i] = 0;
    file_len[i] = 0;
    i = i + 1;
  }

  print("=== MINI SHELL RAM ===");
  putchar(10);
  print("vars set add max min avg");
  putchar(10);

  while (1) {
    print("$ ");
    lp = 0;
    ch = getchar();
    while (ch != 10) {
      if (ch == 64) {
        putchar(10);
        return 0;
      }
      if (lp < 31) {
        line[lp] = ch;
        lp = lp + 1;
      }
      putchar(ch);
      ch = getchar();
    }
    line[lp] = 0;
    putchar(10);

    if (lp == 0) {
      continue;
    }

    if (line[0] == 'v') {
      if (line[1] == 'a') {
        if (line[2] == 'r') {
          if (line[3] == 's') {
            found = 0;
            i = 0;
            while (i < 4) {
              if (var_used[i]) {
                putchar(var_name[i]);
                putchar('=');
                print_num(var_value[i]);
                putchar(10);
                found = 1;
              }
              i = i + 1;
            }
            if (found == 0) {
              print("(no vars)");
              putchar(10);
            }
            continue;
          }
        }
      }
    }

    slot = 255;
    if (line[0] == 'a') {
      if (line[1] == 'd') { slot = 0; }
      if (line[1] == 'v') { slot = 3; }
    }
    if (line[0] == 'm') {
      if (line[1] == 'a') { slot = 1; }
      if (line[1] == 'i') { slot = 2; }
    }
    if (slot != 255) {
      found = 0;
      value = 0;
      base = 0;
      fname = 0;
      i = 0;
      while (i < 4) {
        if (var_used[i]) {
          if (found == 0) {
            base = var_value[i];
            fname = var_value[i];
          }
          value = value + var_value[i];
          if (var_value[i] > base) { base = var_value[i]; }
          if (var_value[i] < fname) { fname = var_value[i]; }
          found = found + 1;
        }
        i = i + 1;
      }
      if (found == 0) {
        print("(no vars)");
        putchar(10);
        continue;
      }
      if (slot == 0) { copied = value; base = 0; }
      if (slot == 1) { copied = base; base = 0; }
      if (slot == 2) { copied = fname; base = 0; }
      if (slot == 3) {
        copied = value / found;
        base = value % found;
      }
      if (lp > 4) {
        if (line[3] == '>') {
          fname = line[4];
          gt = 255;
          i = 0;
          while (i < 4) {
            if (file_used[i]) {
              if (file_name[i] == fname) {
                gt = i;
              }
            }
            i = i + 1;
          }
          if (gt == 255) {
            print("no file ");
            putchar(fname);
            putchar(10);
            continue;
          }
          j = gt * 16;
          value = copied;
          copied = 0;
          if (value >= 100) {
            file_data[j] = 48 + value / 100;
            value = value % 100;
            file_data[j + 1] = 48 + value / 10;
            file_data[j + 2] = 48 + value % 10;
            copied = 3;
          } else {
            if (value >= 10) {
              file_data[j] = 48 + value / 10;
              file_data[j + 1] = 48 + value % 10;
              copied = 2;
            } else {
              file_data[j] = 48 + value;
              copied = 1;
            }
          }
          if (slot == 3) {
            if (base) {
              file_data[j + copied] = '.';
              copied = copied + 1;
              value = base * 10;
              file_data[j + copied] = 48 + value / found;
              copied = copied + 1;
              fname = (value % found) * 10;
              file_data[j + copied] = 48 + fname / found;
              copied = copied + 1;
            }
          }
          file_len[gt] = copied;
          continue;
        }
      }
      print_num(copied);
      if (slot == 3) {
        if (base) {
          putchar('.');
          value = base * 10;
          putchar(48 + (value / found));
          fname = (value % found) * 10;
          putchar(48 + (fname / found));
        }
      }
      putchar(10);
      continue;
    }

    if (line[0] == 's') {
      if (line[1] == 'e') {
        if (line[2] == 't') {
          if (line[3] == ' ') {
            fname = line[4];
            if (line[5] != '=') {
              print("usage: set a=42");
              putchar(10);
              continue;
            }
            value = 0;
            i = 6;
            while (i < lp) {
              if (line[i] < '0') { break; }
              if (line[i] > '9') { break; }
              value = value * 10 + (line[i] - '0');
              i = i + 1;
            }

            slot = 255;
            free_slot = 255;
            i = 0;
            while (i < 4) {
              if (var_used[i]) {
                if (var_name[i] == fname) {
                  slot = i;
                }
              } else {
                if (free_slot == 255) {
                  free_slot = i;
                }
              }
              i = i + 1;
            }

            if (slot == 255) {
              slot = free_slot;
            }

            if (slot == 255) {
              print("var full");
              putchar(10);
              continue;
            }

            var_used[slot] = 1;
            var_name[slot] = fname;
            var_value[slot] = value;
            putchar(fname);
            putchar('=');
            print_num(value);
            putchar(10);
            continue;
          }
        }
      }
    }

    if (line[0] == 't') {
      if (line[1] == 'o') {
        if (line[2] == 'u') {
          if (line[3] == 'c') {
            if (line[4] == 'h') {
              if (line[5] == ' ') {
                fname = line[6];
                slot = 255;
                free_slot = 255;
                i = 0;
                while (i < 4) {
                  if (file_used[i]) {
                    if (file_name[i] == fname) {
                      slot = i;
                    }
                  } else {
                    if (free_slot == 255) {
                      free_slot = i;
                    }
                  }
                  i = i + 1;
                }
                if (slot != 255) {
                  print("exists ");
                  putchar(fname);
                  putchar(10);
                  continue;
                }
                if (free_slot == 255) {
                  print("file full");
                  putchar(10);
                  continue;
                }
                file_used[free_slot] = 1;
                file_name[free_slot] = fname;
                file_len[free_slot] = 0;
                print("created ");
                putchar(fname);
                putchar(10);
                continue;
              }
            }
          }
        }
      }
    }

    if (line[0] == 'c') {
      if (line[1] == 'a') {
        if (line[2] == 't') {
          if (line[3] == ' ') {
            fname = line[4];
            slot = 255;
            i = 0;
            while (i < 4) {
              if (file_used[i]) {
                if (file_name[i] == fname) {
                  slot = i;
                }
              }
              i = i + 1;
            }
            if (slot == 255) {
              print("no file ");
              putchar(fname);
              putchar(10);
              continue;
            }
            base = slot * 16;
            j = 0;
            while (j < file_len[slot]) {
              putchar(file_data[base + j]);
              j = j + 1;
            }
            putchar(10);
            continue;
          }
        }
      }
    }

    gt = 255;
    i = 0;
    while (i < lp) {
      if (line[i] == '>') {
        gt = i;
        break;
      }
      i = i + 1;
    }

    if (gt != 255) {
      if (gt + 1 >= lp) {
        print("?");
        putchar(10);
        continue;
      }
      fname = line[gt + 1];

      if (gt == 0) {
        print("?");
        putchar(10);
        continue;
      }

      slot = 255;
      i = 0;
      while (i < 4) {
        if (file_used[i]) {
          if (file_name[i] == fname) {
            slot = i;
          }
        }
        i = i + 1;
      }

      if (slot == 255) {
        print("no file ");
        putchar(fname);
        putchar(10);
        continue;
      }

      base = slot * 16;
      if (gt > 16) {
        gt = 16;
      }

      j = 0;
      while (j < gt) {
        file_data[base + j] = line[j];
        j = j + 1;
      }
      file_len[slot] = gt;
      continue;
    }

    print("?");
    putchar(10);
  }
  return 0;
}`,
  },
  {
    name: "FS Disque Externe",
    description: "Petit systeme de fichiers sur le lecteur externe IO",
    code: `// FS partage avec le bootloader
// Commandes: fmt, ls, touch f, rm f, cat f, free, txt>f

int line[16];

int d0r(int a) {
  drive_set_page(0);
  return drive_read(a);
}

int d0w(int a, int v) {
  drive_set_page(0);
  return drive_write(a, v);
}

int read_line() {
  int ch;
  int n;
  n = 0;
  ch = getchar();
  while (ch != 10) {
    if (ch == 64) { return 255; }
    if (n < 15) {
      line[n] = ch;
      n = n + 1;
    }
    putchar(ch);
    ch = getchar();
  }
  line[n] = 0;
  putchar(10);
  return n;
}

int entry_base(int slot) {
  return 16 + (slot * 5);
}

int entry_name(int slot) {
  return d0r(entry_base(slot));
}

int entry_type(int slot) {
  return d0r(entry_base(slot) + 1);
}

int entry_page(int slot) {
  return d0r(entry_base(slot) + 2);
}

int entry_pages(int slot) {
  return d0r(entry_base(slot) + 3);
}

int entry_size(int slot) {
  return d0r(entry_base(slot) + 4);
}

int set_entry(int slot, int name, int typev, int page, int pages, int size) {
  int base;
  base = entry_base(slot);
  d0w(base, name);
  d0w(base + 1, typev);
  d0w(base + 2, page);
  d0w(base + 3, pages);
  d0w(base + 4, size);
  return 0;
}

int clear_entry(int slot) {
  return set_entry(slot, 0, 0, 0, 0, 0);
}

int format_drive() {
  int i;
  drive_clear();
  d0w(0, 66);
  d0w(1, 2);
  i = 0;
  while (i < 8) {
    clear_entry(i);
    i = i + 1;
  }
  return 0;
}

int ensure_drive() {
  if (d0r(0) != 66) {
    format_drive();
  }
  if (d0r(1) != 2) {
    format_drive();
  }
  return 0;
}

int find_entry(int name) {
  int i;
  i = 0;
  while (i < 8) {
    if (entry_name(i) == name) { return i; }
    i = i + 1;
  }
  return 255;
}

int find_free_slot() {
  int i;
  i = 0;
  while (i < 8) {
    if (entry_name(i) == 0) { return i; }
    i = i + 1;
  }
  return 255;
}

int page_used(int page) {
  int i;
  int start;
  int stop;
  i = 0;
  while (i < 8) {
    if (entry_name(i) != 0) {
      start = entry_page(i);
      stop = start + entry_pages(i);
      if (page >= start) {
        if (page < stop) { return 1; }
      }
    }
    i = i + 1;
  }
  return 0;
}

int find_free_page() {
  int p;
  p = 1;
  while (p < 32) {
    if (page_used(p) == 0) { return p; }
    p = p + 1;
  }
  return 0;
}

int count_free_pages() {
  int p;
  int c;
  p = 1;
  c = 0;
  while (p < 32) {
    if (page_used(p) == 0) { c = c + 1; }
    p = p + 1;
  }
  return c;
}

int main() {
  int n;
  int slot;
  int name;
  int i;
  int pos;
  int page;
  int found;

  ensure_drive();
  print("=== FS DISQUE EXTERNE ===");
  putchar(10);
  print("fmt | ls | touch f | rm f | cat f | free | txt>f");
  putchar(10);

  while (1) {
    print("# ");
    n = read_line();
    if (n == 255) {
      putchar(10);
      return 0;
    }
    if (n == 0) { continue; }

    if (line[0] == 'f') {
      if (line[1] == 'm') {
        if (line[2] == 't') {
          format_drive();
          print("formatted");
          putchar(10);
          continue;
        }
      }
      if (line[1] == 'r') {
        if (line[2] == 'e') {
          if (line[3] == 'e') {
            print_num(count_free_pages());
            putchar('p');
            putchar(10);
            continue;
          }
        }
      }
    }

    if (line[0] == 'l') {
      if (line[1] == 's') {
        found = 0;
        i = 0;
        while (i < 8) {
          name = entry_name(i);
          if (name != 0) {
            if (entry_type(i) == 1) { putchar('f'); } else { putchar('p'); }
            putchar(' ');
            putchar(name);
            putchar(' ');
            if (entry_type(i) == 1) {
              print_num(entry_size(i));
              putchar('b');
            } else {
              print_num(entry_pages(i));
              putchar('p');
            }
            putchar(10);
            found = 1;
          }
          i = i + 1;
        }
        if (found == 0) {
          print("(empty)");
          putchar(10);
        }
        continue;
      }
    }

    if (line[0] == 't') {
      if (line[1] == 'o') {
        if (line[2] == 'u') {
          if (line[3] == 'c') {
            if (line[4] == 'h') {
              if (line[5] == ' ') {
                name = line[6];
                slot = find_entry(name);
                if (slot != 255) {
                  if (entry_type(slot) != 1) {
                    print("busy");
                    putchar(10);
                    continue;
                  }
                  set_entry(slot, name, 1, entry_page(slot), 1, 0);
                  print("cleared ");
                  putchar(name);
                  putchar(10);
                  continue;
                }
                slot = find_free_slot();
                page = find_free_page();
                if (slot == 255 || page == 0) {
                  print("disk full");
                  putchar(10);
                  continue;
                }
                set_entry(slot, name, 1, page, 1, 0);
                print("created ");
                putchar(name);
                putchar(10);
                continue;
              }
            }
          }
        }
      }
    }

    if (line[0] == 'r') {
      if (line[1] == 'm') {
        if (line[2] == ' ') {
          name = line[3];
          slot = find_entry(name);
          if (slot == 255) {
            print("not found");
            putchar(10);
            continue;
          }
          if (entry_type(slot) != 1) {
            print("locked");
            putchar(10);
            continue;
          }
          clear_entry(slot);
          print("removed ");
          putchar(name);
          putchar(10);
          continue;
        }
      }
    }

    if (line[0] == 'c') {
      if (line[1] == 'a') {
        if (line[2] == 't') {
          if (line[3] == ' ') {
            name = line[4];
            slot = find_entry(name);
            if (slot == 255) {
              print("not found");
              putchar(10);
              continue;
            }
            if (entry_type(slot) != 1) {
              print("not file");
              putchar(10);
              continue;
            }
            page = entry_page(slot);
            i = 0;
            while (i < entry_size(slot)) {
              putchar(drive_read_at(page, i));
              i = i + 1;
            }
            putchar(10);
            continue;
          }
        }
      }
    }

    pos = 255;
    i = 0;
    while (i < n) {
      if (line[i] == '>') {
        pos = i;
        break;
      }
      i = i + 1;
    }

    if (pos != 255) {
      if (pos + 1 >= n) {
        print("?");
        putchar(10);
        continue;
      }
      name = line[pos + 1];
      slot = find_entry(name);
      if (slot == 255) {
        slot = find_free_slot();
        page = find_free_page();
        if (slot == 255 || page == 0) {
          print("disk full");
          putchar(10);
          continue;
        }
        set_entry(slot, name, 1, page, 1, 0);
      } else {
        if (entry_type(slot) != 1) {
          print("not file");
          putchar(10);
          continue;
        }
      }
      if (pos > 15) { pos = 15; }
      page = entry_page(slot);
      i = 0;
      while (i < pos) {
        drive_write_at(page, i, line[i]);
        i = i + 1;
      }
      set_entry(slot, name, 1, page, 1, pos);
      print("saved ");
      putchar(name);
      putchar(10);
      continue;
    }

    print("?");
    putchar(10);
  }
  return 0;
}`,
  },
];
