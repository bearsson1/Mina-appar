
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateWeeklyQuiz(): Promise<Question[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Skapa 10 intressanta tipsfrågor för en tipspromenad. Frågorna ska vara varierade (historia, sport, kultur, natur). Svaren måste vara i formatet 1, X, 2.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            text: { type: Type.STRING },
            options: {
              type: Type.OBJECT,
              properties: {
                '1': { type: Type.STRING },
                'X': { type: Type.STRING },
                '2': { type: Type.STRING },
              },
              required: ['1', 'X', '2']
            },
            correct: { type: Type.STRING, description: "Must be '1', 'X', or '2'" },
          },
          required: ['id', 'text', 'options', 'correct']
        }
      }
    }
  });

  try {
    const questions = JSON.parse(response.text.trim());
    return questions;
  } catch (e) {
    console.error("Failed to parse quiz questions", e);
    // Fallback static questions if AI fails
    return Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      text: `Fråga ${i + 1}: Hur långt är ett maraton?`,
      options: { '1': '42km', 'X': '21km', '2': '10km' },
      correct: '1'
    }));
  }
}
