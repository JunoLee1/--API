import { ko } from './messages/ko';
import { en } from './messages/en';

const messages = { ko, en } as const;

export function getMessages(locale: string | null | undefined) {
  return messages[(locale ?? 'ko') as 'ko' | 'en'] ?? messages.ko;
}

export type { Messages } from './messages/ko';
