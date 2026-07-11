"use client";

import { Wind } from "lucide-react";

interface RefCard {
  title: string;
  items: { code: string; desc: string }[];
}

const CARDS: RefCard[] = [
  {
    title: "Variables & Output",
    items: [
      { code: 'name = "Alice"', desc: "Create a variable" },
      { code: 'show "Hello"', desc: "Print text" },
      { code: "show x, y", desc: "Print multiple values" },
    ],
  },
  {
    title: "Math & Text",
    items: [
      { code: "+  -  *  /  %", desc: "Arithmetic operators" },
      { code: '"Age: " + 25', desc: "Text + number auto-joins" },
      { code: "10 / 3", desc: "Division (gives decimals)" },
    ],
  },
  {
    title: "Conditions",
    items: [
      { code: "if x > 5:", desc: "Run if true" },
      { code: "else:", desc: "Otherwise run this" },
      { code: "and  or  not", desc: "Combine logic" },
      { code: "==  !=  <  >  <=  >=", desc: "Comparisons" },
    ],
  },
  {
    title: "Loops",
    items: [
      { code: "repeat 5:", desc: "Repeat 5 times" },
      { code: "repeat i from 1 to 10:", desc: "Count from 1 to 10" },
      { code: "for item in list:", desc: "Loop over a list" },
    ],
  },
  {
    title: "Functions",
    items: [
      { code: "func greet(name):", desc: "Define a function" },
      { code: "return value", desc: "Give back a value" },
      { code: 'greet("World")', desc: "Call a function" },
    ],
  },
  {
    title: "Lists",
    items: [
      { code: "[1, 2, 3]", desc: "Make a list" },
      { code: "list[0]", desc: "Get first item" },
      { code: "list[0] = 9", desc: "Change an item" },
    ],
  },
  {
    title: "Built-in Helpers",
    items: [
      { code: "len(x)", desc: "Length of text or list" },
      { code: "sum(list)", desc: "Add up a list" },
      { code: "push(list, item)", desc: "Add to a list" },
      { code: "text(x) / number(x)", desc: "Convert types" },
      { code: "upper(s) / lower(s)", desc: "Change text case" },
      { code: "join(list, \" \")", desc: "Join list to text" },
      { code: "random(a, b)", desc: "Random whole number" },
      { code: "range(n)", desc: "List 0 to n-1" },
      { code: "min(...) / max(...)", desc: "Smallest / largest" },
      { code: "abs(x) / round(x)", desc: "Absolute / rounded" },
    ],
  },
];

export function QuickReference() {
  return (
    <section className="border-t border-slate-800 bg-slate-900/40 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <Wind className="h-3.5 w-3.5" />
            Cheat Sheet
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Quick Reference
          </h2>
          <p className="mt-2 text-slate-400">
            Everything you need to write Breeze, on one page.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 transition-colors hover:border-emerald-500/40"
            >
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {card.title}
              </h3>
              <ul className="space-y-3">
                {card.items.map((item, idx) => (
                  <li key={idx} className="space-y-1">
                    <code className="block rounded bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-cyan-300">
                      {item.code}
                    </code>
                    <span className="text-xs text-slate-400">{item.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
