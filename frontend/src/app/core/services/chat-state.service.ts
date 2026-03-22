import { Injectable } from '@angular/core';
import { ChatMessage, ConversationMessage, LastCandidate } from '../../shared/models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatStateService {
  chatMessages:        ChatMessage[]         = [];
  conversationHistory: ConversationMessage[] = [];
  lastCandidates:      LastCandidate[]       = [];
  groqApiKey:          string                = '';
  mode:                'local' | 'groq'      = 'groq';

  clear() {
    this.chatMessages        = [];
    this.conversationHistory = [];
    this.lastCandidates      = [];
  }
}