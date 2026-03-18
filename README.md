# Simulateur Logique Nodal

Made by **TheSamLePirate**.

A tiny, understandable computer laboratory in TypeScript.

Welcome to the classroom/laboratory/garage accident where we start with tiny electric lies called bits, wire them into logic, bully them into becoming an 8-bit computer, then make that computer run ASM, mini C, a bootloader, and a tiny Linux-like disk.

Yes, this is educational.
Yes, this is a little unhinged.
Yes, that is the correct amount of unhinged.

Inside the machine:

- start with transistors
- build up to logic gates
- reach a full 8-bit computer
- write ASM
- write mini C
- boot a tiny Linux-like disk

If you love C, you will probably love my mini C.
If you fear C, this may be the safest possible place to get bitten by it.

It is small, a little strict, a little retro, and just dangerous enough to teach you why buffer overflows were such a legendary hobby.

Remember when writing a single letter on screen was a small emotional crisis?

Remember when your biggest respectable number was `255`?

Remember when division was just repeated subtraction wearing a fake mustache?

And who even uses modulo anymore, except absolutely everyone the moment pixels, loops, counters, clocks, wraparound, or chaos show up?

## Why this repo is fun

- the VM is readable
- the computer is visual
- the bootloader is real
- the disk tools are real
- the mini C compiler is real
- yes, it even has HTTP

This is basically a 1983 computer that drank too much coffee and learned TypeScript.

## Try it live

[puter.com/app/1983-computer](https://puter.com/app/1983-computer)

## Quick start

**Prerequisite:** Node.js

```bash
npm install
npm run dev
```

Then:

1. open the hardware scene if you want the transistor-to-CPU story
2. open the software side if you want to write code immediately
3. try a tiny C program
4. boot the bootloader
5. install the Linux disk
6. run weird little programs with joy

## Test and report

```bash
npm test
```

Then open:

```text
report/index.html
```

You get one test dashboard with:

- all suites
- console output
- plotter snapshots
- animated previews for multi-frame programs

## Docs

- [Easy user guide](docs/userguide.md)
- [How the hardware works](docs/how-the-hardware-works.md)
- [How the computer works](docs/how-the-computer-works.md)
- [Mini C guide](docs/c-language-guide.md)
- [Compiler bugs and tests](docs/compiler-bugfixes-and-tests.md)

## Gentle warning

Issues will not be laughed at.

They will be welcomed, appreciated, and only laughed at **with affection** if the bug is especially creative.

## Repo

[github.com/TheSamLePirate/Simulateur-Logique-Nodal](https://github.com/TheSamLePirate/Simulateur-Logique-Nodal)
