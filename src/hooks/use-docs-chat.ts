import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DocsChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useDocsChat = () => {
  const [messages, setMessages] = useState<DocsChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return false;

    const userMessage: DocsChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    scrollToBottom();

    try {
      const conversationHistory = messages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const { data, error } = await supabase.functions.invoke('ella-docs-assistant', {
        body: { message: content.trim(), conversationHistory },
      });

      if (error || !data?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: "Sorry, I'm having trouble right now. Please try again! 💕",
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.reply,
            timestamp: new Date(),
          },
        ]);
      }
      scrollToBottom();
      return true;
    } catch (err) {
      console.error('Ella docs error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: 'Oops! Something went wrong. Try again? ✨',
          timestamp: new Date(),
        },
      ]);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, scrollToBottom]);

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, isLoading, messagesEndRef, sendMessage, clearChat };
};
