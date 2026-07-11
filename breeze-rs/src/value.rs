//! Runtime value helpers.

use crate::ast::Value;
use crate::error::{BreezeError, BreezeResult};

pub fn value_to_string(v: &Value) -> String {
    match v {
        Value::Number(n) => format_number(*n),
        Value::Text(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::None => "none".to_string(),
        Value::List(items) => {
            let parts: Vec<String> = items.iter().map(value_to_string).collect();
            format!("[{}]", parts.join(", "))
        }
        Value::Func(f) => format!("<function {}>", f.name),
        Value::Builtin { name, .. } => format!("<function {}>", name),
    }
}

pub fn format_number(n: f64) -> String {
    if n.is_nan() {
        return "nan".to_string();
    }
    if n.is_infinite() {
        return if n > 0.0 { "infinity" } else { "-infinity" }.to_string();
    }
    if n.fract() == 0.0 && n.abs() < 1e16 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

pub fn is_truthy(v: &Value) -> bool {
    match v {
        Value::None => false,
        Value::Bool(b) => *b,
        Value::Number(n) => *n != 0.0,
        Value::Text(s) => !s.is_empty(),
        Value::List(l) => !l.is_empty(),
        Value::Func(_) | Value::Builtin { .. } => true,
    }
}

pub fn to_number(v: &Value, line: usize) -> BreezeResult<f64> {
    match v {
        Value::Number(n) => Ok(*n),
        Value::Bool(b) => Ok(if *b { 1.0 } else { 0.0 }),
        Value::Text(s) => s.parse::<f64>().map_err(|_| {
            BreezeError::new(format!("Cannot convert text \"{s}\" to a number"), line)
        }),
        _ => Err(BreezeError::new(
            format!("Cannot convert {} to a number", v.type_name()),
            line,
        )),
    }
}

pub fn values_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x == y,
        (Value::Text(x), Value::Text(y)) => x == y,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::None, Value::None) => true,
        (Value::List(x), Value::List(y)) => {
            x.len() == y.len() && x.iter().zip(y).all(|(a, b)| values_equal(a, b))
        }
        // Cross-type compares via stringification, so `"5" == 5` is true.
        _ => value_to_string(a) == value_to_string(b),
    }
}

pub fn compare(a: &Value, b: &Value, line: usize) -> BreezeResult<std::cmp::Ordering> {
    use std::cmp::Ordering;
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => Ok(x.partial_cmp(y).unwrap_or(Ordering::Equal)),
        (Value::Text(x), Value::Text(y)) => Ok(x.cmp(y)),
        _ => {
            let x = to_number(a, line)?;
            let y = to_number(b, line)?;
            Ok(x.partial_cmp(&y).unwrap_or(Ordering::Equal))
        }
    }
}
