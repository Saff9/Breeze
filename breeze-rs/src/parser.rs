//! Recursive-descent parser.

use crate::ast::*;
use crate::error::{BreezeError, BreezeResult};
use crate::lexer::tokenize_expression;

pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    pub fn parse(mut self) -> BreezeResult<Program> {
        let mut body = Vec::new();
        self.skip_newlines();
        while !self.is_eof() {
            body.push(self.parse_statement()?);
            self.skip_newlines();
        }
        Ok(Program { body })
    }

    /// Entry point for re-parsing an interpolation expression segment.
    pub fn parse_expression_public(&mut self) -> BreezeResult<Expr> {
        self.parse_expression()
    }

    fn peek(&self, offset: usize) -> &Token {
        let idx = (self.pos + offset).min(self.tokens.len().saturating_sub(1));
        &self.tokens[idx]
    }
    fn current(&self) -> &Token {
        self.peek(0)
    }
    fn advance(&mut self) -> Token {
        let t = self.tokens[self.pos].clone();
        if self.pos < self.tokens.len() - 1 {
            self.pos += 1;
        }
        t
    }
    fn is_eof(&self) -> bool {
        matches!(self.current().kind, TokenKind::Eof)
    }
    fn is_kw(&self, kw: &str) -> bool {
        matches!(&self.current().kind, TokenKind::Keyword(k) if k == kw)
    }
    fn is_op(&self, op: &str) -> bool {
        matches!(&self.current().kind, TokenKind::Op(o) if o == op)
    }
    fn skip_newlines(&mut self) {
        while matches!(self.current().kind, TokenKind::Newline) {
            self.pos += 1;
        }
    }

    fn expect(&mut self, kind_str: &str, line: usize) -> BreezeResult<Token> {
        let tok = self.current().clone();
        let matches = matches!(
            (kind_str, &tok.kind),
            ("COLON", TokenKind::Colon)
                | ("LPAREN", TokenKind::LParen)
                | ("RPAREN", TokenKind::RParen)
                | ("LBRACKET", TokenKind::LBracket)
                | ("RBRACKET", TokenKind::RBracket)
                | ("COMMA", TokenKind::Comma)
                | ("NEWLINE", TokenKind::Newline)
                | ("INDENT", TokenKind::Indent)
                | ("DEDENT", TokenKind::Dedent)
                | ("EOF", TokenKind::Eof)
                | ("IDENT", TokenKind::Ident(_))
        );
        if !matches {
            let got = describe_token(&tok);
            return Err(BreezeError::new(
                format!("Expected {kind_str} but found {got}"),
                line,
            ));
        }
        Ok(self.advance())
    }

    fn expect_kw(&mut self, kw: &str) -> BreezeResult<Token> {
        if !self.is_kw(kw) {
            let tok = self.current().clone();
            let got = describe_token(&tok);
            return Err(BreezeError::new(
                format!("Expected '{kw}' but found {got}"),
                tok.line,
            ));
        }
        Ok(self.advance())
    }

    fn parse_statement(&mut self) -> BreezeResult<Stmt> {
        let tok = self.current().clone();
        if let TokenKind::Keyword(k) = &tok.kind {
            match k.as_str() {
                "show" => return self.parse_show(),
                "if" => return self.parse_if(),
                "while" => return self.parse_while(),
                "repeat" => return self.parse_repeat(),
                "for" => return self.parse_for(),
                "func" => return self.parse_func(),
                "return" => return self.parse_return(),
                "break" => {
                    let line = self.advance().line;
                    return Ok(Stmt::Break { line });
                }
                "continue" => {
                    let line = self.advance().line;
                    return Ok(Stmt::Continue { line });
                }
                _ => {}
            }
        }
        let expr = self.parse_expression()?;
        if self.is_op("=") {
            let line = self.advance().line;
            let value = self.parse_expression()?;
            return Ok(Stmt::Assign {
                target: expr,
                value,
                line,
            });
        }
        Ok(Stmt::ExprStmt {
            expr,
            line: tok.line,
        })
    }

    fn parse_show(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("show")?;
        let mut args = vec![self.parse_expression()?];
        while matches!(self.current().kind, TokenKind::Comma) {
            self.advance();
            args.push(self.parse_expression()?);
        }
        Ok(Stmt::Show {
            args,
            line: tok.line,
        })
    }

    fn parse_if(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("if")?;
        let test = self.parse_expression()?;
        self.expect("COLON", tok.line)?;
        let consequent = self.parse_block_or_inline()?;
        let mut elifs: Vec<(Expr, Vec<Stmt>)> = Vec::new();
        let mut alternate = Vec::new();

        // Skip newlines so both inline-form and block-form if/elif chains parse.
        loop {
            self.skip_newlines();
            if self.is_kw("elif") {
                self.advance();
                let elif_test = self.parse_expression()?;
                self.expect("COLON", self.current().line)?;
                let elif_body = self.parse_block_or_inline()?;
                elifs.push((elif_test, elif_body));
                continue;
            }
            break;
        }
        self.skip_newlines();
        if self.is_kw("else") {
            self.advance();
            self.expect("COLON", self.current().line)?;
            alternate = self.parse_block_or_inline()?;
        }
        Ok(Stmt::If {
            test,
            consequent,
            elifs,
            alternate,
            line: tok.line,
        })
    }

    fn parse_while(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("while")?;
        let test = self.parse_expression()?;
        self.expect("COLON", tok.line)?;
        let body = self.parse_block_or_inline()?;
        Ok(Stmt::While {
            test,
            body,
            line: tok.line,
        })
    }

    fn parse_repeat(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("repeat")?;
        let is_range = matches!(&self.peek(0).kind, TokenKind::Ident(_))
            && matches!(&self.peek(1).kind, TokenKind::Keyword(k) if k == "from");
        if is_range {
            let var_tok = self.advance();
            let variable = match var_tok.kind {
                TokenKind::Ident(s) => s,
                _ => unreachable!(),
            };
            self.expect_kw("from")?;
            let from = self.parse_expression()?;
            self.expect_kw("to")?;
            let to = self.parse_expression()?;
            self.expect("COLON", tok.line)?;
            let body = self.parse_block_or_inline()?;
            return Ok(Stmt::RepeatRange {
                variable,
                from,
                to,
                body,
                line: tok.line,
            });
        }
        let count = self.parse_expression()?;
        self.expect("COLON", tok.line)?;
        let body = self.parse_block_or_inline()?;
        Ok(Stmt::Repeat {
            count,
            body,
            line: tok.line,
        })
    }

    fn parse_for(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("for")?;
        let var_tok = self.advance();
        let variable = match var_tok.kind {
            TokenKind::Ident(s) => s,
            _ => {
                return Err(BreezeError::new(
                    format!("Expected a name but found {}", describe_token(&var_tok)),
                    var_tok.line,
                ))
            }
        };
        self.expect_kw("in")?;
        let iterable = self.parse_expression()?;
        self.expect("COLON", tok.line)?;
        let body = self.parse_block_or_inline()?;
        Ok(Stmt::For {
            variable,
            iterable,
            body,
            line: tok.line,
        })
    }

    fn parse_func(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("func")?;
        let name_tok = self.advance();
        let name = match name_tok.kind {
            TokenKind::Ident(s) => s,
            _ => {
                return Err(BreezeError::new(
                    format!(
                        "Expected a function name but found {}",
                        describe_token(&name_tok)
                    ),
                    name_tok.line,
                ))
            }
        };
        self.expect("LPAREN", tok.line)?;
        let mut params = Vec::new();
        if !matches!(self.current().kind, TokenKind::RParen) {
            let p = self.advance();
            params.push(match p.kind {
                TokenKind::Ident(s) => s,
                _ => {
                    return Err(BreezeError::new(
                        format!("Expected a parameter name but found {}", describe_token(&p)),
                        p.line,
                    ))
                }
            });
            while matches!(self.current().kind, TokenKind::Comma) {
                self.advance();
                let p = self.advance();
                params.push(match p.kind {
                    TokenKind::Ident(s) => s,
                    _ => {
                        return Err(BreezeError::new(
                            format!("Expected a parameter name but found {}", describe_token(&p)),
                            p.line,
                        ))
                    }
                });
            }
        }
        self.expect("RPAREN", tok.line)?;
        self.expect("COLON", tok.line)?;
        let body = self.parse_block_or_inline()?;
        Ok(Stmt::Func {
            name,
            params,
            body,
            line: tok.line,
        })
    }

    fn parse_return(&mut self) -> BreezeResult<Stmt> {
        let tok = self.expect_kw("return")?;
        if matches!(
            self.current().kind,
            TokenKind::Newline | TokenKind::Dedent | TokenKind::Eof
        ) {
            return Ok(Stmt::Return {
                value: None,
                line: tok.line,
            });
        }
        let value = self.parse_expression()?;
        Ok(Stmt::Return {
            value: Some(value),
            line: tok.line,
        })
    }

    fn parse_block_or_inline(&mut self) -> BreezeResult<Vec<Stmt>> {
        if !matches!(self.current().kind, TokenKind::Newline) {
            return Ok(vec![self.parse_statement()?]);
        }
        self.expect("NEWLINE", self.current().line)?;
        self.skip_newlines();
        self.expect("INDENT", self.current().line)?;

        let mut stmts = Vec::new();
        self.skip_newlines();
        while !matches!(self.current().kind, TokenKind::Dedent | TokenKind::Eof) {
            stmts.push(self.parse_statement()?);
            self.skip_newlines();
        }
        if !self.is_eof() {
            self.expect("DEDENT", self.current().line)?;
        }
        Ok(stmts)
    }

    fn parse_expression(&mut self) -> BreezeResult<Expr> {
        self.parse_or()
    }

    fn parse_or(&mut self) -> BreezeResult<Expr> {
        let mut left = self.parse_and()?;
        while self.is_kw("or") {
            let line = self.advance().line;
            let right = self.parse_and()?;
            left = Expr::Binary {
                op: "or".into(),
                left: Box::new(left),
                right: Box::new(right),
                line,
            };
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> BreezeResult<Expr> {
        let mut left = self.parse_not()?;
        while self.is_kw("and") {
            let line = self.advance().line;
            let right = self.parse_not()?;
            left = Expr::Binary {
                op: "and".into(),
                left: Box::new(left),
                right: Box::new(right),
                line,
            };
        }
        Ok(left)
    }

    fn parse_not(&mut self) -> BreezeResult<Expr> {
        if self.is_kw("not") {
            let line = self.advance().line;
            let operand = self.parse_not()?;
            return Ok(Expr::Unary {
                op: "not".into(),
                operand: Box::new(operand),
                line,
            });
        }
        self.parse_comparison()
    }

    fn parse_comparison(&mut self) -> BreezeResult<Expr> {
        let mut left = self.parse_addition()?;
        loop {
            let op = match &self.current().kind {
                TokenKind::Op(o) if matches!(o.as_str(), "==" | "!=" | "<" | ">" | "<=" | ">=") => {
                    o.clone()
                }
                _ => break,
            };
            let line = self.advance().line;
            let right = self.parse_addition()?;
            left = Expr::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
                line,
            };
        }
        Ok(left)
    }

    fn parse_addition(&mut self) -> BreezeResult<Expr> {
        let mut left = self.parse_multiplication()?;
        loop {
            let op = match &self.current().kind {
                TokenKind::Op(o) if matches!(o.as_str(), "+" | "-") => o.clone(),
                _ => break,
            };
            let line = self.advance().line;
            let right = self.parse_multiplication()?;
            left = Expr::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
                line,
            };
        }
        Ok(left)
    }

    fn parse_multiplication(&mut self) -> BreezeResult<Expr> {
        let mut left = self.parse_unary()?;
        loop {
            let op = match &self.current().kind {
                TokenKind::Op(o) if matches!(o.as_str(), "*" | "/" | "%") => o.clone(),
                _ => break,
            };
            let line = self.advance().line;
            let right = self.parse_unary()?;
            left = Expr::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
                line,
            };
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> BreezeResult<Expr> {
        if self.is_op("-") {
            let line = self.advance().line;
            let operand = self.parse_unary()?;
            return Ok(Expr::Unary {
                op: "-".into(),
                operand: Box::new(operand),
                line,
            });
        }
        self.parse_postfix()
    }

    fn parse_postfix(&mut self) -> BreezeResult<Expr> {
        let mut expr = self.parse_primary()?;
        loop {
            match &self.current().kind {
                TokenKind::LParen => {
                    let line = self.advance().line;
                    let mut args = Vec::new();
                    if !matches!(self.current().kind, TokenKind::RParen) {
                        args.push(self.parse_expression()?);
                        while matches!(self.current().kind, TokenKind::Comma) {
                            self.advance();
                            args.push(self.parse_expression()?);
                        }
                    }
                    self.expect("RPAREN", line)?;
                    expr = Expr::Call {
                        callee: Box::new(expr),
                        args,
                        line,
                    };
                }
                TokenKind::LBracket => {
                    let line = self.advance().line;
                    let index = self.parse_expression()?;
                    self.expect("RBRACKET", line)?;
                    expr = Expr::Index {
                        object: Box::new(expr),
                        index: Box::new(index),
                        line,
                    };
                }
                _ => break,
            }
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> BreezeResult<Expr> {
        let tok = self.current().clone();
        match &tok.kind {
            TokenKind::Number(n) => {
                self.advance();
                Ok(Expr::Literal {
                    value: Value::Number(*n),
                    line: tok.line,
                })
            }
            TokenKind::String(s) => {
                self.advance();
                Ok(Expr::Literal {
                    value: Value::Text(s.clone()),
                    line: tok.line,
                })
            }
            TokenKind::StringParts(parts) => {
                self.advance();
                let mut out = Vec::with_capacity(parts.len());
                for p in parts {
                    match p {
                        StringPartRaw::Text(t) => out.push(StringPart::Text(t.clone())),
                        StringPartRaw::Expr(src) => {
                            let sub_tokens = tokenize_expression(src, tok.line)?;
                            let mut sub_parser = Parser::new(sub_tokens);
                            let expr = sub_parser.parse_expression_public()?;
                            // Stray trailing tokens mean malformed input.
                            if !matches!(sub_parser.current().kind, TokenKind::Eof) {
                                return Err(BreezeError::new(
                                    format!("Malformed interpolation expression '{{{src}}}'"),
                                    tok.line,
                                ));
                            }
                            out.push(StringPart::Expr(expr));
                        }
                    }
                }
                Ok(Expr::StringInterpolation {
                    parts: out,
                    line: tok.line,
                })
            }
            TokenKind::Keyword(k) => match k.as_str() {
                "true" => {
                    self.advance();
                    Ok(Expr::Literal {
                        value: Value::Bool(true),
                        line: tok.line,
                    })
                }
                "false" => {
                    self.advance();
                    Ok(Expr::Literal {
                        value: Value::Bool(false),
                        line: tok.line,
                    })
                }
                "none" => {
                    self.advance();
                    Ok(Expr::Literal {
                        value: Value::None,
                        line: tok.line,
                    })
                }
                _ => Err(BreezeError::new(
                    format!("Unexpected keyword '{k}' in expression"),
                    tok.line,
                )),
            },
            TokenKind::Ident(name) => {
                self.advance();
                Ok(Expr::Ident {
                    name: name.clone(),
                    line: tok.line,
                })
            }
            TokenKind::LParen => {
                self.advance();
                let expr = self.parse_expression()?;
                self.expect("RPAREN", tok.line)?;
                Ok(expr)
            }
            TokenKind::LBracket => {
                self.advance();
                let mut elements = Vec::new();
                if !matches!(self.current().kind, TokenKind::RBracket) {
                    elements.push(self.parse_expression()?);
                    while matches!(self.current().kind, TokenKind::Comma) {
                        self.advance();
                        elements.push(self.parse_expression()?);
                    }
                }
                self.expect("RBRACKET", tok.line)?;
                Ok(Expr::List {
                    elements,
                    line: tok.line,
                })
            }
            _ => Err(BreezeError::new(
                format!("Unexpected {} in expression", describe_token(&tok)),
                tok.line,
            )),
        }
    }
}

fn describe_token(tok: &Token) -> String {
    match &tok.kind {
        TokenKind::Number(n) => format!("number {n}"),
        TokenKind::String(_) => "text".to_string(),
        TokenKind::StringParts(_) => "interpolated text".to_string(),
        TokenKind::Ident(s) => format!("name '{s}'"),
        TokenKind::Keyword(k) => format!("keyword '{k}'"),
        TokenKind::Op(o) => format!("'{o}'"),
        TokenKind::LParen => "'('".to_string(),
        TokenKind::RParen => "')'".to_string(),
        TokenKind::LBracket => "'['".to_string(),
        TokenKind::RBracket => "']'".to_string(),
        TokenKind::Colon => "':'".to_string(),
        TokenKind::Comma => "','".to_string(),
        TokenKind::Newline => "end of line".to_string(),
        TokenKind::Indent => "indent".to_string(),
        TokenKind::Dedent => "dedent".to_string(),
        TokenKind::Eof => "end of file".to_string(),
    }
}
