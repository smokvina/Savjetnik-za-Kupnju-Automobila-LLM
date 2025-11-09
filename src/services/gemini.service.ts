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

  private readonly SYSTEM_PROMPT = `You are an expert car buying advisor. Your goal is to help a user decide if a specific car is right for them by asking a series of 5 clarifying questions.

Instructions:
1.  You will be given the make and model of a car.
2.  Your first task is to generate the first question to ask the user. This question should be about their lifestyle or driving habits.
3.  After the user answers, you will ask another question. Repeat this for a total of 5 questions. The questions should be varied and cover topics like budget, daily commute, family size, primary use (e.g., city driving, long trips), and important features.
4.  Do not ask more than 5 questions. After the user answers the 5th question, you MUST respond with the exact string "ANALYSIS_READY". Do not add any other text.
5.  When asked to generate the final analysis, provide a comprehensive recommendation about whether the user should buy the car. The analysis should be well-structured, easy to read, and written in Markdown. It should summarize the user's needs based on their answers and evaluate the car (make and model provided) against those needs. Conclude with a clear "Recommendation" section.
6.  All communication must be in Croatian.
  `;

  constructor() {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set. Please set it in your environment.");
    }
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
    const initialPrompt = `The user is interested in a ${make} ${model}. Please generate the first question to ask them.`;
    const result = await chat.sendMessage({ message: initialPrompt });
    return result.text;
  }

  async nextStep(chatHistory: ChatMessage[], make: string, model: string, questionCount: number): Promise<string> {
    // We restore the conversation history up to the point before the user's latest message.
    const historyToRestore = chatHistory.slice(0, -1);
    const lastUserMessage = chatHistory[chatHistory.length - 1];

    if (!lastUserMessage || lastUserMessage.role !== 'user') {
        // This should not happen in the normal flow.
        throw new Error('Invalid chat history: last message is not from user');
    }

    const chat = this.createChatWithHistory(historyToRestore);
    
    const result = await chat.sendMessage({ message: lastUserMessage.content });
    return result.text;
  }

  async generateAnalysis(chatHistory: ChatMessage[], make: string, model: string): Promise<string> {
    const chat = this.createChatWithHistory(chatHistory);
    // This prompt is sent after the conversation is finished to get the final summary.
    const analysisPrompt = `Based on our entire conversation, please generate the final analysis for the ${make} ${model}.`;
    const result = await chat.sendMessage({ message: analysisPrompt });
    return result.text;
  }
}
