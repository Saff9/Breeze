//! Tree-walking interpreter.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use crate::ast::*;
use crate::error::{BreezeError, BreezeResult};
use crate::value::{compare, is_truthy, to_number, value_to_string, values_equal};

/// AST evaluations before bailing on a runaway loop.
pub const MAX_STEPS: u64 = 2_000_000;

/// Lexical scope, shared via `Rc<RefCell>` so closures and lists can mutate in place.
#[derive(Debug, Default)]
pub struct Environment {
    vars: HashMap<String, Value>,
    parent: Option<Rc<RefCell<Environment>>>,
}

impl Environment {
    pub fn new() -> Self {
        Self {
            vars: HashMap::new(),
            parent: None,
        }
    }

    pub fn child(parent: Rc<RefCell<Environment>>) -> Self {
        Self {
            vars: HashMap::new(),
            parent: Some(parent),
        }
    }

    pub fn get(&self, name: &str) -> Option<Value> {
        if let Some(v) = self.vars.get(name) {
            return Some(v.clone());
        }
        self.parent.as_ref().and_then(|p| p.borrow().get(name))
    }

    /// Assign: update an existing binding anywhere in the chain, else create a new local.
    pub fn set(&mut self, name: String, value: Value) {
        #[allow(clippy::map_entry)]
        if self.vars.contains_key(&name) {
            self.vars.insert(name, value);
            return;
        }
        if let Some(p) = &self.parent {
            let mut p = p.borrow_mut();
            if p.has_recursive(&name) {
                p.set(name, value);
                return;
            }
        }
        self.vars.insert(name, value);
    }

    /// Define a new local binding in this scope (params, loop vars).
    pub fn define(&mut self, name: String, value: Value) {
        self.vars.insert(name, value);
    }

    fn has_recursive(&self, name: &str) -> bool {
        if self.vars.contains_key(name) {
            return true;
        }
        self.parent
            .as_ref()
            .is_some_and(|p| p.borrow().has_recursive(name))
    }
}

/// Unwinding signal for `return` / `break` / `continue`.
/// `break`/`continue` escape to the nearest loop; if used outside a loop they
/// bubble up to the caller's loop.
enum Flow {
    Normal,
    Return(Value),
    Break,
    Continue,
}

pub struct Interpreter {
    output: Vec<String>,
    steps: u64,
    globals: Rc<RefCell<Environment>>,
}

impl Interpreter {
    pub fn new() -> Self {
        let mut globals = Environment::new();
        install_builtins(&mut globals);
        Self {
            output: Vec::new(),
            steps: 0,
            globals: Rc::new(RefCell::new(globals)),
        }
    }

    /// Execute a program, returning every line printed by `show`.
    pub fn run(&mut self, program: &Program) -> BreezeResult<Vec<String>> {
        // First pass: register functions so call order does not matter.
        {
            let mut g = self.globals.borrow_mut();
            for stmt in &program.body {
                if let Stmt::Func {
                    name, params, body, ..
                } = stmt
                {
                    let func = BreezeFunc {
                        name: name.clone(),
                        params: params.clone(),
                        body: body.clone(),
                        closure: Rc::clone(&self.globals),
                    };
                    g.define(name.clone(), Value::Func(Rc::new(func)));
                }
            }
        }
        for stmt in &program.body {
            if matches!(stmt, Stmt::Func { .. }) {
                continue;
            }
            match self.execute(stmt, Rc::clone(&self.globals))? {
                Flow::Normal => {}
                Flow::Return(_) => {
                    return Err(BreezeError::new(
                        "'return' outside of a function",
                        stmt.line(),
                    ))
                }
                Flow::Break | Flow::Continue => {
                    return Err(BreezeError::new(
                        "'break' and 'continue' must be inside a loop",
                        stmt.line(),
                    ))
                }
            }
        }
        Ok(std::mem::take(&mut self.output))
    }

    /// Execute a source string against the existing global state (REPL entry point).
    pub fn execute_source(&mut self, source: &str) -> BreezeResult<Vec<String>> {
        let tokens = crate::lexer::tokenize(source)?;
        let program = crate::parser::Parser::new(tokens).parse()?;
        self.run(&program)
    }

    fn tick(&mut self, line: usize) -> BreezeResult<()> {
        self.steps += 1;
        if self.steps > MAX_STEPS {
            return Err(BreezeError::new(
                "Program ran for too long — possible infinite loop (stopped after 2,000,000 steps)",
                line,
            ));
        }
        Ok(())
    }

    fn execute(&mut self, stmt: &Stmt, env: Rc<RefCell<Environment>>) -> BreezeResult<Flow> {
        self.tick(stmt.line())?;
        match stmt {
            Stmt::Show { args, .. } => {
                let mut parts = Vec::with_capacity(args.len());
                for a in args {
                    parts.push(value_to_string(&self.evaluate(a, Rc::clone(&env))?));
                }
                self.output.push(parts.join(" "));
                Ok(Flow::Normal)
            }
            Stmt::ExprStmt { expr, .. } => {
                self.evaluate(expr, env)?;
                Ok(Flow::Normal)
            }
            Stmt::Assign {
                target,
                value,
                line,
            } => {
                let v = self.evaluate(value, Rc::clone(&env))?;
                self.assign(target, v, env, *line)?;
                Ok(Flow::Normal)
            }
            Stmt::If {
                test,
                consequent,
                elifs,
                alternate,
                ..
            } => {
                let cond = self.evaluate(test, Rc::clone(&env))?;
                let body: &Vec<Stmt> = if is_truthy(&cond) {
                    consequent
                } else {
                    let mut chosen: Option<&Vec<Stmt>> = None;
                    for (elif_test, elif_body) in elifs {
                        let t = self.evaluate(elif_test, Rc::clone(&env))?;
                        if is_truthy(&t) {
                            chosen = Some(elif_body);
                            break;
                        }
                    }
                    chosen.unwrap_or(alternate)
                };
                for s in body {
                    match self.execute(s, Rc::clone(&env))? {
                        Flow::Normal => {}
                        signal => return Ok(signal),
                    }
                }
                Ok(Flow::Normal)
            }
            Stmt::While { test, body, line } => {
                'while_loop: loop {
                    let cond = self.evaluate(test, Rc::clone(&env))?;
                    if !is_truthy(&cond) {
                        break;
                    }
                    self.tick(*line)?;
                    for s in body {
                        match self.execute(s, Rc::clone(&env))? {
                            Flow::Normal => {}
                            Flow::Break => break 'while_loop,
                            Flow::Continue => continue 'while_loop,
                            Flow::Return(v) => return Ok(Flow::Return(v)),
                        }
                    }
                }
                Ok(Flow::Normal)
            }
            Stmt::Repeat { count, body, line } => {
                let n = to_number(&self.evaluate(count, Rc::clone(&env))?, *line)?;
                let n = n.floor() as i64;
                if n < 0 {
                    return Err(BreezeError::new("repeat count cannot be negative", *line));
                }
                'repeat_loop: for _ in 0..n {
                    for s in body {
                        match self.execute(s, Rc::clone(&env))? {
                            Flow::Normal => {}
                            Flow::Break => break 'repeat_loop,
                            Flow::Continue => continue 'repeat_loop,
                            Flow::Return(v) => return Ok(Flow::Return(v)),
                        }
                    }
                }
                Ok(Flow::Normal)
            }
            Stmt::RepeatRange {
                variable,
                from,
                to,
                body,
                line,
            } => {
                let lo = to_number(&self.evaluate(from, Rc::clone(&env))?, *line)?.floor() as i64;
                let hi = to_number(&self.evaluate(to, Rc::clone(&env))?, *line)?.floor() as i64;
                // Loop var lives in the enclosing scope (Python-style).
                'range_loop: for i in lo..=hi {
                    env.borrow_mut()
                        .define(variable.clone(), Value::Number(i as f64));
                    for s in body {
                        match self.execute(s, Rc::clone(&env))? {
                            Flow::Normal => {}
                            Flow::Break => break 'range_loop,
                            Flow::Continue => continue 'range_loop,
                            Flow::Return(v) => return Ok(Flow::Return(v)),
                        }
                    }
                }
                Ok(Flow::Normal)
            }
            Stmt::For {
                variable,
                iterable,
                body,
                line,
            } => {
                let iter = self.evaluate(iterable, Rc::clone(&env))?;
                let items = match &iter {
                    Value::List(l) => l.clone(),
                    _ => {
                        return Err(BreezeError::new(
                            format!("for needs a list, not {}", iter.type_name()),
                            *line,
                        ));
                    }
                };
                'for_loop: for item in items {
                    env.borrow_mut().define(variable.clone(), item);
                    for s in body {
                        match self.execute(s, Rc::clone(&env))? {
                            Flow::Normal => {}
                            Flow::Break => break 'for_loop,
                            Flow::Continue => continue 'for_loop,
                            Flow::Return(v) => return Ok(Flow::Return(v)),
                        }
                    }
                }
                Ok(Flow::Normal)
            }
            Stmt::Func {
                name, params, body, ..
            } => {
                let func = BreezeFunc {
                    name: name.clone(),
                    params: params.clone(),
                    body: body.clone(),
                    closure: Rc::clone(&env),
                };
                env.borrow_mut()
                    .define(name.clone(), Value::Func(Rc::new(func)));
                Ok(Flow::Normal)
            }
            Stmt::Return { value, .. } => {
                let v = match value {
                    Some(e) => self.evaluate(e, Rc::clone(&env))?,
                    None => Value::None,
                };
                Ok(Flow::Return(v))
            }
            Stmt::Break { .. } => Ok(Flow::Break),
            Stmt::Continue { .. } => Ok(Flow::Continue),
        }
    }

    fn assign(
        &mut self,
        target: &Expr,
        value: Value,
        env: Rc<RefCell<Environment>>,
        line: usize,
    ) -> BreezeResult<()> {
        match target {
            Expr::Ident { name, .. } => {
                env.borrow_mut().set(name.clone(), value);
                Ok(())
            }
            Expr::Index {
                object,
                index,
                line,
            } => {
                let obj = self.evaluate(object, Rc::clone(&env))?;
                let idx = self.evaluate(index, Rc::clone(&env))?;
                match obj {
                    Value::List(mut list) => {
                        let raw_i = to_number(&idx, *line)?.floor() as i64;
                        let mut i = raw_i;
                        if i < 0 {
                            i += list.len() as i64;
                        }
                        if i < 0 || i as usize >= list.len() {
                            return Err(BreezeError::new(
                                format!(
                                    "List index {raw_i} is out of range (length {})",
                                    list.len()
                                ),
                                *line,
                            ));
                        }
                        list[i as usize] = value;
                        // Write back through the lvalue if it is a plain name.
                        if let Expr::Ident { name, .. } = object.as_ref() {
                            env.borrow_mut().set(name.clone(), Value::List(list));
                        }
                        Ok(())
                    }
                    _ => Err(BreezeError::new(
                        format!("Cannot set item on {}", obj.type_name()),
                        *line,
                    )),
                }
            }
            _ => Err(BreezeError::new("Invalid assignment target", line)),
        }
    }

    fn evaluate(&mut self, expr: &Expr, env: Rc<RefCell<Environment>>) -> BreezeResult<Value> {
        self.tick(expr.line())?;
        match expr {
            Expr::Literal { value, .. } => Ok(value.clone()),
            Expr::StringInterpolation { parts, .. } => {
                let mut result = String::new();
                for part in parts {
                    match part {
                        StringPart::Text(t) => result.push_str(t),
                        StringPart::Expr(e) => {
                            let v = self.evaluate(e, Rc::clone(&env))?;
                            result.push_str(&value_to_string(&v));
                        }
                    }
                }
                Ok(Value::Text(result))
            }
            Expr::Ident { name, line } => env
                .borrow()
                .get(name)
                .ok_or_else(|| BreezeError::new(format!("Name '{name}' is not defined"), *line)),
            Expr::List { elements, .. } => {
                let mut out = Vec::with_capacity(elements.len());
                for e in elements {
                    out.push(self.evaluate(e, Rc::clone(&env))?);
                }
                Ok(Value::List(out))
            }
            Expr::Unary { op, operand, line } => {
                let v = self.evaluate(operand, Rc::clone(&env))?;
                match op.as_str() {
                    "-" => Ok(Value::Number(-to_number(&v, *line)?)),
                    "not" => Ok(Value::Bool(!is_truthy(&v))),
                    _ => Err(BreezeError::new(format!("Unknown operator {op}"), *line)),
                }
            }
            Expr::Binary {
                op,
                left,
                right,
                line,
            } => self.eval_binary(op, left, right, env, *line),
            Expr::Call { callee, args, line } => self.eval_call(callee, args, env, *line),
            Expr::Index {
                object,
                index,
                line,
            } => self.eval_index(object, index, env, *line),
        }
    }

    fn eval_binary(
        &mut self,
        op: &str,
        left: &Expr,
        right: &Expr,
        env: Rc<RefCell<Environment>>,
        line: usize,
    ) -> BreezeResult<Value> {
        if op == "and" {
            let l = self.evaluate(left, Rc::clone(&env))?;
            if !is_truthy(&l) {
                return Ok(Value::Bool(false));
            }
            return Ok(Value::Bool(is_truthy(&self.evaluate(right, env)?)));
        }
        if op == "or" {
            let l = self.evaluate(left, Rc::clone(&env))?;
            if is_truthy(&l) {
                return Ok(Value::Bool(true));
            }
            return Ok(Value::Bool(is_truthy(&self.evaluate(right, env)?)));
        }

        let l = self.evaluate(left, Rc::clone(&env))?;
        let r = self.evaluate(right, env)?;
        match op {
            "+" => match (&l, &r) {
                (Value::Number(a), Value::Number(b)) => Ok(Value::Number(a + b)),
                (Value::Text(_), _) | (_, Value::Text(_)) => Ok(Value::Text(format!(
                    "{}{}",
                    value_to_string(&l),
                    value_to_string(&r)
                ))),
                (Value::List(a), Value::List(b)) => {
                    let mut v = a.clone();
                    v.extend(b.iter().cloned());
                    Ok(Value::List(v))
                }
                _ => Err(BreezeError::new(
                    format!("Cannot add {} and {}", l.type_name(), r.type_name()),
                    line,
                )),
            },
            "-" => Ok(Value::Number(to_number(&l, line)? - to_number(&r, line)?)),
            "*" => Ok(Value::Number(to_number(&l, line)? * to_number(&r, line)?)),
            "/" => {
                let d = to_number(&r, line)?;
                if d == 0.0 {
                    return Err(BreezeError::new("Cannot divide by zero", line));
                }
                Ok(Value::Number(to_number(&l, line)? / d))
            }
            "%" => {
                let d = to_number(&r, line)?;
                if d == 0.0 {
                    return Err(BreezeError::new("Cannot mod by zero", line));
                }
                Ok(Value::Number(to_number(&l, line)? % d))
            }
            "==" => Ok(Value::Bool(values_equal(&l, &r))),
            "!=" => Ok(Value::Bool(!values_equal(&l, &r))),
            "<" => Ok(Value::Bool(
                compare(&l, &r, line)? == std::cmp::Ordering::Less,
            )),
            ">" => Ok(Value::Bool(
                compare(&l, &r, line)? == std::cmp::Ordering::Greater,
            )),
            "<=" => Ok(Value::Bool(
                compare(&l, &r, line)? != std::cmp::Ordering::Greater,
            )),
            ">=" => Ok(Value::Bool(
                compare(&l, &r, line)? != std::cmp::Ordering::Less,
            )),
            _ => Err(BreezeError::new(format!("Unknown operator {op}"), line)),
        }
    }

    fn eval_call(
        &mut self,
        callee: &Expr,
        args: &[Expr],
        env: Rc<RefCell<Environment>>,
        line: usize,
    ) -> BreezeResult<Value> {
        let callee = self.evaluate(callee, Rc::clone(&env))?;
        let mut arg_vals = Vec::with_capacity(args.len());
        for a in args {
            arg_vals.push(self.evaluate(a, Rc::clone(&env))?);
        }
        match callee {
            Value::Builtin { f, .. } => f(&arg_vals, line),
            Value::Func(func) => {
                if arg_vals.len() != func.params.len() {
                    return Err(BreezeError::new(
                        format!(
                            "Function {}() needs {} value{} but got {}",
                            func.name,
                            func.params.len(),
                            if func.params.len() == 1 { "" } else { "s" },
                            arg_vals.len()
                        ),
                        line,
                    ));
                }
                let call_env = Rc::new(RefCell::new(Environment::child(Rc::clone(&func.closure))));
                {
                    let mut env_mut = call_env.borrow_mut();
                    for (p, v) in func.params.iter().zip(arg_vals) {
                        env_mut.define(p.clone(), v);
                    }
                }
                for s in &func.body {
                    match self.execute(s, Rc::clone(&call_env))? {
                        Flow::Return(v) => return Ok(v),
                        Flow::Normal => {}
                        Flow::Break | Flow::Continue => {
                            return Err(BreezeError::new(
                                "'break' and 'continue' must be inside a loop",
                                s.line(),
                            ))
                        }
                    }
                }
                Ok(Value::None)
            }
            _ => Err(BreezeError::new(
                format!("Cannot call {}", callee.type_name()),
                line,
            )),
        }
    }

    fn eval_index(
        &mut self,
        object: &Expr,
        index: &Expr,
        env: Rc<RefCell<Environment>>,
        line: usize,
    ) -> BreezeResult<Value> {
        let obj = self.evaluate(object, Rc::clone(&env))?;
        let idx = self.evaluate(index, env)?;
        match obj {
            Value::List(list) => {
                let raw_i = to_number(&idx, line)?.floor() as i64;
                let mut i = raw_i;
                if i < 0 {
                    i += list.len() as i64;
                }
                if i < 0 || i as usize >= list.len() {
                    return Err(BreezeError::new(
                        format!("List index {raw_i} is out of range (length {})", list.len()),
                        line,
                    ));
                }
                Ok(list[i as usize].clone())
            }
            Value::Text(s) => {
                let raw_i = to_number(&idx, line)?.floor() as i64;
                let chars: Vec<char> = s.chars().collect();
                let mut i = raw_i;
                if i < 0 {
                    i += chars.len() as i64;
                }
                if i < 0 || i as usize >= chars.len() {
                    return Err(BreezeError::new(
                        format!(
                            "Text index {raw_i} is out of range (length {})",
                            chars.len()
                        ),
                        line,
                    ));
                }
                Ok(Value::Text(chars[i as usize].to_string()))
            }
            _ => Err(BreezeError::new(
                format!("Cannot get item from {}", obj.type_name()),
                line,
            )),
        }
    }
}

impl Default for Interpreter {
    fn default() -> Self {
        Self::new()
    }
}

fn install_builtins(env: &mut Environment) {
    macro_rules! bind {
        ($env:expr, $name:expr, $f:expr) => {
            $env.define(
                $name.to_string(),
                Value::Builtin {
                    name: $name.to_string(),
                    f: $f,
                },
            );
        };
    }

    bind!(env, "text", builtin_text);
    bind!(env, "number", builtin_number);
    bind!(env, "len", builtin_len);
    bind!(env, "upper", builtin_upper);
    bind!(env, "lower", builtin_lower);
    bind!(env, "abs", builtin_abs);
    bind!(env, "round", builtin_round);
    bind!(env, "floor", builtin_floor);
    bind!(env, "ceil", builtin_ceil);
    bind!(env, "random", builtin_random);
    bind!(env, "sum", builtin_sum);
    bind!(env, "min", builtin_min);
    bind!(env, "max", builtin_max);
    bind!(env, "push", builtin_push);
    bind!(env, "range", builtin_range);
    bind!(env, "type", builtin_type);
    bind!(env, "join", builtin_join);
    bind!(env, "split", builtin_split);
    bind!(env, "contains", builtin_contains);
    bind!(env, "trim", builtin_trim);
    bind!(env, "replace", builtin_replace);
    bind!(env, "slice", builtin_slice);
    bind!(env, "starts_with", builtin_starts_with);
    bind!(env, "ends_with", builtin_ends_with);
    bind!(env, "index_of", builtin_index_of);
    bind!(env, "reverse", builtin_reverse);
    bind!(env, "repeat_text", builtin_repeat_text);
}

fn need_args(name: &str, args: &[Value], n: usize, line: usize) -> BreezeResult<()> {
    if args.len() != n {
        return Err(BreezeError::new(
            format!(
                "{name}() needs {n} value{} but got {}",
                if n == 1 { "" } else { "s" },
                args.len()
            ),
            line,
        ));
    }
    Ok(())
}

fn builtin_text(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("text", args, 1, line)?;
    Ok(Value::Text(value_to_string(&args[0])))
}
fn builtin_number(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("number", args, 1, line)?;
    Ok(Value::Number(to_number(&args[0], line)?))
}
fn builtin_len(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("len", args, 1, line)?;
    match &args[0] {
        Value::Text(s) => Ok(Value::Number(s.chars().count() as f64)),
        Value::List(l) => Ok(Value::Number(l.len() as f64)),
        _ => Err(BreezeError::new(
            format!("len() works on text or lists, not {}", args[0].type_name()),
            line,
        )),
    }
}
fn builtin_upper(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("upper", args, 1, line)?;
    match &args[0] {
        Value::Text(s) => Ok(Value::Text(s.to_uppercase())),
        _ => Err(BreezeError::new("upper() needs text", line)),
    }
}
fn builtin_lower(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("lower", args, 1, line)?;
    match &args[0] {
        Value::Text(s) => Ok(Value::Text(s.to_lowercase())),
        _ => Err(BreezeError::new("lower() needs text", line)),
    }
}
fn builtin_abs(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("abs", args, 1, line)?;
    Ok(Value::Number(to_number(&args[0], line)?.abs()))
}
fn builtin_round(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("round", args, 1, line)?;
    Ok(Value::Number(to_number(&args[0], line)?.round()))
}
fn builtin_floor(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("floor", args, 1, line)?;
    Ok(Value::Number(to_number(&args[0], line)?.floor()))
}
fn builtin_ceil(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("ceil", args, 1, line)?;
    Ok(Value::Number(to_number(&args[0], line)?.ceil()))
}
fn builtin_random(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("random", args, 2, line)?;
    let lo = to_number(&args[0], line)?.floor() as i64;
    let hi = to_number(&args[1], line)?.floor() as i64;
    if hi < lo {
        return Err(BreezeError::new(
            "random() second value must be >= first value",
            line,
        ));
    }
    // Thread-local xorshift64 seeded from the system clock (no deps).
    use std::cell::Cell;
    thread_local! {
        static SEED: Cell<u64> = Cell::new({
            let mut h = std::collections::hash_map::DefaultHasher::new();
            std::hash::Hasher::write_i64(
                &mut h,
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos() as i64,
            );
            std::hash::Hasher::finish(&h) | 1
        });
    }
    let val = SEED.with(|s| {
        let mut x = s.get();
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        s.set(x);
        x
    });
    let span = (hi - lo + 1) as u64;
    let n = lo + (val % span) as i64;
    Ok(Value::Number(n as f64))
}
fn builtin_sum(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("sum", args, 1, line)?;
    match &args[0] {
        Value::List(l) => {
            let mut total = 0.0;
            for item in l {
                total += to_number(item, line)?;
            }
            Ok(Value::Number(total))
        }
        _ => Err(BreezeError::new("sum() needs a list", line)),
    }
}
fn builtin_min(args: &[Value], line: usize) -> BreezeResult<Value> {
    if args.is_empty() {
        return Err(BreezeError::new("min() needs at least one value", line));
    }
    let mut result = to_number(&args[0], line)?;
    for v in &args[1..] {
        let n = to_number(v, line)?;
        if n < result {
            result = n;
        }
    }
    Ok(Value::Number(result))
}
fn builtin_max(args: &[Value], line: usize) -> BreezeResult<Value> {
    if args.is_empty() {
        return Err(BreezeError::new("max() needs at least one value", line));
    }
    let mut result = to_number(&args[0], line)?;
    for v in &args[1..] {
        let n = to_number(v, line)?;
        if n > result {
            result = n;
        }
    }
    Ok(Value::Number(result))
}
fn builtin_push(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("push", args, 2, line)?;
    match &args[0] {
        Value::List(l) => {
            let mut l = l.clone();
            l.push(args[1].clone());
            Ok(Value::List(l))
        }
        _ => Err(BreezeError::new("push() needs a list first", line)),
    }
}
fn builtin_range(args: &[Value], line: usize) -> BreezeResult<Value> {
    let (start, end) = match args.len() {
        1 => (0.0, to_number(&args[0], line)?),
        2 => (to_number(&args[0], line)?, to_number(&args[1], line)?),
        _ => {
            return Err(BreezeError::new("range() needs 1 or 2 numbers", line));
        }
    };
    let mut out = Vec::new();
    let mut i = start.floor() as i64;
    let end = end.floor() as i64;
    while i < end {
        out.push(Value::Number(i as f64));
        i += 1;
    }
    Ok(Value::List(out))
}
fn builtin_type(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("type", args, 1, line)?;
    Ok(Value::Text(args[0].type_name().to_string()))
}
fn builtin_join(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("join", args, 2, line)?;
    match (&args[0], &args[1]) {
        (Value::List(l), Value::Text(sep)) => {
            let parts: Vec<String> = l.iter().map(value_to_string).collect();
            Ok(Value::Text(parts.join(sep)))
        }
        (Value::List(_), _) => Err(BreezeError::new("join() needs text as the separator", line)),
        _ => Err(BreezeError::new("join() needs a list first", line)),
    }
}

fn builtin_split(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("split", args, 2, line)?;
    match (&args[0], &args[1]) {
        (Value::Text(s), Value::Text(sep)) => {
            // Empty separator splits into characters (JS/Python behaviour).
            let parts: Vec<Value> = if sep.is_empty() {
                s.chars().map(|c| Value::Text(c.to_string())).collect()
            } else {
                s.split(sep.as_str())
                    .map(|p| Value::Text(p.to_string()))
                    .collect()
            };
            Ok(Value::List(parts))
        }
        (Value::Text(_), _) => Err(BreezeError::new(
            "split() needs text as the separator",
            line,
        )),
        _ => Err(BreezeError::new("split() needs text first", line)),
    }
}

fn builtin_contains(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("contains", args, 2, line)?;
    match (&args[0], &args[1]) {
        (Value::Text(s), Value::Text(sub)) => Ok(Value::Bool(s.contains(sub.as_str()))),
        (Value::List(l), _) => {
            let target = value_to_string(&args[1]);
            Ok(Value::Bool(l.iter().any(|v| value_to_string(v) == target)))
        }
        _ => Err(BreezeError::new(
            "contains() needs text or a list first",
            line,
        )),
    }
}

fn builtin_trim(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("trim", args, 1, line)?;
    match &args[0] {
        Value::Text(s) => Ok(Value::Text(s.trim().to_string())),
        _ => Err(BreezeError::new("trim() needs text", line)),
    }
}

fn builtin_replace(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("replace", args, 3, line)?;
    match (&args[0], &args[1], &args[2]) {
        (Value::Text(s), Value::Text(old), Value::Text(new)) => {
            if old.is_empty() {
                // Empty match would loop; insert between chars instead (JS semantics).
                let mut out = String::new();
                let chars: Vec<char> = s.chars().collect();
                for (i, c) in chars.iter().enumerate() {
                    if i > 0 {
                        out.push_str(new);
                    }
                    out.push(*c);
                }
                return Ok(Value::Text(out));
            }
            Ok(Value::Text(s.replace(old.as_str(), new.as_str())))
        }
        _ => Err(BreezeError::new(
            "replace() needs three pieces of text",
            line,
        )),
    }
}

fn builtin_slice(args: &[Value], line: usize) -> BreezeResult<Value> {
    if args.len() < 2 || args.len() > 3 {
        return Err(BreezeError::new("slice() needs 2 or 3 values", line));
    }
    let s = match &args[0] {
        Value::Text(s) => s.clone(),
        _ => {
            return Err(BreezeError::new("slice() needs text first", line));
        }
    };
    let chars: Vec<char> = s.chars().collect();
    let len = chars.len() as i64;
    let mut start = to_number(&args[1], line)?.floor() as i64;
    let mut end = if args.len() == 3 {
        to_number(&args[2], line)?.floor() as i64
    } else {
        len
    };
    if start < 0 {
        start = (start + len).max(0);
    }
    if end < 0 {
        end += len;
    }
    if start < 0 {
        start = 0;
    }
    if end > len {
        end = len;
    }
    if start >= end {
        return Ok(Value::Text(String::new()));
    }
    let result: String = chars[(start as usize)..(end as usize)].iter().collect();
    Ok(Value::Text(result))
}

fn builtin_starts_with(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("starts_with", args, 2, line)?;
    match (&args[0], &args[1]) {
        (Value::Text(s), Value::Text(p)) => Ok(Value::Bool(s.starts_with(p.as_str()))),
        _ => Err(BreezeError::new(
            "starts_with() needs two pieces of text",
            line,
        )),
    }
}

fn builtin_ends_with(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("ends_with", args, 2, line)?;
    match (&args[0], &args[1]) {
        (Value::Text(s), Value::Text(p)) => Ok(Value::Bool(s.ends_with(p.as_str()))),
        _ => Err(BreezeError::new(
            "ends_with() needs two pieces of text",
            line,
        )),
    }
}

fn builtin_index_of(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("index_of", args, 2, line)?;
    match (&args[0], &args[1]) {
        (Value::Text(s), Value::Text(sub)) => {
            // Character index, not byte offset.
            let sub_chars: Vec<char> = sub.chars().collect();
            if sub_chars.is_empty() {
                return Ok(Value::Number(0.0));
            }
            let chars: Vec<char> = s.chars().collect();
            for i in 0..=chars.len().saturating_sub(sub_chars.len()) {
                if chars[i..].starts_with(&sub_chars[..]) {
                    return Ok(Value::Number(i as f64));
                }
            }
            Ok(Value::Number(-1.0))
        }
        (Value::List(l), _) => {
            let target = value_to_string(&args[1]);
            for (i, v) in l.iter().enumerate() {
                if value_to_string(v) == target {
                    return Ok(Value::Number(i as f64));
                }
            }
            Ok(Value::Number(-1.0))
        }
        _ => Err(BreezeError::new(
            "index_of() needs text or a list first",
            line,
        )),
    }
}

fn builtin_reverse(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("reverse", args, 1, line)?;
    match &args[0] {
        Value::Text(s) => {
            let reversed: String = s.chars().rev().collect();
            Ok(Value::Text(reversed))
        }
        Value::List(l) => {
            let mut v = l.clone();
            v.reverse();
            Ok(Value::List(v))
        }
        _ => Err(BreezeError::new("reverse() needs text or a list", line)),
    }
}

fn builtin_repeat_text(args: &[Value], line: usize) -> BreezeResult<Value> {
    need_args("repeat_text", args, 2, line)?;
    match &args[0] {
        Value::Text(s) => {
            let n = to_number(&args[1], line)?.floor() as i64;
            if n < 0 {
                return Err(BreezeError::new(
                    "repeat_text() count cannot be negative",
                    line,
                ));
            }
            Ok(Value::Text(s.repeat(n as usize)))
        }
        _ => Err(BreezeError::new("repeat_text() needs text first", line)),
    }
}
