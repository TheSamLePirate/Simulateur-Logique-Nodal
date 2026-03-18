import {
  BOOT_ARG_COUNT_ADDR,
  BOOT_ARG0_DIR_OFFSET_ADDR,
  BOOT_ARG0_DIR_PAGE_ADDR,
  BOOT_ARG0_SIZE_ADDR,
  BOOT_ARG0_START_PAGE_ADDR,
  BOOT_ARG0_TYPE_ADDR,
} from "./bootArgs";

function emitOutText(text: string, indent = "  "): string {
  return Array.from(text)
    .map((ch) => `${indent}OUT ${ch.charCodeAt(0)}`)
    .join("\n");
}

function emitDrawText(text: string, indent = "  "): string {
  return Array.from(text)
    .map((ch) => `${indent}LDA ${ch.charCodeAt(0)}\n${indent}CALL draw_char_adv`)
    .join("\n");
}

export const ASM_GLX_NANO_SOURCE = `; glxnano - editeur plotter compact
; Lancez: run glxnano fichier
; Controles:
; - texte = insertion
; - BACKSPACE = effacer
; - ENTER = nouvelle ligne
; - LEFT/RIGHT = bouger
; - UP/DOWN = ligne precedente / suivante
; - \\ = sauver
; - TAB = zoom
; - & = theme
; - @ = quitter
;
; RAM
; 0x1000 = page LETTERS
; 0x1001 = page DIGITS
; 0x1002 = taille fichier
; 0x1003 = curseur
; 0x1004 = taille insertion
; 0x1005 = temp
; 0x1006 = page entree dir
; 0x1007 = page fichier
; 0x1008 = dirty
; 0x1009 = redraw
; 0x100A = zoom
; 0x100B = theme
; 0x100C = prev left
; 0x100D = prev right
; 0x100E = temp / i
; 0x100F = temp / j
; 0x1010 = draw x / temp
; 0x1011 = draw y
; 0x1012 = char temp
; 0x1013 = glyph offset
; 0x1014 = glyph page
; 0x1015 = debut vue
; 0x1016 = compteur lignes / tmp
; 0x1017 = compteur colonnes / tmp
; 0x1020 = status (0 ready 1 dirty 2 saved)
; 0x1021 = limite colonnes
; 0x1022 = limite lignes
; 0x1023 = pas vertical
; 0x1024 = pas horizontal
; 0x1025 = echelle pixel
; 0x1030 = offset entree dir fixe
; 0x1031 = draw row scratch
; 0x1032 = draw bits scratch
; 0x1033 = draw col scratch
; 0x1034 = scaled base / punct x
; 0x1035 = scaled off / punct y
; 0x1036 = scaled result
; 0x1040 = buffer insertion
; 0x1100 = buffer texte

start:
  CALL ensure_fs
  CALL find_fonts
  LDM 0x1000
  CMP 0
  JZ fail_fonts
  LDM 0x1001
  CMP 0
  JZ fail_fonts
  CALL load_boot_file
  LDA 0
  STA 0x1008
  STA 0x100A
  STA 0x100B
  STA 0x100C
  STA 0x100D
  STA 0x1015
  LDA 2
  STA 0x1020
  LDA 1
  STA 0x1009
  CALL set_metrics
  LDA 0
  STA 0x1003

main_loop:
  CALL poll_keys
  CALL poll_console
  LDM 0x1009
  CMP 0
  JZ editor_idle
  CALL ensure_cursor_visible
  CALL redraw
  LDA 0
  STA 0x1009
editor_idle:
  LDA 2
  SLEEP
  JMP main_loop

fail_no_arg:
  CLCON
${emitOutText("RUN GLXNANO FILE\\n")}
  HLT

fail_bad_arg:
  CLCON
${emitOutText("FILE ARG ONLY\\n")}
  HLT

fail_fonts:
  CLCON
${emitOutText("NEED LETTERS DIGITS\\n")}
  HLT

ensure_fs:
  LDA 0
  DRVPG
  LDA 0
  DRVRD
  CMP 66
  JNZ fail_bad_arg
  LDA 1
  DRVRD
  CMP 3
  JNZ fail_bad_arg
  RET

load_boot_file:
  LDM ${BOOT_ARG_COUNT_ADDR}
  CMP 0
  JZ fail_no_arg
  LDM ${BOOT_ARG0_TYPE_ADDR}
  CMP 1
  JNZ fail_bad_arg
  LDM ${BOOT_ARG0_DIR_OFFSET_ADDR}
  STA 0x1030
  LDM ${BOOT_ARG0_DIR_PAGE_ADDR}
  STA 0x1006
  LDM ${BOOT_ARG0_START_PAGE_ADDR}
  STA 0x1007
  LDM ${BOOT_ARG0_SIZE_ADDR}
  STA 0x1002
  CALL load_file
  RET

find_fonts:
  LDA 0
  STA 0x1000
  STA 0x1001
  LDA 16
  STA 0x100E
  LDA 0
  STA 0x100F
  STA 0x1016

font_scan_loop:
  LDM 0x1016
  CMP 64
  JZ font_scan_done
  LDM 0x100F
  DRVPG
  LDM 0x100E
  DRVRD
  CMP 0
  JZ font_next
  CALL entry_is_letters
  CMP 1
  JNZ font_check_digits
  LDM 0x100F
  DRVPG
  LDM 0x100E
  ADD 9
  DRVRD
  STA 0x1000
font_check_digits:
  CALL entry_is_digits
  CMP 1
  JNZ font_next
  LDM 0x100F
  DRVPG
  LDM 0x100E
  ADD 9
  DRVRD
  STA 0x1001
font_next:
  CALL next_dir_entry
  JMP font_scan_loop

font_scan_done:
  RET

entry_is_letters:
  LDM 0x100F
  DRVPG
  LDM 0x100E
  DRVRD
  CMP 'L'
  JNZ letters_no
  LDM 0x100E
  ADD 1
  DRVRD
  CMP 'E'
  JNZ letters_no
  LDM 0x100E
  ADD 2
  DRVRD
  CMP 'T'
  JNZ letters_no
  LDM 0x100E
  ADD 3
  DRVRD
  CMP 'T'
  JNZ letters_no
  LDM 0x100E
  ADD 4
  DRVRD
  CMP 'E'
  JNZ letters_no
  LDM 0x100E
  ADD 5
  DRVRD
  CMP 'R'
  JNZ letters_no
  LDM 0x100E
  ADD 6
  DRVRD
  CMP 'S'
  JNZ letters_no
  LDM 0x100E
  ADD 7
  DRVRD
  CMP 0
  JNZ letters_no
  LDM 0x100E
  ADD 8
  DRVRD
  CMP 1
  JNZ letters_no
  LDA 1
  RET
letters_no:
  LDA 0
  RET

entry_is_digits:
  LDM 0x100F
  DRVPG
  LDM 0x100E
  DRVRD
  CMP 'D'
  JNZ digits_no
  LDM 0x100E
  ADD 1
  DRVRD
  CMP 'I'
  JNZ digits_no
  LDM 0x100E
  ADD 2
  DRVRD
  CMP 'G'
  JNZ digits_no
  LDM 0x100E
  ADD 3
  DRVRD
  CMP 'I'
  JNZ digits_no
  LDM 0x100E
  ADD 4
  DRVRD
  CMP 'T'
  JNZ digits_no
  LDM 0x100E
  ADD 5
  DRVRD
  CMP 'S'
  JNZ digits_no
  LDM 0x100E
  ADD 6
  DRVRD
  CMP 0
  JNZ digits_no
  LDM 0x100E
  ADD 8
  DRVRD
  CMP 1
  JNZ digits_no
  LDA 1
  RET
digits_no:
  LDA 0
  RET

next_dir_entry:
  LDM 0x100E
  ADD 12
  STA 0x100E
  JNC next_dir_same_page
  LDM 0x100F
  INC
  STA 0x100F
next_dir_same_page:
  LDM 0x1016
  INC
  STA 0x1016
  RET

set_metrics:
  LDM 0x100A
  CMP 0
  JZ metrics_small
  LDA 28
  STA 0x1021
  LDA 14
  STA 0x1022
  LDA 12
  STA 0x1023
  LDA 8
  STA 0x1024
  LDA 2
  STA 0x1025
  RET
metrics_small:
  LDA 56
  STA 0x1021
  LDA 22
  STA 0x1022
  LDA 8
  STA 0x1023
  LDA 4
  STA 0x1024
  LDA 1
  STA 0x1025
  RET

poll_keys:
  CALL poll_left
  CALL poll_right
  CALL poll_up
  CALL poll_down
  RET

poll_left:
  LDA 0
  GETKEY
  CMP 0
  JZ key_left_released
  LDM 0x100C
  CMP 0
  JNZ key_left_hold
  LDM 0x1003
  CMP 0
  JZ key_left_hold
  DEC
  STA 0x1003
  LDA 1
  STA 0x1009
key_left_hold:
  LDA 1
  STA 0x100C
  RET
key_left_released:
  LDA 0
  STA 0x100C
  RET

poll_right:
  LDA 1
  GETKEY
  CMP 0
  JZ key_right_released
  LDM 0x100D
  CMP 0
  JNZ key_right_hold
  LDM 0x1003
  LBM 0x1002
  CMPB
  JZ key_right_hold
  INC
  STA 0x1003
  LDA 1
  STA 0x1009
key_right_hold:
  LDA 1
  STA 0x100D
  RET
key_right_released:
  LDA 0
  STA 0x100D
  RET

poll_up:
  LDA 2
  GETKEY
  CMP 0
  JZ key_up_released
  LDM 0x1018
  CMP 0
  JNZ key_up_hold
  CALL move_up_line
  LDA 1
  STA 0x1009
key_up_hold:
  LDA 1
  STA 0x1018
  RET
key_up_released:
  LDA 0
  STA 0x1018
  RET

poll_down:
  LDA 3
  GETKEY
  CMP 0
  JZ key_down_released
  LDM 0x1019
  CMP 0
  JNZ key_down_hold
  CALL move_down_line
  LDA 1
  STA 0x1009
key_down_hold:
  LDA 1
  STA 0x1019
  RET
key_down_released:
  LDA 0
  STA 0x1019
  RET

move_up_line:
  LDM 0x1003
  CMP 0
  JZ move_up_done
  STA 0x100E
move_up_seek_curr:
  LDM 0x100E
  CMP 0
  JZ move_up_zero
  DEC
  STA 0x100E
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ move_up_curr_found
  JMP move_up_seek_curr
move_up_zero:
  LDA 0
  STA 0x1003
  RET
move_up_curr_found:
  LDM 0x100E
  STA 0x100E
move_up_seek_prev:
  LDM 0x100E
  CMP 0
  JZ move_up_to_zero
  DEC
  STA 0x100E
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ move_up_prev_found
  JMP move_up_seek_prev
move_up_to_zero:
  LDA 0
  STA 0x1003
  RET
move_up_prev_found:
  LDM 0x100E
  INC
  STA 0x1003
move_up_done:
  RET

move_down_line:
  LDM 0x1003
  STA 0x100E
move_down_loop:
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ move_down_store
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ move_down_found
  LDM 0x100E
  INC
  STA 0x100E
  JMP move_down_loop
move_down_found:
  LDM 0x100E
  INC
  STA 0x100E
move_down_store:
  LDM 0x100E
  STA 0x1003
  RET

poll_console:
  INA
  CMP 0
  JZ console_done
  STA 0x1012
  CMP '@'
  JZ console_quit
  CMP 92
  JZ console_save
  CMP 9
  JZ console_zoom
  CMP '&'
  JZ console_theme
  CMP 8
  JZ console_backspace
  CMP 127
  JZ console_backspace
  CMP 10
  JZ console_newline
  CMP 32
  JN console_done
  CMP 127
  JNC console_done
  LDM 0x1012
  STA 0x1040
  LDA 1
  STA 0x1004
  CALL insert_text
  CALL mark_dirty
  RET

console_backspace:
  CALL delete_before
  CALL mark_dirty
  RET

console_newline:
  LDA 10
  STA 0x1040
  LDA 1
  STA 0x1004
  CALL insert_text
  CALL mark_dirty
  RET

console_save:
  CALL save_file
  LDA 0
  STA 0x1008
  LDA 2
  STA 0x1020
  LDA 1
  STA 0x1009
  RET

console_zoom:
  LDM 0x100A
  CMP 0
  JZ zoom_big
  LDA 0
  STA 0x100A
  JMP zoom_done
zoom_big:
  LDA 1
  STA 0x100A
zoom_done:
  CALL set_metrics
  LDA 1
  STA 0x1009
  RET

console_theme:
  LDM 0x100B
  INC
  CMP 3
  JNZ theme_store
  LDA 0
theme_store:
  STA 0x100B
  LDA 1
  STA 0x1009
  RET

console_quit:
  HLT

console_done:
  RET

mark_dirty:
  LDA 1
  STA 0x1008
  STA 0x1009
  STA 0x1020
  RET

ensure_cursor_visible:
  LDM 0x1003
  LBM 0x1015
  SUBB
  JN cursor_before_view
cursor_fit_retry:
  LDM 0x1015
  STA 0x100E
  LDA 0
  STA 0x1016
  STA 0x1017
cursor_fit_loop:
  LDM 0x100E
  LBM 0x1003
  CMPB
  JZ cursor_visible
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ cursor_visible
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ fit_newline
  LDM 0x1017
  INC
  STA 0x1017
  LDM 0x1017
  LBM 0x1021
  CMPB
  JNC fit_wrap
fit_next_char:
  LDM 0x100E
  INC
  STA 0x100E
  JMP cursor_fit_loop
fit_newline:
  CALL fit_advance_row
  LDM 0x100E
  INC
  STA 0x100E
  JMP cursor_fit_loop
fit_wrap:
  CALL fit_advance_row
  JMP cursor_fit_loop
cursor_before_view:
  CALL set_view_to_cursor_line
  JMP cursor_fit_retry
cursor_visible:
  RET

fit_advance_row:
  LDA 0
  STA 0x1017
  LDM 0x1016
  INC
  STA 0x1016
  LDM 0x1016
  LBM 0x1022
  CMPB
  JNC fit_scroll
  RET
fit_scroll:
  CALL scroll_view_one_row
  JMP cursor_fit_retry

set_view_to_cursor_line:
  LDM 0x1003
  STA 0x100E
line_seek_loop:
  LDM 0x100E
  CMP 0
  JZ line_seek_zero
  DEC
  STA 0x100E
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ line_seek_found
  JMP line_seek_loop
line_seek_zero:
  LDA 0
  STA 0x1015
  RET
line_seek_found:
  LDM 0x100E
  INC
  STA 0x1015
  RET

scroll_view_one_row:
  LDM 0x1015
  STA 0x100E
  LDA 0
  STA 0x1017
scroll_row_loop:
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ scroll_row_store
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ scroll_newline
  LDM 0x1017
  INC
  STA 0x1017
  LDM 0x100E
  INC
  STA 0x100E
  LDM 0x1017
  LBM 0x1021
  CMPB
  JNC scroll_row_store
  JMP scroll_row_loop
scroll_newline:
  LDM 0x100E
  INC
  STA 0x100E
scroll_row_store:
  LDM 0x100E
  STA 0x1015
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

insert_shift_check:
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
  JMP insert_shift_check

insert_copy:
  LDA 0
  STA 0x100F

insert_copy_check:
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
  JMP insert_copy_check

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
  LDM 0x1007
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
  LDM 0x1006
  DRVPG
  LDM 0x1002
  TAB
  LDM 0x1030
  ADD 11
  DRVWR
  RET

load_file:
  LDM 0x1007
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
  RET

redraw:
  CLR
  CALL draw_frame
  CALL set_ui_scale
  CALL draw_title
  CALL draw_file_bar
  CALL draw_status_bar
  CALL set_metrics
  CALL draw_text_area
  CALL draw_help_bar
  CALL set_metrics
  RET

set_ui_scale:
  LDA 4
  STA 0x1024
  LDA 1
  STA 0x1025
  RET

draw_frame:
  CALL apply_frame_color
  LDA 0
  LDB 8
frame_top_loop:
  DRAW
  INC
  JNZ frame_top_loop
  LDA 0
  LDB 24
frame_mid_top:
  DRAW
  INC
  JNZ frame_mid_top
  LDA 0
  LDB 228
frame_mid_bottom:
  DRAW
  INC
  JNZ frame_mid_bottom
  LDA 0
  LDB 244
frame_bottom_loop:
  DRAW
  INC
  JNZ frame_bottom_loop
  LDA 8
  STA 0x100E
frame_left_loop:
  LDA 0
  LBM 0x100E
  DRAW
  LDM 0x100E
  INC
  STA 0x100E
  CMP 245
  JNZ frame_left_loop
  LDA 8
  STA 0x100E
frame_right_loop:
  LDA 255
  LBM 0x100E
  DRAW
  LDM 0x100E
  INC
  STA 0x100E
  CMP 245
  JNZ frame_right_loop
  RET

draw_title:
  CALL apply_title_color
  LDA 10
  STA 0x1010
  LDA 12
  STA 0x1011
${emitDrawText("GLXNANO")}
  RET

draw_file_bar:
  CALL apply_text_color
  LDA 10
  STA 0x1010
  LDA 30
  STA 0x1011
${emitDrawText("FILE ")}
  CALL draw_current_name
  LDA 32
  CALL draw_char_adv
  LDM 0x100A
  CMP 0
  JZ file_bar_small
${emitDrawText("BIG")}
  RET
file_bar_small:
${emitDrawText("SMALL")}
  RET

draw_status_bar:
  CALL apply_accent_color
  LDA 10
  STA 0x1010
  LDA 42
  STA 0x1011
${emitDrawText("STATE ")}
  LDM 0x1020
  CMP 1
  JZ status_dirty
  CMP 2
  JZ status_saved
${emitDrawText("READY")}
  JMP status_theme
status_dirty:
${emitDrawText("DIRTY")}
  JMP status_theme
status_saved:
${emitDrawText("SAVED")}
status_theme:
  LDA 32
  CALL draw_char_adv
${emitDrawText("THEME ")}
  LDM 0x100B
  ADD 48
  CALL draw_char_adv
  RET

draw_text_area:
  CALL apply_text_color
  LDM 0x1015
  STA 0x100E
  LDA 0
  STA 0x1016
  STA 0x1017
  LDA 10
  STA 0x1010
  LDA 58
  STA 0x1011
text_loop:
  LDM 0x1016
  LBM 0x1022
  CMPB
  JNC text_done
  LDM 0x100E
  LBM 0x1003
  CMPB
  JNZ text_check_end
  CALL draw_cursor_block
text_check_end:
  LDM 0x100E
  LBM 0x1002
  CMPB
  JZ text_done
  LDM 0x100E
  LDAI 0x1100
  CMP 10
  JZ text_newline
  LDM 0x1017
  LBM 0x1021
  CMPB
  JNC text_wrap
  LDM 0x100E
  LDAI 0x1100
  CALL draw_char_adv
  LDM 0x1017
  INC
  STA 0x1017
  LDM 0x100E
  INC
  STA 0x100E
  JMP text_loop
text_newline:
  LDM 0x100E
  INC
  STA 0x100E
  CALL advance_text_row
  JMP text_loop
text_wrap:
  CALL advance_text_row
  JMP text_loop
text_done:
  LDM 0x1003
  LBM 0x1002
  CMPB
  JNZ text_ret
  CALL draw_cursor_block
text_ret:
  RET

advance_text_row:
  LDA 10
  STA 0x1010
  LDM 0x1011
  LBM 0x1023
  ADDB
  STA 0x1011
  LDA 0
  STA 0x1017
  LDM 0x1016
  INC
  STA 0x1016
  RET

draw_help_bar:
  CALL set_ui_scale
  CALL apply_frame_color
  LDA 10
  STA 0x1010
  LDA 234
  STA 0x1011
${emitDrawText("ARROWS ENTER TAB AMP")}
  RET

draw_current_name:
  LDA 0
  STA 0x100E
name_loop:
  LDM 0x100E
  CMP 8
  JZ name_done
  LDM 0x1006
  DRVPG
  LDM 0x1030
  TAB
  LDM 0x100E
  ADDB
  DRVRD
  CMP 0
  JZ name_done
  CALL draw_char_adv
  LDM 0x100E
  INC
  STA 0x100E
  JMP name_loop
name_done:
  RET

apply_frame_color:
  LDM 0x100B
  CMP 1
  JZ frame_theme_one
  CMP 2
  JZ frame_theme_two
  LDA 30
  COLR
  LDA 210
  COLG
  LDA 255
  COLB
  RET
frame_theme_one:
  LDA 255
  COLR
  LDA 150
  COLG
  LDA 60
  COLB
  RET
frame_theme_two:
  LDA 90
  COLR
  LDA 255
  COLG
  LDA 160
  COLB
  RET

apply_title_color:
  LDM 0x100B
  CMP 1
  JZ title_theme_one
  CMP 2
  JZ title_theme_two
  LDA 180
  COLR
  LDA 255
  COLG
  LDA 255
  COLB
  RET
title_theme_one:
  LDA 255
  COLR
  LDA 230
  COLG
  LDA 120
  COLB
  RET
title_theme_two:
  LDA 220
  COLR
  LDA 255
  COLG
  LDA 200
  COLB
  RET

apply_text_color:
  LDM 0x100B
  CMP 1
  JZ text_theme_one
  CMP 2
  JZ text_theme_two
  LDA 150
  COLR
  LDA 255
  COLG
  LDA 220
  COLB
  RET
text_theme_one:
  LDA 255
  COLR
  LDA 240
  COLG
  LDA 200
  COLB
  RET
text_theme_two:
  LDA 230
  COLR
  LDA 255
  COLG
  LDA 235
  COLB
  RET

apply_accent_color:
  LDM 0x100B
  CMP 1
  JZ accent_theme_one
  CMP 2
  JZ accent_theme_two
  LDA 255
  COLR
  LDA 235
  COLG
  LDA 120
  COLB
  RET
accent_theme_one:
  LDA 255
  COLR
  LDA 120
  COLG
  LDA 220
  COLB
  RET
accent_theme_two:
  LDA 120
  COLR
  LDA 180
  COLG
  LDA 255
  COLB
  RET

draw_cursor_block:
  CALL apply_accent_color
  CALL punct_under
  CALL apply_text_color
  RET

draw_char_adv:
  CALL draw_char
  LDM 0x1010
  LBM 0x1024
  ADDB
  STA 0x1010
  RET

draw_char:
  CALL to_upper
  STA 0x1012
  CMP ' '
  JZ draw_char_ret
  SUB 'A'
  JN draw_char_digit
  CMP 26
  JNC draw_char_digit
  CALL mul5
  STA 0x1013
  LDM 0x1000
  STA 0x1014
  JMP draw_glyph
draw_char_digit:
  LDM 0x1012
  SUB '0'
  JN draw_char_punct
  CMP 10
  JNC draw_char_punct
  CALL mul5
  STA 0x1013
  LDM 0x1001
  STA 0x1014
  JMP draw_glyph

draw_char_punct:
  LDM 0x1012
  CMP '.'
  JZ punct_dot
  CMP ','
  JZ punct_comma
  CMP ':'
  JZ punct_colon
  CMP '!'
  JZ punct_bang
  CMP '?'
  JZ punct_q
  CMP '-'
  JZ punct_dash
  CMP '_'
  JZ punct_under
  CMP '/'
  JZ punct_slash
  CMP '+'
  JZ punct_plus
  CMP '='
  JZ punct_eq
  CMP 39
  JZ punct_tick
  CMP 34
  JZ punct_quote
  CMP '('
  JZ punct_lpar
  CMP ')'
  JZ punct_rpar
  RET

punct_dot:
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_one
punct_comma:
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  CALL punct_one
  LDA 0
  STA 0x1033
  LDA 5
  STA 0x1034
  JMP punct_one
punct_colon:
  LDA 1
  STA 0x1033
  LDA 1
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_one
punct_bang:
  LDA 1
  STA 0x1033
  LDA 0
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1034
  CALL punct_one
  LDA 2
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_one
punct_q:
  LDA 0
  STA 0x1033
  LDA 0
  STA 0x1034
  CALL punct_hline
  LDA 2
  STA 0x1033
  LDA 1
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1033
  LDA 2
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_one
punct_dash:
  LDA 0
  STA 0x1033
  LDA 2
  STA 0x1034
  JMP punct_hline
punct_under:
  LDA 0
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_hline
punct_slash:
  RET
punct_plus:
  LDA 1
  STA 0x1033
  LDA 1
  STA 0x1034
  CALL punct_vline3
  LDA 0
  STA 0x1033
  LDA 2
  STA 0x1034
  JMP punct_hline
punct_eq:
  LDA 0
  STA 0x1033
  LDA 1
  STA 0x1034
  CALL punct_hline
  LDA 0
  STA 0x1033
  LDA 3
  STA 0x1034
  JMP punct_hline
punct_tick:
  LDA 1
  STA 0x1033
  LDA 0
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1034
  JMP punct_one
punct_quote:
  LDA 0
  STA 0x1033
  LDA 0
  STA 0x1034
  CALL punct_vline2
  LDA 2
  STA 0x1033
  LDA 0
  STA 0x1034
  JMP punct_vline2
punct_lpar:
  LDA 1
  STA 0x1033
  LDA 0
  STA 0x1034
  CALL punct_one
  LDA 0
  STA 0x1033
  LDA 1
  STA 0x1034
  CALL punct_one
  LDA 0
  STA 0x1033
  LDA 2
  STA 0x1034
  CALL punct_one
  LDA 0
  STA 0x1033
  LDA 3
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_one
punct_rpar:
  LDA 1
  STA 0x1033
  LDA 0
  STA 0x1034
  CALL punct_one
  LDA 2
  STA 0x1033
  LDA 1
  STA 0x1034
  CALL punct_one
  LDA 2
  STA 0x1033
  LDA 2
  STA 0x1034
  CALL punct_one
  LDA 2
  STA 0x1033
  LDA 3
  STA 0x1034
  CALL punct_one
  LDA 1
  STA 0x1033
  LDA 4
  STA 0x1034
  JMP punct_one

punct_hline:
  CALL punct_one
  LDM 0x1033
  INC
  STA 0x1033
  CALL punct_one
  LDM 0x1033
  INC
  STA 0x1033
  JMP punct_one

punct_vline2:
  CALL punct_one
  LDM 0x1034
  INC
  STA 0x1034
  JMP punct_one

punct_vline3:
  CALL punct_one
  LDM 0x1034
  INC
  STA 0x1034
  CALL punct_one
  LDM 0x1034
  INC
  STA 0x1034

punct_one:
  LDM 0x1010
  LBM 0x1033
  CALL scaled_add
  PUSH
  LDM 0x1011
  LBM 0x1034
  CALL scaled_add
  TAB
  POP
  CALL plot_scaled_pixel
  RET

draw_glyph:
  LDA 0
  STA 0x1031
glyph_row_loop:
  LDM 0x1031
  CMP 5
  JZ draw_char_ret
  LDM 0x1014
  DRVPG
  LDM 0x1013
  TAB
  LDM 0x1031
  ADDB
  DRVRD
  STA 0x1032
  LDA 0
  STA 0x1033
glyph_col_loop:
  LDM 0x1033
  CMP 3
  JZ glyph_next_row
  LDM 0x1033
  CMP 0
  JZ glyph_bit4
  CMP 1
  JZ glyph_bit2
  LDM 0x1032
  AND 1
  JMP glyph_check
glyph_bit2:
  LDM 0x1032
  AND 2
  JMP glyph_check
glyph_bit4:
  LDM 0x1032
  AND 4
glyph_check:
  CMP 0
  JZ glyph_skip_pixel
  LDM 0x1010
  LBM 0x1033
  CALL scaled_add
  PUSH
  LDM 0x1011
  LBM 0x1031
  CALL scaled_add
  TAB
  POP
  CALL plot_scaled_pixel
glyph_skip_pixel:
  LDM 0x1033
  INC
  STA 0x1033
  JMP glyph_col_loop
glyph_next_row:
  LDM 0x1031
  INC
  STA 0x1031
  JMP glyph_row_loop

plot_scaled_pixel:
  STA 0x101A
  TBA
  STA 0x101B
  LDM 0x101B
  TAB
  LDM 0x101A
  DRAW
  LDM 0x1025
  CMP 1
  JZ plot_scaled_done
  LDM 0x101B
  TAB
  LDM 0x101A
  INC
  DRAW
  LDM 0x101B
  INC
  TAB
  LDM 0x101A
  DRAW
  LDM 0x101B
  INC
  TAB
  LDM 0x101A
  INC
  DRAW
  RET
plot_scaled_done:
  RET

draw_char_ret:
  RET

mul5:
  STA 0x1033
  SHL
  SHL
  TAB
  LDM 0x1033
  ADDB
  RET

scaled_add:
  STA 0x1034
  TBA
  STA 0x1035
  LDM 0x1034
  TAB
  LDM 0x1035
  ADDB
  STA 0x1036
  LDM 0x1025
  CMP 1
  JZ scaled_add_done
  TAB
  LDM 0x1035
  ADDB
  STA 0x1036
scaled_add_done:
  LDM 0x1036
  RET

to_upper:
  CMP 'a'
  JN upper_ret
  CMP '{'
  JNC upper_ret
  SUB 32
upper_ret:
  RET
`;
