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

### Rule 4: `print` prints text, not numbers

This works:

```c
print("Score: ");
string msg = "OK";
print(msg);
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
- `string`
- `void`

Use `int` for numeric variables and function parameters.
Use `string` for zero-terminated character arrays initialized from a string literal.
Use `void` for functions that do not return a value.
Use `const` in front of `int` or `string` when the data should be read-only after initialization.

### Local variables

```c
int main() {
  int x;
  int y = 3;
  x = y + 2;
  return 0;
}
```

You can declare several variables in one statement.

```c
int a, b;
```

Initializers can also be mixed in:

```c
int a = 1, b = 2, c;
```

Read-only data is also supported:

```c
const int digits[3] = {48, 49, 50};
const int count = 3;
string msg = "hello";
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

Global variables share a total storage area of `16` bytes.

That means:

- up to `16` normal global variables if each one uses one byte
- fewer globals if you use global arrays, because arrays also use that same `16`-byte area

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

Function parameters can be plain `int` values or fixed-size array parameters.

This is valid:

```c
int sum(int values[4]) {
  return values[0];
}
```

When you pass an array to a function, the compiler copies the requested slice into the callee's fixed-size array parameter and copies it back after the call. That means writes inside the function are visible to the caller, but the parameter size must be written as a constant.

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
int warm[4] = {10, 20, 30, 40};
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
- Array initializers are supported and fill any missing trailing elements with `0`
- Use `arr[index]`, not just `arr`
- Arrays cannot be used like pointer values
- Array sizes must be constant integers
- Fixed-size array parameters require a declared array name as the argument
- Array parameters are copied into the callee and copied back on return
- `string name = "hello";` creates a zero-terminated array, so `name[0]` is `'h'`
- There is no automatic bounds checking: `arr[99]` will compile and may corrupt nearby memory

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

### Strings

`string` is a convenience declaration for a zero-terminated character array initialized from a string literal.

```c
string msg = "hello";
```

You can read and write individual characters by index as long as the string is not `const`:

```c
msg[0] = 'H';
```

Use single quotes for one character. This is correct:

```c
msg[4] = 'a';
```

This is not:

```c
msg[4] = "a";
```

Concatenation is not built in. This does **not** work:

```c
string c = a + b;
```

If you want to append text, you must do it manually in a writable buffer with enough extra capacity and write the terminating `0` yourself:

```c
int buf[8] = "hi";
buf[2] = '!';
buf[3] = 0;
```

Important string limits:

- `string name = "text";` must be initialized immediately with a string literal
- `string` storage size is exactly the literal length plus the final `0`
- `string msg = "hello"; msg = "bye";` is not supported
- there is no automatic concatenation or copy helper
- use `array_len(...)` for capacity and `string_len(...)` for current runtime length
- index operations are not bounds-checked

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

#### `array_len(array_name)`

Returns the declared capacity of an array.

```c
int values[6];
print_num(array_len(values));   // 6
```

For `string msg = "hello";`, `array_len(msg)` is `6` because the trailing `0` is part of the storage.

#### `string_len(buffer_name)`

Returns the current length up to the first `0`.

```c
string msg = "hello";
print_num(string_len(msg));   // 5
```

If you manually edit the buffer contents, `string_len(...)` reflects the updated runtime value.

#### `print(text_or_buffer)`

Prints either a string literal or a zero-terminated string/buffer.

```c
print("Hello");
string msg = "Hello";
print(msg);
```

When you pass a variable, `print(...)` reads characters until the first `0`.

#### `console_clear()`

Clears the console output buffer.

```c
print("Loading...");
console_clear();
print("Ready");
```

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

`clear()` only affects the plotter. Use `console_clear()` to erase console text.

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

### Bootloader launch arguments

If a program is launched from the shell as:

```text
run myprog notes
```

the bootloader resolves `notes` first and writes one boot-argument block into RAM before jumping to `myprog`.

Layout:

- `0x1018` = argument count (`0` or `1`)
- `0x1019` = directory page
- `0x101A` = directory offset
- `0x101B` = entry type
- `0x101C` = data start page
- `0x101D` = page count
- `0x101E` = size in bytes
- `0x101F` = directory entry index

You can access that block from C with these built-ins:

#### `boot_argc()`

Returns how many bootloader arguments were passed.

```c
if (boot_argc() == 0) {
  print("No file");
}
```

#### `boot_arg_page()`

Returns the directory page of the resolved entry.

#### `boot_arg_offset()`

Returns the directory offset of the resolved entry.

#### `boot_arg_type()`

Returns the entry type (`1` = file, `2` = program).

#### `boot_arg_start_page()`

Returns the first drive page containing the entry data.

#### `boot_arg_page_count()`

Returns how many drive pages the entry occupies.

#### `boot_arg_size()`

Returns the byte size stored in the directory entry.

#### `boot_arg_index()`

Returns the directory index (`0..63`) of the resolved entry.

#### `boot_file_read(offset)`

Reads one byte from the bootloader-passed file data using the already-resolved start page.

```c
int i;

for (i = 0; i < boot_arg_size(); i++) {
  putchar(boot_file_read(i));
}
```

This is the easiest way to write a bootloader-launched viewer or tool without rescanning the filesystem by name.

### Shared FS usage

If you want your C program to share the disk correctly with the bootloader, `FS Disque Externe`, `Éditeur Texte FS`, `Éditeur Multi-fichier FS`, and `Éditeur FS ASM`, use the same filesystem conventions.

#### Disk header

On a formatted shared disk:

- byte `0` = magic value `66` (`'B'`)
- byte `1` = filesystem version `3`

If these bytes do not match, your program should treat the disk as unformatted and initialize it before using the shared FS.

#### Directory layout

- the directory starts at byte `0x10`
- each directory entry uses `12` bytes
- the bootloader reserves room for `64` entries total

Each entry is:

- bytes `+0..+7`: file name as ASCII, zero-padded, max `8` characters
- byte `+8`: entry type
- byte `+9`: start page
- byte `+10`: page count
- byte `+11`: size in bytes

Entry types:

- `1` = text file
- `2` = runnable program

#### Naming rules

To stay compatible with the bootloader:

- file names should be at most `8` characters
- file names should not contain spaces
- names are stored directly as ASCII bytes in the entry

#### Data pages

The shared bootloader format reserves the early drive space for metadata.

- page `0` contains the header and directory
- pages `1` to `3` are reserved by the shared layout
- file and program data should start at page `4` or later

The bootloader's own disk helpers allocate from page `4` upward. Small C examples may use a simpler allocation strategy, but they should still keep the same entry structure and avoid corrupting the reserved metadata area.

#### Text-file conventions

For bootloader-compatible text files:

- use entry type `1`
- keep the byte length in entry byte `+11`
- keep text files to `255` bytes max
- most examples store text in `1` page, so they write page count `1`

#### Program conventions

Programs stored by **Compile to Disk** use the same directory format.

- programs use entry type `2`
- the bootloader can `run` them
- the bootloader can also launch them as `run program file`, in which case the resolved file metadata is exposed through the `boot_arg*()` built-ins above
- text-oriented FS tools should not overwrite or edit type `2` entries as if they were normal text files

#### Practical compatibility rules

If you are writing your own filesystem tool in C, follow these rules:

- preserve bytes `0` and `1` as the shared FS header
- preserve the `12`-byte directory entry format
- preserve type `2` program entries
- keep names within the shared `8`-character limit
- do not invent a different meaning for bytes `+8..+11`

One practical limit: the bootloader supports all `64` directory entries, but some bundled C examples scan fewer entries so they still fit inside the simulator code-size budget. If your program only scans part of the directory, keep the same entry format anyway so it remains compatible with the rest of the system.

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
- Comparisons are unsigned
- Character data is also stored as 8-bit integers

### Memory limits

- Code area: about `4096` bytes of assembled code
- Global storage: `16` bytes total
  This includes both normal global variables and global arrays.
- Compiler scratch: `0x1010-0x1017`
- Boot argument block: `0x1018-0x101F`
- Function frame area: `0x1020-0x17FF`
- Stack: `2048` bytes total (`0x1800-0x1FFF`)

### Practical consequences

- Large programs may fail to compile or assemble if they are too big
- Large global arrays quickly fill the global area
- Arrays and strings are not bounds-checked, so invalid indexes can overwrite nearby variables
- `print(buf)` and `string_len(buf)` stop only at the first `0`, so unterminated buffers may print garbage
- Array parameters are fixed-size copies, so passing large arrays to helper functions costs time and frame space
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
- dynamic allocation (`malloc`, `free`)
- `switch`
- `sizeof`
- function pointer syntax
- multi-dimensional arrays
Also keep in mind:

- `print` only handles string literals and zero-terminated buffers
- array sizes must be constant integers
- arrays are not general pointer values; only declared arrays can be passed to fixed-size array parameters
- `string` variables must be initialized from a string literal at declaration time
- whole-array and whole-string assignment are not supported
- string concatenation is not built in
- string literals are not general expression values, so use `'A'` for one character and `print("text")` for direct text output

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

### Build a cursor-driven editor loop

```c
int ch;

while (1) {
  ch = getchar_nb();
  if (ch == '@') {
    break;
  }

  if (getKey(0)) {
    // move cursor left
  }
  if (getKey(1)) {
    // move cursor right
  }
}
```

This pattern is useful for text editors, games, or plotter tools that need immediate arrow-key movement while still accepting typed commands from the console.

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
- `Éditeur Texte FS` for a tiny single-file drive editor
- `Éditeur Multi-fichier FS` for opening, editing, and saving multiple files with arrow-key cursor movement
- `Plotter`, `Courbe`, and `Spirale` for graphics
- `Tableau (Tri)` for arrays
- `Tableau (Nouvelles Fonctionnalites)` for fixed-size array parameters and comma-separated declarations
- `Const et String` for const data, array initializers, string editing, `array_len(...)`, and `string_len(...)`

If you want the assembly-language version of that same idea, look at `Éditeur FS ASM` in [src/cpu/examples.ts](/Users/olivierveinand/Downloads/Simulateur%20Logique%20Nodal%20%281%29/src/cpu/examples.ts). It uses `/o nom` to open or create any shared-FS text file, edits with the arrow keys, saves with `/s`, and writes files in the real bootloader disk format.

If you want the implementation details of how this language compiles to ASM, also read [docs/how-the-computer-works.md](/Users/olivierveinand/Downloads/Simulateur Logique Nodal%20%281%29/docs/how-the-computer-works.md), especially the compiler section.
