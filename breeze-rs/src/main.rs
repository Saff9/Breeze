//! Breeze CLI.

use std::env;
use std::fs;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use breeze::run as run_program;
use breeze::Interpreter;

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn banner() -> String {
    format!(
        r#"
  ___
 / _ \  __ _  ___| | __
| | | |/ _` |/ __| |/ /
| |_| | (_| | (__|   <
 \__\_\\__,_|\___|_|\_\   v{VERSION}   the easiest language

Type 'show "hi"' to begin.  Type 'exit' or press Ctrl-D to leave.
"#
    )
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();
    match args.len() {
        1 => repl(),
        _ => {
            let first = &args[1];
            match first.as_str() {
                "-h" | "--help" => {
                    print_help();
                    ExitCode::SUCCESS
                }
                "-V" | "--version" => {
                    println!("breeze {VERSION}");
                    ExitCode::SUCCESS
                }
                "-e" | "--eval" => {
                    if args.len() < 3 {
                        eprintln!("Error: --eval needs a program string");
                        return ExitCode::from(2);
                    }
                    run_string(&args[2])
                }
                _ => {
                    if first.starts_with('-') {
                        eprintln!("Error: unknown option '{first}'");
                        print_help();
                        return ExitCode::from(2);
                    }
                    run_file(&PathBuf::from(first))
                }
            }
        }
    }
}

fn run_file(path: &PathBuf) -> ExitCode {
    let source = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: cannot read {}: {e}", path.display());
            return ExitCode::from(2);
        }
    };
    run_string(&source)
}

fn run_string(source: &str) -> ExitCode {
    let result = run_program(source);
    let stdout = io::stdout();
    let mut out = stdout.lock();
    for line in &result.output {
        let _ = writeln!(out, "{line}");
    }
    if let Some(formatted) = &result.error_formatted {
        eprintln!("{formatted}");
        return ExitCode::from(1);
    }
    if let Some(err) = &result.error {
        // Defensive: run() should always set error_formatted when error is set.
        eprintln!("{err}");
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}

fn repl() -> ExitCode {
    print!("{}", banner());
    let _ = io::stdout().flush();

    let stdin = io::stdin();
    let mut interp = Interpreter::new();
    let mut buffer = String::new();
    let mut in_block = false;

    loop {
        let prompt = if buffer.is_empty() {
            "breeze> "
        } else {
            "    ... "
        };
        print!("{prompt}");
        let _ = io::stdout().flush();

        let mut line = String::new();
        match stdin.lock().read_line(&mut line) {
            Ok(0) => {
                println!();
                break;
            }
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error reading input: {e}");
                return ExitCode::from(2);
            }
        }

        let trimmed = line.trim_end();
        let is_indented = line.starts_with(' ') || line.starts_with('\t');

        // Top-level exit/quit only when not mid-block.
        if buffer.is_empty() && (trimmed == "exit" || trimmed == "quit") {
            break;
        }

        // Un-indented line while in a block ends the block; flush then re-check
        // exit/quit before treating the line as a fresh statement.
        if in_block && !is_indented && !trimmed.is_empty() {
            in_block = false;
            execute_buffer(&mut interp, &buffer);
            buffer.clear();
            if trimmed == "exit" || trimmed == "quit" {
                break;
            }
        }

        // A line ending with ':' opens a new block.
        if trimmed.ends_with(':') {
            in_block = true;
        }

        buffer.push_str(&line);

        if !in_block {
            if buffer.trim().is_empty() {
                buffer.clear();
                continue;
            }
            execute_buffer(&mut interp, &buffer);
            buffer.clear();
        }
    }
    ExitCode::SUCCESS
}

fn execute_buffer(interp: &mut Interpreter, source: &str) {
    let stdout = io::stdout();
    let mut out = stdout.lock();
    match interp.execute_source(source) {
        Ok(lines) => {
            for line in lines {
                let _ = writeln!(out, "{line}");
            }
        }
        Err(e) => {
            let _ = writeln!(out, "{e}");
        }
    }
}

fn print_help() {
    println!("breeze {VERSION} — the easiest programming language\n");
    println!("USAGE:");
    println!("    breeze                 Start the interactive REPL");
    println!("    breeze <file.bz>       Run a Breeze source file");
    println!("    breeze -e <program>    Run a one-line program");
    println!();
    println!("OPTIONS:");
    println!("    -h, --help             Show this help message");
    println!("    -V, --version          Print version information");
    println!();
    println!("EXAMPLES:");
    println!("    breeze hello.bz");
    println!("    breeze -e 'show \"Hello, World!\"'");
    println!("    breeze -e 'repeat i from 1 to 5: show i'");
}
