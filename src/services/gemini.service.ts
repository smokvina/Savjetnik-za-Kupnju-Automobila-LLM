// FIX: Replaced placeholder content with a full implementation of GeminiService. This resolves the module and compilation errors.
import { Injectable } from '@angular/core';
import { GoogleGenAI, Chat, GenerateContentResponse } from '@google/genai';
import { ChatMessage } from '../models/chat.model';

// The build environment is expected to handle process.env.API_KEY.
// This declaration is to satisfy TypeScript.
declare const process: {
  env: {
    API_KEY: string;
  };
};

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  private readonly SYSTEM_PROMPT = `Vi ste stručni savjetnik za kupnju automobila. Vaš je cilj razumjeti potrebe korisnika kako biste mu preporučili najbolji automobil.

Upute:
1.  Dobit ćete početnu točku: marku i model automobila za koji je korisnik zainteresiran.
2.  Vaš je zadatak postaviti seriju od najviše 5 pojašnjavajućih pitanja kako biste dubinski razumjeli korisničke preferencije i zahtjeve.
3.  Pitanja trebaju biti raznolika i pokrivati teme kao što su budžet (u eurima), dnevna putovanja, veličina obitelji, primarna namjena (npr. gradska vožnja, duga putovanja) i važne značajke (npr. sigurnost, tehnologija, potrošnja goriva).
4.  Nakon što korisnik odgovori na 5. pitanje, MORATE odgovoriti točnim nizom znakova "ANALYSIS_READY". Nemojte dodavati nikakav drugi tekst.
5.  Kada se od vas zatraži da generirate konačnu analizu, vaš izlaz mora biti sveobuhvatan izvještaj u Markdown formatu, podijeljen u tri dijela:
    a. **Analiza odabranog vozila:** Detaljna analiza početnog automobila na temelju korisnikovih odgovora.
    b. **Prijedlozi alternativnih modela:** Predložite 1-2 druga relevantna modela automobila koji bi također odlično odgovarali korisniku, uz objašnjenje zašto. Koristite svoje znanje o tržišnim trendovima.
    c. **Usporedna tablica:** Markdown tablica koja uspoređuje ključne specifikacije početnog automobila i vaših predloženih alternativa. Uključite stupce kao što su 'Model', 'Cijena (EUR)', 'Potrošnja (l/100km)', 'Glavne značajke' i 'Preporuka'.
6.  Sva komunikacija i konačni izvještaj moraju biti na hrvatskom jeziku.
  `;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private createChatWithHistory(history: ChatMessage[]): Chat {
    return this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: this.SYSTEM_PROMPT,
      },
      history: history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }))
    });
  }

  async startConversation(make: string, model: string): Promise<string> {
    const chat = this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: this.SYSTEM_PROMPT,
        }
    });
    
    // The user doesn't see this prompt, it's just to kickstart the conversation with the model.
    const initialPrompt = `Korisnik je zainteresiran za ${make} ${model}. Molim te, generiraj prvo pitanje koje ćeš mu postaviti.`;
    const result = await chat.sendMessage({ message: initialPrompt });
    return result.text;
  }

  async nextStep(chatHistory: ChatMessage[], make: string, model: string, questionCount: number): Promise<string> {
    // We restore the conversation history up to the point before the user's latest message.
    const historyToRestore = chatHistory.slice(0, -1);
    const lastUserMessage = chatHistory[chatHistory.length - 1];

    if (!lastUserMessage || lastUserMessage.role !== 'user') {
        // This should not happen in the normal flow.
        throw new Error('Nevažeća povijest razgovora: zadnja poruka nije od korisnika');
    }

    const chat = this.createChatWithHistory(historyToRestore);
    
    const result = await chat.sendMessage({ message: lastUserMessage.content });
    return result.text;
  }

  async generateAnalysis(chatHistory: ChatMessage[], make: string, model: string): Promise<string> {
    const chat = this.createChatWithHistory(chatHistory);
    // This prompt is sent after the conversation is finished to get the final summary.
    const analysisPrompt = `Na temelju cijelog našeg razgovora, molim vas generirajte konačnu, detaljnu analizu za ${make} ${model} i predložite alternative prema uputama u sistemskom promptu. Početni interes korisnika bio je za ${make} ${model}. Strukturirajte izlaz u tri tražena dijela.`;
    const result = await chat.sendMessage({ message: analysisPrompt });
    return result.text;
  }
}