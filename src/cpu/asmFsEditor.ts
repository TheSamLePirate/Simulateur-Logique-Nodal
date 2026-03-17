export const ASM_FS_EDITOR_SOURCE = `; Editeur FS ASM
; Fichiers partages avec le bootloader
; Fleches = deplacer le curseur
; /o nom = ouvrir/creer, /n = newline, /d = delete avant curseur
; /s = sauver, @ = quitter
;
; RAM:
; 0x1000 = offset entree directory courante
; 0x1001 = page fichier
; 0x1002 = taille fichier
; 0x1003 = curseur
; 0x1004 = taille ligne saisie
; 0x1005 = offset scan / tmp
; 0x1006 = page scan / tmp
; 0x1007 = dirty
; 0x1008 = prev left
; 0x1009 = prev right
; 0x100A = prev up
; 0x100B = prev down
; 0x100C = free offset
; 0x100D = free page dir
; 0x100E = i
; 0x100F = j
; 0x1010 = new len / limit / next page libre
; 0x1011 = page entree directory courante
; 0x1012 = char courant / tmp
; 0x1013 = taille nom
; 0x1040 = buffer ligne
; 0x1100 = buffer texte

start:
  CALL ensure_drive
  LDA '/'
  STA 0x1040
  LDA 'o'
  STA 0x1041
  LDA ' '
  STA 0x1042
  LDA 'n'
  STA 0x1043
  LDA 'o'
  STA 0x1044
  LDA 't'
  STA 0x1045
  LDA 'e'
  STA 0x1046
  LDA 's'
  STA 0x1047
  LDA 8
  STA 0x1004
  CALL open_from_line
  LDA 0
  STA 0x1004
  LDM 0x1000
  CMP 255
  JNZ editor_ready
  OUT 'D'
  OUT 'I'
  OUT 'S'
  OUT 'K'
  OUT ' '
  OUT 'F'
  OUT 'U'
  OUT 'L'
  OUT 'L'
  OUT 10
  HLT

editor_ready:
  LDA 1
  STA 0x1007

main_loop:
  CALL poll_keys
  INA
  CMP 0
  JZ after_input
  STA 0x1012
  CMP 10
  JZ process_line
  LDM 0x1004
  CMP 47
  JNC after_input
  TAB
  LDM 0x1012
  STAI 0x1040
  LDM 0x1004
  INC
  STA 0x1004
  JMP after_input

process_line:
  LDM 0x1004
  CMP 0
  JZ clear_line
  CMP 1
  JNZ check_slash
  LDA 0
  LDAI 0x1040
  CMP '@'
  JNZ check_slash
  HLT

check_slash:
  LDA 0
  LDAI 0x1040
  CMP '/'
  JNZ do_insert_text
  LDM 0x1004
  CMP 4
  JNC maybe_open
  JMP maybe_short_command

maybe_open:
  LDA 1
  LDAI 0x1040
  CMP 'o'
  JNZ maybe_short_command
  LDA 2
  LDAI 0x1040
  CMP ' '
  JNZ maybe_short_command
  CALL open_from_line
  LDA 1
  STA 0x1007
  JMP clear_line

maybe_short_command:
  LDM 0x1004
  CMP 2
  JNZ do_insert_text
  LDA 1
  LDAI 0x1040
  CMP 's'
  JZ do_save
  CMP 'd'
  JZ do_delete
  CMP 'n'
  JZ do_newline
  JMP do_insert_text

do_save:
  CALL save_file
  LDA 1
  STA 0x1007
  JMP clear_line

do_delete:
  CALL delete_before
  LDA 1
  STA 0x1007
  JMP clear_line

do_newline:
  LDA 10
  STA 0x1040
  LDA 1
  STA 0x1004
  CALL insert_text
  LDA 1
  STA 0x1007
  JMP clear_line

do_insert_text:
  CALL insert_text
  LDA 1
  STA 0x1007

clear_line:
  LDA 0
  STA 0x1004

after_input:
  LDM 0x1007
  CMP 0
  JZ idle
  CALL redraw
  LDA 0
  STA 0x1007

idle:
  LDA 2
  SLEEP
  JMP main_loop

poll_keys:
  LDA 0
  GETKEY
  CMP 0
  JZ left_released
  LDM 0x1008
  CMP 0
  JNZ left_hold
  LDM 0x1003
  CMP 0
  JZ left_hold
  DEC
  STA 0x1003
  LDA 1
  STA 0x1007
left_hold:
  LDA 1
  STA 0x1008
  JMP check_right
left_released:
  LDA 0
  STA 0x1008

check_right:
  LDA 1
  GETKEY
  CMP 0
  JZ right_released
  LDM 0x1009
  CMP 0
  JNZ right_hold
  LDM 0x1003
  LBM 0x1002
  CMPB
  JZ right_hold
  INC
  STA 0x1003
  LDA 1
  STA 0x1007
right_hold:
  LDA 1
  STA 0x1009
  JMP check_up
right_released:
  LDA 0
  STA 0x1009

check_up:
  LDA 2
  GETKEY
  CMP 0
  JZ up_released
  LDM 0x100A
  CMP 0
  JNZ up_hold
  LDM 0x1003
  CMP 0
  JZ up_hold
  LDA 0
  STA 0x1003
  LDA 1
  STA 0x1007
up_hold:
  LDA 1
  STA 0x100A
  JMP check_down
up_released:
  LDA 0
  STA 0x100A

check_down:
  LDA 3
  GETKEY
  CMP 0
  JZ down_released
  LDM 0x100B
  CMP 0
  JNZ down_hold
  LDM 0x1003
  LBM 0x1002
  CMPB
  JZ down_hold
  LDM 0x1002
  STA 0x1003
  LDA 1
  STA 0x1007
down_hold:
  LDA 1
  STA 0x100B
  RET
down_released:
  LDA 0
  STA 0x100B
  RET

insert_text:
  LDM 0x1004
  CMP 0
  JZ insert_done
  LDM 0x1002
  LBM 0x1004
  ADDB
  JC insert_done
  STA 0x1010
  LDM 0x1002
  STA 0x100E

shift_check:
  LDM 0x100E
  LBM 0x1003
  CMPB
  JZ insert_copy
  DEC
  STA 0x100E
  LDM 0x100E
  LDAI 0x1100
  STA 0x1005
  LDM 0x100E
  TAB
  LDM 0x1004
  ADDB
  TAB
  LDM 0x1005
  STAI 0x1100
  JMP shift_check

insert_copy:
  LDA 0
  STA 0x100F

copy_check:
  LDM 0x100F
  LBM 0x1004
  CMPB
  JZ insert_finish
  LDM 0x100F
  LDAI 0x1040
  STA 0x1005
  LDM 0x1003
  TAB
  LDM 0x100F
  ADDB
  TAB
  LDM 0x1005
  STAI 0x1100
  LDM 0x100F
  INC
  STA 0x100F
  JMP copy_check

insert_finish:
  LDM 0x1010
  STA 0x1002
  LDM 0x1003
  LBM 0x1004
  ADDB
  STA 0x1003

insert_done:
  RET

delete_before:
  LDM 0x1003
  CMP 0
  JZ delete_done
  DEC
  STA 0x1003
  STA 0x100E
  LDM 0x1002
  DEC
  STA 0x1010

delete_loop:
  LDM 0x100E
  LBM 0x1010
  CMPB
  JZ delete_shrink
  LDM 0x100E
  INC
  LDAI 0x1100
  STA 0x1005
  LDM 0x100E
  TAB
  LDM 0x1005
  STAI 0x1100
  LDM 0x100E
  INC
  STA 0x100E
  JMP delete_loop

delete_shrink:
  LDM 0x1002
  DEC
  STA 0x1002

delete_done:
  RET

save_file:
  LDM 0x1001
  DRVPG
  LDA 0
  STA 0x100E

save_loop:
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ save_meta
  LDM 0x100E
  LDAI 0x1100
  STA 0x1005
  LDM 0x1005
  TAB
  LDM 0x100E
  DRVWR
  LDM 0x100E
  INC
  STA 0x100E
  JMP save_loop

save_meta:
  LDM 0x1011
  DRVPG
  LDM 0x1002
  TAB
  LDM 0x1000
  ADD 11
  DRVWR
  RET

load_file:
  LDM 0x1001
  DRVPG
  LDA 0
  STA 0x100E

load_loop:
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ load_done
  LDM 0x100E
  DRVRD
  STA 0x1005
  LDM 0x100E
  TAB
  LDM 0x1005
  STAI 0x1100
  LDM 0x100E
  INC
  STA 0x100E
  JMP load_loop

load_done:
  LDM 0x1002
  STA 0x1003
  RET

open_from_line:
  LDM 0x1004
  DEC
  DEC
  DEC
  STA 0x1013
  CMP 0
  JZ open_fail
  CMP 9
  JNC open_fail
  LDA 0
  STA 0x100F

validate_name:
  LDM 0x100F
  LBM 0x1013
  CMPB
  JZ open_scan_init
  LDM 0x100F
  TAB
  LDA 3
  ADDB
  LDAI 0x1040
  CMP ' '
  JZ open_fail
  LDM 0x100F
  INC
  STA 0x100F
  JMP validate_name

open_scan_init:
  LDA 255
  STA 0x100C
  LDA 0
  STA 0x100D
  LDA 4
  STA 0x1010
  LDA 16
  STA 0x1005
  LDA 0
  STA 0x1006
  LDA 0
  STA 0x100E

open_scan_loop:
  LDM 0x100E
  CMP 64
  JZ open_scan_done
  LDM 0x1006
  DRVPG
  LDM 0x1005
  DRVRD
  CMP 0
  JZ open_maybe_free
  CALL update_next_page
  CALL match_name
  CMP 1
  JZ open_found
  JMP open_next_slot

open_maybe_free:
  LDM 0x100C
  CMP 255
  JNZ open_next_slot
  LDM 0x1005
  STA 0x100C
  LDM 0x1006
  STA 0x100D
  JMP open_next_slot

open_found:
  LDM 0x1005
  ADD 8
  DRVRD
  CMP 1
  JNZ open_fail
  LDM 0x1005
  STA 0x1000
  LDM 0x1006
  STA 0x1011
  LDM 0x1005
  ADD 9
  DRVRD
  STA 0x1001
  LDM 0x1005
  ADD 11
  DRVRD
  STA 0x1002
  CALL load_file
  LDA 1
  RET

open_next_slot:
  LDM 0x1005
  ADD 12
  STA 0x1005
  JNC open_next_slot_same_page
  LDM 0x1006
  INC
  STA 0x1006
open_next_slot_same_page:
  LDM 0x100E
  INC
  STA 0x100E
  JMP open_scan_loop

open_scan_done:
  LDM 0x100C
  CMP 255
  JZ open_fail
  CALL init_name
  LDM 0x100C
  STA 0x1000
  LDM 0x100D
  STA 0x1011
  LDM 0x100D
  DRVPG
  LDM 0x1010
  STA 0x1001
  LDA 0
  STA 0x1002
  STA 0x1003
  LDA 1
  RET

open_fail:
  LDA 0
  RET

update_next_page:
  LDM 0x1005
  ADD 9
  DRVRD
  STA 0x1012
  LDM 0x1005
  ADD 10
  DRVRD
  TAB
  LDM 0x1012
  ADDB
  LBM 0x1010
  CMPB
  JNC update_store_page
  RET

update_store_page:
  STA 0x1010
  RET

match_name:
  LDA 0
  STA 0x100F

match_loop:
  LDM 0x100F
  CMP 8
  JZ match_yes
  LDM 0x1005
  TAB
  LDM 0x100F
  ADDB
  DRVRD
  STA 0x1012
  LDM 0x100F
  LBM 0x1013
  CMPB
  JNC match_need_zero
  LDM 0x100F
  TAB
  LDA 3
  ADDB
  LDAI 0x1040
  TAB
  LDM 0x1012
  CMPB
  JNZ match_no
  JMP match_next

match_need_zero:
  LDM 0x1012
  CMP 0
  JNZ match_no

match_next:
  LDM 0x100F
  INC
  STA 0x100F
  JMP match_loop

match_yes:
  LDA 1
  RET

match_no:
  LDA 0
  RET

init_name:
  LDM 0x100D
  DRVPG
  LDA 0
  STA 0x100F

init_name_loop:
  LDM 0x100F
  CMP 8
  JZ init_name_meta
  LDM 0x100F
  LBM 0x1013
  CMPB
  JNC init_name_zero
  LDM 0x100F
  TAB
  LDA 3
  ADDB
  LDAI 0x1040
  STA 0x1012
  LDM 0x100C
  TAB
  LDM 0x100F
  ADDB
  STA 0x1006
  LDM 0x1012
  TAB
  LDM 0x1006
  DRVWR
  JMP init_name_next

init_name_zero:
  LDM 0x100C
  TAB
  LDM 0x100F
  ADDB
  STA 0x1006
  LDA 0
  TAB
  LDM 0x1006
  DRVWR

init_name_next:
  LDM 0x100F
  INC
  STA 0x100F
  JMP init_name_loop

init_name_meta:
  LDA 1
  TAB
  LDM 0x100C
  ADD 8
  DRVWR
  LDM 0x1010
  TAB
  LDM 0x100C
  ADD 9
  DRVWR
  LDA 1
  TAB
  LDM 0x100C
  ADD 10
  DRVWR
  LDA 0
  TAB
  LDM 0x100C
  ADD 11
  DRVWR
  RET

print_current_name:
  LDM 0x1000
  CMP 255
  JNZ print_name_start
  OUT '?'
  RET

print_name_start:
  LDM 0x1011
  DRVPG
  LDA 0
  STA 0x100F

print_name_loop:
  LDM 0x100F
  CMP 8
  JZ print_name_done
  LDM 0x1000
  TAB
  LDM 0x100F
  ADDB
  DRVRD
  CMP 0
  JZ print_name_done
  OUTA
  LDM 0x100F
  INC
  STA 0x100F
  JMP print_name_loop

print_name_done:
  RET

ensure_drive:
  LDA 0
  DRVPG
  LDA 0
  DRVRD
  CMP 66
  JZ check_version
  CALL format_drive
  RET

check_version:
  LDA 1
  DRVRD
  CMP 3
  JZ ensure_done
  CALL format_drive

ensure_done:
  RET

format_drive:
  DRVCLR
  LDA 0
  DRVPG
  LDA 66
  TAB
  LDA 0
  DRVWR
  LDA 3
  TAB
  LDA 1
  DRVWR
  RET

redraw:
  CLCON
  OUT '='
  OUT '='
  OUT '='
  OUT ' '
  OUT 'E'
  OUT 'D'
  OUT 'I'
  OUT 'T'
  OUT 'E'
  OUT 'U'
  OUT 'R'
  OUT ' '
  OUT 'F'
  OUT 'S'
  OUT ' '
  OUT 'A'
  OUT 'S'
  OUT 'M'
  OUT ' '
  OUT '='
  OUT '='
  OUT '='
  OUT 10
  CALL print_current_name
  OUT ' '
  OUT '|'
  OUT ' '
  OUT '/'
  OUT 'o'
  OUT ' '
  OUT 'n'
  OUT 'o'
  OUT 'm'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT 'a'
  OUT 'r'
  OUT 'r'
  OUT 'o'
  OUT 'w'
  OUT 's'
  OUT ' '
  OUT 'm'
  OUT 'o'
  OUT 'v'
  OUT 'e'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT '/'
  OUT 'n'
  OUT ' '
  OUT 'n'
  OUT 'l'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT '/'
  OUT 'd'
  OUT ' '
  OUT 'd'
  OUT 'e'
  OUT 'l'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT '/'
  OUT 's'
  OUT ' '
  OUT 's'
  OUT 'a'
  OUT 'v'
  OUT 'e'
  OUT ' '
  OUT '|'
  OUT ' '
  OUT '@'
  OUT ' '
  OUT 'q'
  OUT 'u'
  OUT 'i'
  OUT 't'
  OUT 10
  OUT '['
  LDM 0x1003
  OUTD
  OUT '/'
  LDM 0x1002
  OUTD
  OUT ']'
  OUT 10
  LDA 0
  STA 0x100E

draw_loop:
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ draw_tail
  LDM 0x100E
  LBM 0x1003
  CMPB
  JNZ draw_char
  OUT '|'

draw_char:
  LDM 0x100E
  LDAI 0x1100
  OUTA
  LDM 0x100E
  INC
  STA 0x100E
  JMP draw_loop

draw_tail:
  LDM 0x1003
  LBM 0x1002
  CMPB
  JNZ draw_done
  OUT '|'

draw_done:
  OUT 10
  RET
`;
