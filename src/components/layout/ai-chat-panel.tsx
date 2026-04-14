'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Bot,
  User,
  Sparkles,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useClaimsStore } from '@/store/claims-store'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  'How do I process a new claim?',
  'What do the confidence scores mean?',
  'Explain the workflow pipeline stages',
  'How does AI classification work?',
]

export function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => `session-${Date.now()}`)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectedClaimId = useClaimsStore((s) => s.selectedClaimId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          sessionId,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-error`,
            role: 'assistant',
            content: `Sorry, I encountered an error: ${data.error}`,
            timestamp: new Date(),
          },
        ])
      } else {
        const aiMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMessage])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: 'Sorry, I couldn\'t connect to the AI service. Please try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId])

  const handleSuggestedPrompt = (prompt: string) => {
    setInput(prompt)
    // Auto-send after setting
    setTimeout(() => {
      const sendBtn = document.querySelector('[data-send-btn]')
      if (sendBtn) (sendBtn as HTMLButtonElement).click()
    }, 100)
  }

  const handleClear = async () => {
    try {
      await fetch(`/api/ai-chat?sessionId=${sessionId}`, { method: 'DELETE' })
      setMessages([])
    } catch {
      // Ignore clear errors
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-sm font-mono">$1</code>')
      .replace(/\n/g, '<br />')
      .replace(/^- (.*)/gm, '<span class="flex gap-2 ml-1">• $1</span>')
      .replace(/^(\d+)\. (.*)/gm, '<span class="flex gap-2 ml-1">$1. $2</span>')
  }

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 btn-press hover:scale-105 group relative pulse-ring"
        >
          <Sparkles className="size-5 group-hover:rotate-12 transition-transform" />
          <span className="text-sm font-medium hidden sm:inline">AI Assistant</span>
          <MessageSquare className="size-4 opacity-70" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 bg-card border shadow-elevated flex flex-col transition-all duration-300 ease-in-out',
            isMinimized
              ? 'bottom-6 right-6 w-72 h-14 rounded-xl overflow-hidden'
              : 'bottom-6 right-6 w-[380px] sm:w-[420px] h-[560px] sm:h-[620px] rounded-2xl overflow-hidden'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/15 via-accent/10 to-primary/5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                <Bot className="size-4.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">AI Claims Assistant</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-4 gap-0.5">
                    <Sparkles className="size-2.5" />
                    AI
                  </Badge>
                </div>
                {!isMinimized && (
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {isLoading ? 'Thinking...' : messages.length === 0 ? 'Ask me anything about claims' : 'Online'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {!isMinimized && messages.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={handleClear}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Clear chat</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setIsMinimized(!isMinimized)}
                  >
                    {isMinimized ? (
                      <Maximize2 className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Minimize2 className="size-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {isMinimized ? 'Expand' : 'Minimize'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="size-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Close</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Messages area */}
          {!isMinimized && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-6 py-8">
                    <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-4">
                      <Bot className="size-7 text-primary" />
                    </div>
                    <h4 className="text-base font-semibold text-foreground mb-1">
                      Stefco AI Assistant
                    </h4>
                    <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                      I can help you with claims processing, insurance queries, and dashboard navigation.
                    </p>
                    <div className="w-full space-y-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSuggestedPrompt(prompt)}
                          className="w-full text-left px-3 py-2.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-sm text-foreground cursor-pointer group"
                        >
                          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                            {prompt}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-4 space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex gap-2.5',
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {msg.role === 'assistant' && (
                          <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                            <Bot className="size-3.5 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          )}
                        >
                          <div
                            dangerouslySetInnerHTML={{
                              __html: formatMessage(msg.content),
                            }}
                          />
                        </div>
                        {msg.role === 'user' && (
                          <div className="flex items-center justify-center size-7 rounded-lg bg-primary shrink-0 mt-0.5">
                            <User className="size-3.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-2.5 justify-start">
                        <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                          <Bot className="size-3.5 text-primary" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="border-t px-4 py-3 shrink-0 bg-background">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about claims, insurance, or the dashboard..."
                    className="min-h-[40px] max-h-[120px] resize-none text-sm py-2.5 pr-3"
                    rows={1}
                    disabled={isLoading}
                  />
                  <Button
                    data-send-btn
                    size="icon"
                    className="size-9 shrink-0 rounded-lg"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 px-0.5">
                  AI-powered by Stefco · Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
