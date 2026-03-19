# Easy User Guide

This app is a complete, understandable computer playground.

It lets you explore computing from the bottom to the top:

- from **transistors**
- to **logic gates**
- to an **8-bit computer**
- to **assembly**
- to a small **C language**
- to a bootloader and a tiny **Linux-like userland**

The whole virtual machine is written in **TypeScript**, so you can understand every layer. It behaves like a small 1983-style computer, but with a few modern extras such as an HTTP bridge, a very fast simulator, and built-in visual tools.

---

## 1. What This App Is

There are really **two apps in one**:

### Hardware side

You build and inspect the machine itself:

- transistors
- gates
- registers
- ALU
- RAM
- clock
- full 8-bit CPU

### Software side

You use that machine like a computer:

- write ASM
- write mini C programs
- run the bootloader
- install the Linux-like userland disk
- use the console, plotter, drive, and network features

---

## 2. Why It Is Special

This is not a black-box emulator.

It is meant to be **understandable**:

- you can see the hardware blocks
- you can inspect RAM, registers, and flags
- you can read the assembler and compiler
- you can follow how a program turns into machine code
- you can see the bootloader and userland disk as real project files

In short: it is a small **virtual machine** with the spirit of an early personal computer, but easier to inspect than real hardware.

It has most of what you would expect from a classic 8-bit machine:

- text console
- keyboard input
- graphics plotter
- persistent drive
- bootloader
- disk programs
- simple C compiler

And it also has a few things a real 1983 home computer usually did not have:

- an **HTTP** bridge
- very fast execution in software
- a modern visual debugger-like UI
- a fully readable TypeScript implementation

---

## 3. First Orientation

When using the app, think of it like this:

- **Hardware / materiel scene**: learn or inspect how the computer is built
- **Software view**: actually program and use the machine

If you are new, the easiest path is:

1. Look at the basic hardware scene for a minute
2. Switch to the software view
3. Run a tiny C program
4. Boot the bootloader
5. Install the Linux disk
6. Try a few userland commands

---

## 4. How To Use The Basic Hardware Scene

The hardware scene is the visual, node-based part of the app.

You will see components connected by wires. Those components can be:

- inputs and outputs
- transistors
- logic gates
- registers
- ALU blocks
- clock and control logic
- memory
- CPU/peripheral modules

### What to do there

Start simple:

1. Toggle an input
2. Watch the wire color change
3. Observe the output node

Then move up one level:

1. Open a scene with transistors or gates
2. Change the inputs
3. Verify the truth table behavior

Then look at the default computer scene:

1. Find the CPU, RAM, and I/O blocks
2. Run the clock or step the machine
3. Watch values move through the system

### What the colors mean

- active/high signals light up
- inactive/low signals stay dim
- animated wires show activity

### Best way to learn

Use the hardware scene to answer questions like:

- What is a transistor doing?
- How does an AND gate work?
- What is inside an ALU?
- How do registers store values?
- How does a clock advance the machine?

This is the “from transistor to computer” part of the app.

---

## 5. How To Use The Software View

The software view is where you use the computer as a programmer.

Here you can:

- edit ASM or C code
- assemble/compile it
- run, pause, reset, or step
- inspect registers and memory
- see console output
- draw on the plotter
- use the external drive

The runtime area on the right now has two modes:

- `Computer` shows a non-editable live overview of the same running machine used by the software view
- `Classic` keeps the older split panels for registers, memory, console, and plotter

The `Computer` panel can be fullscreened and is meant to show the whole machine at once without dropping to hardware-scene granularity. It groups together:

- CPU state, registers, flags, bus/state summary, and stack activity
- memory and boot argument state
- console and plotter output
- immediate keyboard input, with a collapsible on-screen keyboard
- the external drive using the bootloader filesystem conventions
- the network controller, including recent completed requests

### Basic workflow

1. Choose `ASM` or `C`
2. Write or load a program
3. Compile/assemble
4. Run it
5. Inspect the output and state

If something goes wrong, use:

- the console output
- the register view
- the memory view
- the generated test report in `report/index.html`

If you want the broadest live view of the running program, switch the runtime area to `Computer`. It is especially useful in bootloader mode because the disk, keyboard, console, plotter, and network state are visible together in one place.
That `Computer` view also includes the live `Computer Architecture Flow`: a whole-machine SVG showing the CPU, ALU, memory bus, console, keyboard, drive, network, and plotter paths with the same renderer used by the automated test snapshots.

---

## 6. How To Write A Mini C Program

The easiest first C program is:

```c
int main() {
  print("Hello World!");
  return 0;
}
```

### How to run it

1. Open the software view
2. Switch the editor language to `C`
3. Paste the program
4. Compile it
5. Run it

### Another tiny example

```c
int main() {
  int a, b;
  a = 7;
  b = 5;
  print("Result: ");
  print_num(a + b);
  putchar(10);
  return 0;
}
```

### What mini C supports

The language is intentionally small and easy to understand:

- `int`
- `string`
- `const`
- `if`, `else`, `while`, `for`
- functions
- arrays
- array parameters
- string literals
- plotter and console built-ins

### Important thing to remember

`int` is **8-bit unsigned**, so values are from `0` to `255`.

That means:

- `255 + 1` becomes `0`
- `0 - 1` becomes `255`

This is part of the charm of the machine: it behaves like a real tiny 8-bit system.

---

## 7. How To Use The Bootloader And Linux Disk

The app includes a bootloader and a small Linux-like disk userland.

This is not real Linux, but it feels like a tiny classic machine OS:

- programs live on disk
- the bootloader launches them
- files can be read and written
- a shell prompt lets you explore the disk

### Basic boot flow

1. Open the software view
2. Enable or boot the bootloader
3. Install the Linux disk
4. Wait for the shell prompt

Then try:

```text
ls
run hello
run sysinfo
run bootcat readme
run wget url
cat result
```

### Useful bundled files and programs

Depending on the current disk image, you will find things like:

- `readme`
- `story`
- `url`
- `result`
- `hello`
- `sysinfo`
- `wget`
- `cp`
- `mv`
- `grep`
- `jsonp`
- `glxsh`
- `glxnano`

### `wget`

The default `url` file points to:

```text
https://jsonplaceholder.typicode.com/todos/1
```

So this is a nice first demo:

```text
run wget url
cat result
```

If you keep the software view on the `Computer` panel while running `wget`, the network card shows:

- the current pending request
- the last completed status
- the last completed URL
- the last completed request body
- the last completed response body
- a recent-request history

That history is kept so short-lived tools are still inspectable even when they return quickly to the bootloader shell.

### `glxnano`

`glxnano` is the graphical text editor.

Run it like this:

```text
run glxnano readme
```

Then type directly. The keyboard is immediate while the program runs.

In the `Computer` runtime panel, the keyboard card mirrors that behavior with a collapsible input surface, while the plotter and console cards show the editor's live output in the same fullscreenable dashboard.

Typical keys:

- arrows to move
- `Enter` for newline
- `Backspace` to delete
- `Tab` for zoom
- `&` for theme
- `\` to save
- `@` to quit

---

## 8. A Good First Tour

If you want the shortest useful tour of the whole app:

### Tour A — Understand the machine

1. Open the hardware scene
2. Look at a transistor scene
3. Look at a gate scene
4. Look at the full 8-bit computer scene
5. Step the clock and inspect the state

### Tour B — Use the machine

1. Open the software view
2. Run a tiny C program
3. Draw something on the plotter
4. Boot the bootloader
5. Install the Linux disk
6. Run `ls`, `run hello`, `run wget url`
7. Open `glxnano`

This gives you both halves of the project:

- how the computer is built
- how the computer is used

---

## 9. What To Read Next

After this user guide, the deeper docs are:

- `docs/how-the-hardware-works.md`
- `docs/how-the-computer-works.md`
- `docs/c-language-guide.md`
- `docs/compiler-bugfixes-and-tests.md`

If you want the quick visual result of the automated tests, open:

- `report/index.html`

That report now includes:

- plotter image suites
- computer architecture SVG snapshots
- PNG copies of those architecture snapshots
- full-computer bootloader/Linux architecture runs
- one architecture snapshot for every bundled C example

Project testing rule:

- everything the user can run on the computer must be tested
- every bundled example program must be exercised through multiple workflows when possible
- for Linux-like userland programs, the direct CPU suite and the Computer Architecture Flow suite are expected to cover the same runnable set
- in this project, that is the practical meaning of `100% test coverage`

---

## 10. Final Mental Model

This app is:

- a transistor-to-computer teaching tool
- a tiny 8-bit retro-style machine
- a readable TypeScript virtual machine
- a programming playground with ASM, C, bootloader, disk, graphics, and HTTP

If you want one sentence:

**It is a fully understandable 8-bit computer, built in TypeScript, that lets you learn computing from transistors all the way up to a tiny operating-system-like userland.**
