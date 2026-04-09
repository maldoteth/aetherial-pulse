/**
 * Chat AI Model Constants
 * ========================
 * Defines available chat AI models for the assistant.
 */

export interface ChatModelOption {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

// Available chat models
export const CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Fansite trained model',
    emoji: '✨'
  },
  {
    id: 'wizardlm',
    name: 'WizardLM',
    description: 'Uncensored & powerful',
    emoji: '🐬'
  },
  {
    id: 'grok-4',
    name: 'Grok 4',
    description: 'xAI flagship $$$',
    emoji: '🔮'
  }
];

// Helper to get model by ID
export function getChatModelById(id: string): ChatModelOption | undefined {
  return CHAT_MODEL_OPTIONS.find(m => m.id === id);
}

// Default model - AUTO for smart selection
export const DEFAULT_CHAT_MODEL = 'auto';

export type ChatModelKey = typeof CHAT_MODEL_OPTIONS[number]['id'];
