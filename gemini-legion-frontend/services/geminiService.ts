
import { GoogleGenAI, GenerateContentResponse, Part, GenerateContentParameters, Content } from "@google/genai";
import { PerceptionPlan } from "../types";

export interface GeminiResponse {
  text: string;
  error?: string;
}

// Helper to safely parse JSON from a model response, stripping markdown fences.
export const parseJsonFromMarkdown = <T>(jsonString: string): T | null => {
    let cleanedString = jsonString.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanedString.match(fenceRegex);

    if (match && match[2]) {
        cleanedString = match[2].trim();
    }

    try {
        return JSON.parse(cleanedString);
    } catch (e) {
        console.error("Failed to parse JSON response:", e, "\nOriginal string:", jsonString);
        return null;
    }
};

// Helper to convert mixed array of strings and Parts into an array of Parts
const convertToParts = (items: (string | Part)[]): Part[] => {
    return items.map(item => (typeof item === 'string' ? { text: item } : item));
};

const prepareContentParam = (promptContent: string | Part | (string | Part)[]): Content => {
    if (typeof promptContent === 'string') {
        return { parts: [{ text: promptContent }] };
    }
    if (Array.isArray(promptContent)) {
        const partsArray: Part[] = convertToParts(promptContent);
        return { parts: partsArray }; 
    }
    return { parts: [promptContent] };
};

// New function for getting a structured JSON response (for Stage 1)
export const callGeminiApiForJson = async (
  prompt: string,
  model: string,
  temperature: number,
  apiKey: string, // <-- Changed from UI_API_KEY
  systemInstruction?: string,
): Promise<{ plan: PerceptionPlan | null, error?: string }> => {
  if (!apiKey) {
    const errorMsg = "API Key not provided for JSON API call.";
    console.error(errorMsg);
    return { plan: null, error: errorMsg };
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const requestPayload: GenerateContentParameters = {
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        temperature: temperature,
        responseMimeType: "application/json",
      },
    };
    if (systemInstruction) {
        requestPayload.config!.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContent(requestPayload);
    
    if (!response.text) {
        let errorReason = "Model returned an empty response";
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
            errorReason = `Response finished with reason: ${finishReason}.`;
        }
        console.error("Error calling Gemini API for JSON:", errorReason, response);
        return { plan: null, error: errorReason };
    }
    
    const plan = parseJsonFromMarkdown<PerceptionPlan>(response.text);

    if (!plan) {
        return { plan: null, error: "Failed to parse valid plan from model response." };
    }

    return { plan };

  } catch (error: any) {
    console.error("Error calling Gemini API for JSON:", error);
    const errorMessage = error.message || String(error);
    return { plan: null, error: `Gemini API Error: ${errorMessage}` };
  }
};


export const callGeminiAPIStream = async (
  promptContent: string | Part | (string | Part)[],
  model: string,
  temperature: number,
  apiKey: string, // <-- Changed from UI_API_KEY
  onStreamChunk: (chunkText: string, isFinal: boolean) => void,
  onError: (errorMessage: string) => void,
  systemInstruction?: string
): Promise<void> => {
  if (!apiKey) {
    const errorMsg = "API Key not provided for streaming.";
    console.error(errorMsg);
    onError(errorMsg);
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const geminiApiConfig: GenerateContentParameters['config'] = {
      temperature: temperature,
    };

    if (systemInstruction) {
       geminiApiConfig.systemInstruction = systemInstruction;
    }
    
    const processedContents = prepareContentParam(promptContent);

    const requestPayload: GenerateContentParameters = {
      model: model,
      contents: processedContents,
      config: geminiApiConfig,
    };

    const stream = await ai.models.generateContentStream(requestPayload);

    let fullText = ""; 
    for await (const chunk of stream) {
      const chunkText = chunk.text; 
      onStreamChunk(chunkText, false);
      fullText += chunkText; 
    }
    onStreamChunk("", true); // Signal completion of stream

  } catch (error: any) {
    console.error("Error calling Gemini API (stream):", error);
    let errorMessage = "An unknown error occurred with the Gemini API stream.";
     if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    onError(`Gemini API Stream Error: ${errorMessage}`);
  }
};