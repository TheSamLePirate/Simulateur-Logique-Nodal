/**
 * Lexer / Tokenizer for the simple C language.
 *
 * Converts source text into a flat token stream with line/column info.
 */

export enum TokenType {
  // Literals
  NUMBER,
  CHAR_LITERAL,
  STRING_LITERAL,
  // Identifiers & keywords
  IDENTIFIER,
  INT,
  VOID,
  IF,
  ELSE,
  WHILE,
  FOR,
  RETURN,
  // Operators
  PLUS,
  MINUS,
  STAR,
  SLASH,
  PERCENT,
  AMP,
  PIPE,
  CARET,
  TILDE,
  LSHIFT,
  RSHIFT,
  EQ,
  NEQ,
  LT,
  GT,
  LTE,
  GTE,
  ASSIGN,
  PLUS_ASSIGN,
  MINUS_ASSIGN,
  AND,
  OR,
  NOT,
  INC,
  DEC,
  // Delimiters
  LPAREN,
  RPAREN,
  LBRACE,
  RBRACE,
  COMMA,
  SEMICOLON,
  // Special
  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS: Record<string, TokenType> = {
  int: TokenType.INT,
  void: TokenType.VOID,
  if: TokenType.IF,
  else: TokenType.ELSE,
  while: TokenType.WHILE,
  for: TokenType.FOR,
  return: TokenType.RETURN,
};

export interface LexerError {
  line: number;
  message: string;
}

export function tokenize(source: string): {
  tokens: Token[];
  errors: LexerError[];
} {
  const tokens: Token[] = [];
  const errors: LexerError[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function peek(): string {
    return pos < source.length ? source[pos] : "\0";
  }
  function peekNext(): string {
    return pos + 1 < source.length ? source[pos + 1] : "\0";
  }
  function advance(): string {
    const ch = source[pos++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  while (pos < source.length) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Whitespace
    if (/\s/.test(ch)) {
      advance();
      continue;
    }

    // Line comment
    if (ch === "/" && peekNext() === "/") {
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    // Block comment
    if (ch === "/" && peekNext() === "*") {
      advance();
      advance();
      while (pos < source.length) {
        if (peek() === "*" && peekNext() === "/") {
          advance();
          advance();
          break;
        }
        advance();
      }
      continue;
    }

    // Preprocessor #define — skip (handled in preprocessor)
    if (ch === "#") {
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    // String literal
    if (ch === '"') {
      advance();
      let str = "";
      while (pos < source.length && peek() !== '"') {
        if (peek() === "\\") {
          advance();
          const esc = advance();
          if (esc === "n") str += "\n";
          else if (esc === "t") str += "\t";
          else if (esc === "\\") str += "\\";
          else if (esc === '"') str += '"';
          else str += esc;
        } else {
          str += advance();
        }
      }
      if (peek() === '"') advance();
      tokens.push({
        type: TokenType.STRING_LITERAL,
        value: str,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Char literal
    if (ch === "'") {
      advance();
      let charVal = "";
      if (peek() === "\\") {
        advance();
        const esc = advance();
        if (esc === "n") charVal = "\n";
        else if (esc === "t") charVal = "\t";
        else if (esc === "\\") charVal = "\\";
        else if (esc === "'") charVal = "'";
        else charVal = esc;
      } else {
        charVal = advance();
      }
      if (peek() === "'") advance();
      tokens.push({
        type: TokenType.CHAR_LITERAL,
        value: charVal,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Number (decimal or hex)
    if (/[0-9]/.test(ch)) {
      let num = "";
      if (ch === "0" && (peekNext() === "x" || peekNext() === "X")) {
        num += advance(); // '0'
        num += advance(); // 'x'
        while (/[0-9a-fA-F]/.test(peek())) num += advance();
      } else {
        while (/[0-9]/.test(peek())) num += advance();
      }
      tokens.push({
        type: TokenType.NUMBER,
        value: num,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (/[a-zA-Z0-9_]/.test(peek())) id += advance();
      const kwType = KEYWORDS[id];
      tokens.push({
        type: kwType !== undefined ? kwType : TokenType.IDENTIFIER,
        value: id,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Two-character operators
    if (ch === "+" && peekNext() === "+") {
      advance();
      advance();
      tokens.push({
        type: TokenType.INC,
        value: "++",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "-" && peekNext() === "-") {
      advance();
      advance();
      tokens.push({
        type: TokenType.DEC,
        value: "--",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "+" && peekNext() === "=") {
      advance();
      advance();
      tokens.push({
        type: TokenType.PLUS_ASSIGN,
        value: "+=",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "-" && peekNext() === "=") {
      advance();
      advance();
      tokens.push({
        type: TokenType.MINUS_ASSIGN,
        value: "-=",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "=" && peekNext() === "=") {
      advance();
      advance();
      tokens.push({
        type: TokenType.EQ,
        value: "==",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "!" && peekNext() === "=") {
      advance();
      advance();
      tokens.push({
        type: TokenType.NEQ,
        value: "!=",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "<" && peekNext() === "=") {
      advance();
      advance();
      tokens.push({
        type: TokenType.LTE,
        value: "<=",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === ">" && peekNext() === "=") {
      advance();
      advance();
      tokens.push({
        type: TokenType.GTE,
        value: ">=",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "<" && peekNext() === "<") {
      advance();
      advance();
      tokens.push({
        type: TokenType.LSHIFT,
        value: "<<",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === ">" && peekNext() === ">") {
      advance();
      advance();
      tokens.push({
        type: TokenType.RSHIFT,
        value: ">>",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "&" && peekNext() === "&") {
      advance();
      advance();
      tokens.push({
        type: TokenType.AND,
        value: "&&",
        line: startLine,
        col: startCol,
      });
      continue;
    }
    if (ch === "|" && peekNext() === "|") {
      advance();
      advance();
      tokens.push({
        type: TokenType.OR,
        value: "||",
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Single-character operators
    const singleOps: Record<string, TokenType> = {
      "+": TokenType.PLUS,
      "-": TokenType.MINUS,
      "*": TokenType.STAR,
      "/": TokenType.SLASH,
      "%": TokenType.PERCENT,
      "&": TokenType.AMP,
      "|": TokenType.PIPE,
      "^": TokenType.CARET,
      "~": TokenType.TILDE,
      "!": TokenType.NOT,
      "<": TokenType.LT,
      ">": TokenType.GT,
      "=": TokenType.ASSIGN,
      "(": TokenType.LPAREN,
      ")": TokenType.RPAREN,
      "{": TokenType.LBRACE,
      "}": TokenType.RBRACE,
      ",": TokenType.COMMA,
      ";": TokenType.SEMICOLON,
    };

    if (singleOps[ch] !== undefined) {
      advance();
      tokens.push({
        type: singleOps[ch],
        value: ch,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Unknown character
    errors.push({ line: startLine, message: `Caractère inattendu: '${ch}'` });
    advance();
  }

  tokens.push({ type: TokenType.EOF, value: "", line, col });
  return { tokens, errors };
}
