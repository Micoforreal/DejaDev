import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/lib/types";

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[12px]">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{chunk}</span>;
  });
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*([-*]|\d+\.)\s+/.test(line));
        if (isList) {
          return (
            <ul key={index} className="space-y-1 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="list-disc text-sm leading-relaxed">
                  {renderInline(line.replace(/^\s*([-*]|\d+\.)\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-sm leading-relaxed">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

type Props = {
  userName: string;
  messages: ChatMessage[];
  streaming: boolean;
  savingMemory: boolean;
  isNewUser?: boolean;
  onSend: (text: string) => void;
  onCheckin: (type: "morning" | "evening", text: string) => void;
  onRecallClick: (text: string) => void;
};

const PROMPTS: Record<"morning" | "evening", string> = {
  morning: "What are you shipping today? Anything carrying over?",
  evening: "What got done? What's still stuck? Energy level?",
};

export function ChatPanel({
  userName,
  messages,
  streaming,
  savingMemory,
  isNewUser,
  onSend,
  onCheckin,
  onRecallClick,
}: Props) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "morning" | "evening">("chat");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [userName, streaming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (mode === "chat") onSend(text);
    else onCheckin(mode, text);
    setMode("chat");
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="panel p-4">
            <p className="font-mono text-xs text-signal">déjà·dev</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Morning, {userName}. Start a check-in and I'll keep the thread across days — blockers,
              velocity, mood, all of it.
              {isNewUser ? (
                <span className="mt-2 block">
                  Select <strong className="font-semibold text-foreground">morning check-in</strong> below to get started.
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className="enter">
            {message.role === "assistant" ? (
              <div className="space-y-2">
                <p className="mono-label">déjà·dev</p>
                {message.recalled && message.recalled.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {message.recalled.slice(0, 4).map((memory, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onRecallClick(memory)}
                        className="rounded-full border border-signal/40 px-2 py-0.5 font-mono text-[10px] text-signal transition-colors hover:bg-signal/10"
                        title={memory}
                      >
                        recalled: {memory.length > 42 ? `${memory.slice(0, 42)}…` : memory}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="text-foreground">
                  {message.content ? (
                    <Markdown text={message.content} />
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground live-dot">
                      thinking…
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-raised px-3 py-2 text-sm leading-relaxed text-foreground">
                  {message.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {savingMemory ? (
          <p className="font-mono text-[11px] text-signal live-dot">
            writing facts to walrus memory…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="border-t border-hairline bg-surface/50 px-4 py-3 sm:px-6"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {(["morning", "evening"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setMode(mode === type ? "chat" : type);
                inputRef.current?.focus();
              }}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                mode === type
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-hairline text-muted-foreground hover:text-foreground"
              }`}
            >
              {type} check-in
            </button>
          ))}
          {mode !== "chat" ? (
            <span className="text-[11px] text-muted-foreground">{PROMPTS[mode]}</span>
          ) : null}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) submit(event);
            }}
            rows={2}
            placeholder={mode === "chat" ? "Talk to your coach…" : PROMPTS[mode]}
            className="min-h-[52px] flex-1 resize-none rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-signal"
          />
          <button
            type="submit"
            disabled={streaming || input.trim().length === 0}
            className="h-[52px] shrink-0 rounded-md bg-signal px-4 font-mono text-xs text-signal-foreground transition-opacity disabled:opacity-40"
          >
            {streaming ? "…" : mode === "chat" ? "send" : "log"}
          </button>
        </div>
      </form>
    </div>
  );
}
