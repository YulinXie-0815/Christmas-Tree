import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateLuxuryWish = async (recipient: string = "Valued Guest"): Promise<string> => {
  try {
    const model = ai.models;
    const prompt = `Write a very short, sophisticated, and luxurious Christmas wish for a high-end brand client named "${recipient}". 
    Tone: Elegant, opulent, cinematic, warm but majestic. 
    Max length: 25 words. 
    Keywords to reflect: Gold, Emerald, Light, Timeless.`;

    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.9,
      }
    });

    return response.text || "Season's Greetings from Arix.";
  } catch (error) {
    console.error("Gemini generation error:", error);
    return "Wishing you a season of timeless elegance and golden moments.";
  }
};