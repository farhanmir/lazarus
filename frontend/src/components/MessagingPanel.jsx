import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageCircle, Bot, User } from 'lucide-react'
import { fetchConversation, sendMessage } from '../services/api'

const FALLBACK_ERROR_REPLY = 'Sorry, I could not process your question. Please try again.'

function MessagingPanel({ runId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!runId) return

    let isMounted = true
    setLoading(true)
    fetchConversation(runId)
      .then((res) => {
        if (!isMounted) return
        setMessages(res.messages || [])
      })
      .catch(() => {
        if (!isMounted) return
        setMessages([])
      })
      .finally(() => {
        if (!isMounted) return
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [runId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const question = input.trim()
    if (!question || !runId || sending) return
    setInput('')
    setSending(true)

    // Optimistic user message
    const userMsg = { id: Date.now(), role: 'user', content: question, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])

    try {
      const reply = await sendMessage(runId, question)
      setMessages((prev) => [...prev, reply])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: FALLBACK_ERROR_REPLY,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!runId) {
    return (
      <div className="nexus-glass-card flex flex-col items-center justify-center p-8 text-slate-400">
        <MessageCircle className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Run an analysis first to chat about the results</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="nexus-glass-card flex h-[520px] flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
        <Bot className="h-5 w-5 text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-800">Follow-Up Assistant</h3>
        <span className="ml-auto text-xs text-slate-500">{messages.length} messages</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="text-center text-sm text-slate-500">Loading conversation…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-slate-500 mt-12">
            <p>Ask anything about this analysis run.</p>
            <p className="mt-1 text-xs text-slate-600">
              Try: "What did the advocate propose?" or "What are the risks?"
            </p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg) => {
            const isUser = msg.role === 'user'
            const bubbleClassName = isUser
              ? 'bg-cyan-600/25 text-slate-900 border border-cyan-600/30'
              : 'bg-white/70 text-slate-700 border border-slate-200/80'

            return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20">
                  <Bot className="h-3.5 w-3.5 text-cyan-400" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${bubbleClassName}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sources_json && Array.isArray(msg.sources_json) && msg.sources_json.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {msg.sources_json.map((src, i) => (
                      <span key={`${msg.id}-${src}-${i}`} className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-500 border border-slate-200/80">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isUser && (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20">
                  <User className="h-3.5 w-3.5 text-violet-400" />
                </div>
              )}
            </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200/70 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this analysis…"
            disabled={sending}
            className="message-input flex-1 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

MessagingPanel.propTypes = {
  runId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}

export default MessagingPanel
