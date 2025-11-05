"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_MODEL = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
const MODELS = [
  { id: "Qwen2-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2 0.5B (fastest)" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B" },
  { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC", label: "Llama 3.1 8B (slow, high quality)" },
];

export default function Home() {
  const [engine, setEngine] = useState(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const engineRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // load model on mount
    loadModel(selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadModel(modelId) {
    try {
      setError("");
      setIsLoadingModel(true);
      setInitProgress(0);
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          if (report.progress) setInitProgress(Math.floor(report.progress * 100));
        },
      });
      engineRef.current = engine;
      setEngine(engine);
    } catch (e) {
      console.error(e);
      setError("Failed to load model. Try another model or refresh.");
    } finally {
      setIsLoadingModel(false);
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }

  async function handleSend() {
    if (!input.trim() || !engineRef.current || generating) return;
    setError("");

    const userMessage = { role: "user", content: input.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    setGenerating(true);
    const abortController = new AbortController();
    abortRef.current = abortController;

    const assistantMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const completion = await engineRef.current.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful, concise AI assistant. Keep responses short and clear.",
          },
          ...nextMessages,
        ],
        stream: true,
        temperature: 0.7,
      });

      for await (const part of completion) {
        const delta = part?.choices?.[0]?.delta?.content ?? "";
        if (typeof delta === "string" && delta.length > 0) {
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: (updated[lastIndex].content || "") + delta,
            };
            return updated;
          });
          scrollToBottom();
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e);
        setError("Generation failed. Try again.");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  function handleAbort() {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
  }

  async function handleChangeModel(e) {
    const modelId = e.target.value;
    setSelectedModel(modelId);
    await loadModel(modelId);
  }

  function handleClear() {
    setMessages([]);
    setError("");
  }

  return (
    <main className="container">
      <header className="topbar">
        <div className="brand">AI Chat</div>
        <div className="controls">
          <select
            value={selectedModel}
            onChange={handleChangeModel}
            disabled={isLoadingModel || generating}
            aria-label="Select model"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={handleClear} disabled={generating}>
            Clear
          </button>
        </div>
      </header>

      {isLoadingModel && (
        <div className="banner">
          Loading model? {initProgress}%
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <section className="chat" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">
            <h2>Welcome</h2>
            <p>Type a message below to start chatting. Runs fully in your browser.</p>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={`msg ${m.role}`}>
            <div className="role">{m.role === "user" ? "You" : "AI"}</div>
            <div className="bubble">{m.content}</div>
          </div>
        ))}
      </section>

      <footer className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={engine ? "Write a message?" : "Loading model?"}
          disabled={!engine || isLoadingModel || generating}
          rows={2}
        />
        <div className="composer-actions">
          <button onClick={handleSend} disabled={!engine || isLoadingModel || generating || !input.trim()}>
            Send
          </button>
          {generating && (
            <button className="secondary" onClick={handleAbort}>
              Stop
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}
