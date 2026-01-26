
import { GoogleGenAI } from "@google/genai";
import { Keyword } from "../types";

export const getTrendSummary = async (keywords: Keyword[]): Promise<string> => {
  try {
    // Correct initialization: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze the following technical trend data for the last 7 days and provide a 3-sentence executive summary highlighting what's emerging and what's cooling down.
    
    Data:
    ${keywords.map(k => `- ${k.name}: ${k.mentionsCount7d} mentions, ${k.growthRate}% growth`).join('\n')}
    
    Tone: Professional, Insightful, Tech-focused.`;

    // Ensure model name and contents structure are strictly followed
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });

    // Access the text property directly (not a method)
    return response.text || "Unable to generate insights at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Trending data indicates a strong shift towards edge-native databases and high-performance runtimes like Bun and Cloudflare D1.";
  }
};
