import { Injectable } from '@angular/core';
import { ChatMessage, ConversationMessage, LastCandidate } from '../../shared/models/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatStateService {
  chatMessages:        ChatMessage[]         = [];
  conversationHistory: ConversationMessage[] = [];
  lastCandidates:      LastCandidate[]       = [];
  aiApiKey:            string                = '';

  clear() {
    this.chatMessages        = [];
    this.conversationHistory = [];
    this.lastCandidates      = [];
  }
}