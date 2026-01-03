
import { GoogleGenAI, Type } from "@google/genai";
import { AccidentData, TraumaAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTraumaData = async (data: AccidentData): Promise<TraumaAnalysis> => {
  const prompt = `
    Perform a professional medical and biomechanical trauma analysis for a Road Traffic Accident (RTA).
    
    ACCIDENT NARRATIVE (Input may be in English or Roman Urdu):
    "${data.accidentDescription}"

    INSTRUCTIONS:
    1. The narrative might be written in Roman Urdu (Urdu language using Latin script). Understand the context, mechanics, and specifics provided in either language.
    2. Infer the collision mechanics (e.g., impact vector, estimated severity, vehicle types involved, position of the patient) from the narrative.
    3. Apply Newton's Laws of Motion to explain the kinetic energy transfer to the human body (e.g., F=ma, inertia).
    4. Analyze anatomical vulnerabilities based on the physics of the described crash (e.g., pelvic shear, thoracic compression, coup-contrecoup).
    5. Predict likely injuries using clinical trauma standards (ATLS).
    6. Provide the result in a structured JSON format in professional clinical English.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          severityScore: { type: Type.STRING, enum: ['Low', 'Moderate', 'High', 'Critical'] },
          predictedInjuries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                bodyRegion: { type: Type.STRING },
                injuryName: { type: Type.STRING },
                probability: { type: Type.NUMBER },
                physicsExplanation: { type: Type.STRING },
                anatomyVulnerability: { type: Type.STRING }
              },
              required: ["bodyRegion", "injuryName", "probability", "physicsExplanation", "anatomyVulnerability"]
            }
          },
          immediateActions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["summary", "severityScore", "predictedInjuries", "immediateActions"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("Invalid analysis data received from AI");
  }
};
