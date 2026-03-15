/**
 * Recursive descent parser for the simple C language.
 *
 * Produces an AST from a token stream.
 * Supports: functions, globals, if/else, while, for, return,
 *           binary/unary operators with precedence, function calls.
 */

import { TokenType, type Token } from "./lexer";

// ─── AST Node Types ───

export interface Program {
  kind: "Program";
  globals: VarDecl[];
  functions: FunctionDecl[];
}

export interface FunctionDecl {
  kind: "FunctionDecl";
  name: string;
  params: { name: string }[];
  returnType: "int" | "void";
  body: Block;
  line: number;
}

export interface VarDecl {
  kind: "VarDecl";
  name: string;
  initializer: Expr | null;
  line: number;
}

export interface Block {
  kind: "Block";
  statements: Stmt[];
  line: number;
}

export type Stmt =
  | VarDecl
  | IfStmt
  | WhileStmt
  | ForStmt
  | ReturnStmt
  | BreakStmt
  | ContinueStmt
  | ExprStmt
  | Block;

export interface IfStmt {
  kind: "IfStmt";
  condition: Expr;
  thenBranch: Stmt;
  elseBranch: Stmt | null;
  line: number;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expr;
  body: Stmt;
  line: number;
}

export interface ForStmt {
  kind: "ForStmt";
  init: Stmt | null;
  condition: Expr | null;
  update: Expr | null;
  body: Stmt;
  line: number;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  value: Expr | null;
  line: number;
}

export interface BreakStmt {
  kind: "BreakStmt";
  line: number;
}

export interface ContinueStmt {
  kind: "ContinueStmt";
  line: number;
}

export interface ExprStmt {
  kind: "ExprStmt";
  expression: Expr;
  line: number;
}

export type Expr =
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | AssignExpr
  | CompoundAssignExpr
  | NumberLiteral
  | CharLiteral
  | StringLiteral
  | Identifier
  | PostfixExpr;

export interface BinaryExpr {
  kind: "BinaryExpr";
  op: string;
  left: Expr;
  right: Expr;
  line: number;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  op: string;
  operand: Expr;
  line: number;
}

export interface PostfixExpr {
  kind: "PostfixExpr";
  op: string; // "++" or "--"
  operand: Expr;
  line: number;
}

export interface CallExpr {
  kind: "CallExpr";
  name: string;
  args: Expr[];
  line: number;
}

export interface AssignExpr {
  kind: "AssignExpr";
  name: string;
  value: Expr;
  line: number;
}

export interface CompoundAssignExpr {
  kind: "CompoundAssignExpr";
  op: string; // "+=" or "-="
  name: string;
  value: Expr;
  line: number;
}

export interface NumberLiteral {
  kind: "NumberLiteral";
  value: number;
  line: number;
}

export interface CharLiteral {
  kind: "CharLiteral";
  value: number; // char code
  line: number;
}

export interface StringLiteral {
  kind: "StringLiteral";
  value: string;
  line: number;
}

export interface Identifier {
  kind: "Identifier";
  name: string;
  line: number;
}

export interface ParseError {
  line: number;
  message: string;
}

// ─── Parser ───

export function parse(tokens: Token[]): {
  program: Program;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];
  let pos = 0;

  function peek(): Token {
    return tokens[pos] || { type: TokenType.EOF, value: "", line: 0, col: 0 };
  }

  function advance(): Token {
    return (
      tokens[pos++] || {
        type: TokenType.EOF,
        value: "",
        line: 0,
        col: 0,
      }
    );
  }

  function check(type: TokenType): boolean {
    return peek().type === type;
  }

  function match(type: TokenType): boolean {
    if (check(type)) {
      advance();
      return true;
    }
    return false;
  }

  function expect(type: TokenType, msg: string): Token {
    if (check(type)) return advance();
    const t = peek();
    errors.push({
      line: t.line,
      message: `${msg} (reçu: "${t.value || TokenType[t.type]}")`,
    });
    return t;
  }

  // ─── Top-level parsing ───

  function parseProgram(): Program {
    const globals: VarDecl[] = [];
    const functions: FunctionDecl[] = [];

    while (!check(TokenType.EOF)) {
      // Skip preprocessor directives (already handled)
      if (peek().value === "#") {
        while (!check(TokenType.EOF) && peek().line === peek().line) advance();
        continue;
      }

      // Expect type: int or void
      if (check(TokenType.INT) || check(TokenType.VOID)) {
        const typeToken = advance();
        const returnType = typeToken.value as "int" | "void";

        if (!check(TokenType.IDENTIFIER)) {
          errors.push({
            line: peek().line,
            message: "Nom attendu après le type",
          });
          advance();
          continue;
        }
        const nameToken = advance();

        // Function: int/void name(...)
        if (check(TokenType.LPAREN)) {
          functions.push(parseFunctionDecl(returnType, nameToken));
        } else {
          // Global variable: int name = expr;
          let initializer: Expr | null = null;
          if (match(TokenType.ASSIGN)) {
            initializer = parseExpression();
          }
          expect(TokenType.SEMICOLON, "';' attendu après déclaration globale");
          globals.push({
            kind: "VarDecl",
            name: nameToken.value,
            initializer,
            line: nameToken.line,
          });
        }
      } else {
        errors.push({
          line: peek().line,
          message: `Déclaration attendue (reçu: "${peek().value}")`,
        });
        advance();
      }
    }

    return { kind: "Program", globals, functions };
  }

  function parseFunctionDecl(
    returnType: "int" | "void",
    nameToken: Token,
  ): FunctionDecl {
    expect(TokenType.LPAREN, "'(' attendu");
    const params: { name: string }[] = [];

    if (!check(TokenType.RPAREN)) {
      do {
        expect(TokenType.INT, "'int' attendu pour paramètre");
        const paramName = expect(
          TokenType.IDENTIFIER,
          "Nom de paramètre attendu",
        );
        params.push({ name: paramName.value });
      } while (match(TokenType.COMMA));
    }

    expect(TokenType.RPAREN, "')' attendu");
    const body = parseBlock();

    return {
      kind: "FunctionDecl",
      name: nameToken.value,
      params,
      returnType,
      body,
      line: nameToken.line,
    };
  }

  // ─── Statement parsing ───

  function parseBlock(): Block {
    const bLine = peek().line;
    expect(TokenType.LBRACE, "'{' attendu");
    const statements: Stmt[] = [];
    while (!check(TokenType.RBRACE) && !check(TokenType.EOF)) {
      statements.push(parseStatement());
    }
    expect(TokenType.RBRACE, "'}' attendu");
    return { kind: "Block", statements, line: bLine };
  }

  function parseStatement(): Stmt {
    // Block
    if (check(TokenType.LBRACE)) return parseBlock();

    // Variable declaration
    if (check(TokenType.INT)) {
      return parseVarDecl();
    }

    // If
    if (check(TokenType.IF)) return parseIfStmt();

    // While
    if (check(TokenType.WHILE)) return parseWhileStmt();

    // For
    if (check(TokenType.FOR)) return parseForStmt();

    // Return
    if (check(TokenType.RETURN)) return parseReturnStmt();

    // Break
    if (check(TokenType.BREAK)) {
      const tok = advance();
      expect(TokenType.SEMICOLON, "';' attendu après 'break'");
      return { kind: "BreakStmt", line: tok.line } as BreakStmt;
    }

    // Continue
    if (check(TokenType.CONTINUE)) {
      const tok = advance();
      expect(TokenType.SEMICOLON, "';' attendu après 'continue'");
      return { kind: "ContinueStmt", line: tok.line } as ContinueStmt;
    }

    // Expression statement
    return parseExprStmt();
  }

  function parseVarDecl(): VarDecl {
    const tok = advance(); // consume 'int'
    const nameToken = expect(TokenType.IDENTIFIER, "Nom de variable attendu");
    let initializer: Expr | null = null;
    if (match(TokenType.ASSIGN)) {
      initializer = parseExpression();
    }
    expect(TokenType.SEMICOLON, "';' attendu après déclaration");
    return {
      kind: "VarDecl",
      name: nameToken.value,
      initializer,
      line: tok.line,
    };
  }

  function parseIfStmt(): IfStmt {
    const tok = advance(); // consume 'if'
    expect(TokenType.LPAREN, "'(' attendu après 'if'");
    const condition = parseExpression();
    expect(TokenType.RPAREN, "')' attendu");
    const thenBranch = parseStatement();
    let elseBranch: Stmt | null = null;
    if (match(TokenType.ELSE)) {
      elseBranch = parseStatement();
    }
    return {
      kind: "IfStmt",
      condition,
      thenBranch,
      elseBranch,
      line: tok.line,
    };
  }

  function parseWhileStmt(): WhileStmt {
    const tok = advance(); // consume 'while'
    expect(TokenType.LPAREN, "'(' attendu après 'while'");
    const condition = parseExpression();
    expect(TokenType.RPAREN, "')' attendu");
    const body = parseStatement();
    return { kind: "WhileStmt", condition, body, line: tok.line };
  }

  function parseForStmt(): ForStmt {
    const tok = advance(); // consume 'for'
    expect(TokenType.LPAREN, "'(' attendu après 'for'");

    // Init
    let init: Stmt | null = null;
    if (check(TokenType.INT)) {
      init = parseVarDecl();
    } else if (!check(TokenType.SEMICOLON)) {
      init = {
        kind: "ExprStmt",
        expression: parseExpression(),
        line: peek().line,
      };
      expect(TokenType.SEMICOLON, "';' attendu dans 'for'");
    } else {
      advance(); // consume ';'
    }

    // Condition
    let condition: Expr | null = null;
    if (!check(TokenType.SEMICOLON)) {
      condition = parseExpression();
    }
    expect(TokenType.SEMICOLON, "';' attendu dans 'for'");

    // Update
    let update: Expr | null = null;
    if (!check(TokenType.RPAREN)) {
      update = parseExpression();
    }
    expect(TokenType.RPAREN, "')' attendu");

    const body = parseStatement();
    return { kind: "ForStmt", init, condition, update, body, line: tok.line };
  }

  function parseReturnStmt(): ReturnStmt {
    const tok = advance(); // consume 'return'
    let value: Expr | null = null;
    if (!check(TokenType.SEMICOLON)) {
      value = parseExpression();
    }
    expect(TokenType.SEMICOLON, "';' attendu après 'return'");
    return { kind: "ReturnStmt", value, line: tok.line };
  }

  function parseExprStmt(): ExprStmt {
    const expr = parseExpression();
    expect(TokenType.SEMICOLON, "';' attendu après expression");
    return { kind: "ExprStmt", expression: expr, line: expr.line };
  }

  // ─── Expression parsing with precedence ───

  function parseExpression(): Expr {
    return parseAssignment();
  }

  function parseAssignment(): Expr {
    const expr = parseOr();

    // Check for assignment: identifier = expr
    if (check(TokenType.ASSIGN) && expr.kind === "Identifier") {
      advance();
      const value = parseAssignment(); // right-associative
      return {
        kind: "AssignExpr",
        name: expr.name,
        value,
        line: expr.line,
      };
    }

    // Compound assignment: x += expr, x -= expr
    if (
      (check(TokenType.PLUS_ASSIGN) || check(TokenType.MINUS_ASSIGN)) &&
      expr.kind === "Identifier"
    ) {
      const opTok = advance();
      const value = parseAssignment();
      return {
        kind: "CompoundAssignExpr",
        op: opTok.value,
        name: expr.name,
        value,
        line: expr.line,
      };
    }

    return expr;
  }

  function parseOr(): Expr {
    let left = parseAnd();
    while (check(TokenType.OR)) {
      const op = advance();
      const right = parseAnd();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseAnd(): Expr {
    let left = parseBitOr();
    while (check(TokenType.AND)) {
      const op = advance();
      const right = parseBitOr();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseBitOr(): Expr {
    let left = parseBitXor();
    while (check(TokenType.PIPE)) {
      const op = advance();
      const right = parseBitXor();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseBitXor(): Expr {
    let left = parseBitAnd();
    while (check(TokenType.CARET)) {
      const op = advance();
      const right = parseBitAnd();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseBitAnd(): Expr {
    let left = parseEquality();
    while (check(TokenType.AMP)) {
      const op = advance();
      const right = parseEquality();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseEquality(): Expr {
    let left = parseComparison();
    while (check(TokenType.EQ) || check(TokenType.NEQ)) {
      const op = advance();
      const right = parseComparison();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseComparison(): Expr {
    let left = parseShift();
    while (
      check(TokenType.LT) ||
      check(TokenType.GT) ||
      check(TokenType.LTE) ||
      check(TokenType.GTE)
    ) {
      const op = advance();
      const right = parseShift();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseShift(): Expr {
    let left = parseAdditive();
    while (check(TokenType.LSHIFT) || check(TokenType.RSHIFT)) {
      const op = advance();
      const right = parseAdditive();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseAdditive(): Expr {
    let left = parseMultiplicative();
    while (check(TokenType.PLUS) || check(TokenType.MINUS)) {
      const op = advance();
      const right = parseMultiplicative();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseMultiplicative(): Expr {
    let left = parseUnary();
    while (
      check(TokenType.STAR) ||
      check(TokenType.SLASH) ||
      check(TokenType.PERCENT)
    ) {
      const op = advance();
      const right = parseUnary();
      left = { kind: "BinaryExpr", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseUnary(): Expr {
    // Prefix: -, !, ~, ++, --
    if (
      check(TokenType.MINUS) ||
      check(TokenType.NOT) ||
      check(TokenType.TILDE)
    ) {
      const op = advance();
      const operand = parseUnary();
      return { kind: "UnaryExpr", op: op.value, operand, line: op.line };
    }
    if (check(TokenType.INC) || check(TokenType.DEC)) {
      const op = advance();
      const operand = parseUnary();
      return { kind: "UnaryExpr", op: op.value, operand, line: op.line };
    }
    return parsePostfix();
  }

  function parsePostfix(): Expr {
    let expr = parsePrimary();
    // Postfix: ++, --
    while (check(TokenType.INC) || check(TokenType.DEC)) {
      const op = advance();
      expr = {
        kind: "PostfixExpr",
        op: op.value,
        operand: expr,
        line: op.line,
      };
    }
    return expr;
  }

  function parsePrimary(): Expr {
    const tok = peek();

    // Number
    if (check(TokenType.NUMBER)) {
      advance();
      let val: number;
      if (tok.value.startsWith("0x") || tok.value.startsWith("0X")) {
        val = parseInt(tok.value, 16);
      } else {
        val = parseInt(tok.value, 10);
      }
      return { kind: "NumberLiteral", value: val & 0xff, line: tok.line };
    }

    // Char literal
    if (check(TokenType.CHAR_LITERAL)) {
      advance();
      return {
        kind: "CharLiteral",
        value: tok.value.charCodeAt(0) & 0xff,
        line: tok.line,
      };
    }

    // String literal
    if (check(TokenType.STRING_LITERAL)) {
      advance();
      return { kind: "StringLiteral", value: tok.value, line: tok.line };
    }

    // Identifier or function call
    if (check(TokenType.IDENTIFIER)) {
      advance();
      // Check for function call: name(...)
      if (check(TokenType.LPAREN)) {
        advance();
        const args: Expr[] = [];
        if (!check(TokenType.RPAREN)) {
          do {
            args.push(parseExpression());
          } while (match(TokenType.COMMA));
        }
        expect(TokenType.RPAREN, "')' attendu après arguments");
        return {
          kind: "CallExpr",
          name: tok.value,
          args,
          line: tok.line,
        };
      }
      return { kind: "Identifier", name: tok.value, line: tok.line };
    }

    // Parenthesized expression
    if (check(TokenType.LPAREN)) {
      advance();
      const expr = parseExpression();
      expect(TokenType.RPAREN, "')' attendu");
      return expr;
    }

    errors.push({
      line: tok.line,
      message: `Expression attendue (reçu: "${tok.value || TokenType[tok.type]}")`,
    });
    advance();
    return { kind: "NumberLiteral", value: 0, line: tok.line };
  }

  const program = parseProgram();
  return { program, errors };
}
