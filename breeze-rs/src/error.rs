//! Error types.

use std::fmt;

#[derive(Debug, Clone)]
pub struct BreezeError {
    pub message: String,
    pub line: usize,
}

impl BreezeError {
    pub fn new(message: impl Into<String>, line: usize) -> Self {
        Self {
            message: message.into(),
            line,
        }
    }

    pub fn unlined(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            line: 0,
        }
    }
}

impl fmt::Display for BreezeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.line > 0 {
            write!(f, "Error (line {}): {}", self.line, self.message)
        } else {
            write!(f, "Error: {}", self.message)
        }
    }
}

impl std::error::Error for BreezeError {}

impl From<std::io::Error> for BreezeError {
    fn from(e: std::io::Error) -> Self {
        BreezeError::unlined(format!("I/O error: {e}"))
    }
}

pub type BreezeResult<T> = Result<T, BreezeError>;
