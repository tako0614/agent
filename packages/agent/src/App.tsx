import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';

/**
 * ChatGPT-like UI built with SolidJS + Tailwind CSS
 * -------------------------------------------------
 * - Responsive sidebar with conversations
 * - Sticky header with model selector & actions
 * - Scrollable message area with assistant/user bubbles
 * - Copy-to-clipboard, timestamps, and hover actions
 * - Chat input with shift+enter for newline, autosizing textarea
 * - Fake assistant reply to demonstrate flow (replace with your API call)
 * - Dark mode toggle (persists in localStorage)
 */

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

interface Conversation {
  id: string;
  title: string;
  lastUpdated: number;
}

// --- Utilities ---
const uid = () => Math.random().toString(36).slice(2);
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function IconSend(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  );
}

function IconPlus(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  );
}

function IconMoon(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  );
}

function IconSun(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
  );
}

function IconTrash(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6l1-2h4l1 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  );
}

function IconCopy(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
      <rect x="2" y="2" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
    </svg>
  );
}

function IconStop(props: { class?: string }) {
  return (
    <svg class={props.class} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
    </svg>
  );
}

export default function App() {
  // --- State ---
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  // compute concrete initial values (avoid passing a function to createSignal)
  const initialTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  const initialConversations: Conversation[] = [
    { id: uid(), title: '新しいチャット', lastUpdated: Date.now() },
  ];
  const initialMessages: Message[] = [
    { id: uid(), role: 'assistant', content: 'こんにちは！ChatGPT風のUIです。ご質問はありますか？', createdAt: Date.now() }
  ];

  const [theme, setTheme] = createSignal<'light' | 'dark'>(initialTheme);
  const [conversations, setConversations] = createSignal<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = createSignal(initialConversations[0].id);
  const [messages, setMessages] = createSignal<Message[]>(initialMessages);

  const [input, setInput] = createSignal('');
  const [isThinking, setIsThinking] = createSignal(false);
  let scrollRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  let thinkTimer: number | undefined;

  // --- Effects ---
  onMount(() => {
    document.documentElement.classList.toggle('dark', theme() === 'dark');
    queueMicrotask(scrollToBottom);
  });

  createEffect(() => {
    // Auto-scroll when messages change
    messages();
    scrollToBottom();
  });

  createEffect(() => {
    localStorage.setItem('theme', theme());
    document.documentElement.classList.toggle('dark', theme() === 'dark');
  });

  onCleanup(() => {
    if (thinkTimer) window.clearTimeout(thinkTimer);
  });

  // --- Handlers ---
  const scrollToBottom = () => {
    if (!scrollRef) return;
    scrollRef.scrollTo({ top: scrollRef.scrollHeight, behavior: 'smooth' });
  };

  const autosize = () => {
    if (!textareaRef) return;
    textareaRef.style.height = 'auto';
    textareaRef.style.height = textareaRef.scrollHeight + 'px';
  };

  const newChat = () => {
    const c: Conversation = { id: uid(), title: '新しいチャット', lastUpdated: Date.now() };
    setConversations([c, ...conversations()]);
    setActiveId(c.id);
    setMessages([{ id: uid(), role: 'assistant', content: '新しいチャットを始めました。何を話しますか？', createdAt: Date.now() }]);
    setInput('');
    queueMicrotask(scrollToBottom);
  };

  const clearChat = () => {
    setMessages([]);
    setTimeout(() => setMessages([{ id: uid(), role: 'assistant', content: '履歴をクリアしました。何でも聞いてください！', createdAt: Date.now() }]), 80);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // noop
    }
  };

  const stopThinking = () => {
    if (thinkTimer) window.clearTimeout(thinkTimer);
    setIsThinking(false);
  };

  const send = () => {
    const value = input().trim();
    if (!value || isThinking()) return;

    // Update title from first user message
    if (messages().length <= 1 && conversations().find(c => c.id === activeId())) {
      const firstLine = value.split('\n')[0].slice(0, 30) || '新しいチャット';
      setConversations(prev => prev.map(c => c.id === activeId() ? { ...c, title: firstLine, lastUpdated: Date.now() } : c));
    }

    const userMsg: Message = { id: uid(), role: 'user', content: value, createdAt: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    autosize();
    setIsThinking(true);

    // Fake assistant reply (replace with your API call)
    thinkTimer = window.setTimeout(() => {
      const reply = makeFakeReply(value);
      const aiMsg: Message = { id: uid(), role: 'assistant', content: reply, createdAt: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
      setIsThinking(false);
    }, 700);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // --- Demo reply generator ---
  const makeFakeReply = (prompt: string) => {
    const templates = [
      `要約:\n- ${prompt.slice(0, 80)}\n\n補足: これはデモ返信です。バックエンドに接続すれば本物の回答が返せます。`,
      `考え方:\n1) 問題を分解\n2) 選択肢を比較\n3) 手順化\n\n回答: ${prompt ? '「' + prompt.slice(0, 60) + '」について解説します。' : 'ご質問にお答えします。'}`,
      `コード例:\n\n\`\`\`ts\n// これはダミーコードです\nconst answer = ${JSON.stringify(prompt.slice(0, 30))};\nconsole.log(answer);\n\`\`\`\n\nご参考になれば幸いです。`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  };

  // --- Render ---
  return (
    <div class="h-screen w-full flex bg-gray-50 text-slate-900 dark:bg-neutral-900 dark:text-neutral-100">
      {/* Sidebar */}
      <aside class={
        'fixed inset-y-0 left-0 z-40 w-72 transform border-r border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/80 dark:border-white/5 transition md:static md:translate-x-0 ' +
        (sidebarOpen() ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
      }>
        <div class="flex h-full flex-col">
          <div class="flex items-center gap-2 p-4 border-b border-black/5 dark:border-white/5">
            <button
              onClick={newChat}
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white shadow hover:bg-emerald-700 active:scale-[.99]"
            >
              <IconPlus class="h-5 w-5" />
              <span class="font-medium">新しいチャット</span>
            </button>
          </div>
          <nav class="flex-1 overflow-y-auto p-2 space-y-2">
            <For each={conversations()}>
              {(c) => (
                <button
                  class={
                    'w-full text-left rounded-xl px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition ' +
                    (c.id === activeId() ? 'bg-black/5 dark:bg-white/5' : '')
                  }
                  onClick={() => setActiveId(c.id)}
                >
                  <div class="truncate font-medium">{c.title}</div>
                  <div class="text-xs text-slate-500 dark:text-neutral-400">{new Date(c.lastUpdated).toLocaleString()}</div>
                </button>
              )}
            </For>
          </nav>
          <div class="mt-auto p-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
            <button
              onClick={() => setTheme(theme() === 'dark' ? 'light' : 'dark')}
              class="inline-flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Show when={theme() === 'dark'} fallback={<IconMoon class="h-5 w-5" />}>
                <IconSun class="h-5 w-5" />
              </Show>
              <span class="text-sm">テーマ</span>
            </button>
            <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">v0.1</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div class="flex flex-1 flex-col">
        {/* Header */}
        <header class="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-900/80 dark:border-white/5">
          <div class="mx-auto max-w-3xl px-3 py-2 md:px-6">
            <div class="flex items-center gap-2">
              <button class="md:hidden rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setSidebarOpen(!sidebarOpen())}>
                {/* hamburger */}
                <div class="space-y-1.5">
                  <div class="h-0.5 w-5 bg-current"></div>
                  <div class="h-0.5 w-4 bg-current"></div>
                  <div class="h-0.5 w-6 bg-current"></div>
                </div>
              </button>
              <div class="text-sm text-slate-500 dark:text-neutral-400">会話</div>
              <div class="mx-2 text-slate-400">/</div>
              <div class="font-semibold truncate">{conversations().find(c => c.id === activeId())?.title || 'チャット'}</div>
              <div class="ml-auto flex items-center gap-2">
                <select class="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10">
                  <option>gpt-4o-mini</option>
                  <option>gpt-4o</option>
                  <option>gpt-4.1</option>
                </select>
                <button onClick={clearChat} class="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5" title="履歴をクリア">
                  <IconTrash class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} class="flex-1 overflow-y-auto">
          <div class="mx-auto max-w-3xl px-3 py-4 md:px-6 md:py-6 space-y-4">
            <For each={messages()}>
              {(m) => (
                <div class="group">
                  <div class="flex items-start gap-3">
                    {/* Avatar */}
                    <div class={
                      'mt-0.5 flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold text-white ' +
                      (m.role === 'assistant' ? 'bg-emerald-600' : 'bg-sky-600')
                    }>
                      {m.role === 'assistant' ? 'AI' : 'You'}
                    </div>

                    {/* Bubble */}
                    <div class="relative max-w-prose rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
                      <div class="prose prose-slate max-w-none whitespace-pre-wrap dark:prose-invert">
                        {m.content}
                      </div>
                      <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400">
                        <span>{fmtTime(m.createdAt)}</span>
                        <button class="opacity-0 transition group-hover:opacity-100 hover:underline inline-flex items-center gap-1" onClick={() => copyText(m.content)}>
                          <IconCopy class="h-3 w-3" />
                          <span>コピー</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>

            <Show when={isThinking()}>
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">AI</div>
                <div class="relative max-w-prose rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
                  <div class="inline-flex items-center gap-2 text-sm">
                    <span class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-.2s]"></span>
                    <span class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-.1s]"></span>
                    <span class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current"></span>
                    <span class="ml-2 text-slate-500 dark:text-neutral-400">考え中…</span>
                  </div>
                  <div class="mt-2">
                    <button onClick={stopThinking} class="inline-flex items-center gap-2 rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5">
                      <IconStop class="h-4 w-4" /> 停止
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>

        {/* Composer */}
        <div class="sticky bottom-0 z-20 border-t border-black/5 bg-gradient-to-t from-white/90 to-white/70 backdrop-blur dark:from-neutral-900/90 dark:to-neutral-900/70 dark:border-white/5">
          <div class="mx-auto max-w-3xl px-3 py-4 md:px-6">
            <div class="rounded-2xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-neutral-900">
              <div class="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input()}
                  onInput={(e) => { setInput(e.currentTarget.value); autosize(); }}
                  onKeyDown={handleKeyDown as any}
                  rows={1}
                  placeholder="メッセージを入力 (Shift+Enterで改行)"
                  class="min-h-[2.5rem] max-h-48 w-full resize-none bg-transparent px-3 py-2 outline-none placeholder:text-slate-400"
                />
                <button
                  onClick={send}
                  disabled={!input().trim() || isThinking()}
                  class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-700"
                  title="送信 (Enter)"
                >
                  <IconSend class="h-5 w-5" />
                </button>
              </div>
              <div class="mt-1 flex items-center justify-between px-1">
                <div class="text-[11px] text-slate-500 dark:text-neutral-400">これはUIデモです。バックエンドに接続して実際の回答を取得できます。</div>
                <div class="text-[11px] text-slate-500 dark:text-neutral-400">Shift+Enterで改行</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
