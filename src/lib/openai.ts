import OpenAI from "openai";

// This will throw if key is missing in client-side but we are using it server-side
const apiKey = process.env.OPENAI_API_KEY;

export const openai = new OpenAI({
  apiKey: apiKey,
});
