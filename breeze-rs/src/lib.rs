//! Breeze language runtime.

pub mod ast;
pub mod error;
pub mod interpreter;
pub mod lexer;
pub mod parser;
pub mod value;

pub use ast::{BreezeFunc, Expr, Program, Stmt, StringPart, Token, TokenKind, Value};
pub use error::{BreezeError, BreezeResult};
pub use interpreter::Interpreter;
pub use lexer::{tokenize, tokenize_expression};
pub use parser::Parser;

#[derive(Debug, Clone, Default)]
pub struct RunResult {
    pub output: Vec<String>,
    pub error: Option<BreezeError>,
    /// Multi-line error string with a source-line excerpt, for CLI printing.
    pub error_formatted: Option<String>,
}

impl RunResult {
    pub fn is_ok(&self) -> bool {
        self.error.is_none()
    }
}

/// Lex, parse, and execute a Breeze program in one call.
///
/// Errors are captured into [`RunResult::error`] rather than returned as `Err`,
/// for easy embedding in REPLs or services.
///
/// # Example
///
/// ```
/// use breeze::run;
/// let r = run("show 1 + 2");
/// assert!(r.error.is_none());
/// assert_eq!(r.output, vec!["3".to_string()]);
/// ```
pub fn run(source: &str) -> RunResult {
    match run_inner(source) {
        Ok(output) => RunResult {
            output,
            error: None,
            error_formatted: None,
        },
        Err(e) => {
            let formatted = format_error(&e, source);
            RunResult {
                output: Vec::new(),
                error: Some(e),
                error_formatted: Some(formatted),
            }
        }
    }
}

fn run_inner(source: &str) -> BreezeResult<Vec<String>> {
    let tokens = tokenize(source)?;
    let program = Parser::new(tokens).parse()?;
    let mut interp = Interpreter::new();
    interp.run(&program)
}

/// Render an error with the offending source line, e.g. `Error (line 3): ...
///     3 | show x`.
pub fn format_error(err: &BreezeError, source: &str) -> String {
    if err.line == 0 {
        return err.to_string();
    }
    let lines: Vec<&str> = source.split('\n').collect();
    let idx = err.line.saturating_sub(1);
    if idx >= lines.len() {
        return err.to_string();
    }
    let src_line = lines[idx];
    let line_num = err.line.to_string();
    // Min width 5 so the `|` aligns across single- and multi-digit line numbers.
    let aligned = format!("{:>5}", line_num);
    format!(
        "Error (line {line}): {msg}\n{aligned} | {src_line}",
        line = err.line,
        msg = err.message,
        aligned = aligned,
        src_line = src_line,
    )
}
