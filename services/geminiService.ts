import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateExamQuestions = async (topic: string, count: number = 5) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate ${count} exam questions about "${topic}". Mix multiple choice and essay questions. Language: Arabic.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "The question text in Arabic" },
              type: { type: Type.STRING, enum: ["multiple_choice", "essay"] },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of 4 options if multiple_choice, else empty array"
              },
              correctAnswer: { type: Type.STRING, description: "The correct answer text" },
              points: { type: Type.NUMBER }
            },
            required: ["text", "type", "points"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini generation failed:", error);
    return [];
  }
};
