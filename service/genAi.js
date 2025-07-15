
const { GoogleGenAI } = require("@google/genai");

// const {GoogleGenAI}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

async function response_from_ai(prompt) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  console.log(response.text);
  return response.text
}

module.exports = {response_from_ai};