
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
    if (!this.ai) return "AI service is not initialized.";
    
    const prompt = `You are BestBuyCar Advisor, a hyper-efficient Automotive Market Analyst & Master Mechanic. Your goal is to help me choose a specific version of the ${make} ${model}. Ask me up to 5 iterative, dependency-based questions to narrow down my needs. Start with your first question now. Do not greet me or ask for the make and model again. Just ask the first question.`;
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text;
    } catch (error) {
      console.error('Error starting conversation:', error);
      return 'Sorry, I encountered an error. Please try again.';
    }
  }

  async nextStep(history: ChatMessage[], make: string, model: string, questionCount: number): Promise<string> {
    if (!this.ai) return "AI service is not initialized.";
    
    const latestUserMessage = history[history.length - 1].content;
    const conversationHistory = this.getFormattedHistory(history);
    
    const prompt = `Based on my last answer ("${latestUserMessage}"), ask the next logical question to refine my choice for a ${make} ${model}. You have asked ${questionCount} questions so far out of a maximum of 5. If you have enough information or have reached the 5-question limit, respond ONLY with the exact phrase 'ANALYSIS_READY'. Otherwise, ask your next single question without any preamble.`;

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
      return 'Sorry, I encountered an error. Please try again.';
    }
  }
  
  async generateAnalysis(history: ChatMessage[], make: string, model: string): Promise<string> {
    if (!this.ai) return "AI service is not initialized.";

    const conversationHistory = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const prompt = `Based on our entire conversation about the ${make} ${model} (full transcript provided below), generate a final 3-part analysis. Use the googleSearch tool to get up-to-date and accurate information on costs, depreciation, and common failures. The output MUST be in Markdown and follow this structure exactly:
### **1. TCO/Depreciation Forecast (5 Years)**
(A detailed markdown table with columns: Year, Estimated Value, Estimated Annual Cost (Insurance, Fuel, Maintenance), Cumulative TCO)
### **2. Critical Reliability Report**
(A detailed markdown table with columns: Common Failure, Description, Estimated Repair Cost)
### **3. Optimal Trim/Engine Match**
(A detailed markdown table with columns: Recommended Trim/Engine, Justification based on my answers)

Conversation Transcript:
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
      return 'Sorry, I was unable to generate the final analysis. Please check the console for errors.';
    }
  }
}
