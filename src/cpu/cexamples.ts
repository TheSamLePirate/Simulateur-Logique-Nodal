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
  color(0, 200, 255);

  // Diagonale
  for (i = 0; i < 80; i++) {
    draw(i, i);
  }

  color(255, 180, 0);

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
    name: "Tableau (Fonction)",
    description: "Passe un tableau a des fonctions qui le modifient",
    code: `// Passage de tableau a une fonction
// Les fonctions recoivent un tableau de taille fixe,
// le lisent et peuvent aussi le modifier.

void fill_pair(int values[2]) {
  values[0] = 12;
  values[1] = 34;
}

int sum_pair(int values[2]) {
  return values[0] + values[1];
}

void bump_second(int values[2]) {
  values[1] = values[1] + 5;
}

int main() {
  int data[2];

  fill_pair(data);
  print("Init: ");
  print_num(data[0]);
  putchar(32);
  print_num(data[1]);
  putchar(10);

  bump_second(data);
  print("Apres: ");
  print_num(data[0]);
  putchar(32);
  print_num(data[1]);
  putchar(10);

  print("Somme: ");
  print_num(sum_pair(data));
  putchar(10);

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
    name: "writeDigits",
    description: "Ecrit le fichier DIGITS dans le FS partage bootloader",
    code: `// Writer compatible avec le FS partage bootloader
// Cree un seul fichier: DIGITS
// Contenu:
// digit 0 = octets 0..4
// digit 1 = octets 5..9
// ...
// digit 9 = octets 45..49

#define DIR_START 16
#define ENTRY_SIZE 12
#define ENTRY_COUNT 8
#define FS_MAGIC 66
#define FS_VER 3

void clear_entry(int base) {
  int j;
  j = 0;
  while (j < ENTRY_SIZE) {
    drive_write_at(0, base + j, 0);
    j = j + 1;
  }
}

void format_drive() {
  int i;
  int base;

  drive_clear();
  drive_write_at(0, 0, FS_MAGIC);
  drive_write_at(0, 1, FS_VER);

  base = DIR_START;
  i = 0;
  while (i < ENTRY_COUNT) {
    clear_entry(base);
    base = base + ENTRY_SIZE;
    i = i + 1;
  }
}

void ensure_drive() {
  if (drive_read_at(0, 0) != FS_MAGIC) {
    format_drive();
    return;
  }
  if (drive_read_at(0, 1) != FS_VER) {
    format_drive();
    return;
  }
}

int is_digits_name(int base) {
  if (drive_read_at(0, base + 0) != 'D') { return 0; }
  if (drive_read_at(0, base + 1) != 'I') { return 0; }
  if (drive_read_at(0, base + 2) != 'G') { return 0; }
  if (drive_read_at(0, base + 3) != 'I') { return 0; }
  if (drive_read_at(0, base + 4) != 'T') { return 0; }
  if (drive_read_at(0, base + 5) != 'S') { return 0; }
  if (drive_read_at(0, base + 6) != 0) { return 0; }
  return 1;
}

int find_digits_entry() {
  int i;
  int base;

  base = DIR_START;
  i = 0;
  while (i < ENTRY_COUNT) {
    if (drive_read_at(0, base + 0) != 0) {
      if (is_digits_name(base)) {
        return base;
      }
    }
    base = base + ENTRY_SIZE;
    i = i + 1;
  }
  return 255;
}

int find_free_entry() {
  int i;
  int base;

  base = DIR_START;
  i = 0;
  while (i < ENTRY_COUNT) {
    if (drive_read_at(0, base + 0) == 0) {
      return base;
    }
    base = base + ENTRY_SIZE;
    i = i + 1;
  }
  return 255;
}

int page_used(int page) {
  int i;
  int base;

  base = DIR_START;
  i = 0;
  while (i < ENTRY_COUNT) {
    if (drive_read_at(0, base + 0) != 0) {
      if (drive_read_at(0, base + 9) == page) {
        return 1;
      }
    }
    base = base + ENTRY_SIZE;
    i = i + 1;
  }
  return 0;
}

int find_free_page() {
  int page;

  page = 255;
  while (1) {
    if (page != 0) {
      if (!page_used(page)) {
        return page;
      }
    }
    if (page == 1) { break; }
    page = page - 1;
  }
  return 0;
}

void write_digits_entry(int base, int page) {
  drive_write_at(0, base + 0, 'D');
  drive_write_at(0, base + 1, 'I');
  drive_write_at(0, base + 2, 'G');
  drive_write_at(0, base + 3, 'I');
  drive_write_at(0, base + 4, 'T');
  drive_write_at(0, base + 5, 'S');
  drive_write_at(0, base + 6, 0);
  drive_write_at(0, base + 7, 0);
  drive_write_at(0, base + 8, 1);    // type=file
  drive_write_at(0, base + 9, page); // page de donnees
  drive_write_at(0, base + 10, 1);   // pages utilisees
  drive_write_at(0, base + 11, 50);  // taille en octets
}

void save_digit_row(int page, int digit, int row, int mask) {
  drive_write_at(page, digit * 5 + row, mask);
}

int main() {
  int base;
  int page;

  ensure_drive();

  base = find_digits_entry();
  if (base == 255) {
    base = find_free_entry();
    if (base == 255) {
      print("directory full");
      putchar(10);
      return 0;
    }

    page = find_free_page();
    if (page == 0) {
      print("disk full");
      putchar(10);
      return 0;
    }

    write_digits_entry(base, page);
  } else {
    page = drive_read_at(0, base + 9);
    write_digits_entry(base, page);
  }

  // 0 = 111 / 101 / 101 / 101 / 111
  save_digit_row(page, 0, 0, 7);
  save_digit_row(page, 0, 1, 5);
  save_digit_row(page, 0, 2, 5);
  save_digit_row(page, 0, 3, 5);
  save_digit_row(page, 0, 4, 7);

  // 1 = 010 / 110 / 010 / 010 / 111
  save_digit_row(page, 1, 0, 2);
  save_digit_row(page, 1, 1, 6);
  save_digit_row(page, 1, 2, 2);
  save_digit_row(page, 1, 3, 2);
  save_digit_row(page, 1, 4, 7);

  // 2 = 111 / 001 / 111 / 100 / 111
  save_digit_row(page, 2, 0, 7);
  save_digit_row(page, 2, 1, 1);
  save_digit_row(page, 2, 2, 7);
  save_digit_row(page, 2, 3, 4);
  save_digit_row(page, 2, 4, 7);

  // 3 = 111 / 001 / 111 / 001 / 111
  save_digit_row(page, 3, 0, 7);
  save_digit_row(page, 3, 1, 1);
  save_digit_row(page, 3, 2, 7);
  save_digit_row(page, 3, 3, 1);
  save_digit_row(page, 3, 4, 7);

  // 4 = 101 / 101 / 111 / 001 / 001
  save_digit_row(page, 4, 0, 5);
  save_digit_row(page, 4, 1, 5);
  save_digit_row(page, 4, 2, 7);
  save_digit_row(page, 4, 3, 1);
  save_digit_row(page, 4, 4, 1);

  // 5 = 111 / 100 / 111 / 001 / 111
  save_digit_row(page, 5, 0, 7);
  save_digit_row(page, 5, 1, 4);
  save_digit_row(page, 5, 2, 7);
  save_digit_row(page, 5, 3, 1);
  save_digit_row(page, 5, 4, 7);

  // 6 = 111 / 100 / 111 / 101 / 111
  save_digit_row(page, 6, 0, 7);
  save_digit_row(page, 6, 1, 4);
  save_digit_row(page, 6, 2, 7);
  save_digit_row(page, 6, 3, 5);
  save_digit_row(page, 6, 4, 7);

  // 7 = 111 / 001 / 001 / 001 / 001
  save_digit_row(page, 7, 0, 7);
  save_digit_row(page, 7, 1, 1);
  save_digit_row(page, 7, 2, 1);
  save_digit_row(page, 7, 3, 1);
  save_digit_row(page, 7, 4, 1);

  // 8 = 111 / 101 / 111 / 101 / 111
  save_digit_row(page, 8, 0, 7);
  save_digit_row(page, 8, 1, 5);
  save_digit_row(page, 8, 2, 7);
  save_digit_row(page, 8, 3, 5);
  save_digit_row(page, 8, 4, 7);

  // 9 = 111 / 101 / 111 / 001 / 111
  save_digit_row(page, 9, 0, 7);
  save_digit_row(page, 9, 1, 5);
  save_digit_row(page, 9, 2, 7);
  save_digit_row(page, 9, 3, 1);
  save_digit_row(page, 9, 4, 7);

  print("saved DIGITS");
  putchar(10);
  return 0;
}`,
  },
  {
    name: "writeLetters",
    description: "Ecrit le fichier LETTERS dans le FS partage bootloader",
    code: `// Writer minimal pour fichier LETTERS
// Compatible avec le FS partage bootloader
// Le disque doit deja etre formate

int i;
int base;
int found;
int free_base;
int page;

int main() {
  drive_set_page(0);

  if (drive_read(0) != 66) {
    print("fmt first");
    putchar(10);
    return 0;
  }
  if (drive_read(1) != 3) {
    print("fmt first");
    putchar(10);
    return 0;
  }

  found = 255;
  free_base = 255;
  page = 0;
  base = 16;
  i = 0;

  while (i < 8) {
    if (drive_read(base) == 0) {
      if (free_base == 255) {
        free_base = base;
        page = 255 - i;
      }
    } else {
      if (drive_read(base + 0) == 'L') {
        if (drive_read(base + 1) == 'E') {
          if (drive_read(base + 2) == 'T') {
            if (drive_read(base + 3) == 'T') {
              if (drive_read(base + 4) == 'E') {
                if (drive_read(base + 5) == 'R') {
                  if (drive_read(base + 6) == 'S') {
                    found = base;
                  }
                }
              }
            }
          }
        }
      }
    }
    base = base + 12;
    i = i + 1;
  }

  if (found != 255) {
    base = found;
    page = drive_read(base + 9);
  } else {
    if (free_base == 255) {
      print("directory full");
      putchar(10);
      return 0;
    }
    base = free_base;
  }

  drive_write(base + 0, 'L');
  drive_write(base + 1, 'E');
  drive_write(base + 2, 'T');
  drive_write(base + 3, 'T');
  drive_write(base + 4, 'E');
  drive_write(base + 5, 'R');
  drive_write(base + 6, 'S');
  drive_write(base + 7, 0);
  drive_write(base + 8, 1);
  drive_write(base + 9, page);
  drive_write(base + 10, 1);
  drive_write(base + 11, 130);

  // A
  drive_write_at(page, 0, 2);
  drive_write_at(page, 1, 5);
  drive_write_at(page, 2, 7);
  drive_write_at(page, 3, 5);
  drive_write_at(page, 4, 5);

  // B
  drive_write_at(page, 5, 6);
  drive_write_at(page, 6, 5);
  drive_write_at(page, 7, 6);
  drive_write_at(page, 8, 5);
  drive_write_at(page, 9, 6);

  // C
  drive_write_at(page, 10, 3);
  drive_write_at(page, 11, 4);
  drive_write_at(page, 12, 4);
  drive_write_at(page, 13, 4);
  drive_write_at(page, 14, 3);

  // D
  drive_write_at(page, 15, 6);
  drive_write_at(page, 16, 5);
  drive_write_at(page, 17, 5);
  drive_write_at(page, 18, 5);
  drive_write_at(page, 19, 6);

  // E
  drive_write_at(page, 20, 7);
  drive_write_at(page, 21, 4);
  drive_write_at(page, 22, 6);
  drive_write_at(page, 23, 4);
  drive_write_at(page, 24, 7);

  // F
  drive_write_at(page, 25, 7);
  drive_write_at(page, 26, 4);
  drive_write_at(page, 27, 6);
  drive_write_at(page, 28, 4);
  drive_write_at(page, 29, 4);

  // G
  drive_write_at(page, 30, 3);
  drive_write_at(page, 31, 4);
  drive_write_at(page, 32, 5);
  drive_write_at(page, 33, 5);
  drive_write_at(page, 34, 3);

  // H
  drive_write_at(page, 35, 5);
  drive_write_at(page, 36, 5);
  drive_write_at(page, 37, 7);
  drive_write_at(page, 38, 5);
  drive_write_at(page, 39, 5);

  // I
  drive_write_at(page, 40, 7);
  drive_write_at(page, 41, 2);
  drive_write_at(page, 42, 2);
  drive_write_at(page, 43, 2);
  drive_write_at(page, 44, 7);

  // J
  drive_write_at(page, 45, 1);
  drive_write_at(page, 46, 1);
  drive_write_at(page, 47, 1);
  drive_write_at(page, 48, 5);
  drive_write_at(page, 49, 2);

  // K
  drive_write_at(page, 50, 5);
  drive_write_at(page, 51, 5);
  drive_write_at(page, 52, 6);
  drive_write_at(page, 53, 5);
  drive_write_at(page, 54, 5);

  // L
  drive_write_at(page, 55, 4);
  drive_write_at(page, 56, 4);
  drive_write_at(page, 57, 4);
  drive_write_at(page, 58, 4);
  drive_write_at(page, 59, 7);

  // M
  drive_write_at(page, 60, 5);
  drive_write_at(page, 61, 7);
  drive_write_at(page, 62, 7);
  drive_write_at(page, 63, 5);
  drive_write_at(page, 64, 5);

  // N
  drive_write_at(page, 65, 5);
  drive_write_at(page, 66, 7);
  drive_write_at(page, 67, 7);
  drive_write_at(page, 68, 7);
  drive_write_at(page, 69, 5);

  // O
  drive_write_at(page, 70, 2);
  drive_write_at(page, 71, 5);
  drive_write_at(page, 72, 5);
  drive_write_at(page, 73, 5);
  drive_write_at(page, 74, 2);

  // P
  drive_write_at(page, 75, 6);
  drive_write_at(page, 76, 5);
  drive_write_at(page, 77, 6);
  drive_write_at(page, 78, 4);
  drive_write_at(page, 79, 4);

  // Q
  drive_write_at(page, 80, 2);
  drive_write_at(page, 81, 5);
  drive_write_at(page, 82, 5);
  drive_write_at(page, 83, 7);
  drive_write_at(page, 84, 3);

  // R
  drive_write_at(page, 85, 6);
  drive_write_at(page, 86, 5);
  drive_write_at(page, 87, 6);
  drive_write_at(page, 88, 5);
  drive_write_at(page, 89, 5);

  // S
  drive_write_at(page, 90, 3);
  drive_write_at(page, 91, 4);
  drive_write_at(page, 92, 2);
  drive_write_at(page, 93, 1);
  drive_write_at(page, 94, 6);

  // T
  drive_write_at(page, 95, 7);
  drive_write_at(page, 96, 2);
  drive_write_at(page, 97, 2);
  drive_write_at(page, 98, 2);
  drive_write_at(page, 99, 2);

  // U
  drive_write_at(page, 100, 5);
  drive_write_at(page, 101, 5);
  drive_write_at(page, 102, 5);
  drive_write_at(page, 103, 5);
  drive_write_at(page, 104, 7);

  // V
  drive_write_at(page, 105, 5);
  drive_write_at(page, 106, 5);
  drive_write_at(page, 107, 5);
  drive_write_at(page, 108, 5);
  drive_write_at(page, 109, 2);

  // W
  drive_write_at(page, 110, 5);
  drive_write_at(page, 111, 5);
  drive_write_at(page, 112, 7);
  drive_write_at(page, 113, 7);
  drive_write_at(page, 114, 5);

  // X
  drive_write_at(page, 115, 5);
  drive_write_at(page, 116, 5);
  drive_write_at(page, 117, 2);
  drive_write_at(page, 118, 5);
  drive_write_at(page, 119, 5);

  // Y
  drive_write_at(page, 120, 5);
  drive_write_at(page, 121, 5);
  drive_write_at(page, 122, 2);
  drive_write_at(page, 123, 2);
  drive_write_at(page, 124, 2);

  // Z
  drive_write_at(page, 125, 7);
  drive_write_at(page, 126, 1);
  drive_write_at(page, 127, 2);
  drive_write_at(page, 128, 4);
  drive_write_at(page, 129, 7);

  print("saved LETTERS");
  putchar(10);
  return 0;
}`,
  },
  {
    name: "FS Disque Externe",
    description: "Petit systeme de fichiers sur le lecteur externe IO",
    code: `// FS partage avec le bootloader
// Commandes: fmt, ls, touch nom, rm nom, cat nom, free, txt>nom
// Noms de fichiers: 8 caracteres max

int line[12];
int i;
int base;
int name_start;
int name_len;

int read_line() {
  int n;
  int ch;
  n = 0;
  ch = getchar();
  while (ch != 10) {
    if (ch == 64) { return 255; }
    if (n < 11) {
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

int parse_name(int start) {
  int n;
  int ch;
  n = 0;
  while (1) {
    ch = line[start + n];
    if (ch == 0) { break; }
    if (ch == ' ') { break; }
    if (n == 8) { return 255; }
    n = n + 1;
  }
  if (n == 0) { return 255; }
  return n;
}

int print_line_name(int start, int len) {
  i = 0;
  while (i < len) {
    putchar(line[start + i]);
    i = i + 1;
  }
  return 0;
}

int print_entry_name(int base) {
  int j;
  int ch;
  j = 0;
  while (j < 8) {
    ch = drive_read(base + j);
    if (ch == 0) { break; }
    putchar(ch);
    j = j + 1;
  }
  return 0;
}

int write_entry(int base, int page, int size) {
  int j;
  j = 0;
  while (j < 8) {
    if (j < name_len) {
      drive_write(base + j, line[name_start + j]);
    } else {
      drive_write(base + j, 0);
    }
    j = j + 1;
  }
  drive_write(base + 8, 1);
  drive_write(base + 9, page);
  drive_write(base + 10, 1);
  drive_write(base + 11, size);
  return 0;
}

int clear_entry(int base) {
  int j;
  j = 0;
  while (j < 12) {
    drive_write(base + j, 0);
    j = j + 1;
  }
  return 0;
}

int format_drive() {
  drive_clear();
  drive_set_page(0);
  drive_write(0, 66);
  drive_write(1, 3);
  base = 16;
  i = 0;
  while (i < 8) {
    clear_entry(base);
    base = base + 12;
    i = i + 1;
  }
  return 0;
}

int ensure_drive() {
  drive_set_page(0);
  if (drive_read(0) != 66) {
    format_drive();
  }
  drive_set_page(0);
  if (drive_read(1) != 3) {
    format_drive();
  }
  return 0;
}

int main() {
  int n;
  int pos;
  int page;
  int found;
  int free_base;
  int free_page;
  int used;
  int typev;
  ensure_drive();
  print("=== FS DISQUE EXTERNE ===");
  putchar(10);
  print("ls | touch nom | cat nom | free | txt>nom");
  putchar(10);

  while (1) {
    print("# ");
    n = read_line();
    if (n == 255) {
      putchar(10);
      return 0;
    }
    if (n == 0) { continue; }
    drive_set_page(0);

    if (line[0] == 'f') {
      if (line[1] == 'm') {
        if (line[2] == 't') {
          if (line[3] == 0) {
          format_drive();
          print("formatted");
          putchar(10);
          continue;
          }
        }
      }
      if (line[1] == 'r') {
        if (line[2] == 'e') {
          if (line[3] == 'e') {
            if (line[4] == 0) {
            used = 0;
            base = 16;
            i = 0;
            while (i < 8) {
              if (drive_read(base) != 0) {
                used = used + drive_read(base + 10);
              }
              base = base + 12;
              i = i + 1;
            }
            print_num(255 - used);
            putchar('p');
            putchar(10);
            continue;
            }
          }
        }
      }
    }

    if (line[0] == 'l') {
      if (line[1] == 's') {
        if (line[2] == 0) {
        base = 16;
        i = 0;
        while (i < 8) {
          if (drive_read(base) != 0) {
            typev = drive_read(base + 8);
            if (typev == 1) { putchar('f'); } else { putchar('p'); }
            putchar(' ');
            print_entry_name(base);
            putchar(' ');
            if (typev == 1) {
              print_num(drive_read(base + 11));
              putchar('b');
            } else {
              print_num(drive_read(base + 10));
              putchar('p');
            }
            putchar(10);
          }
          base = base + 12;
          i = i + 1;
        }
        continue;
        }
      }
    }

    if (line[0] == 't') {
      if (line[1] == 'o') {
        if (line[2] == 'u') {
          if (line[3] == 'c') {
            if (line[4] == 'h') {
              if (line[5] == ' ') {
                name_start = 6;
                name_len = parse_name(name_start);
                if (name_len == 255) {
                  print("name?");
                  putchar(10);
                  continue;
                }
                found = 255;
                free_base = 255;
                free_page = 0;
                base = 16;
                i = 0;
                while (i < 8) {
                  if (drive_read(base) == 0) {
                    if (free_base == 255) {
                      free_base = base;
                      free_page = 255 - i;
                    }
                  } else {
                    if (drive_read(base) == line[name_start]) { found = base; }
                  }
                  base = base + 12;
                  i = i + 1;
                }
                if (found != 255) {
                  if (drive_read(found + 8) != 1) {
                    print("busy");
                    putchar(10);
                    continue;
                  }
                  write_entry(found, drive_read(found + 9), 0);
                  print("cleared ");
                  print_line_name(name_start, name_len);
                  putchar(10);
                  continue;
                }
                if (free_base == 255) {
                  print("disk full");
                  putchar(10);
                  continue;
                }
                page = free_page;
                write_entry(free_base, page, 0);
                print("created ");
                print_line_name(name_start, name_len);
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
            name_start = 4;
            name_len = parse_name(name_start);
            if (name_len == 255) {
              print("name?");
              putchar(10);
              continue;
            }
            found = 255;
            base = 16;
            i = 0;
            while (i < 8) {
              if (drive_read(base) != 0) {
                if (drive_read(base) == line[name_start]) { found = base; }
              }
              base = base + 12;
              i = i + 1;
            }
            if (found == 255) {
              print("not found");
              putchar(10);
              continue;
            }
            if (drive_read(found + 8) != 1) {
              print("not file");
              putchar(10);
              continue;
            }
            page = drive_read(found + 9);
            used = drive_read(found + 11);
            i = 0;
            while (i < used) {
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
      name_start = pos + 1;
      name_len = parse_name(name_start);
      if (name_len == 255) {
        print("name?");
        putchar(10);
        continue;
      }
      found = 255;
      free_base = 255;
      free_page = 0;
      base = 16;
      i = 0;
      while (i < 8) {
        if (drive_read(base) == 0) {
          if (free_base == 255) {
            free_base = base;
            free_page = 255 - i;
          }
        } else {
          if (drive_read(base) == line[name_start]) { found = base; }
        }
        base = base + 12;
        i = i + 1;
      }
      if (found == 255) {
        if (free_base == 255) {
          print("disk full");
          putchar(10);
          continue;
        }
        page = free_page;
        found = free_base;
      } else {
        if (drive_read(found + 8) != 1) {
          print("not file");
          putchar(10);
          continue;
        }
        page = drive_read(found + 9);
      }
      i = 0;
      while (i < pos) {
        drive_write_at(page, i, line[i]);
        i = i + 1;
      }
      drive_set_page(0);
      write_entry(found, page, pos);
      print("saved ");
      print_line_name(name_start, name_len);
      putchar(10);
      continue;
    }

    print("?");
    putchar(10);
  }
  return 0;
}`,
  },
  {
    name: "Éditeur Texte FS",
    description: "Mini editeur texte pour les fichiers du disque partage",
    code: `// Mini editeur texte sur le FS partage avec le bootloader
// Fichier fixe: "notes"
// Tapez du texte pour l'ajouter
// Ligne vide = sauvegarder, /show = afficher, /clear = vider, @ = quitter

int clear_entry(int base) {
  int j;
  j = 0;
  while (j < 12) {
    drive_write(base + j, 0);
    j = j + 1;
  }
  return 0;
}

int format_drive() {
  int base;
  int i;
  drive_clear();
  drive_set_page(0);
  drive_write(0, 66);
  drive_write(1, 3);
  base = 16;
  i = 0;
  while (i < 8) {
    clear_entry(base);
    base = base + 12;
    i = i + 1;
  }
  return 0;
}

int ensure_drive() {
  drive_set_page(0);
  if (drive_read(0) != 66) {
    format_drive();
  }
  drive_set_page(0);
  if (drive_read(1) != 3) {
    format_drive();
  }
  return 0;
}

int is_notes(int base) {
  if (drive_read(base + 0) != 'n') { return 0; }
  if (drive_read(base + 1) != 'o') { return 0; }
  if (drive_read(base + 2) != 't') { return 0; }
  if (drive_read(base + 3) != 'e') { return 0; }
  if (drive_read(base + 4) != 's') { return 0; }
  if (drive_read(base + 5) != 0) { return 0; }
  return 1;
}

int init_notes_entry(int base, int page, int size) {
  drive_write(base + 0, 'n');
  drive_write(base + 1, 'o');
  drive_write(base + 2, 't');
  drive_write(base + 3, 'e');
  drive_write(base + 4, 's');
  drive_write(base + 5, 0);
  drive_write(base + 6, 0);
  drive_write(base + 7, 0);
  drive_write(base + 8, 1);
  drive_write(base + 9, page);
  drive_write(base + 10, 1);
  drive_write(base + 11, size);
  return 0;
}

int find_or_create_notes() {
  int base;
  int i;
  int free_base;
  int free_page;
  free_base = 255;
  free_page = 0;
  base = 16;
  i = 0;
  while (i < 8) {
    if (drive_read(base) == 0) {
      if (free_base == 255) {
        free_base = base;
        free_page = 255 - i;
      }
    } else {
      if (is_notes(base)) {
        return base;
      }
    }
    base = base + 12;
    i = i + 1;
  }
  if (free_base == 255) {
    return 255;
  }
  init_notes_entry(free_base, free_page, 0);
  return free_base;
}

int show_notes(int page, int len) {
  int i;
  if (len == 0) {
    print("(empty)");
    putchar(10);
    return 0;
  }
  i = 0;
  while (i < len) {
    putchar(drive_read_at(page, i));
    i = i + 1;
  }
  if (drive_read_at(page, len - 1) != 10) {
    putchar(10);
  }
  return 0;
}

int main() {
  int line[40];
  int n;
  int ch;
  int base;
  int page;
  int text_len;
  int i;

  ensure_drive();
  base = find_or_create_notes();
  if (base == 255) {
    print("disk full");
    putchar(10);
    return 0;
  }

  page = drive_read(base + 9);
  text_len = drive_read(base + 11);

  print("=== EDITEUR TEXTE FS ===");
  putchar(10);
  print("notes | vide=save | /show | /clear | @ quit");
  putchar(10);
  show_notes(page, text_len);

  while (1) {
    print("notes> ");
    n = 0;
    ch = getchar();
    while (ch != 10) {
      if (ch == 64) {
        putchar(10);
        return 0;
      }
      if (n < 39) {
        line[n] = ch;
        n = n + 1;
      }
      putchar(ch);
      ch = getchar();
    }
    line[n] = 0;
    putchar(10);

    if (n == 0) {
      drive_set_page(0);
      drive_write(base + 11, text_len);
      print("saved notes");
      putchar(10);
      continue;
    }

    if (line[0] == '/') {
      if (line[1] == 's') {
        if (line[2] == 'h') {
          if (line[3] == 'o') {
            if (line[4] == 'w') {
              if (line[5] == 0) {
                show_notes(page, text_len);
                continue;
              }
            }
          }
        }
      }
      if (line[1] == 'c') {
        if (line[2] == 'l') {
          if (line[3] == 'e') {
            if (line[4] == 'a') {
              if (line[5] == 'r') {
                if (line[6] == 0) {
                  text_len = 0;
                  print("buffer cleared");
                  putchar(10);
                  continue;
                }
              }
            }
          }
        }
      }
    }

    i = 0;
    while (i < n) {
      if (text_len == 255) {
        print("full");
        putchar(10);
        i = 255;
        break;
      }
      drive_write_at(page, text_len, line[i]);
      text_len = text_len + 1;
      i = i + 1;
    }
    if (i == 255) { continue; }
    if (text_len < 255) {
      drive_write_at(page, text_len, 10);
      text_len = text_len + 1;
    }
    print("appended");
    putchar(10);
  }
  return 0;
}`,
  },
  {
    name: "Éditeur Multi-fichier FS",
    description: "Editeur texte leger pour ouvrir ou creer plusieurs fichiers",
    code: `// Editeur multi-fichier avec curseur
// o nom = ouvrir/creer, l = liste, v = vue, s = sauver, c = vider, d = effacer
// Fleches: gauche/droite = curseur, haut = debut, bas = fin
// Toute autre ligne est inseree au curseur, vide = sauver, @ = quitter

int clear_entry(int base) {
  int j;
  j = 0;
  while (j < 12) {
    drive_write(base + j, 0);
    j = j + 1;
  }
  return 0;
}

int format_drive() {
  int base;
  int i;
  drive_clear();
  drive_set_page(0);
  drive_write(0, 66);
  drive_write(1, 3);
  base = 16;
  i = 0;
  while (i < 8) {
    clear_entry(base);
    base = base + 12;
    i = i + 1;
  }
  return 0;
}

int ensure_drive() {
  drive_set_page(0);
  if (drive_read(0) != 66) {
    format_drive();
  }
  drive_set_page(0);
  if (drive_read(1) != 3) {
    format_drive();
  }
  return 0;
}

int print_entry_name(int base) {
  int i;
  int ch;
  i = 0;
  while (i < 8) {
    ch = drive_read(base + i);
    if (ch == 0) { break; }
    putchar(ch);
    i = i + 1;
  }
  return 0;
}

int show_file(int page, int len) {
  int i;
  if (len == 0) {
    print("(empty)");
    putchar(10);
    return 0;
  }
  i = 0;
  while (i < len) {
    putchar(drive_read_at(page, i));
    i = i + 1;
  }
  if (drive_read_at(page, len - 1) != 10) {
    putchar(10);
  }
  return 0;
}

int draw_view(int base, int page, int len, int cursor) {
  int i;

  if (base == 255) {
    print("(o nom pour ouvrir)");
    putchar(10);
    return 0;
  }

  putchar('[');
  print_entry_name(base);
  putchar(']');
  putchar(' ');
  print_num(cursor);
  putchar('/');
  print_num(len);
  putchar(10);

  i = 0;
  while (i < len) {
    if (i == cursor) { putchar('|'); }
    putchar(drive_read_at(page, i));
    i = i + 1;
  }
  if (cursor == len) { putchar('|'); }
  if (len == 0) { putchar('|'); }
  putchar(10);
  return 0;
}

int main() {
  int line[40];
  int n;
  int ch;
  int base;
  int i;
  int j;
  int found;
  int free_base;
  int free_page;
  int start;
  int name_len;
  int match;
  int current_base;
  int current_page;
  int current_len;
  int cursor;
  int left_prev;
  int right_prev;
  int up_prev;
  int down_prev;
  int key;
  int dirty;
  int extra;

  ensure_drive();
  current_base = 255;
  current_page = 0;
  current_len = 0;
  cursor = 0;
  left_prev = 0;
  right_prev = 0;
  up_prev = 0;
  down_prev = 0;
  dirty = 1;

  print("=== EDITEUR CURSEUR FS ===");
  putchar(10);
  print("o nom | l | v | s | c | d | texte");
  putchar(10);

  while (1) {
    ch = getchar_nb();
    if (ch == 64) {
      putchar(10);
      return 0;
    }

    if (ch != 0) {
      if (ch == 10) {
        line[n] = 0;

        if (n == 0) {
          if (current_base == 255) {
            print("open?");
            putchar(10);
          } else {
            drive_set_page(0);
            drive_write(current_base + 11, current_len);
            print("saved ");
            print_entry_name(current_base);
            putchar(10);
          }
          dirty = 1;
          n = 0;
        } else {
          drive_set_page(0);

          if (line[0] == 'l') {
            if (line[1] == 0) {
              base = 16;
              i = 0;
              while (i < 8) {
                if (drive_read(base) != 0) {
                  putchar('f');
                  putchar(' ');
                  print_entry_name(base);
                  putchar(' ');
                  print_num(drive_read(base + 11));
                  putchar('b');
                  putchar(10);
                }
                base = base + 12;
                i = i + 1;
              }
              dirty = 1;
              n = 0;
            }
          }

          if (n != 0) {
            if (line[0] == 'v') {
              if (line[1] == 0) {
                dirty = 1;
                n = 0;
              }
            }
          }

          if (n != 0) {
            if (line[0] == 's') {
              if (line[1] == 0) {
                if (current_base == 255) {
                  print("open?");
                  putchar(10);
                } else {
                  drive_write(current_base + 11, current_len);
                  print("saved ");
                  print_entry_name(current_base);
                  putchar(10);
                }
                dirty = 1;
                n = 0;
              }
            }
          }

          if (n != 0) {
            if (line[0] == 'c') {
              if (line[1] == 0) {
                if (current_base == 255) {
                  print("open?");
                  putchar(10);
                } else {
                  current_len = 0;
                  cursor = 0;
                  print("cleared ");
                  print_entry_name(current_base);
                  putchar(10);
                }
                dirty = 1;
                n = 0;
              }
            }
          }

          if (n != 0) {
            if (line[0] == 'd') {
              if (line[1] == 0) {
                if (current_base == 255) {
                  print("open?");
                  putchar(10);
                } else {
                  if (cursor > 0) {
                    cursor = cursor - 1;
                    i = cursor;
                    while (i + 1 < current_len) {
                      drive_write_at(current_page, i, drive_read_at(current_page, i + 1));
                      i = i + 1;
                    }
                    current_len = current_len - 1;
                    print("deleted");
                    putchar(10);
                  }
                }
                dirty = 1;
                n = 0;
              }
            }
          }

          if (n != 0) {
            if (line[0] == 'o') {
              if (line[1] == ' ') {
                start = 2;
                name_len = 0;
                while (1) {
                  ch = line[start + name_len];
                  if (ch == 0) { break; }
                  if (ch == ' ') { break; }
                  if (name_len == 8) { name_len = 255; break; }
                  name_len = name_len + 1;
                }
                if (name_len == 0 || name_len == 255) {
                  print("name?");
                  putchar(10);
                  dirty = 1;
                  n = 0;
                } else {
                  found = 255;
                  free_base = 255;
                  free_page = 0;
                  base = 16;
                  i = 0;
                  while (i < 8) {
                    if (drive_read(base) == 0) {
                      if (free_base == 255) {
                        free_base = base;
                        free_page = 255 - i;
                      }
                    } else {
                      match = 1;
                      j = 0;
                      while (j < 8) {
                        ch = drive_read(base + j);
                        if (j < name_len) {
                          if (ch != line[start + j]) { match = 0; }
                        } else {
                          if (ch != 0) { match = 0; }
                        }
                        j = j + 1;
                      }
                      if (match == 1) { found = base; }
                    }
                    base = base + 12;
                    i = i + 1;
                  }

                  if (found == 255) {
                    if (free_base == 255) {
                      print("disk full");
                      putchar(10);
                    } else {
                      j = 0;
                      while (j < 8) {
                        if (j < name_len) {
                          drive_write(free_base + j, line[start + j]);
                        } else {
                          drive_write(free_base + j, 0);
                        }
                        j = j + 1;
                      }
                      drive_write(free_base + 8, 1);
                      drive_write(free_base + 9, free_page);
                      drive_write(free_base + 10, 1);
                      drive_write(free_base + 11, 0);
                      current_base = free_base;
                      current_page = free_page;
                      current_len = 0;
                      cursor = 0;
                      print("created ");
                      print_entry_name(current_base);
                      putchar(10);
                    }
                  } else {
                    current_base = found;
                    current_page = drive_read(found + 9);
                    current_len = drive_read(found + 11);
                    cursor = current_len;
                    print("opened ");
                    print_entry_name(current_base);
                    putchar(10);
                  }
                  dirty = 1;
                  n = 0;
                }
              }
            }
          }

          if (n != 0) {
            if (current_base == 255) {
              print("open?");
              putchar(10);
              dirty = 1;
              n = 0;
            } else {
              extra = n + 1;
              if (current_len + extra > 255) {
                print("full");
                putchar(10);
                dirty = 1;
                n = 0;
              } else {
                i = current_len;
                while (i > cursor) {
                  i = i - 1;
                  drive_write_at(current_page, i + extra, drive_read_at(current_page, i));
                }
                i = 0;
                while (i < n) {
                  drive_write_at(current_page, cursor + i, line[i]);
                  i = i + 1;
                }
                drive_write_at(current_page, cursor + n, 10);
                current_len = current_len + extra;
                cursor = cursor + extra;
                print("inserted");
                putchar(10);
                dirty = 1;
                n = 0;
              }
            }
          }
        }
      } else {
        if (n < 39) {
          line[n] = ch;
          n = n + 1;
        }
      }
    }

    key = getKey(0);
    if (key) {
      if (left_prev == 0) {
        if (cursor > 0) {
          cursor = cursor - 1;
          dirty = 1;
        }
      }
    }
    left_prev = key;

    key = getKey(1);
    if (key) {
      if (right_prev == 0) {
        if (cursor < current_len) {
          cursor = cursor + 1;
          dirty = 1;
        }
      }
    }
    right_prev = key;

    key = getKey(2);
    if (key) {
      if (up_prev == 0) {
        if (cursor != 0) {
          cursor = 0;
          dirty = 1;
        }
      }
    }
    up_prev = key;

    key = getKey(3);
    if (key) {
      if (down_prev == 0) {
        if (cursor != current_len) {
          cursor = current_len;
          dirty = 1;
        }
      }
    }
    down_prev = key;

    if (dirty) {
      draw_view(current_base, current_page, current_len, cursor);
      dirty = 0;
    }

    sleep(2);
  }
  return 0;
}`,
  },
  {
    name: "Système Solaire 255",
    description: "Soleil et une planete en orbite circulaire colorés sur 255x255",
    code: `// Soleil RGB + une planete en orbite circulaire
// @ = quitter

int gx;
int gy;

int anchor(int p) {
  p = p & 31;
  if (p == 0) { gx = 212; gy = 128; return 0; }
  if (p == 1) { gx = 210; gy = 144; return 0; }
  if (p == 2) { gx = 206; gy = 160; return 0; }
  if (p == 3) { gx = 198; gy = 175; return 0; }
  if (p == 4) { gx = 188; gy = 188; return 0; }
  if (p == 5) { gx = 175; gy = 198; return 0; }
  if (p == 6) { gx = 160; gy = 206; return 0; }
  if (p == 7) { gx = 144; gy = 210; return 0; }
  if (p == 8) { gx = 128; gy = 212; return 0; }
  if (p == 9) { gx = 112; gy = 210; return 0; }
  if (p == 10) { gx = 96; gy = 206; return 0; }
  if (p == 11) { gx = 81; gy = 198; return 0; }
  if (p == 12) { gx = 68; gy = 188; return 0; }
  if (p == 13) { gx = 58; gy = 175; return 0; }
  if (p == 14) { gx = 50; gy = 160; return 0; }
  if (p == 15) { gx = 46; gy = 144; return 0; }
  if (p == 16) { gx = 44; gy = 128; return 0; }
  if (p == 17) { gx = 46; gy = 112; return 0; }
  if (p == 18) { gx = 50; gy = 96; return 0; }
  if (p == 19) { gx = 58; gy = 81; return 0; }
  if (p == 20) { gx = 68; gy = 68; return 0; }
  if (p == 21) { gx = 81; gy = 58; return 0; }
  if (p == 22) { gx = 96; gy = 50; return 0; }
  if (p == 23) { gx = 112; gy = 46; return 0; }
  if (p == 24) { gx = 128; gy = 44; return 0; }
  if (p == 25) { gx = 144; gy = 46; return 0; }
  if (p == 26) { gx = 160; gy = 50; return 0; }
  if (p == 27) { gx = 175; gy = 58; return 0; }
  if (p == 28) { gx = 188; gy = 68; return 0; }
  if (p == 29) { gx = 198; gy = 81; return 0; }
  if (p == 30) { gx = 206; gy = 96; return 0; }
  gx = 210;
  gy = 112;
  return 0;
}

int lerp(int a, int b, int s) {
  if (b > a) {
    return a + (((b - a) * s) >> 2);
  }
  return a - (((a - b) * s) >> 2);
}

int place(int p) {
  int x0;
  int y0;
  p = p & 127;
  anchor(p >> 2);
  if ((p & 3) == 0) {
    return 0;
  }
  x0 = gx;
  y0 = gy;
  anchor((p >> 2) + 1);
  gx = lerp(x0, gx, p & 3);
  gy = lerp(y0, gy, p & 3);
  return 0;
}

int orbit() {
  int p;
  color(70, 90, 150);
  p = 0;
  while (p < 128) {
    place(p);
    draw(gx, gy);
    p = p + 1;
  }
  return 0;
}

int planet(int p) {
  int tx;
  int ty;
  place(p);
  color(70, 210, 255);
  draw(gx, gy);
  draw(gx + 1, gy);
  draw(gx - 1, gy);
  draw(gx, gy + 1);
  draw(gx, gy - 1);
  draw(gx + 2, gy);
  draw(gx - 2, gy);
  draw(gx, gy + 2);
  draw(gx, gy - 2);
  draw(gx + 1, gy - 1);
  draw(gx - 1, gy + 1);
  draw(gx + 1, gy + 1);
  draw(gx - 1, gy - 1);
  tx = gx;
  ty = gy;
  color(255, 255, 255);
  place(p - 2);
  draw(gx, gy);
  place(p - 4);
  draw(gx, gy);
  color(30, 180, 90);
  draw(tx + 1, ty - 1);
  draw(tx + 1, ty);
  draw(tx + 1, ty + 1);
  gx = tx;
  gy = ty;
  return 0;
}

int sun() {
  color(255, 220, 80);
  draw(128, 128);
  draw(127, 128); draw(129, 128);
  draw(128, 127); draw(128, 129);
  draw(127, 127); draw(129, 127);
  draw(127, 129); draw(129, 129);
  draw(126, 128); draw(130, 128);
  draw(128, 126); draw(128, 130);
  draw(125, 128); draw(131, 128);
  draw(128, 125); draw(128, 131);
  draw(126, 126); draw(130, 126);
  draw(126, 130); draw(130, 130);
  draw(124, 128); draw(132, 128);
  draw(128, 124); draw(128, 132);
  draw(125, 125); draw(131, 125);
  draw(125, 131); draw(131, 131);
  color(255, 245, 190);
  draw(128, 128);
  draw(127, 128); draw(129, 128);
  draw(128, 127); draw(128, 129);
  return 0;
}

int corona(int t) {
  color(255, 140, 40);
  if ((t & 8) == 0) {
    draw(121, 128); draw(135, 128);
    draw(128, 121); draw(128, 135);
    draw(123, 123); draw(133, 123);
    draw(123, 133); draw(133, 133);
  } else {
    draw(120, 128); draw(136, 128);
    draw(128, 120); draw(128, 136);
    draw(122, 122); draw(134, 122);
    draw(122, 134); draw(134, 134);
  }
  return 0;
}

int main() {
  int t;
  int k;
  int hold;

  print("=== SOLAR 255 ===");
  putchar(10);
  print("sun + orbiting planet");
  putchar(10);
  print("@ quit");
  putchar(10);

  t = 0;
  while (1) {
    k = getchar_nb();
    if (k == 64) {
      putchar(10);
      return 0;
    }

    clear();
    color(180, 180, 220);
    draw(212, 128);
    //orbit();
    sun();
    corona(t);
    planet(t);

    hold = 0;
    while (hold < 10) {
      sleep(255);
      hold = hold + 1;
    }
    t = t + 1;
  }
  return 0;
}`,
  },
  {
    name: "Paysage RGB",
    description: "Grand paysage coloré avec ciel, montagnes, lac et sapins",
    code: `// Paysage RGB plus complexe
// Ciel en couches, soleil, montagnes, reflets et sapins

int hline(int x0, int x1, int y) {
  int x;
  x = x0;
  while (1) {
    draw(x, y);
    if (x == x1) {
      return 0;
    }
    x = x + 1;
  }
  return 0;
}

int fill_rect(int x0, int y0, int x1, int y1, int r, int g, int b) {
  int y;
  color(r, g, b);
  y = y0;
  while (1) {
    hline(x0, x1, y);
    if (y == y1) {
      return 0;
    }
    y = y + 1;
  }
  return 0;
}

int diamond(int cx, int cy, int radius, int r, int g, int b) {
  int d;
  color(r, g, b);
  d = 0;
  while (1) {
    hline(cx - d, cx + d, cy - d);
    if (d != 0) {
      hline(cx - d, cx + d, cy + d);
    }
    if (d == radius) {
      return 0;
    }
    d = d + 1;
  }
  return 0;
}

int mountain(int cx, int peak_y, int base_y, int r, int g, int b) {
  int y;
  int span;
  color(r, g, b);
  y = peak_y;
  span = 0;
  while (1) {
    hline(cx - span, cx + span, y);
    if (y == base_y) {
      return 0;
    }
    y = y + 1;
    span = span + 1;
  }
  return 0;
}

int pine(int x, int base_y) {
  color(70, 40, 20);
  fill_rect(x, base_y - 12, x + 2, base_y, 70, 40, 20);

  color(10, 70, 25);
  hline(x - 8, x + 10, base_y - 12);
  hline(x - 7, x + 9, base_y - 15);
  hline(x - 6, x + 8, base_y - 18);
  hline(x - 5, x + 7, base_y - 21);
  hline(x - 4, x + 6, base_y - 24);
  hline(x - 3, x + 5, base_y - 27);
  hline(x - 2, x + 4, base_y - 30);
  hline(x - 1, x + 3, base_y - 33);
  hline(x, x + 2, base_y - 36);
  return 0;
}

int reflection() {
  color(255, 210, 90);
  hline(184, 208, 142);
  hline(180, 212, 150);
  hline(176, 216, 158);
  hline(182, 210, 166);
  hline(188, 204, 174);

  color(255, 255, 220);
  hline(192, 200, 146);
  hline(190, 202, 154);
  hline(194, 198, 162);
  return 0;
}

int cloud(int x, int y, int tone) {
  color(tone, tone, tone);
  hline(x - 14, x + 14, y);
  hline(x - 22, x + 10, y + 4);
  hline(x - 10, x + 22, y + 8);
  hline(x - 16, x + 16, y + 12);
  return 0;
}

int ripples() {
  color(84, 172, 220);
  hline(20, 118, 182);
  hline(10, 100, 188);
  hline(140, 250, 194);
  hline(36, 108, 200);
  hline(150, 236, 206);

  color(126, 198, 236);
  hline(48, 128, 180);
  hline(132, 226, 186);
  hline(22, 90, 198);
  hline(168, 240, 210);
  return 0;
}

int stars() {
  color(255, 255, 255);
  draw(18, 14);  draw(40, 22);  draw(72, 10);  draw(104, 18);
  draw(136, 12); draw(154, 28); draw(226, 16); draw(244, 26);
  color(255, 220, 180);
  draw(28, 34);  draw(94, 30);  draw(166, 20); draw(214, 36);
  return 0;
}

int birds() {
  color(32, 20, 24);
  draw(78, 74);  draw(79, 73);  draw(80, 72);  draw(81, 73);  draw(82, 74);
  draw(112, 64); draw(113, 63); draw(114, 62); draw(115, 63); draw(116, 64);
  draw(152, 72); draw(153, 71); draw(154, 70); draw(155, 71); draw(156, 72);
  return 0;
}

int main() {
  clear();

  fill_rect(0, 0, 255, 35, 8, 18, 70);
  fill_rect(0, 36, 255, 78, 36, 86, 160);
  fill_rect(0, 79, 255, 118, 255, 132, 82);
  fill_rect(0, 119, 255, 170, 18, 86, 138);
  fill_rect(0, 171, 255, 214, 14, 66, 110);
  fill_rect(0, 215, 255, 255, 20, 74, 28);

  stars();
  cloud(54, 44, 220);
  cloud(106, 34, 236);
  cloud(236, 58, 205);
  birds();

  diamond(194, 54, 22, 255, 150, 60);
  diamond(194, 54, 16, 255, 214, 88);
  diamond(194, 54, 10, 255, 245, 190);

  mountain(54, 92, 176, 26, 18, 50);
  mountain(126, 62, 176, 48, 26, 76);
  mountain(210, 102, 176, 22, 16, 44);

  color(24, 110, 170);
  hline(0, 255, 171);
  color(32, 130, 190);
  hline(0, 255, 172);
  hline(0, 255, 173);

  reflection();
  ripples();

  pine(18, 230);
  pine(40, 236);
  pine(68, 234);
  pine(216, 232);
  pine(236, 238);

  color(90, 58, 26);
  hline(0, 255, 255);
  hline(0, 255, 254);
  return 0;
}`,
  },
  {
    name: "HTTP JSONPlaceholder",
    description: "GET et POST vers l'API JSONPlaceholder",
    code: `// Demo reseau avec JSONPlaceholder
// Affiche d'abord un todo en JSON, puis la reponse d'un POST

void print_http_response() {
  int c;
  while ((c = gethttpchar()) != 0) {
    putchar(c);
  }
}

int main() {
  print("GET /todos/1");
  putchar(10);
  get("https://jsonplaceholder.typicode.com/todos/1");
  print_http_response();
  putchar(10);
  putchar(10);

  print("POST /posts");
  putchar(10);
  post(
    "https://jsonplaceholder.typicode.com/posts",
    "{\\"title\\":\\"foo\\",\\"body\\":\\"bar\\",\\"userId\\":1}"
  );
  print_http_response();
  putchar(10);

  return 0;
}`,
  },
  {
    name: "Meteo Ales",
    description: "Open-Meteo en direct avec scene graphique premium",
    code: `// Meteo temps reel pour Ales via Open-Meteo
// Coordonnees: 44.1249, 4.0808

int temp_abs;
int temp_neg;
int weather_code;
int is_day_now;

int num_started;
int num_value;
int num_sign;
int num_decimal;
int in_string;

void hline(int x1, int x2, int y) {
  int x;
  x = x1;
  while (1) {
    draw(x, y);
    if (x == x2) { return; }
    x = x + 1;
  }
}

void fill_rect(int x1, int y1, int x2, int y2, int r, int g, int b) {
  int y;
  color(r, g, b);
  y = y1;
  while (1) {
    hline(x1, x2, y);
    if (y == y2) { return; }
    y = y + 1;
  }
}

void disc(int cx, int cy, int radius, int r, int g, int b) {
  int dy;
  int dx;
  color(r, g, b);
  dy = 0;
  while (dy <= radius) {
    dx = radius - (dy >> 1);
    hline(cx - dx, cx + dx, cy + dy);
    if (dy != 0) { hline(cx - dx, cx + dx, cy - dy); }
    dy = dy + 1;
  }
}

void cloud(int x, int y, int tone) {
  disc(x, y, 11, tone, tone, tone + 8);
  disc(x + 13, y - 4, 9, tone + 8, tone + 8, tone + 12);
  disc(x + 24, y, 11, tone, tone, tone + 8);
  fill_rect(x - 4, y, x + 28, y + 8, tone - 8, tone - 8, tone);
}

void reset_num() {
  num_started = 0;
  num_value = 0;
  num_sign = 0;
  num_decimal = 0;
}

int feed_num(int c) {
  if (!num_started) {
    if (c == 45) { num_started = 1; num_sign = 1; return 0; }
    if (c >= 48 && c <= 57) {
      num_started = 1;
      num_value = c - 48;
    }
    return 0;
  }
  if (c >= 48 && c <= 57) {
    if (num_decimal == 0) {
      num_value = num_value * 10 + (c - 48);
    } else if (num_decimal == 1) {
      if (c >= 53) { num_value = num_value + 1; }
      num_decimal = 2;
    }
    return 0;
  }
  if (c == 46 && num_decimal == 0) {
    num_decimal = 1;
    return 0;
  }
  return 1;
}

void fetch_weather() {
  int c;
  int depth;
  int object_hits;
  int field;
  int started;

  temp_abs = 0;
  temp_neg = 0;
  is_day_now = 1;
  weather_code = 0;
  in_string = 0;
  depth = 0;
  object_hits = 0;
  field = 0;
  started = 0;
  reset_num();

  get("https://api.open-meteo.com/v1/forecast?latitude=44.1249&longitude=4.0808&current=temperature_2m,is_day,weather_code");

  while ((c = gethttpchar()) != 0) {
    if (c == 34) {
      in_string = !in_string;
      continue;
    }
    if (!in_string) {
      if (started) {
        if (feed_num(c)) {
          // Open-Meteo "current" now includes an "interval" field before
          // the requested weather values, so we intentionally skip field 1.
          if (field == 2) {
            temp_abs = num_value;
            temp_neg = num_sign;
          }
          if (field == 3) { is_day_now = num_value; }
          if (field == 4) {
            weather_code = num_value;
            return;
          }
          field = field + 1;
          reset_num();
        }
      }
      if (c == 123) {
        depth = depth + 1;
        if (depth == 2) {
          object_hits = object_hits + 1;
          if (object_hits == 2) {
            started = 1;
            field = 1;
            reset_num();
          }
        }
      }
      if (c == 125) { depth = depth - 1; }
    }
  }
}

void draw_scene() {
  int x;
  int y;
  int level;

  clear();

  if (is_day_now) {
    if (weather_code == 0) {
      color(98, 192, 255);
    } else {
      color(112, 154, 210);
    }
  } else {
    color(26, 36, 74);
  }

  y = 6;
  while (y < 118) {
    hline(0, 255, y);
    y = y + 18;
  }

  if (is_day_now) {
    disc(204, 44, 20, 255, 220, 96);
    disc(204, 44, 11, 255, 244, 188);
  } else {
    disc(206, 42, 13, 240, 240, 220);
    disc(212, 38, 13, 20, 30, 72);
    color(255, 244, 216);
    draw(28, 18); draw(72, 28); draw(118, 16); draw(168, 22); draw(216, 14);
  }

  if (weather_code != 0) {
    if (weather_code <= 3) {
      cloud(56, 78, 220);
      cloud(150, 92, 208);
    } else {
      cloud(52, 78, 154);
      cloud(138, 82, 142);
    }
  }

  if ((weather_code >= 51 && weather_code <= 67) || (weather_code >= 80 && weather_code <= 82)) {
    color(126, 190, 255);
    x = 20;
    while (x < 240) {
      draw(x, 94); draw(x + 2, 100); draw(x + 4, 106);
      x = x + 16;
    }
  }

  if ((weather_code >= 71 && weather_code <= 77) || weather_code == 85 || weather_code == 86) {
    color(250, 250, 255);
    x = 22;
    while (x < 240) {
      draw(x, 90); draw(x - 1, 90); draw(x + 1, 90); draw(x, 89); draw(x, 91);
      x = x + 18;
    }
  }

  if (weather_code == 45 || weather_code == 48) {
    fill_rect(16, 94, 240, 100, 184, 190, 198);
    fill_rect(28, 118, 228, 124, 170, 176, 186);
  }

  if (weather_code >= 95) {
    color(255, 244, 180);
    draw(182, 64); draw(174, 82); draw(180, 82);
  }

  color(34, 58, 42);
  hline(0, 255, 186);
  hline(0, 255, 202);
  hline(0, 255, 218);
  fill_rect(34, 156, 48, 218, 22, 24, 28);
  fill_rect(74, 144, 92, 218, 18, 20, 24);
  fill_rect(154, 150, 172, 218, 22, 24, 28);

  fill_rect(18, 40, 28, 182, 232, 236, 242);
  fill_rect(20, 42, 26, 180, 38, 42, 58);
  disc(23, 194, 10, 238, 240, 246);

  level = temp_abs;
  if (level > 34) { level = 34; }
  if (temp_neg) {
    fill_rect(21, 180 - level * 4, 25, 180, 112, 192, 255);
    disc(23, 194, 6, 112, 192, 255);
  } else if (temp_abs > 27) {
    fill_rect(21, 180 - level * 4, 25, 180, 255, 118, 88);
    disc(23, 194, 6, 255, 118, 88);
  } else {
    fill_rect(21, 180 - level * 4, 25, 180, 255, 176, 92);
    disc(23, 194, 6, 255, 176, 92);
  }
}

int main() {
  putchar(62);
  fetch_weather();
  putchar(84);
  if (temp_neg) { putchar(45); } else { putchar(43); }
  print_num(temp_abs);
  putchar(32);
  print_num(weather_code);
  putchar(10);
  draw_scene();
  return 0;
}`,
  },
  {
    name: "Boot Args - Cat",
    description: "Lit le fichier passe a 'run bootcat nom' via le bloc d'arguments du bootloader",
    code: `// Utilisation:
//   run bootcat notes
// Le bootloader remplit 0x1018..0x101F et ces built-ins lisent ce bloc.

int main() {
  int i;

  if (boot_argc() == 0) {
    print("NO ARG");
    putchar(10);
    return 0;
  }

  for (i = 0; i < boot_arg_size(); i++) {
    putchar(boot_file_read(i));
  }

  return 0;
}`,
  },
  {
    name: "Tableau (Nouvelles Fonctionnalites)",
    description: "Utilise declarations multiples et tableaux passes aux fonctions",
    code: `// Demonstration des nouvelles fonctionnalites:
// 1. declarations multiples: int a, b, c;
// 2. parametres de tableau: int values[3]

void sort3(int values[3]) {
  int i, j, tmp;

  for (i = 0; i < 2; i++) {
    for (j = 0; j < 2 - i; j++) {
      if (values[j] > values[j + 1]) {
        tmp = values[j];
        values[j] = values[j + 1];
        values[j + 1] = tmp;
      }
    }
  }
}

int sum3(int values[3]) {
  int i, total;
  total = 0;
  for (i = 0; i < 3; i++) {
    total = total + values[i];
  }
  return total;
}

int main() {
  int a = 42, b = 7, c = 19;
  int data[3];
  int i;

  data[0] = a;
  data[1] = b;
  data[2] = c;

  print("Avant: ");
  for (i = 0; i < 3; i++) {
    print_num(data[i]);
    putchar(32);
  }
  putchar(10);

  sort3(data);

  print("Trie: ");
  for (i = 0; i < 3; i++) {
    print_num(data[i]);
    putchar(32);
  }
  putchar(10);

  print("Somme: ");
  print_num(sum3(data));
  putchar(10);

  return 0;
}`,
  },
  {
    name: "Const et String",
    description: "Montre const, tableaux, strings, longueurs et modification par index",
    code: `// Donnees constantes globales
const int digits[10] = {48,49,50,51,52,53,54,55,56,57};
const int palette[3] = {0, 128, 255};
const int msg_len = 5;

void patch_text(int text[6]) {
  text[string_len(text) - 1] = 'A';
}

int sum3(int values[3]) {
  return values[0] + values[1] + values[2];
}

int main() {
  string msg = "hello";
  int buf[8] = "hi";
  const int local_mix[3] = {1, 2, 3};
  int i;

  print("Base: ");
  print(msg);
  putchar(32);
  print_num(string_len(msg));
  putchar(47);
  print_num(array_len(msg));
  putchar(10);

  patch_text(msg);
  print("Patch: ");
  print(msg);
  putchar(32);
  print_num(string_len(msg));
  putchar(47);
  print_num(array_len(msg));
  putchar(10);

  buf[2] = '!';
  buf[3] = 0;
  print("Buf: ");
  print(buf);
  putchar(32);
  print_num(string_len(buf));
  putchar(47);
  print_num(array_len(buf));
  putchar(10);

  print("Data: ");
  print_num(palette[1]);
  putchar(32);
  putchar(digits[7]);
  putchar(32);
  print_num(array_len(digits));
  putchar(32);
  print_num(sum3(local_mix));
  putchar(10);

  return 0;
}`,
  },
];
