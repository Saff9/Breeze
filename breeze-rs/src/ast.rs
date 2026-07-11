//! Tokens and AST nodes.

use std::cell::RefCell;
use std::rc::Rc;

use crate::error::BreezeResult;
use crate::interpreter::Environment;

#[derive(Debug, Clone, PartialEq)]
pub enum StringPartRaw {
    Text(String),
    /// Raw source for an interpolation expression; re-parsed by the parser.
    Expr(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    Number(f64),
    String(String),
    /// Double-quoted string with at least one `{expr}` segment.
    StringParts(Vec<StringPartRaw>),
    Ident(String),
    Keyword(String),
    Op(String),
    LParen,
    RParen,
    LBracket,
    RBracket,
    Colon,
    Comma,
    Newline,
    Indent,
    Dedent,
    Eof,
}

#[derive(Debug, Clone)]
pub struct Token {
    pub kind: TokenKind,
    pub line: usize,
}

impl Token {
    pub fn new(kind: TokenKind, line: usize) -> Self {
        Self { kind, line }
    }
}

pub const KEYWORDS: &[&str] = &[
    "show", "if", "elif", "else", "while", "repeat", "from", "to", "for", "in", "func", "return",
    "break", "continue", "true", "false", "none", "and", "or", "not",
];

#[derive(Debug, Clone)]
pub enum StringPart {
    Text(String),
    Expr(Expr),
}

#[derive(Debug, Clone)]
pub enum Expr {
    Literal {
        value: Value,
        line: usize,
    },
    StringInterpolation {
        parts: Vec<StringPart>,
        line: usize,
    },
    Ident {
        name: String,
        line: usize,
    },
    List {
        elements: Vec<Expr>,
        line: usize,
    },
    Unary {
        op: String,
        operand: Box<Expr>,
        line: usize,
    },
    Binary {
        op: String,
        left: Box<Expr>,
        right: Box<Expr>,
        line: usize,
    },
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        line: usize,
    },
    Index {
        object: Box<Expr>,
        index: Box<Expr>,
        line: usize,
    },
}

impl Expr {
    pub fn line(&self) -> usize {
        match self {
            Expr::Literal { line, .. }
            | Expr::StringInterpolation { line, .. }
            | Expr::Ident { line, .. }
            | Expr::List { line, .. }
            | Expr::Unary { line, .. }
            | Expr::Binary { line, .. }
            | Expr::Call { line, .. }
            | Expr::Index { line, .. } => *line,
        }
    }
}

#[derive(Debug, Clone)]
pub enum Stmt {
    Show {
        args: Vec<Expr>,
        line: usize,
    },
    Assign {
        target: Expr,
        value: Expr,
        line: usize,
    },
    If {
        test: Expr,
        consequent: Vec<Stmt>,
        elifs: Vec<(Expr, Vec<Stmt>)>,
        alternate: Vec<Stmt>,
        line: usize,
    },
    While {
        test: Expr,
        body: Vec<Stmt>,
        line: usize,
    },
    Repeat {
        count: Expr,
        body: Vec<Stmt>,
        line: usize,
    },
    RepeatRange {
        variable: String,
        from: Expr,
        to: Expr,
        body: Vec<Stmt>,
        line: usize,
    },
    For {
        variable: String,
        iterable: Expr,
        body: Vec<Stmt>,
        line: usize,
    },
    Func {
        name: String,
        params: Vec<String>,
        body: Vec<Stmt>,
        line: usize,
    },
    Return {
        value: Option<Expr>,
        line: usize,
    },
    Break {
        line: usize,
    },
    Continue {
        line: usize,
    },
    ExprStmt {
        expr: Expr,
        line: usize,
    },
}

impl Stmt {
    pub fn line(&self) -> usize {
        match self {
            Stmt::Show { line, .. }
            | Stmt::Assign { line, .. }
            | Stmt::If { line, .. }
            | Stmt::While { line, .. }
            | Stmt::Repeat { line, .. }
            | Stmt::RepeatRange { line, .. }
            | Stmt::For { line, .. }
            | Stmt::Func { line, .. }
            | Stmt::Return { line, .. }
            | Stmt::Break { line }
            | Stmt::Continue { line }
            | Stmt::ExprStmt { line, .. } => *line,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Program {
    pub body: Vec<Stmt>,
}

#[derive(Debug, Clone)]
pub struct BreezeFunc {
    pub name: String,
    pub params: Vec<String>,
    pub body: Vec<Stmt>,
    pub closure: Rc<RefCell<Environment>>,
}

pub type BuiltinFn = fn(&[Value], usize) -> BreezeResult<Value>;

#[derive(Debug, Clone)]
pub enum Value {
    Number(f64),
    Text(String),
    Bool(bool),
    None,
    List(Vec<Value>),
    Func(Rc<BreezeFunc>),
    Builtin { name: String, f: BuiltinFn },
}

impl Value {
    pub fn type_name(&self) -> &'static str {
        match self {
            Value::Number(_) => "number",
            Value::Text(_) => "text",
            Value::Bool(_) => "boolean",
            Value::None => "none",
            Value::List(_) => "list",
            Value::Func(_) | Value::Builtin { .. } => "function",
        }
    }
}
