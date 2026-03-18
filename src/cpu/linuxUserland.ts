import {
  BOOT_ARG_COUNT_ADDR,
  BOOT_ARG0_SIZE_ADDR,
  BOOT_ARG0_START_PAGE_ADDR,
  BOOT_ARG0_TYPE_ADDR,
} from "./bootArgs";
import { ASM_FS_EDITOR_SOURCE } from "./asmFsEditor";
import { ASM_GLX_NANO_SOURCE } from "./asmGlxNano";
import { ASM_PLOTTER_SHELL_SOURCE } from "./asmPlotterShell";

export interface LinuxUserlandProgram {
  exampleName: string;
  name: string;
  description: string;
  code: string;
  language?: "asm" | "c";
}

export interface LinuxUserlandFile {
  name: string;
  text?: string;
  bytes?: number[];
}

function emitOutText(text: string, indent = "  "): string {
  return text
    .split("")
    .map((ch) => `${indent}OUT ${ch.charCodeAt(0)}`)
    .join("\n");
}

function noArgProgram(label: string): string {
  return `  LDM ${BOOT_ARG_COUNT_ADDR}
  CMP 0
  JNZ ${label}
${emitOutText("NO ARG\n")}
  HLT

${label}:`;
}

const HELLO_SOURCE = `; Petit /bin/hello pour le disque Linux-like
${emitOutText("hello from /bin/hello\n")}
  HLT`;

const SYSINFO_SOURCE = `; /bin/sysinfo - resume statique du mini systeme
${emitOutText("NodalLinux 8-bit\nCPU: 8-bit unsigned\nRAM: 8K  DISK: 8K\nShell: root@sim:/#\n")}
  HLT`;

const UNAME_SOURCE = `; /bin/uname - version mini systeme
${emitOutText("NodalLinux 8-bit 0.3\n")}
  HLT`;

const PWD_SOURCE = `; /bin/pwd - chemin courant symbolique
${emitOutText("/\n")}
  HLT`;

const BOOTCAT_SOURCE = `; /bin/bootcat - affiche le fichier passe par le bootloader
${noArgProgram("have_file")}
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  DRVPG
  LDA 0
  STA 0x1100

read_loop:
  LDM 0x1100
  TAB
  LDM ${BOOT_ARG0_SIZE_ADDR}
  CMPB
  JZ done
  TBA
  DRVRD
  OUTA
  LDM 0x1100
  INC
  STA 0x1100
  JMP read_loop

done:
  OUT 10
  HLT`;

const ARGDUMP_SOURCE = `; /bin/argdump - montre les metadonnees du fichier argument
${noArgProgram("have_file")}
${emitOutText("type ")}
  LDM ${BOOT_ARG0_TYPE_ADDR}
  CMP 1
  JZ type_file
${emitOutText("program")}
  JMP after_type
type_file:
${emitOutText("file")}
after_type:
${emitOutText(" page ")}
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  OUTD
${emitOutText(" size ")}
  LDM ${BOOT_ARG0_SIZE_ADDR}
  OUTD
${emitOutText("b\n")}
  HLT`;

const WC_SOURCE = `; /bin/wc - compte octets et retours ligne du fichier argument
${noArgProgram("have_file")}
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  DRVPG
  LDA 0
  STA 0x1100
  LDA 0
  STA 0x1101

wc_loop:
  LDM 0x1100
  TAB
  LDM ${BOOT_ARG0_SIZE_ADDR}
  CMPB
  JZ wc_done
  TBA
  DRVRD
  CMP 10
  JNZ wc_next
  LDM 0x1101
  INC
  STA 0x1101
wc_next:
  LDM 0x1100
  INC
  STA 0x1100
  JMP wc_loop

wc_done:
  LDM ${BOOT_ARG0_SIZE_ADDR}
  OUTD
${emitOutText("b ")}
  LDM 0x1101
  OUTD
${emitOutText("l\n")}
  HLT`;

const HEAD_SOURCE = `; /bin/head - affiche les 32 premiers octets du fichier argument
${noArgProgram("have_file")}
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  DRVPG
  LDA 0
  STA 0x1100

head_loop:
  LDM 0x1100
  CMP 32
  JZ head_done
  TAB
  LDM ${BOOT_ARG0_SIZE_ADDR}
  CMPB
  JZ head_done
  TBA
  DRVRD
  OUTA
  LDM 0x1100
  INC
  STA 0x1100
  JMP head_loop

head_done:
  OUT 10
  HLT`;

const WGET_SOURCE = `; /bin/wget - HTTP GET simple depuis une URL stockee dans un fichier
; Utilisation:
;   run wget url
; Le fichier passe en argument doit contenir une URL ASCII.
${noArgProgram("have_file")}
  LDM ${BOOT_ARG0_TYPE_ADDR}
  CMP 1
  JZ copy_url
${emitOutText("ARG MUST BE FILE\n")}
  HLT

copy_url:
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  DRVPG
  LDA 0
  STA 0x1100

copy_loop:
  LDM 0x1100
  TAB
  LDM ${BOOT_ARG0_SIZE_ADDR}
  CMPB
  JZ copy_done
  TBA
  DRVRD
  STA 0x1180
  LDM 0x1100
  TAB
  LDM 0x1180
  STAI 0x1120
  LDM 0x1100
  INC
  STA 0x1100
  JMP copy_loop

copy_done:
  LDM 0x1100
  TAB
  LDA 0
  STAI 0x1120
  CALL find_result
  CMP 1
  JZ start_get
${emitOutText("NO RESULT FILE\n")}
  HLT

start_get:
  LDA 0
  STA 0x1101
  HTTPGET 0x1120

wait_first:
  HTTPIN
  JC wait_first
  JZ done
  CALL save_byte
  OUTA

read_more:
  HTTPIN
  JC read_more
  JZ done
  CALL save_byte
  OUTA
  JMP read_more

done:
  CALL save_size
  OUT 10
  HLT

save_byte:
  STA 0x1105
  LDM 0x1101
  CMP 255
  JZ save_skip
  LDM 0x1104
  DRVPG
  LDM 0x1105
  TAB
  LDM 0x1101
  DRVWR
  LDM 0x1101
  INC
  STA 0x1101
save_skip:
  LDM 0x1105
  RET

save_size:
  LDM 0x1103
  DRVPG
  LDM 0x1101
  TAB
  LDM 0x1102
  ADD 11
  DRVWR
  RET

find_result:
  LDA 0
  STA 0x1103
  LDA 16
  STA 0x1102
  LDA 0
  STA 0x1106

find_result_loop:
  LDM 0x1106
  CMP 64
  JZ find_result_fail
  LDM 0x1103
  DRVPG
  LDM 0x1102
  DRVRD
  CMP 'r'
  JNZ find_result_next
  LDM 0x1102
  ADD 1
  DRVRD
  CMP 'e'
  JNZ find_result_next
  LDM 0x1102
  ADD 2
  DRVRD
  CMP 's'
  JNZ find_result_next
  LDM 0x1102
  ADD 3
  DRVRD
  CMP 'u'
  JNZ find_result_next
  LDM 0x1102
  ADD 4
  DRVRD
  CMP 'l'
  JNZ find_result_next
  LDM 0x1102
  ADD 5
  DRVRD
  CMP 't'
  JNZ find_result_next
  LDM 0x1102
  ADD 6
  DRVRD
  CMP 0
  JNZ find_result_next
  LDM 0x1102
  ADD 9
  DRVRD
  STA 0x1104
  LDA 1
  RET

find_result_next:
  LDM 0x1102
  ADD 12
  STA 0x1102
  JNC find_result_same_page
  LDM 0x1103
  INC
  STA 0x1103
find_result_same_page:
  LDM 0x1106
  INC
  STA 0x1106
  JMP find_result_loop

find_result_fail:
  LDA 0
  RET`;

const CP_SOURCE = `#define TYPE_FILE 1
#define DIR_START 16
#define ENTRY_SIZE 12
#define ENTRY_COUNT 64
#define DATA_START_PAGE 4

int read_name(int buf[9]) {
  int len = 0, ch = 0;
  while (1) {
    ch = getchar();
    if (ch == 10) { break; }
    if (len < 8) {
      buf[len] = ch;
      len = len + 1;
    }
  }
  return len;
}

int entry_name_equals(int page, int off, int name[9], int len) {
  int i = 0, want = 0;
  while (i < 8) {
    want = 0;
    if (i < len) {
      want = name[i];
    }
    if (drive_read_at(page, off + i) != want) {
      return 0;
    }
    i = i + 1;
  }
  return 1;
}

int find_entry(int name[9], int len, int out[3]) {
  int page = 0, off = DIR_START, idx = 0;
  while (idx < ENTRY_COUNT) {
    if (drive_read_at(page, off) != 0) {
      if (entry_name_equals(page, off, name, len)) {
        out[0] = page;
        out[1] = off;
        out[2] = drive_read_at(page, off + 9);
        return 1;
      }
    }
    off = off + ENTRY_SIZE;
    if (off < ENTRY_SIZE) {
      page = page + 1;
    }
    idx = idx + 1;
  }
  return 0;
}

int find_free_entry(int out[2]) {
  int page = 0, off = DIR_START, idx = 0;
  while (idx < ENTRY_COUNT) {
    if (drive_read_at(page, off) == 0) {
      out[0] = page;
      out[1] = off;
      return 1;
    }
    off = off + ENTRY_SIZE;
    if (off < ENTRY_SIZE) {
      page = page + 1;
    }
    idx = idx + 1;
  }
  return 0;
}

int page_used(int page) {
  int dir_page = 0, dir_off = DIR_START, idx = 0;
  int start = 0, count = 0;
  while (idx < ENTRY_COUNT) {
    if (drive_read_at(dir_page, dir_off) != 0) {
      start = drive_read_at(dir_page, dir_off + 9);
      count = drive_read_at(dir_page, dir_off + 10);
      if (page >= start) {
        if (page < start + count) {
          return 1;
        }
      }
    }
    dir_off = dir_off + ENTRY_SIZE;
    if (dir_off < ENTRY_SIZE) {
      dir_page = dir_page + 1;
    }
    idx = idx + 1;
  }
  return 0;
}

int find_free_data_page() {
  int page = DATA_START_PAGE;
  while (page != 0) {
    if (!page_used(page)) {
      return page;
    }
    page = page + 1;
  }
  return 0;
}

void write_entry(int dir_page, int dir_off, int name[9], int len, int data_page, int sizev) {
  int i = 0, value = 0;
  while (i < 8) {
    value = 0;
    if (i < len) {
      value = name[i];
    }
    drive_write_at(dir_page, dir_off + i, value);
    i = i + 1;
  }
  drive_write_at(dir_page, dir_off + 8, TYPE_FILE);
  drive_write_at(dir_page, dir_off + 9, data_page);
  drive_write_at(dir_page, dir_off + 10, 1);
  drive_write_at(dir_page, dir_off + 11, sizev);
}

void copy_source_to(int page) {
  int i = 0, ch = 0;
  while (i < boot_arg_size()) {
    ch = boot_file_read(i);
    drive_write_at(page, i, ch);
    i = i + 1;
  }
}

int main() {
  int name[9], existing[3], free_slot[2];
  int len = 0, data_page = 0, dir_page = 0, dir_off = 0;

  if (boot_argc() == 0 || boot_arg_type() != TYPE_FILE) {
    print("usage: run cp file");
    putchar(10);
    return 0;
  }

  print("dest> ");
  len = read_name(name);
  if (len == 0) {
    print("cancel");
    putchar(10);
    return 0;
  }

  if (find_entry(name, len, existing)) {
    dir_page = existing[0];
    dir_off = existing[1];
    data_page = existing[2];
  } else {
    if (!find_free_entry(free_slot)) {
      print("directory full");
      putchar(10);
      return 0;
    }
    data_page = find_free_data_page();
    if (data_page == 0) {
      print("disk full");
      putchar(10);
      return 0;
    }
    dir_page = free_slot[0];
    dir_off = free_slot[1];
  }

  copy_source_to(data_page);
  write_entry(dir_page, dir_off, name, len, data_page, boot_arg_size());
  print("copied");
  putchar(10);
  return 0;
}`;

const MV_SOURCE = `#define TYPE_FILE 1
#define DIR_START 16
#define ENTRY_SIZE 12
#define ENTRY_COUNT 64
#define DATA_START_PAGE 4

int read_name(int buf[9]) {
  int len = 0, ch = 0;
  while (1) {
    ch = getchar();
    if (ch == 10) { break; }
    if (len < 8) {
      buf[len] = ch;
      len = len + 1;
    }
  }
  return len;
}

int entry_name_equals(int page, int off, int name[9], int len) {
  int i = 0, want = 0;
  while (i < 8) {
    want = 0;
    if (i < len) {
      want = name[i];
    }
    if (drive_read_at(page, off + i) != want) {
      return 0;
    }
    i = i + 1;
  }
  return 1;
}

int find_entry(int name[9], int len, int out[3]) {
  int page = 0, off = DIR_START, idx = 0;
  while (idx < ENTRY_COUNT) {
    if (drive_read_at(page, off) != 0) {
      if (entry_name_equals(page, off, name, len)) {
        out[0] = page;
        out[1] = off;
        out[2] = drive_read_at(page, off + 9);
        return 1;
      }
    }
    off = off + ENTRY_SIZE;
    if (off < ENTRY_SIZE) {
      page = page + 1;
    }
    idx = idx + 1;
  }
  return 0;
}

int find_free_entry(int out[2]) {
  int page = 0, off = DIR_START, idx = 0;
  while (idx < ENTRY_COUNT) {
    if (drive_read_at(page, off) == 0) {
      out[0] = page;
      out[1] = off;
      return 1;
    }
    off = off + ENTRY_SIZE;
    if (off < ENTRY_SIZE) {
      page = page + 1;
    }
    idx = idx + 1;
  }
  return 0;
}

int page_used(int page) {
  int dir_page = 0, dir_off = DIR_START, idx = 0;
  int start = 0, count = 0;
  while (idx < ENTRY_COUNT) {
    if (drive_read_at(dir_page, dir_off) != 0) {
      start = drive_read_at(dir_page, dir_off + 9);
      count = drive_read_at(dir_page, dir_off + 10);
      if (page >= start) {
        if (page < start + count) {
          return 1;
        }
      }
    }
    dir_off = dir_off + ENTRY_SIZE;
    if (dir_off < ENTRY_SIZE) {
      dir_page = dir_page + 1;
    }
    idx = idx + 1;
  }
  return 0;
}

int find_free_data_page() {
  int page = DATA_START_PAGE;
  while (page != 0) {
    if (!page_used(page)) {
      return page;
    }
    page = page + 1;
  }
  return 0;
}

void write_entry(int dir_page, int dir_off, int name[9], int len, int data_page, int sizev) {
  int i = 0, value = 0;
  while (i < 8) {
    value = 0;
    if (i < len) {
      value = name[i];
    }
    drive_write_at(dir_page, dir_off + i, value);
    i = i + 1;
  }
  drive_write_at(dir_page, dir_off + 8, TYPE_FILE);
  drive_write_at(dir_page, dir_off + 9, data_page);
  drive_write_at(dir_page, dir_off + 10, 1);
  drive_write_at(dir_page, dir_off + 11, sizev);
}

void clear_entry(int dir_page, int dir_off) {
  int i = 0;
  while (i < ENTRY_SIZE) {
    drive_write_at(dir_page, dir_off + i, 0);
    i = i + 1;
  }
}

void copy_source_to(int page) {
  int i = 0, ch = 0;
  while (i < boot_arg_size()) {
    ch = boot_file_read(i);
    drive_write_at(page, i, ch);
    i = i + 1;
  }
}

int main() {
  int name[9], existing[3], free_slot[2];
  int len = 0, data_page = 0, dir_page = 0, dir_off = 0;

  if (boot_argc() == 0 || boot_arg_type() != TYPE_FILE) {
    print("usage: run mv file");
    putchar(10);
    return 0;
  }

  print("dest> ");
  len = read_name(name);
  if (len == 0) {
    print("cancel");
    putchar(10);
    return 0;
  }

  if (find_entry(name, len, existing)) {
    dir_page = existing[0];
    dir_off = existing[1];
    data_page = existing[2];
  } else {
    if (!find_free_entry(free_slot)) {
      print("directory full");
      putchar(10);
      return 0;
    }
    data_page = find_free_data_page();
    if (data_page == 0) {
      print("disk full");
      putchar(10);
      return 0;
    }
    dir_page = free_slot[0];
    dir_off = free_slot[1];
  }

  copy_source_to(data_page);
  write_entry(dir_page, dir_off, name, len, data_page, boot_arg_size());

  if (dir_page != boot_arg_page() || dir_off != boot_arg_offset()) {
    clear_entry(boot_arg_page(), boot_arg_offset());
  }

  print("moved");
  putchar(10);
  return 0;
}`;

const GREP_SOURCE = `#define TYPE_FILE 1

int read_pattern(int buf[16]) {
  int len = 0, ch = 0;
  while (1) {
    ch = getchar();
    if (ch == 10) { break; }
    if (len < 15) {
      buf[len] = ch;
      len = len + 1;
    }
  }
  return len;
}

int match_at(int start, int pat[16], int pat_len) {
  int j = 0;
  while (j < pat_len) {
    if (start + j >= boot_arg_size()) {
      return 0;
    }
    if (boot_file_read(start + j) != pat[j]) {
      return 0;
    }
    j = j + 1;
  }
  return 1;
}

int main() {
  int pat[16];
  int pat_len = 0, i = 0, matches = 0;

  if (boot_argc() == 0 || boot_arg_type() != TYPE_FILE) {
    print("usage: run grep file");
    putchar(10);
    return 0;
  }

  print("pat> ");
  pat_len = read_pattern(pat);
  if (pat_len == 0) {
    print("empty pattern");
    putchar(10);
    return 0;
  }

  while (i < boot_arg_size()) {
    if (match_at(i, pat, pat_len)) {
      print("match ");
      print_num(i);
      putchar(10);
      matches = matches + 1;
    }
    i = i + 1;
  }

  if (matches == 0) {
    print("no match");
    putchar(10);
  }

  return 0;
}`;

const JSONP_SOURCE = `#define TYPE_FILE 1

int read_key(int buf[16]) {
  int len = 0, ch = 0;
  while (1) {
    ch = getchar();
    if (ch == 10) { break; }
    if (len < 15) {
      buf[len] = ch;
      len = len + 1;
    }
  }
  return len;
}

int main() {
  int key[16];
  int key_len = 0, i = 0, j = 0, c = 0;

  if (boot_argc() == 0 || boot_arg_type() != TYPE_FILE) {
    print("usage: run jsonp file");
    putchar(10);
    return 0;
  }

  print("key> ");
  key_len = read_key(key);
  if (key_len == 0) {
    print("empty key");
    putchar(10);
    return 0;
  }

  i = 0;
  while (i < boot_arg_size()) {
    if (boot_file_read(i) == '"') {
      j = 0;
      while (j < key_len) {
        if (i + 1 + j >= boot_arg_size()) {
          break;
        }
        if (boot_file_read(i + 1 + j) != key[j]) {
          break;
        }
        j = j + 1;
      }

      if (j == key_len) {
        if (i + 1 + j < boot_arg_size()) {
          if (boot_file_read(i + 1 + j) == '"') {
            i = i + key_len + 2;
            while (i < boot_arg_size()) {
              c = boot_file_read(i);
              if (c == ':') {
                i = i + 1;
                break;
              }
              i = i + 1;
            }
            while (i < boot_arg_size() && boot_file_read(i) == ' ') {
              i = i + 1;
            }
            if (i >= boot_arg_size()) { break; }
            c = boot_file_read(i);
            if (c == '"') {
              putchar('"');
              i = i + 1;
              while (i < boot_arg_size()) {
                c = boot_file_read(i);
                if (c == '"') {
                  putchar('"');
                  putchar(10);
                  return 0;
                }
                putchar(c);
                i = i + 1;
              }
              break;
            } else {
              while (i < boot_arg_size()) {
                c = boot_file_read(i);
                if (c == ',' || c == '}' || c == 10) {
                  putchar(10);
                  return 0;
                }
                putchar(c);
                i = i + 1;
              }
              putchar(10);
              return 0;
            }
          }
        }
      }
    }
    i = i + 1;
  }

  print("not found");
  putchar(10);
  return 0;
}`;

const ASCII_SOURCE = `; /bin/ascii - mini table ASCII imprimable
  LDA 32
  STA 0x1100
  LDA 0
  STA 0x1101

ascii_loop:
  LDM 0x1100
  OUTA
  OUT 32
  LDM 0x1101
  INC
  STA 0x1101
  CMP 16
  JNZ ascii_next
  LDA 0
  STA 0x1101
  OUT 10
ascii_next:
  LDM 0x1100
  INC
  STA 0x1100
  CMP 127
  JNZ ascii_loop
  OUT 10
  HLT`;

const UPPER_SOURCE = `; /bin/upper - lit l'entree console et convertit en majuscules
${emitOutText("upper> ")}

loop:
  INA
  CMP 0
  JZ loop
  CMP 10
  JZ newline
  PUSH
  SUB 97
  JN not_lower
  CMP 26
  JNC not_lower
  POP
  SUB 32
  OUTA
  JMP loop

not_lower:
  POP
  OUTA
  JMP loop

newline:
  OUT 10
${emitOutText("upper> ")}
  JMP loop`;

const ECHO_SOURCE = `; /bin/echoio - echo interactif depuis la console
${emitOutText("echo> ")}

loop:
  INA
  CMP 0
  JZ loop
  CMP 10
  JZ newline
  OUTA
  JMP loop

newline:
  OUT 10
${emitOutText("echo> ")}
  JMP loop`;

const PLOT_SOURCE = `; /bin/plot - petite demo graphique Linux-like
  CLR

  ; ciel
  LDA 15
  COLR
  LDA 45
  COLG
  LDA 110
  COLB
  LDB 0
sky_row:
  LDA 0
sky_px:
  DRAW
  INC
  JNZ sky_px
  TBA
  INC
  TAB
  CMP 120
  JNZ sky_row

  ; sol
  LDA 10
  COLR
  LDA 70
  COLG
  LDA 25
  COLB
ground_row:
  LDA 0
ground_px:
  DRAW
  INC
  JNZ ground_px
  TBA
  INC
  TAB
  JNZ ground_row

  ; soleil
  LDA 255
  COLR
  LDA 200
  COLG
  LDA 0
  COLB
  LDA 200
  LDB 40
  DRAW
  LDA 201
  DRAW
  LDA 199
  DRAW
  LDA 200
  LDB 39
  DRAW
  LDB 41
  DRAW

  ; maison simple
  LDA 190
  COLR
  LDA 190
  COLG
  LDA 210
  COLB
  LDB 150
wall_row:
  LDA 90
wall_px:
  DRAW
  INC
  CMP 150
  JNZ wall_px
  TBA
  INC
  TAB
  CMP 190
  JNZ wall_row

  LDA 120
  COLR
  LDA 50
  COLG
  LDA 40
  COLB
  LDB 130
  LDA 88
  DRAW
  LDA 89
  DRAW
  LDA 90
roof_row:
  DRAW
  INC
  CMP 150
  JNZ roof_row
  HLT`;

const DIGITS_FILE_BYTES = [
  7, 5, 5, 5, 7,
  2, 6, 2, 2, 7,
  7, 1, 7, 4, 7,
  7, 1, 7, 1, 7,
  5, 5, 7, 1, 1,
  7, 4, 7, 1, 7,
  7, 4, 7, 5, 7,
  7, 1, 1, 1, 1,
  7, 5, 7, 5, 7,
  7, 5, 7, 1, 7,
];

const LETTERS_FILE_BYTES = [
  2, 5, 7, 5, 5,
  6, 5, 6, 5, 6,
  3, 4, 4, 4, 3,
  6, 5, 5, 5, 6,
  7, 4, 6, 4, 7,
  7, 4, 6, 4, 4,
  3, 4, 5, 5, 3,
  5, 5, 7, 5, 5,
  7, 2, 2, 2, 7,
  1, 1, 1, 5, 2,
  5, 5, 6, 5, 5,
  4, 4, 4, 4, 7,
  5, 7, 7, 5, 5,
  5, 7, 7, 7, 5,
  2, 5, 5, 5, 2,
  6, 5, 6, 4, 4,
  2, 5, 5, 7, 3,
  6, 5, 6, 5, 5,
  3, 4, 2, 1, 6,
  7, 2, 2, 2, 2,
  5, 5, 5, 5, 7,
  5, 5, 5, 5, 2,
  5, 5, 7, 7, 5,
  5, 5, 2, 5, 5,
  5, 5, 2, 2, 2,
  7, 1, 2, 4, 7,
];

export const LINUX_USERLAND_PROGRAMS: LinuxUserlandProgram[] = [
  {
    exampleName: "Linux - hello",
    name: "hello",
    description: "Petit programme disque qui salue depuis /bin/hello",
    code: HELLO_SOURCE,
  },
  {
    exampleName: "Linux - sysinfo",
    name: "sysinfo",
    description: "Mini equivalent assembleur de uname/neofetch pour le simulateur",
    code: SYSINFO_SOURCE,
  },
  {
    exampleName: "Linux - uname",
    name: "uname",
    description: "Affiche le nom et la version du mini systeme",
    code: UNAME_SOURCE,
  },
  {
    exampleName: "Linux - pwd",
    name: "pwd",
    description: "Affiche le repertoire symbolique courant",
    code: PWD_SOURCE,
  },
  {
    exampleName: "Boot Args - Cat",
    name: "bootcat",
    description: "Affiche le fichier passe a 'run bootcat nom' sans rescanner le FS",
    code: BOOTCAT_SOURCE,
  },
  {
    exampleName: "Linux - argdump",
    name: "argdump",
    description: "Affiche type, page et taille du fichier passe par le bootloader",
    code: ARGDUMP_SOURCE,
  },
  {
    exampleName: "Linux - wc",
    name: "wc",
    description: "Compte octets et retours ligne d'un fichier argument",
    code: WC_SOURCE,
  },
  {
    exampleName: "Linux - head",
    name: "head",
    description: "Affiche les 32 premiers octets du fichier argument",
    code: HEAD_SOURCE,
  },
  {
    exampleName: "Linux - wget",
    name: "wget",
    description: "HTTP GET simple depuis une URL stockee dans un fichier du disque",
    code: WGET_SOURCE,
  },
  {
    exampleName: "Linux - ascii",
    name: "ascii",
    description: "Imprime une mini table ASCII",
    code: ASCII_SOURCE,
  },
  {
    exampleName: "Linux - upper",
    name: "upper",
    description: "Echo interactif en majuscules",
    code: UPPER_SOURCE,
  },
  {
    exampleName: "Linux - echoio",
    name: "echoio",
    description: "Echo interactif assembleur depuis la console",
    code: ECHO_SOURCE,
  },
  {
    exampleName: "Linux - plot",
    name: "plot",
    description: "Petite demo graphique livree sur le disque Linux-like",
    code: PLOT_SOURCE,
  },
  {
    exampleName: "Linux - nano",
    name: "nano",
    description: "Editeur texte plein ecran ASM pour les fichiers du disque partage",
    code: ASM_FS_EDITOR_SOURCE,
  },
  {
    exampleName: "Linux - glxnano",
    name: "glxnano",
    description: "Editeur texte plotter avec zoom, themes et sauvegarde directe du fichier argument",
    code: ASM_GLX_NANO_SOURCE,
  },
  {
    exampleName: "Linux - glxsh",
    name: "glxsh",
    description: "Shell graphique sur le plotter, livre comme programme disque",
    code: ASM_PLOTTER_SHELL_SOURCE,
  },
  {
    exampleName: "Linux - cp",
    name: "cp",
    description: "Copie un fichier bootloader vers un nom saisi interactivement",
    code: CP_SOURCE,
    language: "c",
  },
  {
    exampleName: "Linux - mv",
    name: "mv",
    description: "Deplace un fichier bootloader vers un nouveau nom saisi interactivement",
    code: MV_SOURCE,
    language: "c",
  },
  {
    exampleName: "Linux - grep",
    name: "grep",
    description: "Recherche un motif texte dans un fichier et affiche les lignes correspondantes",
    code: GREP_SOURCE,
    language: "c",
  },
  {
    exampleName: "Linux - jsonp",
    name: "jsonp",
    description: "Extrait une valeur simple par cle depuis un fichier JSON",
    code: JSONP_SOURCE,
    language: "c",
  },
];

export const LINUX_USERLAND_FILES: LinuxUserlandFile[] = [
  {
    name: "motd",
    text:
      "Welcome to NodalLinux 8-bit\nType help, ls, uname, pwd\nTry run hello, run sysinfo, run bootcat readme, run wc story\n",
  },
  {
    name: "readme",
    text:
      "This is a tiny Linux-like environment for the simulator.\nPrograms live on the external drive and are launched with run NAME.\nUse run NAME FILE to pass one resolved file argument.\n",
  },
  {
    name: "story",
    text:
      "One byte at a time, this little machine dreams of bigger kernels.\nBut today it boots fast, draws pixels, and still gets the job done.\n",
  },
  {
    name: "DIGITS",
    bytes: DIGITS_FILE_BYTES,
  },
  {
    name: "LETTERS",
    bytes: LETTERS_FILE_BYTES,
  },
  {
    name: "result",
    text: "",
  },
  {
    name: "url",
    text: "https://jsonplaceholder.typicode.com/todos/1",
  },
];
