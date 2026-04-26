import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useDocsChat, type DocsChatMessage } from '@/hooks/use-docs-chat';
import ellaAvatar from '@/assets/ella-avatar.png';

const EllaDocsChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, messagesEndRef, sendMessage, clearChat } = useDocsChat();

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const m = inputValue;
    setInputValue('');
    await sendMessage(m);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-2xl"
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[540px] max-h-[80vh] bg-black/80 backdrop-blur-[24px] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-white/50">
                  <AvatarImage src={ellaAvatar} alt="Ella" />
                  <AvatarFallback className="bg-purple-400 text-white">E</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm">Ella</h3>
                  <p className="text-xs text-white/80">Docs Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-2 py-6">
                  <Avatar className="h-16 w-16 mb-4 border-2 border-purple-400/40">
                    <AvatarImage src={ellaAvatar} alt="Ella" />
                    <AvatarFallback className="bg-purple-400 text-white text-xl">E</AvatarFallback>
                  </Avatar>
                  <h4 className="font-semibold text-foreground mb-2">Hi! I'm Ella ✨</h4>
                  <p className="text-sm text-foreground/60 mb-4">
                    Ask me anything about fan.site docs! I can explain features, tokenomics, and how things work.
                  </p>
                  <div className="space-y-2 w-full">
                    {[
                      'What are the platform fees?',
                      'Tell me about the $FANS token',
                      'When is the app launching?',
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/80 transition-colors border border-white/10"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m) => <Bubble key={m.id} message={m} />)}
                  {isLoading && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={ellaAvatar} alt="Ella" />
                        <AvatarFallback className="bg-purple-400 text-white text-xs">E</AvatarFallback>
                      </Avatar>
                      <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  ref={inputRef} value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask me anything…"
                  className="flex-1 bg-white/5 border-white/10 text-foreground placeholder:text-foreground/40"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend} disabled={!inputValue.trim() || isLoading}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const Bubble = ({ message }: { message: DocsChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={ellaAvatar} alt="Ella" />
          <AvatarFallback className="bg-purple-400 text-white text-xs">E</AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
        isUser
          ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-br-md'
          : 'bg-white/10 text-foreground rounded-bl-md border border-white/10'
      }`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

export default EllaDocsChat;
