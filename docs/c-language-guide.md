# Programming Guide for the Simulator C Language

This project includes a small C-like language that compiles to the simulator's ASM and then runs on the 8-bit CPU.

This guide explains how to write programs that actually work with this compiler.

---

## Table of Contents

1. [What This Language Is](#1-what-this-language-is)
2. [Your First Program](#2-your-first-program)
3. [Core Rules to Remember](#3-core-rules-to-remember)
4. [Program Structure](#4-program-structure)
5. [Variables and Values](#5-variables-and-values)
6. [Operators](#6-operators)
7. [Conditions and Loops](#7-conditions-and-loops)
8. [Functions](#8-functions)
9. [Arrays](#9-arrays)
10. [Built-in Functions](#10-built-in-functions)
11. [Constants with `#define`](#11-constants-with-define)
12. [Important Limits](#12-important-limits)
13. [What Is Not Supported](#13-what-is-not-supported)
14. [Programming Patterns](#14-programming-patterns)
15. [Example Programs](#15-example-programs)

---

## 1. What This Language Is

This is not full desktop C.

It is a **small, practical C-like language** made for this simulator:

- It compiles to the simulator's ASM
- It runs on an **8-bit CPU**
- All values are **unsigned 8-bit numbers**
- It is designed for simple algorithms, console programs, and plotter graphics

If you already know basic C, most of the syntax will feel familiar. The biggest difference is that this language is much smaller and much stricter.

---

## 2. Your First Program

```c
int main() {
  print("Hello World!");
  return 0;
}
```

What it does:

- `int main()` is the entry point
- `print("Hello World!")` writes text to the console
- `return 0;` ends the program

To run it in the simulator:

1. Open the software view
2. Switch the editor to `C`
3. Paste the program
4. Compile/assemble it
5. Run it

---

## 3. Core Rules to Remember

These rules explain most surprises people hit when writing code for this language.

### Rule 1: `int` is 8-bit unsigned

`int` values are always from `0` to `255`.

Examples:

- `255 + 1` becomes `0`
- `0 - 1` becomes `255`
- Negative numbers are not stored as normal signed integers

```c
int main() {
  int x;
  x = 255;
  x = x + 1;
  print_num(x);   // prints 0
  return 0;
}
```

### Rule 2: `main` is required

Every program must define:

```c
int main() {
  ...
}
```

### Rule 3: only a small subset of C is supported

You can use variables, functions, loops, conditions, arrays, and some built-ins.

You cannot use pointers, structs, floats, or the standard C library.

### Rule 4: `print` only prints string literals

This works:

```c
print("Score: ");
```

Use `print_num(x)` to print numbers.

### Rule 5: comparisons are unsigned

Operators like `<`, `>`, `<=`, `>=` compare values as numbers from `0` to `255`.

---

## 4. Program Structure

A program is made of:

- optional `#define` constants
- optional global variables
- one or more functions
- a required `main()` function

Example:

```c
#define LIMIT 10

int counter;

int add_one(int x) {
  return x + 1;
}

int main() {
  counter = add_one(LIMIT);
  print_num(counter);
  return 0;
}
```

Comments are supported:

```c
// one-line comment

/* multi-line
   comment */
```

---

## 5. Variables and Values

### Types

Supported types:

- `int`
- `void`

Use `int` for variables and function parameters.
Use `void` for functions that do not return a value.

### Local variables

```c
int main() {
  int x;
  int y = 3;
  x = y + 2;
  return 0;
}
```

### Global variables

```c
int score = 0;
int lives = 3;

int main() {
  score = score + 1;
  return 0;
}
```

### Literals

You can write:

- decimal numbers: `42`
- hexadecimal numbers: `0x2A`
- character literals: `'A'`
- string literals: `"Hello"`

Numbers are automatically reduced to 8 bits.

```c
int x = 300;   // stored as 44
```

### Naming advice

Keep variable names unique inside a function. The compiler is simple, so avoiding reused names across nested blocks will keep programs easier to reason about.

---

## 6. Operators

### Arithmetic

Supported:

- `+`
- `-`
- `*`
- `/`
- `%`

Example:

```c
int main() {
  int a = 10;
  int b = 3;

  print_num(a + b);
  putchar(10);
  print_num(a - b);
  putchar(10);
  print_num(a * b);
  putchar(10);
  print_num(a / b);
  putchar(10);
  print_num(a % b);
  return 0;
}
```

### Bitwise

Supported:

- `&`
- `|`
- `^`
- `~`
- `<<`
- `>>`

### Comparison

Supported:

- `==`
- `!=`
- `<`
- `>`
- `<=`
- `>=`

Comparisons return:

- `1` for true
- `0` for false

### Logical

Supported:

- `!`
- `&&`
- `||`

### Assignment

Supported:

- `=`
- `+=`
- `-=`

### Increment and decrement

Supported:

- `++x`
- `--x`
- `x++`
- `x--`

These work best on normal variables such as `x`, not on array expressions.

---

## 7. Conditions and Loops

### `if` / `else`

```c
if (x > 10) {
  print("big");
} else {
  print("small");
}
```

### `while`

```c
while (x < 10) {
  x = x + 1;
}
```

### `for`

```c
for (i = 0; i < 10; i++) {
  print_num(i);
  putchar(10);
}
```

You can also declare the loop variable inside the `for`:

```c
for (int i = 0; i < 10; i++) {
  putchar(48 + i);
}
```

### `break` and `continue`

Both are supported:

```c
while (1) {
  if (x == 10) {
    break;
  }

  x = x + 1;

  if (x == 5) {
    continue;
  }
}
```

---

## 8. Functions

### Declaring functions

```c
int add(int a, int b) {
  return a + b;
}
```

### Calling functions

```c
int main() {
  int r;
  r = add(3, 4);
  print_num(r);
  return 0;
}
```

### Recursive functions

Recursion is supported:

```c
int fact(int n) {
  if (n <= 1) {
    return 1;
  }
  return n * fact(n - 1);
}
```

Keep recursion small, because stack space is limited.

### `void` functions

```c
void newline() {
  putchar(10);
}
```

```c
int main() {
  print("Hi");
  newline();
  return 0;
}
```

---

## 9. Arrays

One-dimensional arrays are supported.

### Declaring arrays

```c
int values[8];
```

The size must be a constant number.

### Writing to arrays

```c
values[0] = 42;
values[1] = 99;
```

### Reading from arrays

```c
int x;
x = values[1];
```

### Indexed access

```c
int i;
for (i = 0; i < 8; i++) {
  values[i] = i * 2;
}
```

### Important array rules

- Only 1D arrays are supported
- Array initializers are not supported
- Use `arr[index]`, not just `arr`
- Arrays cannot be used like pointer values

This is valid:

```c
int t[4];
int x;
x = t[2];
```

This is not valid:

```c
int t[4];
int x;
x = t;   // not supported
```

---

## 10. Built-in Functions

These are special functions provided by the compiler and runtime.

### Console output

#### `putchar(value)`

Prints one ASCII character.

```c
putchar(65);    // A
putchar('A');   // A
putchar(10);    // newline
```

#### `print_num(value)`

Prints a number in decimal.

```c
print_num(42);
```

#### `print("text")`

Prints a string literal.

```c
print("Hello");
```

Use it only with a string literal.

### Console input

#### `getchar()`

Reads one character from the console input buffer.

It waits until a character is available.

```c
int c;
c = getchar();
putchar(c);
```

#### `getchar_nb()`

Reads one character from the console input buffer without waiting.

It returns:

- the ASCII value of the next character, if one is available
- `0` if the input buffer is empty

This is useful for interactive graphics or keyboard-driven loops that still want to react to console commands like `@` without blocking the frame loop.

```c
int ch;
ch = getchar_nb();
if (ch == '@') {
  return 0;
}
```

### HTTP network I/O

#### `get("url")`

Starts an HTTP `GET` request using a string literal URL.

```c
get("https://jsonplaceholder.typicode.com/todos/1");
```

#### `post("url", "body")`

Starts an HTTP `POST` request using string literal URL and body values.

```c
post(
  "https://jsonplaceholder.typicode.com/posts",
  "{\"title\":\"foo\",\"body\":\"bar\",\"userId\":1}"
);
```

#### `gethttpchar()`

Reads the next byte from the most recent HTTP response.

It waits while the request is still in flight, then returns:

- the next response byte when one is available
- `0` when the response is fully consumed

Typical pattern:

```c
int c;
get("https://jsonplaceholder.typicode.com/todos/1");
while ((c = gethttpchar()) != 0) {
  putchar(c);
}
```

Current limitations:

- `get(...)` and `post(...)` only accept string literals
- the response is exposed as bytes/chars, not parsed JSON
- `post(...)` sends the body exactly as written

### Keyboard state

#### `getKey(index)`

Reads the current keyboard state.

It returns:

- `1` if the key is pressed
- `0` if the key is not pressed

Key indexes:

- `0` = Left arrow
- `1` = Right arrow
- `2` = Up arrow
- `3` = Down arrow
- `4` = Enter

Example:

```c
if (getKey(0)) {
  x = x - 1;
}
```

### Plotter graphics

#### `color(r, g, b)`

Sets the current drawing color for the plotter.

Each channel is an 8-bit integer (`0..255`). All later `draw(x, y)` calls use that color until you change it again. If you never call `color(...)`, the default color stays the simulator's cyan.

```c
color(0, 128, 255);
draw(10, 20);   // rgb(0,128,255)
```

#### `draw(x, y)`

Draws one pixel on the plotter using the current plotter color.

```c
draw(10, 20);
```

#### `clear()`

Clears the plotter.

```c
clear();
```

### External drive

#### `drive_read(addr)`

Reads one byte from the external drive.

`addr` is an 8-bit offset inside the currently selected drive page.

```c
int value;
value = drive_read(10);
```

#### `drive_write(addr, value)`

Writes one byte to the external drive.

This expression evaluates to the written value, so it can be used inside a larger expression if needed.

```c
drive_write(10, 65);
putchar(drive_read(10));
```

#### `drive_set_page(page)`

Selects the current external drive page.

The 8 KB drive is split into `32` pages of `256` bytes.

```c
drive_set_page(1);
drive_write(10, 65);
```

#### `drive_read_at(page, addr)`

Reads directly from a specific page and offset.

```c
int value;
value = drive_read_at(1, 10);
```

#### `drive_write_at(page, addr, value)`

Writes directly to a specific page and offset.

```c
drive_write_at(1, 10, 65);
```

#### `drive_clear()`

Clears the whole external drive to `0`.

```c
drive_clear();
```

The external drive has `8192` bytes and persists across CPU reset, which makes it useful for tiny file systems, bootable programs, or saving state between runs.

The `FS Disque Externe` example and the bootloader shell both use the same disk format, so files and compiled programs can coexist on the same disk image.

### Misc

#### `rand()`

Returns a pseudo-random 8-bit value.

```c
x = rand();
```

#### `sleep(n)`

Pauses execution for `n` CPU cycles.

```c
sleep(5);
```

---

## 11. Constants with `#define`

Simple `#define` constants are supported through text substitution.

```c
#define WIDTH 100
#define HEIGHT 80

int main() {
  draw(WIDTH, HEIGHT);
  return 0;
}
```

This is a simple replacement system, not full macro C.

Supported well:

- `#define SIZE 10`
- `#define NEWLINE 10`

Not supported:

- macro functions like `#define ADD(a,b) ...`

---

## 12. Important Limits

The language runs on a very small machine, so programs must fit inside its memory model.

### Value limits

- Every `int` is `0..255`
- Arithmetic wraps around at 8 bits

### Memory limits

- Code area: about `1024` bytes of assembled code
- Global storage: `16` bytes total
- Local variables and parameters: fixed addresses in RAM
- Stack: `512` bytes total

### Practical consequences

- Large programs may fail to compile or assemble if they are too big
- Large global arrays quickly fill the global area
- Deep recursion can overflow the stack
- Expensive operations like `*`, `/`, `%`, `&`, `|`, `^`, `<<`, `>>` may be slower than on a normal CPU

---

## 13. What Is Not Supported

The following features are not part of this language:

- pointers
- structs
- floats
- `char`, `short`, `long`
- the standard C library
- `switch`
- `sizeof`
- function pointer syntax
- string variables
- array initializers like `int t[3] = {1,2,3};`
- multi-dimensional arrays

Also keep in mind:

- `print` is only for string literals
- array sizes must be constant integers
- arrays are not passed around like pointers

---

## 14. Programming Patterns

### Print text and numbers together

```c
print("Score: ");
print_num(score);
putchar(10);
```

### Wait for keyboard input

```c
while (!getKey(4)) {
  // wait for Enter
}
```

### Read characters until Enter

```c
int c;

while (1) {
  c = getchar();
  if (c == 10) {
    break;
  }
  putchar(c);
}
```

### Draw a line of pixels

```c
int x;

clear();
for (x = 0; x < 100; x++) {
  draw(x, 50);
}
```

### Count with a `for` loop

```c
int i;

for (i = 0; i < 10; i++) {
  putchar(48 + i);
}
```

---

## 15. Example Programs

The best real examples are in [src/cpu/cexamples.ts](/Users/olivierveinand/Downloads/Simulateur Logique Nodal%20%281%29/src/cpu/cexamples.ts).

Useful ones to start with:

- `Hello World` for console output
- `Compteur` for `for` loops
- `Factorielle` for recursion
- `Echo (Saisie)` for `getchar()`
- `Clavier` for `getKey()`
- `Plotter`, `Courbe`, and `Spirale` for graphics
- `Tableau (Tri)` for arrays

If you want the implementation details of how this language compiles to ASM, also read [docs/how-the-computer-works.md](/Users/olivierveinand/Downloads/Simulateur Logique Nodal%20%281%29/docs/how-the-computer-works.md), especially the compiler section.
