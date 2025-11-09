import { Component, ChangeDetectionStrategy, signal, inject, effect, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';
import { ChatMessage } from './models/chat.model';
import { ChatMessageComponent } from './components/chat-message/chat-message.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ChatMessageComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private chatContainerEl = viewChild<ElementRef>('chatContainer');

  step = signal<'initial' | 'chatting' | 'analysis'>('initial');
  isLoading = signal(false);
  chatHistory = signal<ChatMessage[]>([]);
  make = signal('');
  model = signal('');
  questionCount = signal(0);
  errorMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      // Auto-scroll to the bottom when chat history changes
      if (this.chatHistory().length && this.chatContainerEl()) {
        const element = this.chatContainerEl()?.nativeElement;
        setTimeout(() => element.scrollTop = element.scrollHeight, 0);
      }
    });
  }

  async startAdvisor(makeInput: HTMLInputElement, modelInput: HTMLInputElement): Promise<void> {
    const make = makeInput.value.trim();
    const model = modelInput.value.trim();

    if (!make || !model) {
      this.errorMessage.set('Molimo unesite i marku i model.');
      return;
    }
    this.errorMessage.set(null);
    this.make.set(make);
    this.model.set(model);
    this.step.set('chatting');
    this.isLoading.set(true);

    try {
      const firstQuestion = await this.geminiService.startConversation(make, model);
      this.chatHistory.set([{ role: 'model', content: firstQuestion }]);
      this.questionCount.set(1);
    } catch (e) {
      this.chatHistory.set([{ role: 'model', content: 'Došlo je do pogreške. Molimo osvježite stranicu i pokušajte ponovno.' }]);
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  async sendMessage(promptInput: HTMLInputElement): Promise<void> {
    const prompt = promptInput.value.trim();
    if (!prompt || this.isLoading()) return;

    promptInput.value = '';
    this.chatHistory.update(h => [...h, { role: 'user', content: prompt }]);
    this.isLoading.set(true);
    
    try {
      const response = await this.geminiService.nextStep(this.chatHistory(), this.make(), this.model(), this.questionCount());

      if (response.trim() === 'ANALYSIS_READY') {
        this.step.set('analysis');
        const analysis = await this.geminiService.generateAnalysis(this.chatHistory(), this.make(), this.model());
        this.chatHistory.update(h => [...h, { role: 'model', content: analysis }]);
      } else {
        this.chatHistory.update(h => [...h, { role: 'model', content: response }]);
        this.questionCount.update(c => c + 1);
      }
    } catch (e) {
      this.chatHistory.update(h => [...h, { role: 'model', content: 'Došlo je do pogreške prilikom obrade vašeg zahtjeva.' }]);
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}