// import { GoogleGenAI } from "@google/genai";

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// if (!GEMINI_API_KEY) {
//   throw new Error("GEMINI_API_KEY is not defined");
// }

// const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// export async function response_from_ai(prompt: string): Promise<string> {
//   const response = await ai.models.generateContent({
//     model: 'gemini-2.5-flash',
//     contents: prompt,
//   });
//   console.log(response.text);
//   return response.text;
// }