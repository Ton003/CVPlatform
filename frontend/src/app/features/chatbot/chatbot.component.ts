import { Component, ViewChild, ElementRef, AfterViewChecked, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule }           from '@angular/common';
import { FormsModule }            from '@angular/forms';
import { HttpClient }             from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize }               from 'rxjs';
import { AuthService }            from '../../core/services/auth.service';
import { ChatStateService }       from '../../core/services/chat-state.service';
import { ApiKeyService }          from '../../core/services/api-key.service';
import { ToastService }           from '../../core/services/toast.service';

import { environment }            from '../../../environments/environment';
import {
  ChatMessage, ConversationMessage, LastCandidate,
  CandidateMatch, SearchResult,
} from '../../shared/models/chat.models';

@Component({
  selector:    'app-chatbot',
  standalone:  true,
  imports:     [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls:   ['./chatbot.component.scss'],
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatEnd') chatEnd!: ElementRef;

  mode: 'local' | 'groq' = 'groq';
  personTypeFilter: 'all' | 'candidate' | 'employee' = 'all';

  jobDescription = '';
  loading        = false;
  result:  SearchResult | null = null;
  error:   string | null       = null;

  chatInput     = '';
  chatMessages: ChatMessage[] = [];
  chatLoading   = false;

  private conversationHistory: ConversationMessage[] = [];
  private lastCandidates: LastCandidate[] = [];
  private shouldScroll = false;

  constructor(
    private readonly http:        HttpClient,
    private readonly authService: AuthService,
    private readonly chatState:   ChatStateService,
    private readonly apiKey:      ApiKeyService,
    private readonly toast:       ToastService,
    private readonly router:      Router,
    private readonly cdr:         ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.chatMessages        = [...this.chatState.chatMessages];
    this.conversationHistory = [...this.chatState.conversationHistory];
    this.lastCandidates      = [...this.chatState.lastCandidates];
    this.mode                = this.chatState.mode;
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      try { this.chatEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' }); } catch {}
      this.shouldScroll = false;
    }
  }

  openProfile(candidateId: string): void {
    this.chatState.mode       = this.mode;
    this.router.navigate(['/candidates', candidateId], { queryParams: { from: 'chatbot' } });
  }

  toggleMode(m: 'local' | 'groq') {
    this.mode = m;
    this.chatState.mode = m;
    this.result = null;
    this.error  = null;
  }

  logout(): void { this.authService.logout(); }

  get canSearch(): boolean { return !!this.jobDescription.trim() && !this.loading; }
  get canChat(): boolean {
    if (this.mode === 'groq' && !this.apiKey.has()) return false;
    return !!this.chatInput.trim() && !this.chatLoading;
  }

  search() {
    if (!this.canSearch) return;
    this.loading = true;
    this.result  = null;
    this.error   = null;

    this.http.post<SearchResult>(
      `${environment.apiUrl}/chatbot/recommend`,
      { message: this.jobDescription, mode: 'local', personType: this.personTypeFilter }
    ).pipe(
      finalize(() => { this.loading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next:  r => { this.result = r; },
      error: e => { this.error  = e.error?.message ?? 'Search failed.'; },
    });
  }

  clearSearch() { this.jobDescription = ''; this.result = null; this.error = null; }

  sendChat() {
    if (!this.canChat) {
      if (this.mode === 'groq' && !this.apiKey.has()) {
        this.toast.error('AI Mode requires a Groq API key. Please add it in the sidebar settings.');
      }
      return;
    }

    const userMessage = this.chatInput.trim();
    this.chatInput = '';

    this.chatMessages = [...this.chatMessages, { role: 'user', content: userMessage, timestamp: new Date() }];
    const loadingIndex = this.chatMessages.length;
    this.chatMessages = [...this.chatMessages, { role: 'assistant', content: '', loading: true, timestamp: new Date() }];

    this.chatLoading  = true;
    this.shouldScroll = true;
    this.cdr.detectChanges();

    this.http.post<SearchResult>(
      `${environment.apiUrl}/chatbot/recommend`,
      {
        message:        userMessage,
        mode:           'groq',
        apiKey:         this.apiKey.get(),
        history:        this.conversationHistory,
        lastCandidates: this.lastCandidates,
        personType:     this.personTypeFilter,
      }
    ).pipe(
      finalize(() => { this.chatLoading = false; this.shouldScroll = true; this.cdr.detectChanges(); })
    ).subscribe({
      next: res => {
        const assistantText = res.ragAnalysis?.answer ?? res.aiRecommendation ?? res.message;
        const updated = [...this.chatMessages];
        updated[loadingIndex] = { role: 'assistant', content: assistantText, result: res, loading: false, timestamp: new Date() };
        this.chatMessages = updated;

        this.conversationHistory = [...this.conversationHistory,
          { role: 'user',      content: userMessage   },
          { role: 'assistant', content: assistantText },
        ];
        if (this.conversationHistory.length > 12) this.conversationHistory = this.conversationHistory.slice(-12);

        if (res.candidates?.length > 0) {
          this.lastCandidates = res.candidates.map((c: CandidateMatch) => ({
            candidateId: c.candidateId, name: c.name, currentTitle: c.currentTitle,
            location: c.location, yearsExp: c.yearsExp, skills: c.skills,
            matchScore: c.matchScore, email: c.email,
          }));
        }

        this.chatState.chatMessages        = [...this.chatMessages];
        this.chatState.conversationHistory = [...this.conversationHistory];
        this.chatState.lastCandidates      = [...this.lastCandidates];
        this.cdr.detectChanges();
      },
      error: err => {
        const updated = [...this.chatMessages];
        updated[loadingIndex] = { role: 'assistant', content: err.error?.message ?? 'Something went wrong.', loading: false, timestamp: new Date() };
        this.chatMessages = updated;
        this.cdr.detectChanges();
      },
    });
  }

  onChatKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendChat(); }
  }

  clearChat() {
    this.chatMessages = []; this.conversationHistory = []; this.lastCandidates = [];
    this.chatState.clear();
    this.cdr.detectChanges();
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#f43f5e';
  }

  getNoteForCandidate(notes: any[], candidateName: string): any | null {
    if (!notes?.length) return null;
    const nameLow = candidateName.toLowerCase().trim();
    return notes.find(n => n.name?.toLowerCase().trim() === nameLow)
      ?? notes.find(n => { const nl = n.name?.toLowerCase().trim() ?? ''; return nameLow.includes(nl) || nl.includes(nameLow); })
      ?? notes.find(n => nameLow.split(' ')[0] === n.name?.toLowerCase().trim().split(' ')[0])
      ?? null;
  }

  getFollowUpQuestion(msg: ChatMessage): string { return msg.result?.ragAnalysis?.followUpQuestion ?? ''; }
  getBestMatch(msg: ChatMessage): string        { return msg.result?.ragAnalysis?.bestMatch        ?? ''; }
  getCandidateNotes(msg: ChatMessage): any[]    { return msg.result?.ragAnalysis?.candidateNotes   ?? []; }

  sendFollowUp(question: string) { this.chatInput = question; this.sendChat(); }
}