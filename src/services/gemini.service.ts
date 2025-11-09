import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../models/chat.model';

// This is a placeholder for the API key.
// In a real app, this should be handled securely and not hardcoded.
const API_KEY = process.env.API_KEY;

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (!API_KEY) {
      console.error('API_KEY is not set.');
      return;
    }
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  private getFormattedHistory(history: ChatMessage[]) {
    return history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    })).slice(0, -1); // Exclude the last user message which is part of the new prompt
  }

  async startConversation(make: string, model: string): Promise<string> {
    if (!this.ai) return "AI servis nije inicijaliziran.";
    
    const prompt = `Vi ste Savjetnik za Kupnju Automobila, iznimno učinkovit analitičar automobilskog tržišta i vrhunski mehaničar. Vaš cilj je pomoći mi odabrati specifičnu verziju ${make} ${model}. Postavite mi do 5 iterativnih, ovisnih pitanja kako biste suzili moje potrebe. Započnite s prvim pitanjem odmah. Nemojte me pozdravljati niti ponovno pitati za marku i model. Samo postavite prvo pitanje.`;
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text;
    } catch (error) {
      console.error('Error starting conversation:', error);
      return 'Nažalost, došlo je do pogreške. Molimo pokušajte ponovno.';
    }
  }

  async nextStep(history: ChatMessage[], make: string, model: string, questionCount: number): Promise<string> {
    if (!this.ai) return "AI servis nije inicijaliziran.";
    
    const latestUserMessage = history[history.length - 1].content;
    const conversationHistory = this.getFormattedHistory(history);
    
    const prompt = `Na temelju mog posljednjeg odgovora ("${latestUserMessage}"), postavite sljedeće logično pitanje kako biste precizirali moj izbor za ${make} ${model}. Do sada ste postavili ${questionCount} pitanja od najviše 5. Ako imate dovoljno informacija ili ste dosegli ograničenje od 5 pitanja, odgovorite SAMO s točnom frazom 'ANALYSIS_READY'. U suprotnom, postavite sljedeće pitanje bez ikakvog uvoda.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            role: 'user',
            parts: [{text: prompt}]
        },
        history: conversationHistory
      });
      return response.text;
    } catch (error) {
      console.error('Error in next step:', error);
      return 'Nažalost, došlo je do pogreške. Molimo pokušajte ponovno.';
    }
  }
  
  async generateAnalysis(history: ChatMessage[], make: string, model: string): Promise<string> {
    if (!this.ai) return "AI servis nije inicijaliziran.";

    const conversationHistory = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const prompt = `Na temelju našeg cjelokupnog razgovora o ${make} ${model} (potpuni transkript u nastavku), generirajte završnu analizu u 3 dijela. Koristite alat googleSearch za dobivanje ažurnih i točnih informacija o troškovima, deprecijaciji i uobičajenim kvarovima. Svi troškovi moraju biti izraženi u EUR. Izlaz MORA biti u Markdown formatu i točno slijediti ovu strukturu:
### **1. Prognoza ukupnog troška vlasništva (TCO) i deprecijacije (5 godina)**
(Detaljna markdown tablica sa stupcima: Godina, Procijenjena vrijednost (EUR), Procijenjeni godišnji trošak (Osiguranje, Gorivo, Održavanje) (EUR), Kumulativni TCO (EUR))
### **2. Izvještaj o kritičnoj pouzdanosti**
(Detaljna markdown tablica sa stupcima: Uobičajeni kvar, Opis, Procijenjeni trošak popravka (EUR))
### **3. Optimalna oprema/motor**
(Detaljna markdown tablica sa stupcima: Preporučena oprema/motor, Obrazloženje temeljeno na mojim odgovorima)

Transkript razgovora:
${conversationHistory}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}]
        }
      });
      return response.text;
    } catch (error) {
      console.error('Error generating analysis:', error);
      return 'Nažalost, nisam uspio generirati završnu analizu. Molimo provjerite konzolu za pogreške.';
    }
  }
}