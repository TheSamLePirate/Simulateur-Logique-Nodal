export const ASM_PLOTTER_SHELL_SOURCE = `; Super Unix Shell Plotter
; Graphical shell that uses LETTERS and DIGITS from the shared bootloader FS.
; Controls:
; - type commands in the console input field, press Enter
; - UP/DOWN = move selection
; - LEFT = help, RIGHT = preview
; Commands:
; - HELP
; - LS
; - CAT NAME
; - CLS
; - QUIT
;
; RAM
; 0x1000 = letters font page
; 0x1001 = digits font page
; 0x1002 = selected used-entry index
; 0x1003 = total used entries
; 0x1004 = scroll index
; 0x1005 = dirty
; 0x1006 = command length
; 0x1007 = selected dir base
; 0x1008 = selected dir page
; 0x1009 = selected type
; 0x100A = selected data page
; 0x100B = selected page count
; 0x100C = selected size
; 0x100D = temp / loop
; 0x100E = temp / loop
; 0x100F = temp / loop
; 0x1010 = draw x
; 0x1011 = draw y
; 0x1012 = char temp
; 0x1013 = glyph offset
; 0x1014 = glyph page
; 0x1015 = status code
; 0x1016 = view mode (0=preview 1=help)
; 0x1017 = line / display y
; 0x1018 = used count temp
; 0x1019 = prev up
; 0x101A = prev down
; 0x101B = prev left
; 0x101C = prev right
; 0x1040 = command buffer

start:
  CALL ensure_fs
  CALL find_fonts
  LDM 0x1000
  CMP 0
  JZ fail_fonts
  LDM 0x1001
  CMP 0
  JZ fail_fonts
  LDA 0
  STA 0x1002
  STA 0x1004
  STA 0x1006
  STA 0x1015
  STA 0x1016
  STA 0x1019
  STA 0x101A
  STA 0x101B
  STA 0x101C
  CALL recount_entries
  LDA 1
  STA 0x1005

main_loop:
  CALL poll_keys
  CALL poll_console
  LDM 0x1005
  CMP 0
  JZ shell_idle
  CALL redraw
  LDA 0
  STA 0x1005
shell_idle:
  LDA 2
  SLEEP
  JMP main_loop

fail_fs:
  CLCON
  OUT 'N'
  OUT 'E'
  OUT 'E'
  OUT 'D'
  OUT ' '
  OUT 'B'
  OUT 'O'
  OUT 'O'
  OUT 'T'
  OUT ' '
  OUT 'F'
  OUT 'S'
  OUT 10
  HLT

fail_fonts:
  CLCON
  OUT 'N'
  OUT 'E'
  OUT 'E'
  OUT 'D'
  OUT ' '
  OUT 'L'
  OUT 'E'
  OUT 'T'
  OUT 'T'
  OUT 'E'
  OUT 'R'
  OUT 'S'
  OUT ' '
  OUT 'D'
  OUT 'I'
  OUT 'G'
  OUT 'I'
  OUT 'T'
  OUT 'S'
  OUT 10
  HLT

ensure_fs:
  LDA 0
  DRVPG
  LDA 0
  DRVRD
  CMP 66
  JNZ fail_fs
  LDA 1
  DRVRD
  CMP 3
  JNZ fail_fs
  RET

find_fonts:
  LDA 0
  STA 0x1000
  STA 0x1001
  LDA 16
  STA 0x100D
  LDA 0
  STA 0x100E
  STA 0x100F

font_scan_loop:
  LDM 0x100F
  CMP 64
  JZ font_scan_done
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 0
  JZ font_next
  CALL entry_is_letters
  CMP 1
  JNZ check_digits_font
  LDM 0x100E
  DRVPG
  LDM 0x100D
  ADD 9
  DRVRD
  STA 0x1000
check_digits_font:
  CALL entry_is_digits
  CMP 1
  JNZ font_next
  LDM 0x100E
  DRVPG
  LDM 0x100D
  ADD 9
  DRVRD
  STA 0x1001
font_next:
  CALL next_dir_entry
  JMP font_scan_loop

font_scan_done:
  RET

entry_is_letters:
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 'L'
  JNZ letters_no
  LDM 0x100D
  ADD 1
  DRVRD
  CMP 'E'
  JNZ letters_no
  LDM 0x100D
  ADD 2
  DRVRD
  CMP 'T'
  JNZ letters_no
  LDM 0x100D
  ADD 3
  DRVRD
  CMP 'T'
  JNZ letters_no
  LDM 0x100D
  ADD 4
  DRVRD
  CMP 'E'
  JNZ letters_no
  LDM 0x100D
  ADD 5
  DRVRD
  CMP 'R'
  JNZ letters_no
  LDM 0x100D
  ADD 6
  DRVRD
  CMP 'S'
  JNZ letters_no
  LDM 0x100D
  ADD 7
  DRVRD
  CMP 0
  JNZ letters_no
  LDM 0x100D
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
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 'D'
  JNZ digits_no
  LDM 0x100D
  ADD 1
  DRVRD
  CMP 'I'
  JNZ digits_no
  LDM 0x100D
  ADD 2
  DRVRD
  CMP 'G'
  JNZ digits_no
  LDM 0x100D
  ADD 3
  DRVRD
  CMP 'I'
  JNZ digits_no
  LDM 0x100D
  ADD 4
  DRVRD
  CMP 'T'
  JNZ digits_no
  LDM 0x100D
  ADD 5
  DRVRD
  CMP 'S'
  JNZ digits_no
  LDM 0x100D
  ADD 6
  DRVRD
  CMP 0
  JNZ digits_no
  LDM 0x100D
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
  LDM 0x100D
  ADD 12
  STA 0x100D
  JNC next_dir_done
  LDM 0x100E
  INC
  STA 0x100E
next_dir_done:
  LDM 0x100F
  INC
  STA 0x100F
  RET

recount_entries:
  LDA 0
  STA 0x1003
  LDA 16
  STA 0x100D
  LDA 0
  STA 0x100E
  STA 0x100F

recount_loop:
  LDM 0x100F
  CMP 64
  JZ recount_done
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 0
  JZ recount_next
  LDM 0x1003
  INC
  STA 0x1003
recount_next:
  CALL next_dir_entry
  JMP recount_loop

recount_done:
  LDM 0x1003
  CMP 0
  JNZ recount_non_empty
  LDA 0
  STA 0x1002
  STA 0x1004
  RET

recount_non_empty:
  LDM 0x1003
  TAB
  LDM 0x1002
  CMPB
  JNC clamp_selected
  JMP clamp_scroll

clamp_selected:
  LDM 0x1003
  DEC
  STA 0x1002

clamp_scroll:
  LDM 0x1004
  LBM 0x1002
  CMPB
  JNC fix_scroll_to_selected
  LDM 0x1002
  SUB 12
  JN scroll_ok
  INC
  STA 0x1004
  RET
fix_scroll_to_selected:
  LDM 0x1002
  STA 0x1004
scroll_ok:
  RET

poll_keys:
  CALL poll_up
  CALL poll_down
  CALL poll_left
  CALL poll_right
  RET

poll_up:
  LDA 2
  GETKEY
  CMP 0
  JZ up_released
  LDM 0x1019
  CMP 0
  JNZ up_hold
  LDM 0x1002
  CMP 0
  JZ up_hold
  DEC
  STA 0x1002
  LDM 0x1002
  LBM 0x1004
  CMPB
  JNC up_dirty
  LDM 0x1002
  STA 0x1004
up_dirty:
  LDA 0
  STA 0x1016
  LDA 1
  STA 0x1005
up_hold:
  LDA 1
  STA 0x1019
  RET
up_released:
  LDA 0
  STA 0x1019
  RET

poll_down:
  LDA 3
  GETKEY
  CMP 0
  JZ down_released
  LDM 0x101A
  CMP 0
  JNZ down_hold
  LDM 0x1003
  TAB
  LDM 0x1002
  INC
  CMPB
  JNC down_hold
  LDM 0x1002
  INC
  STA 0x1002
  LDM 0x1002
  LBM 0x1004
  SUBB
  CMP 12
  JN down_dirty
  LDM 0x1004
  INC
  STA 0x1004
down_dirty:
  LDA 0
  STA 0x1016
  LDA 1
  STA 0x1005
down_hold:
  LDA 1
  STA 0x101A
  RET
down_released:
  LDA 0
  STA 0x101A
  RET

poll_left:
  LDA 0
  GETKEY
  CMP 0
  JZ left_released
  LDM 0x101B
  CMP 0
  JNZ left_hold
  LDA 1
  STA 0x1016
  LDA 1
  STA 0x1005
left_hold:
  LDA 1
  STA 0x101B
  RET
left_released:
  LDA 0
  STA 0x101B
  RET

poll_right:
  LDA 1
  GETKEY
  CMP 0
  JZ right_released
  LDM 0x101C
  CMP 0
  JNZ right_hold
  LDA 0
  STA 0x1016
  LDA 1
  STA 0x1005
right_hold:
  LDA 1
  STA 0x101C
  RET
right_released:
  LDA 0
  STA 0x101C
  RET

poll_console:
  INA
  CMP 0
  JZ console_done
  STA 0x1012
  CMP 10
  JZ execute_and_clear
  CMP 8
  JZ console_backspace
  CMP 127
  JZ console_backspace
  LDM 0x1006
  CMP 31
  JNC console_done
  TAB
  LDM 0x1012
  CALL to_upper
  STAI 0x1040
  LDM 0x1006
  INC
  STA 0x1006
  LDA 1
  STA 0x1005
  RET

console_backspace:
  LDM 0x1006
  CMP 0
  JZ console_done
  DEC
  STA 0x1006
  LDA 1
  STA 0x1005
console_done:
  RET

execute_and_clear:
  CALL execute_command
  LDA 0
  STA 0x1006
  LDA 1
  STA 0x1005
  RET

execute_command:
  LDM 0x1006
  CMP 0
  JZ command_ret
  CALL cmd_is_quit
  CMP 1
  JNZ check_help_cmd
  HLT

check_help_cmd:
  CALL cmd_is_help
  CMP 1
  JNZ check_ls_cmd
  LDA 1
  STA 0x1016
  LDA 0
  STA 0x1015
  RET

check_ls_cmd:
  CALL cmd_is_ls
  CMP 1
  JNZ check_cls_cmd
  CALL recount_entries
  LDA 0
  STA 0x1015
  STA 0x1016
  RET

check_cls_cmd:
  CALL cmd_is_cls
  CMP 1
  JNZ check_cat_cmd
  LDA 0
  STA 0x1015
  STA 0x1016
  RET

check_cat_cmd:
  CALL cmd_is_cat
  CMP 1
  JNZ bad_command
  CALL find_entry_from_command
  CMP 1
  JNZ not_found_status
  LDA 0
  STA 0x1015
  STA 0x1016
  RET

bad_command:
  LDA 2
  STA 0x1015
  RET

not_found_status:
  LDA 1
  STA 0x1015
  RET

command_ret:
  RET

cmd_is_help:
  LDM 0x1006
  CMP 4
  JNZ cmd_help_no
  LDA 0
  LDAI 0x1040
  CMP 'H'
  JNZ cmd_help_no
  LDA 1
  LDAI 0x1040
  CMP 'E'
  JNZ cmd_help_no
  LDA 2
  LDAI 0x1040
  CMP 'L'
  JNZ cmd_help_no
  LDA 3
  LDAI 0x1040
  CMP 'P'
  JNZ cmd_help_no
  LDA 1
  RET
cmd_help_no:
  LDA 0
  RET

cmd_is_ls:
  LDM 0x1006
  CMP 2
  JNZ cmd_ls_no
  LDA 0
  LDAI 0x1040
  CMP 'L'
  JNZ cmd_ls_no
  LDA 1
  LDAI 0x1040
  CMP 'S'
  JNZ cmd_ls_no
  LDA 1
  RET
cmd_ls_no:
  LDA 0
  RET

cmd_is_cls:
  LDM 0x1006
  CMP 3
  JNZ cmd_cls_no
  LDA 0
  LDAI 0x1040
  CMP 'C'
  JNZ cmd_cls_no
  LDA 1
  LDAI 0x1040
  CMP 'L'
  JNZ cmd_cls_no
  LDA 2
  LDAI 0x1040
  CMP 'S'
  JNZ cmd_cls_no
  LDA 1
  RET
cmd_cls_no:
  LDA 0
  RET

cmd_is_quit:
  LDM 0x1006
  CMP 4
  JNZ cmd_quit_no
  LDA 0
  LDAI 0x1040
  CMP 'Q'
  JNZ cmd_quit_no
  LDA 1
  LDAI 0x1040
  CMP 'U'
  JNZ cmd_quit_no
  LDA 2
  LDAI 0x1040
  CMP 'I'
  JNZ cmd_quit_no
  LDA 3
  LDAI 0x1040
  CMP 'T'
  JNZ cmd_quit_no
  LDA 1
  RET
cmd_quit_no:
  LDA 0
  RET

cmd_is_cat:
  LDM 0x1006
  CMP 5
  JN cmd_cat_no
  LDA 0
  LDAI 0x1040
  CMP 'C'
  JNZ cmd_cat_no
  LDA 1
  LDAI 0x1040
  CMP 'A'
  JNZ cmd_cat_no
  LDA 2
  LDAI 0x1040
  CMP 'T'
  JNZ cmd_cat_no
  LDA 3
  LDAI 0x1040
  CMP ' '
  JNZ cmd_cat_no
  LDA 1
  RET
cmd_cat_no:
  LDA 0
  RET

find_entry_from_command:
  LDA 16
  STA 0x100D
  LDA 0
  STA 0x100E
  STA 0x100F
  STA 0x1018

find_cmd_loop:
  LDM 0x100F
  CMP 64
  JZ find_cmd_fail
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 0
  JZ find_cmd_next
  CALL entry_matches_command_name
  CMP 1
  JNZ find_cmd_count
  LDM 0x1018
  STA 0x1002
  CALL adjust_scroll
  LDA 1
  RET
find_cmd_count:
  LDM 0x1018
  INC
  STA 0x1018
find_cmd_next:
  CALL next_dir_entry
  JMP find_cmd_loop

find_cmd_fail:
  LDA 0
  RET

adjust_scroll:
  LDM 0x1002
  LBM 0x1004
  CMPB
  JNC adjust_lower_ok
  LDM 0x1002
  STA 0x1004
adjust_lower_ok:
  LDM 0x1002
  SUB 11
  JN adjust_ret
  LDM 0x1004
  TAB
  LDM 0x1002
  SUB 11
  CMPB
  JNC adjust_store
  RET
adjust_store:
  LDM 0x1002
  SUB 11
  STA 0x1004
adjust_ret:
  RET

entry_matches_command_name:
  LDM 0x1006
  SUB 4
  STA 0x1017
  LDA 0
  STA 0x1013

match_cmd_loop:
  LDM 0x1013
  CMP 8
  JZ match_cmd_yes
  LDM 0x100E
  DRVPG
  LDM 0x100D
  TAB
  LDM 0x1013
  ADDB
  DRVRD
  CALL to_upper
  STA 0x1012
  LDM 0x1013
  LBM 0x1017
  CMPB
  JNC match_cmd_need_zero
  LDM 0x1013
  ADD 4
  LDAI 0x1040
  CALL to_upper
  TAB
  LDM 0x1012
  CMPB
  JNZ match_cmd_no
  JMP match_cmd_next

match_cmd_need_zero:
  LDM 0x1012
  CMP 0
  JNZ match_cmd_no

match_cmd_next:
  LDM 0x1013
  INC
  STA 0x1013
  JMP match_cmd_loop

match_cmd_yes:
  LDA 1
  RET
match_cmd_no:
  LDA 0
  RET

locate_selected_entry:
  LDM 0x1003
  CMP 0
  JNZ locate_start
  LDA 255
  STA 0x1007
  RET

locate_start:
  LDA 16
  STA 0x100D
  LDA 0
  STA 0x100E
  STA 0x100F
  STA 0x1018

locate_loop:
  LDM 0x100F
  CMP 64
  JZ locate_fail
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 0
  JZ locate_next
  LDM 0x1018
  LBM 0x1002
  CMPB
  JZ locate_found
  LDM 0x1018
  INC
  STA 0x1018
locate_next:
  CALL next_dir_entry
  JMP locate_loop

locate_found:
  LDM 0x100D
  STA 0x1007
  LDM 0x100E
  STA 0x1008
  LDM 0x100E
  DRVPG
  LDM 0x100D
  ADD 8
  DRVRD
  STA 0x1009
  LDM 0x100D
  ADD 9
  DRVRD
  STA 0x100A
  LDM 0x100D
  ADD 10
  DRVRD
  STA 0x100B
  LDM 0x100D
  ADD 11
  DRVRD
  STA 0x100C
  RET

locate_fail:
  LDA 255
  STA 0x1007
  RET

redraw:
  CLR
  CALL draw_frame
  CALL draw_title
  CALL draw_list_panel
  CALL draw_preview_panel
  CALL draw_status_line
  CALL draw_command_line
  RET

draw_frame:
  LDA 20
  COLR
  LDA 140
  COLG
  LDA 210
  COLB
  LDA 0
  LDB 12
frame_top:
  DRAW
  INC
  JNZ frame_top
  LDA 0
  LDB 232
frame_bottom:
  DRAW
  INC
  JNZ frame_bottom
  LDA 112
  LDB 12
frame_mid:
  DRAW
  TBA
  INC
  TAB
  CMP 232
  JNZ frame_mid
  RET

draw_title:
  LDA 40
  COLR
  LDA 220
  COLG
  LDA 255
  COLB
  LDA 4
  STA 0x1010
  LDA 3
  STA 0x1011
  LDA 'S'
  CALL draw_char_adv
  LDA 'U'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'R'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'S'
  CALL draw_char_adv
  LDA 'H'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  RET

draw_list_panel:
  CALL recount_entries
  LDA 50
  COLR
  LDA 230
  COLG
  LDA 120
  COLB
  LDA 4
  STA 0x1010
  LDA 18
  STA 0x1011
  LDA 'F'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'S'
  CALL draw_char_adv

  LDA 16
  STA 0x100D
  LDA 0
  STA 0x100E
  STA 0x100F
  STA 0x1018
  LDA 24
  STA 0x1017

draw_list_loop:
  LDM 0x100F
  CMP 64
  JZ draw_list_done
  LDM 0x1017
  CMP 224
  JNC draw_list_done
  LDM 0x100E
  DRVPG
  LDM 0x100D
  DRVRD
  CMP 0
  JZ draw_list_next
  LDM 0x1018
  LBM 0x1004
  CMPB
  JN draw_list_count
  LDM 0x1018
  LBM 0x1004
  SUBB
  CMP 12
  JNC draw_list_count
  CALL draw_one_list_row
  LDM 0x1017
  ADD 8
  STA 0x1017
draw_list_count:
  LDM 0x1018
  INC
  STA 0x1018
draw_list_next:
  CALL next_dir_entry
  JMP draw_list_loop

draw_list_done:
  RET

draw_one_list_row:
  LDM 0x1018
  LBM 0x1002
  CMPB
  JNZ row_normal
  LDA 255
  COLR
  LDA 220
  COLG
  LDA 80
  COLB
  JMP row_color_done
row_normal:
  LDA 80
  COLR
  LDA 220
  COLG
  LDA 120
  COLB
row_color_done:
  LDA 4
  STA 0x1010
  LDM 0x1017
  STA 0x1011
  LDM 0x100E
  DRVPG
  LDM 0x100D
  ADD 8
  DRVRD
  CMP 2
  JNZ row_file
  LDA 'P'
  JMP row_type_draw
row_file:
  LDA 'F'
row_type_draw:
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  CALL draw_scan_entry_name
  RET

draw_scan_entry_name:
  LDA 0
  STA 0x1012
scan_name_loop:
  LDM 0x1012
  CMP 8
  JZ scan_name_done
  LDM 0x100E
  DRVPG
  LDM 0x100D
  TAB
  LDM 0x1012
  ADDB
  DRVRD
  CMP 0
  JZ scan_name_done
  CALL draw_char_adv
  LDM 0x1012
  INC
  STA 0x1012
  JMP scan_name_loop
scan_name_done:
  RET

draw_preview_panel:
  LDA 70
  COLR
  LDA 180
  COLG
  LDA 255
  COLB
  LDA 120
  STA 0x1010
  LDA 18
  STA 0x1011
  LDA 'V'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'W'
  CALL draw_char_adv

  LDM 0x1016
  CMP 1
  JZ draw_help_screen
  CALL locate_selected_entry
  LDM 0x1007
  CMP 255
  JNZ draw_selected_preview
  CALL draw_empty_preview
  RET

draw_help_screen:
  CALL draw_help_panel
  RET

draw_selected_preview:
  LDA 180
  COLR
  LDA 240
  COLG
  LDA 255
  COLB
  LDA 120
  STA 0x1010
  LDA 28
  STA 0x1011
  CALL draw_selected_name
  LDM 0x1009
  CMP 2
  JZ draw_program_preview
  CALL draw_file_preview
  RET

draw_empty_preview:
  LDA 200
  COLR
  LDA 200
  COLG
  LDA 200
  COLB
  LDA 120
  STA 0x1010
  LDA 32
  STA 0x1011
  LDA 'N'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'F'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'S'
  CALL draw_char_adv
  RET

draw_selected_name:
  LDA 0
  STA 0x1012
selected_name_loop:
  LDM 0x1012
  CMP 8
  JZ selected_name_done
  LDM 0x1008
  DRVPG
  LDM 0x1007
  TAB
  LDM 0x1012
  ADDB
  DRVRD
  CMP 0
  JZ selected_name_done
  CALL draw_char_adv
  LDM 0x1012
  INC
  STA 0x1012
  JMP selected_name_loop
selected_name_done:
  RET

draw_program_preview:
  LDA 120
  COLR
  LDA 200
  COLG
  LDA 255
  COLB
  LDA 120
  STA 0x1010
  LDA 44
  STA 0x1011
  LDA 'P'
  CALL draw_char_adv
  LDA 'R'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'G'
  CALL draw_char_adv
  LDA 'R'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'F'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv

  LDA 120
  STA 0x1010
  LDA 56
  STA 0x1011
  LDA 'B'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  RET

draw_help_panel:
  LDA 180
  COLR
  LDA 230
  COLG
  LDA 255
  COLB
  LDA 120
  STA 0x1010
  LDA 32
  STA 0x1011
  LDA 'U'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'W'
  CALL draw_char_adv
  LDA 'N'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'S'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'C'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv

  LDA 120
  STA 0x1010
  LDA 44
  STA 0x1011
  LDA 'L'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'F'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'H'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'R'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'G'
  CALL draw_char_adv
  LDA 'H'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'V'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'W'
  CALL draw_char_adv

  LDA 120
  STA 0x1010
  LDA 56
  STA 0x1011
  LDA 'T'
  CALL draw_char_adv
  LDA 'Y'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'H'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'C'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'N'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv

  LDA 120
  STA 0x1010
  LDA 68
  STA 0x1011
  LDA 'T'
  CALL draw_char_adv
  LDA 'Y'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'C'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'S'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'Q'
  CALL draw_char_adv
  LDA 'U'
  CALL draw_char_adv
  LDA 'I'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  RET

draw_file_preview:
  LDA 120
  COLR
  LDA 255
  COLG
  LDA 180
  COLB
  LDA 120
  STA 0x1010
  LDA 40
  STA 0x1011
  LDA 0
  STA 0x1018
  STA 0x1017
  LDM 0x100A
  DRVPG

file_preview_loop:
  LDM 0x1018
  LBM 0x100C
  CMPB
  JZ file_preview_done
  LDM 0x1017
  CMP 24
  JNC file_preview_done
  LDM 0x100A
  DRVPG
  LDM 0x1018
  DRVRD
  STA 0x1012
  CMP 10
  JZ file_newline
  CMP 13
  JZ file_skip_char
  LDM 0x1010
  CMP 248
  JNC file_newline_wrap
  LDM 0x1012
  CALL draw_char_adv
file_skip_char:
  LDM 0x1018
  INC
  STA 0x1018
  JMP file_preview_loop

file_newline_wrap:
  LDM 0x1017
  INC
  STA 0x1017
  LDA 120
  STA 0x1010
  LDM 0x1011
  ADD 7
  STA 0x1011
  JMP file_preview_loop

file_newline:
  LDM 0x1018
  INC
  STA 0x1018
  LDM 0x1017
  INC
  STA 0x1017
  LDA 120
  STA 0x1010
  LDM 0x1011
  ADD 7
  STA 0x1011
  JMP file_preview_loop

file_preview_done:
  RET

draw_status_line:
  LDA 170
  COLR
  LDA 170
  COLG
  LDA 170
  COLB
  LDA 4
  STA 0x1010
  LDA 236
  STA 0x1011
  LDA 'S'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA 'U'
  CALL draw_char_adv
  LDA 'S'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv

  LDM 0x1015
  CMP 1
  JZ status_not_found
  CMP 2
  JZ status_bad
  LDM 0x1016
  CMP 1
  JZ status_help
  LDM 0x1003
  CMP 0
  JZ status_empty
  JMP status_ready

status_ready:
  LDA 'R'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  LDA 'Y'
  CALL draw_char_adv
  RET

status_not_found:
  LDA 'N'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'F'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'U'
  CALL draw_char_adv
  LDA 'N'
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  RET

status_bad:
  LDA 'B'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'C'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA 'A'
  CALL draw_char_adv
  LDA 'N'
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  RET

status_help:
  LDA 'H'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  LDA 'L'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA 'O'
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  LDA 'E'
  CALL draw_char_adv
  RET

status_empty:
  LDA 'E'
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA 'P'
  CALL draw_char_adv
  LDA 'T'
  CALL draw_char_adv
  LDA 'Y'
  CALL draw_char_adv
  RET

draw_command_line:
  LDA 255
  COLR
  LDA 255
  COLG
  LDA 120
  COLB
  LDA 4
  STA 0x1010
  LDA 244
  STA 0x1011
  LDA 'C'
  CALL draw_char_adv
  LDA 'M'
  CALL draw_char_adv
  LDA 'D'
  CALL draw_char_adv
  LDA ' '
  CALL draw_char_adv
  CALL draw_command_buffer
  RET

draw_command_buffer:
  LDA 0
  STA 0x1018
cmd_draw_loop:
  LDM 0x1018
  LBM 0x1006
  CMPB
  JZ cmd_draw_done
  LDM 0x1018
  LDAI 0x1040
  CALL draw_char_adv
  LDM 0x1018
  INC
  STA 0x1018
  JMP cmd_draw_loop
cmd_draw_done:
  RET

draw_char_adv:
  CALL draw_char
  LDM 0x1010
  ADD 4
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
  JN draw_char_ret
  CMP 10
  JNC draw_char_ret
  CALL mul5
  STA 0x1013
  LDM 0x1001
  STA 0x1014

draw_glyph:
  LDA 0
  STA 0x100D
glyph_row_loop:
  LDM 0x100D
  CMP 5
  JZ draw_char_ret
  LDM 0x1014
  DRVPG
  LDM 0x1013
  TAB
  LDM 0x100D
  ADDB
  DRVRD
  STA 0x100F
  LDA 0
  STA 0x100E
glyph_col_loop:
  LDM 0x100E
  CMP 3
  JZ glyph_next_row
  LDM 0x100E
  CMP 0
  JZ glyph_bit4
  CMP 1
  JZ glyph_bit2
  LDM 0x100F
  AND 1
  JMP glyph_check
glyph_bit2:
  LDM 0x100F
  AND 2
  JMP glyph_check
glyph_bit4:
  LDM 0x100F
  AND 4
glyph_check:
  CMP 0
  JZ glyph_skip_pixel
  LDM 0x1010
  TAB
  LDM 0x100E
  ADDB
  PUSH
  LDM 0x1011
  TAB
  LDM 0x100D
  ADDB
  TAB
  POP
  DRAW
glyph_skip_pixel:
  LDM 0x100E
  INC
  STA 0x100E
  JMP glyph_col_loop
glyph_next_row:
  LDM 0x100D
  INC
  STA 0x100D
  JMP glyph_row_loop

draw_char_ret:
  RET

mul5:
  STA 0x100D
  SHL
  SHL
  TAB
  LDM 0x100D
  ADDB
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
