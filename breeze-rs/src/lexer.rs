//! Lexer.

use crate::ast::KEYWORDS;
use crate::ast::{StringPartRaw, Token, TokenKind};
use crate::error::{BreezeError, BreezeResult};

fn is_digit(c: char) -> bool {
    c.is_ascii_digit()
}
fn is_alpha(c: char) -> bool {
    c.is_ascii_alphabetic() || c == '_'
}
fn is_alnum(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

pub fn tokenize(source: &str) -> BreezeResult<Vec<Token>> {
    let normalised = source.replace('\t', "  ");
    let lines: Vec<&str> = normalised.split('\n').collect();
    let mut tokens: Vec<Token> = Vec::new();
    let mut indent_stack: Vec<usize> = vec![0];

    for (idx, raw) in lines.iter().enumerate() {
        let line_no = idx + 1;
        let trimmed = raw.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let indent = raw.len() - raw.trim_start().len();
        let current = *indent_stack.last().unwrap();

        if indent > current {
            indent_stack.push(indent);
            tokens.push(Token::new(TokenKind::Indent, line_no));
        } else if indent < current {
            while indent_stack.len() > 1 && *indent_stack.last().unwrap() > indent {
                indent_stack.pop();
                tokens.push(Token::new(TokenKind::Dedent, line_no));
            }
            if *indent_stack.last().unwrap() != indent {
                return Err(BreezeError::new(
                    "Inconsistent indentation — does not match any previous level",
                    line_no,
                ));
            }
        }

        tokenize_line(&raw[indent..], line_no, &mut tokens)?;
        tokens.push(Token::new(TokenKind::Newline, line_no));
    }

    while indent_stack.len() > 1 {
        indent_stack.pop();
        tokens.push(Token::new(TokenKind::Dedent, lines.len()));
    }

    tokens.push(Token::new(TokenKind::Eof, lines.len()));
    Ok(tokens)
}

/// Tokenize a raw expression source for the parser to re-parse inside an
/// interpolated string segment.
pub fn tokenize_expression(src: &str, line: usize) -> BreezeResult<Vec<Token>> {
    let mut tokens: Vec<Token> = Vec::new();
    tokenize_line(src, line, &mut tokens)?;
    tokens.push(Token::new(TokenKind::Eof, line));
    Ok(tokens)
}

fn tokenize_line(src: &str, line: usize, tokens: &mut Vec<Token>) -> BreezeResult<()> {
    let chars: Vec<char> = src.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        if c == ' ' {
            i += 1;
            continue;
        }

        if c == '#' {
            break;
        }

        // Double-quoted strings allow `{expr}` interpolation; single-quoted are literal.
        if c == '"' || c == '\'' {
            let quote = c;
            let interpolate = quote == '"';
            let mut parts: Vec<StringPartRaw> = Vec::new();
            let mut current = String::new();
            let mut has_expr = false;
            i += 1;
            while i < chars.len() && chars[i] != quote {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    let next = chars[i + 1];
                    match next {
                        'n' => current.push('\n'),
                        't' => current.push('\t'),
                        'r' => current.push('\r'),
                        '\\' => current.push('\\'),
                        q if q == quote => current.push(quote),
                        '{' if interpolate => current.push('{'),
                        '}' if interpolate => current.push('}'),
                        other => current.push(other),
                    }
                    i += 2;
                } else if interpolate && chars[i] == '{' {
                    // Capture raw expression source up to the matching `}`,
                    // tracking nested braces so `{f(a, b)}` and `{[1, 2]}` work.
                    parts.push(StringPartRaw::Text(std::mem::take(&mut current)));
                    has_expr = true;
                    i += 1;
                    let mut depth: i32 = 1;
                    let mut expr_src = String::new();
                    while i < chars.len() && depth > 0 {
                        if chars[i] == '{' {
                            depth += 1;
                            expr_src.push('{');
                        } else if chars[i] == '}' {
                            depth -= 1;
                            if depth == 0 {
                                break;
                            }
                            expr_src.push('}');
                        } else {
                            expr_src.push(chars[i]);
                        }
                        i += 1;
                    }
                    if i >= chars.len() {
                        return Err(BreezeError::new(
                            "Unterminated interpolation — missing closing '}' in string",
                            line,
                        ));
                    }
                    i += 1;
                    parts.push(StringPartRaw::Expr(expr_src));
                } else {
                    current.push(chars[i]);
                    i += 1;
                }
            }
            if i >= chars.len() {
                return Err(BreezeError::new(
                    "Unterminated string — missing closing quote",
                    line,
                ));
            }
            i += 1;
            if interpolate && has_expr {
                parts.push(StringPartRaw::Text(current));
                tokens.push(Token::new(TokenKind::StringParts(parts), line));
            } else {
                tokens.push(Token::new(TokenKind::String(current), line));
            }
            continue;
        }

        if is_digit(c) || (c == '.' && i + 1 < chars.len() && is_digit(chars[i + 1])) {
            let mut num = String::new();
            let mut has_dot = false;
            while i < chars.len() && (is_digit(chars[i]) || chars[i] == '.') {
                if chars[i] == '.' {
                    if has_dot {
                        break;
                    }
                    has_dot = true;
                }
                num.push(chars[i]);
                i += 1;
            }
            let val: f64 = num
                .parse()
                .map_err(|_| BreezeError::new(format!("Invalid number '{num}'"), line))?;
            tokens.push(Token::new(TokenKind::Number(val), line));
            continue;
        }

        if is_alpha(c) {
            let mut ident = String::new();
            while i < chars.len() && is_alnum(chars[i]) {
                ident.push(chars[i]);
                i += 1;
            }
            if KEYWORDS.contains(&ident.as_str()) {
                tokens.push(Token::new(TokenKind::Keyword(ident), line));
            } else {
                tokens.push(Token::new(TokenKind::Ident(ident), line));
            }
            continue;
        }

        if i + 1 < chars.len() {
            let two: String = chars[i..=i + 1].iter().collect();
            if matches!(two.as_str(), "==" | "!=" | "<=" | ">=") {
                tokens.push(Token::new(TokenKind::Op(two), line));
                i += 2;
                continue;
            }
        }

        if "+-*/%<>=".contains(c) {
            tokens.push(Token::new(TokenKind::Op(c.to_string()), line));
            i += 1;
            continue;
        }

        match c {
            '(' => tokens.push(Token::new(TokenKind::LParen, line)),
            ')' => tokens.push(Token::new(TokenKind::RParen, line)),
            '[' => tokens.push(Token::new(TokenKind::LBracket, line)),
            ']' => tokens.push(Token::new(TokenKind::RBracket, line)),
            ':' => tokens.push(Token::new(TokenKind::Colon, line)),
            ',' => tokens.push(Token::new(TokenKind::Comma, line)),
            _ => {
                return Err(BreezeError::new(
                    format!("Unexpected character '{c}'"),
                    line,
                ));
            }
        }
        i += 1;
    }

    Ok(())
}
