"use client";

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { highlightBreeze } from "@/lib/breeze/highlighter";

export interface CodeEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor({ value, onChange }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => value,
      setValue: (v: string) => onChange(v),
    }));

    const syncScroll = useCallback(() => {
      const ta = textareaRef.current;
      const pre = preRef.current;
      const ln = lineNumbersRef.current;
      if (!ta || !pre || !ln) return;
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
      ln.scrollTop = ta.scrollTop;
    }, []);

    useEffect(() => {
      syncScroll();
    }, [value, syncScroll]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      if (e.key === "Tab") {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = value.slice(0, start) + "  " + value.slice(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      } else if (e.key === "Enter") {
        // Auto-indent: keep the indentation of the current line
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const indentMatch = currentLine.match(/^[ \t]*/);
        let indent = indentMatch ? indentMatch[0] : "";
        // Add extra indent if line ends with ':'
        const trimmedCurrent = currentLine.trim();
        if (trimmedCurrent.endsWith(":")) {
          indent += "  ";
        }
        const insert = "\n" + indent;
        const newValue = value.slice(0, start) + insert + value.slice(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        });
      }
    };

    const lineCount = value.split("\n").length;
    const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

    const highlighted = highlightBreeze(value) + "\n";

    return (
      <div className="flex h-full w-full overflow-hidden rounded-lg border border-border bg-[#0d1117]">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          aria-hidden
          className="select-none overflow-hidden bg-[#0d1117] py-4 pr-3 pl-4 text-right font-mono text-xs leading-6 text-slate-600"
          style={{ minWidth: "3rem" }}
        >
          {lineNumbers.map((n) => (
            <div key={n} className="leading-6">
              {n}
            </div>
          ))}
        </div>
        {/* Code area */}
        <div className="relative flex-1 overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden
            className="breeze-pre absolute inset-0 m-0 overflow-auto whitespace-pre p-4 font-mono text-sm leading-6 text-slate-200"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="breeze-textarea absolute inset-0 m-0 h-full w-full resize-none overflow-auto whitespace-pre border-0 bg-transparent p-4 font-mono text-sm leading-6 text-transparent caret-emerald-400 outline-none"
            style={{ caretColor: "#34d399" }}
          />
        </div>
      </div>
    );
  }
);
