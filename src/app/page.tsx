"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Trash2,
  BookOpen,
  Sparkles,
  Terminal,
  Code2,
  Heart,
  Zap,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CodeEditor } from "@/components/breeze/code-editor";
import { QuickReference } from "@/components/breeze/quick-reference";
import { runBreeze, EXAMPLES } from "@/lib/breeze";

interface RunOutput {
  text: string;
  type: "out" | "err";
}

// Build the initial output by running the first example, so the console
// is populated on first paint without an effect.
function buildOutput(source: string): RunOutput[] {
  const result = runBreeze(source);
  const lines: RunOutput[] = result.output.map((line) => ({
    text: line,
    type: "out" as const,
  }));
  if (result.error) {
    // Use the formatted error (includes the source line excerpt) when available.
    const text = result.errorFormatted || result.error;
    // Split multi-line formatted errors into separate console lines.
    for (const part of text.split("\n")) {
      lines.push({ text: part, type: "err" as const });
    }
  }
  return lines;
}

export default function Home() {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [output, setOutput] = useState<RunOutput[]>(() =>
    buildOutput(EXAMPLES[0].code)
  );
  const [hasRun, setHasRun] = useState(true);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback(() => {
    setOutput(buildOutput(code));
    setHasRun(true);
  }, [code]);

  // Auto-scroll console to bottom on new output
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  // Keyboard shortcut: Ctrl/Cmd + Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRun]);

  const handleClear = () => {
    setOutput([]);
    setHasRun(false);
  };

  const handleExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (ex) {
      setCode(ex.code);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/breeze-icon.svg" alt="Breeze" width={36} height={36} className="rounded-lg shadow-lg shadow-emerald-500/20" />
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight text-white">
                Breeze
              </h1>
              <p className="text-[11px] leading-tight text-slate-400">
                The easiest programming language
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 sm:inline">
              v1.0
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() =>
                document
                  .getElementById("docs")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <BookOpen className="mr-1.5 h-4 w-4" />
              Docs
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.15), transparent 40%), radial-gradient(circle at 80% 60%, rgba(20,184,166,0.12), transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            Simpler than Python. Made for humans.
          </div>
          <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Code like a{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              breeze
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 sm:text-lg">
            A brand-new programming language designed to be gentle on beginners.
            No semicolons, no curly braces, no confusing symbols — just plain
            English you can read and write.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              onClick={() =>
                document
                  .getElementById("playground")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Play className="mr-2 h-4 w-4" />
              Try it now
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={() =>
                document
                  .getElementById("docs")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Read the docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Playground */}
      <section id="playground" className="border-b border-slate-800 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleRun}
                className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                <Play className="mr-1.5 h-4 w-4" />
                Run
                <kbd className="ml-2 hidden rounded bg-emerald-700/40 px-1.5 py-0.5 text-[10px] font-mono sm:inline">
                  ⌘↵
                </kbd>
              </Button>
              <Button
                variant="outline"
                onClick={handleClear}
                className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Clear
              </Button>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-slate-500 sm:inline">Examples:</span>
                <Select onValueChange={handleExample} defaultValue={EXAMPLES[0].id}>
                  <SelectTrigger className="h-9 w-[200px] border-slate-700 bg-slate-900 text-slate-200">
                    <SelectValue placeholder="Pick an example" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-900 text-slate-200">
                    {EXAMPLES.map((ex) => (
                      <SelectItem
                        key={ex.id}
                        value={ex.id}
                        className="focus:bg-slate-800"
                      >
                        {ex.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Code2 className="mr-1.5 h-4 w-4" />
              Copy
            </Button>
          </div>

          {/* Editor + Console */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Editor */}
            <div className="flex flex-col">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Code2 className="h-3.5 w-3.5" />
                Editor
              </div>
              <div className="h-[480px]">
                <CodeEditor value={code} onChange={setCode} />
              </div>
            </div>

            {/* Console */}
            <div className="flex flex-col">
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Terminal className="h-3.5 w-3.5" />
                Output
              </div>
              <div className="breeze-scroll h-[480px] overflow-y-auto rounded-lg border border-slate-800 bg-[#0d1117] p-4 font-mono text-sm">
                {output.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-600">
                    <Terminal className="mb-3 h-10 w-10 opacity-40" />
                    <p className="text-sm">
                      Press <span className="text-emerald-400">Run</span> to see
                      output here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {output.map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.type === "err"
                            ? "whitespace-pre-wrap break-words text-red-400"
                            : "whitespace-pre-wrap break-words text-slate-200"
                        }
                      >
                        {line.type === "err" && (
                          <span className="mr-1 text-red-500">✕</span>
                        )}
                        {line.text || "\u00A0"}
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-slate-800 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Why Breeze is easier
            </h2>
            <p className="mt-2 text-slate-400">
              Designed from scratch to remove the friction beginners hate.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Sparkles,
                title: "Plain English",
                desc: 'Reads like a sentence: show "Hello", repeat 5, if age > 18. No cryptic symbols.',
                color: "text-emerald-400",
              },
              {
                icon: Zap,
                title: "Auto Text Join",
                desc: '"Score: " + 95 just works. Breeze auto-joins text and numbers — no str() needed.',
                color: "text-amber-400",
              },
              {
                icon: ShieldCheck,
                title: "Friendly Errors",
                desc: 'Mistakes say what went wrong and where: "Line 3: Name x is not defined."',
                color: "text-cyan-400",
              },
              {
                icon: Heart,
                title: "No Boilerplate",
                desc: "No semicolons, no curly braces, no main() function. Just write what you mean.",
                color: "text-pink-400",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition-all hover:border-slate-700 hover:bg-slate-900/70"
              >
                <div className={`mb-4 ${f.color}`}>
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Docs / Quick Reference */}
      <div id="docs" className="scroll-mt-16">
        <QuickReference />
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <img src="/breeze-icon.svg" alt="" width={18} height={18} />
            <span>
              <span className="font-semibold text-slate-300">Breeze</span> — a
              language built for learning.
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Written in TypeScript · Runs entirely in your browser
          </p>
        </div>
      </footer>
    </div>
  );
}
