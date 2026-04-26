import { useState, useRef, useEffect } from 'react';
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
    const msg = inputValue;
    setInputValue('');
    await sendMessage(msg);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary hover:bg-primary/90 shadow-2xl"
        aria-label="Open Ella docs assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[500px] max-h-[80vh] bg-black/80 backdrop-blur-[24px] rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-white/20">
            <AvatarImage src={ellaAvatar} alt="Ella" />
            <AvatarFallback>E</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Ella</h3>
            <p className="text-xs text-foreground/60">Docs Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <Avatar className="h-16 w-16 mb-4 border border-white/20">
              <AvatarImage src={ellaAvatar} alt="Ella" />
              <AvatarFallback>E</AvatarFallback>
            </Avatar>
            <h4 className="font-semibold text-foreground mb-2">Hi! I'm Ella ✨</h4>
            <p className="text-sm text-foreground/60 mb-4">
              Ask me anything about the docs — features, tokenomics, or how things work.
            </p>
            <div className="space-y-2 w-full">
              {['What are the platform fees?', 'Tell me about the $FANS token', 'When is the app launching?'].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/80 transition-colors border border-white/10"
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={ellaAvatar} alt="Ella" />
                  <AvatarFallback>E</AvatarFallback>
                </Avatar>
                <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-2 flex gap-1">
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me anything…"
            className="flex-1 bg-white/5 border-white/10"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const Bubble = ({ message }: { message: DocsChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={ellaAvatar} alt="Ella" />
          <AvatarFallback>E</AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-white/10 text-foreground rounded-bl-md'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

export default EllaDocsChat;
