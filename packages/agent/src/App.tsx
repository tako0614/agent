import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Plus, Send, Trash2, Edit3, RotateCcw, Copy, Check, Sun, Moon, Search, MessageSquare, ChevronDown } from "lucide-solid";
import { SolidMarkdown as Markdown } from "solid-markdown";
import remarkGfm from "remark-gfm";

// ---- Types ----
type Role = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// ---- Utils ----
const ROLES: Record<Role, Role> = { user: "user", assistant: "assistant", system: "system" } as const;
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const formatTime = (t: number) => new Date(t).toLocaleString();

const STORAGE = {
  CHATS: "cgpt-ui:chats",
  THEME: "cgpt-ui:theme",
};

const loadChats = (): ChatThread[] => {
  try {
    const raw = localStorage.getItem(STORAGE.CHATS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveChats = (chats: ChatThread[]) => localStorage.setItem(STORAGE.CHATS, JSON.stringify(chats));

const streamText = async ({ fullText, onToken, tokenDelay = 8 }: { fullText: string; onToken: (t: string) => void; tokenDelay?: number; }) => {
  for (let i = 0; i < fullText.length; i++) {
    onToken(fullText[i]);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, tokenDelay));
  }
};

const draftAssistantAnswer = (prompt: string) => {
  const tips = [
    "もちろん！以下は要点です:",
    "ポイントは3つあります:",
    "まず前提を整理しましょう:",
  ];
  const head = tips[Math.floor(Math.random() * tips.length)];
  return `${head}

- あなたの質問: \`${prompt.slice(0, 200)}\`
- 簡潔な回答サマリ

---

### 例コード

\`\`\`ts
function hello(name: string){
  return \`Hello, ${"${name}"}\`;
}
console.log(hello("ChatGPT UI"));
\`\`\`

必要に応じて、追加の詳細やコード例を出力できます。`;
};

// ---- Components ----
const Avatar: Component<{ role: Role }> = (props) => {
  const base = "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold shadow-sm";
  return (
    <div class={
      props.role === ROLES.user
        ? `${base} bg-sky-600 text-white`
        : props.role === ROLES.assistant
        ? `${base} bg-emerald-600 text-white`
        : `${base} bg-zinc-700 text-white`
    }>
      {props.role === ROLES.user ? "U" : props.role === ROLES.assistant ? "A" : "S"}
    </div>
  );
};

const IconButton: Component<{ icon: Component<any>; title?: string; onClick?: (e?: any) => void; class?: string }>
= (props) => {
  const Icon = props.icon;
  return (
    <button
      title={props.title}
      onClick={props.onClick}
      class={`inline-flex items-center justify-center rounded-2xl px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${props.class || ""}`}
    >
      <Icon class="h-4 w-4" />
    </button>
  );
};

const MessageBubble: Component<{ msg: ChatMessage }> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div class="relative flex gap-3">
      <Avatar role={props.msg.role} />
      <div class="group w-full">
        <div
          class={`prose prose-zinc max-w-none rounded-2xl p-4 shadow-sm ring-1 ring-zinc-200 dark:prose-invert dark:ring-zinc-800 ${
            props.msg.role === ROLES.user ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-900/70"
          }`}
        >
          <Markdown remarkPlugins={[remarkGfm]}>{props.msg.content}</Markdown>
        </div>
        <div class="mt-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={copy}
            class="text-xs inline-flex items-center gap-1 rounded-xl px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {copied() ? <Check class="h-3 w-3" /> : <Copy class="h-3 w-3" />} コピー
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatInput: Component<{ value: string; setValue: (v: string) => void; onSend: () => void; disabled?: boolean }>
= (props) => {
  let ref!: HTMLTextAreaElement;

  const autoSize = () => {
    if (!ref) return;
    ref.style.height = "0px";
    ref.style.height = Math.min(180, ref.scrollHeight) + "px";
  };

  createEffect(autoSize);

  const handleKey = (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement; target: Element }) => {
    if (e.key === "Enter" && !(e as any).shiftKey) {
      e.preventDefault();
      if (props.value.trim() && !props.disabled) props.onSend();
    }
  };

  return (
    <div class="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <textarea
        ref={ref}
        rows={1}
        value={props.value}
        onInput={(e) => props.setValue(e.currentTarget.value)}
        onKeyDown={handleKey as any}
        placeholder="メッセージを入力 (Shift+Enterで改行)"
        class="min-h-[44px] max-h-44 w-full resize-none bg-transparent px-3 py-2 outline-none placeholder:text-zinc-400"
      />
      <button
        onClick={props.onSend}
        disabled={props.disabled || !props.value.trim()}
        class="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-zinc-900 px-3 text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        <Send class="h-4 w-4" />
        送信
      </button>
    </div>
  );
};

// ---- Main Component ----
const ChatGPTLikeUI: Component = () => {
  // theme
  const [theme, setTheme] = createSignal<string>(localStorage.getItem(STORAGE.THEME) || "dark");
  createEffect(() => localStorage.setItem(STORAGE.THEME, theme()));

  // chats
  const initialChats = (() => {
    const initial = loadChats();
    if (initial.length) return initial;
    const first: ChatThread = {
      id: uid(),
      title: "新しいチャット",
      messages: [
        {
          id: uid(),
          role: ROLES.assistant,
          content: `こんにちは！左上の『新規』からチャットを増やせます。下の入力欄にメッセージを書いて送信してください。

> このUIはデモです。実サービス接続は 'handleSend' 内を差し替えてください。`,
          createdAt: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveChats([first]);
    return [first];
  })();

  const [chats, setChats] = createSignal<ChatThread[]>(initialChats);

  // current chat id
  const [currentId, setCurrentId] = createSignal<string | null>(chats()[0] ? chats()[0].id : null);
  const current = createMemo<ChatThread | null>(() => chats().find((c) => c.id === currentId()) || null);

  const [query, setQuery] = createSignal("");
  const [input, setInput] = createSignal("");
  const [isStreaming, setIsStreaming] = createSignal(false);

  // persist
  createEffect(() => saveChats(chats()));

  // keyboard shortcuts
  const onKey = (e: KeyboardEvent) => {
    // New chat: Cmd/Ctrl+N
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
      e.preventDefault();
      newChat();
    }
    // Focus search: Cmd/Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const el = document.getElementById("chat-search") as HTMLInputElement | null;
      el?.focus();
    }
  };
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));

  const updateChat = (id: string, patch: Partial<ChatThread>) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
  };

  const newChat = () => {
    const c: ChatThread = { id: uid(), title: "新しいチャット", messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    setChats((prev) => [c, ...prev]);
    setCurrentId(c.id);
    setInput("");
  };

  const deleteChat = (id: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (currentId() === id) setCurrentId(next[0]?.id ?? null);
      return next;
    });
  };

  const renameChat = (id: string) => {
    const title = window.prompt("新しいタイトル");
    if (title) updateChat(id, { title });
  };

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = chats();
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)));
  });

  let containerRef!: HTMLDivElement;
  createEffect(() => {
    // scroll to bottom on message change
    const len = current()?.messages.length; // read dependency
    if (!containerRef) return;
    queueMicrotask(() => (containerRef.scrollTop = containerRef.scrollHeight));
    return len;
  });

  const handleSend = async () => {
    const chat = current();
    if (!chat) return;
    const content = input().trim();
    if (!content) return;

    setInput("");
    const userMsg: ChatMessage = { id: uid(), role: ROLES.user, content, createdAt: Date.now() };
    const assistantMsg: ChatMessage = { id: uid(), role: ROLES.assistant, content: "", createdAt: Date.now() };

    updateChat(chat.id, { messages: [...chat.messages, userMsg, assistantMsg] });
    setIsStreaming(true);

    // --- Replace this block with your real API call ---
    const reply = draftAssistantAnswer(content);
    await streamText({
      fullText: reply,
      onToken: (t) => {
        setChats((prev) =>
          prev.map((c) =>
            c.id === chat.id
              ? { ...c, messages: c.messages.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + t } : m)) }
              : c
          )
        );
      },
    });
    // --- end mock ---

    setIsStreaming(false);
  };

  const regenerateLast = async () => {
    const chat = current();
    if (!chat) return;
    const msgs = chat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === ROLES.user) {
        const promptText = msgs[i].content;
        const idxAssistant = i + 1;
        if (msgs[idxAssistant] && msgs[idxAssistant].role === ROLES.assistant) {
          const targetId = msgs[idxAssistant].id;
          setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, messages: c.messages.map((m) => (m.id === targetId ? { ...m, content: "" } : m)) } : c)));
          setIsStreaming(true);
          const reply = draftAssistantAnswer(promptText);
          await streamText({
            fullText: reply,
            onToken: (t) =>
              setChats((prev) =>
                prev.map((c) =>
                  c.id === chat.id
                    ? { ...c, messages: c.messages.map((m) => (m.id === targetId ? { ...m, content: m.content + t } : m)) }
                    : c
                )
              ),
          });
          setIsStreaming(false);
        }
        break;
      }
    }
  };

  return (
    <div class={`${theme() === "dark" ? "dark" : ""} w-full h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50`}>
      <div class="grid h-full grid-cols-1 md:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside class="hidden md:flex flex-col gap-3 border-r border-zinc-200 p-3 dark:border-zinc-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 font-semibold">
              <MessageSquare class="h-5 w-5" /> Chat
            </div>
            <div class="flex items-center gap-1">
              <IconButton icon={Plus} title="新規" onClick={newChat} />
              <IconButton icon={theme() === "dark" ? Sun : Moon} title="テーマ切替" onClick={() => setTheme(theme() === "dark" ? "light" : "dark")} />
            </div>
          </div>

          <div class="flex items-center gap-2 rounded-xl border border-zinc-200 px-2 py-1 dark:border-zinc-800">
            <Search class="h-4 w-4 text-zinc-400" />
            <input
              id="chat-search"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="検索 (⌘/Ctrl+K)"
              class="w-full bg-transparent py-1 text-sm outline-none placeholder:text-zinc-400"
            />
          </div>

          <div class="flex-1 overflow-y-auto pr-1">
            <ul class="space-y-1">
              <For each={filtered()}>
                {(c) => (
                  <li>
                    <button
                      onClick={() => setCurrentId(c.id)}
                      class={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 ${currentId() === c.id ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
                    >
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium">{c.title}</div>
                        <div class="truncate text-xs text-zinc-500">{formatTime(c.updatedAt)}</div>
                      </div>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <IconButton icon={Edit3} title="名前変更" onClick={(e) => { e.stopPropagation(); renameChat(c.id); }} />
                        <IconButton icon={Trash2} title="削除" onClick={(e) => { e.stopPropagation(); if (confirm("削除しますか？")) deleteChat(c.id); }} />
                      </div>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </div>

          <div class="text-[11px] text-zinc-500">⌘/Ctrl+N で新規、⌘/Ctrl+K で検索</div>
        </aside>

        {/* Main */}
        <main class="flex h-full flex-col">
          {/* Header */}
          <header class="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-3 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
            <div class="flex items-center gap-2">
              <button
                class="md:hidden inline-flex items-center gap-2 rounded-xl border px-2 py-1 text-sm dark:border-zinc-800"
                onClick={() => alert("小画面ではサイドバーは省略しています。幅を広げてください。")}
              >
                メニュー <ChevronDown class="h-4 w-4" />
              </button>
              <div class="font-semibold">{current()?.title || "チャット"}</div>
              <span class="text-xs text-zinc-500">{current() ? `${current()!.messages.length} メッセージ` : ""}</span>
            </div>
            <div class="flex items-center gap-2">
              <select class="rounded-xl border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-800" value="gpt-4o" title="モデル (ダミー)">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
              <IconButton icon={theme() === "dark" ? Sun : Moon} title="テーマ切替" onClick={() => setTheme(theme() === "dark" ? "light" : "dark")} />
              <IconButton icon={RotateCcw} title="直前の応答を再生成" onClick={regenerateLast} />
            </div>
          </header>

          {/* Messages */}
          <div ref={containerRef} class="flex-1 space-y-6 overflow-y-auto p-4">
            <Show when={current() && current()!.messages.length === 0}>
              <div class="mx-auto max-w-xl rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-800">
                会話を始めましょう。下の入力欄にメッセージを書いて送信してください。
              </div>
            </Show>

            <For each={current()?.messages || []}>{(m) => <MessageBubble msg={m} />}</For>

            {/* bottom spacer */}
            <div class="h-24" />
          </div>

          {/* Composer */}
          <div class="sticky bottom-0 z-10 border-t border-zinc-200 bg-gradient-to-t from-white via-white to-white/70 p-3 backdrop-blur-md dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950/70">
            <div class="mx-auto max-w-3xl">
              <ChatInput value={input()} setValue={setInput} onSend={handleSend} disabled={isStreaming() || !current()} />
              <div class="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                <div>Enterで送信 / Shift+Enterで改行</div>
                <div>{isStreaming() ? "応答を生成中…" : ""}</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ChatGPTLikeUI;
