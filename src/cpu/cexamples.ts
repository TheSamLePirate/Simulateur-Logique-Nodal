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
  a = getchar() - 48;
  putchar(a + 48);
  putchar(10);

  print("b=");
  b = getchar() - 48;
  putchar(b + 48);
  putchar(10);

  if (b == 0) {
    print("Err: b=0");
    return 0;
  }

  print("c=");
  c = getchar() - 48;
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

  x = 127;
  y = 200;
  lf = 0;

  while (1) {
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
    name: "Test Mémoire 2K",
    description: "Remplit les 2048 octets: code, données et pile",
    code: `// Test Memoire 2K Complet
// Remplit: 16 globales, 488 locales, ~1024 code, pile
// Verifie l'integrite apres appels de fonction
// Attendu: =MEM 2K= g0=42 gf=15 r1=57 r2=5 PASS

// -- 16 globales (zone 0x400-0x40F) --
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
  int i; int tmp;

  bx = 128; by = 128;
  bdx = 1; bdy = 1;
  py = 118; ay = 118;

  while (1) {
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
];
