
export interface AccidentData {
  accidentDescription: string;
}

export interface PredictedInjury {
  bodyRegion: string;
  injuryName: string;
  probability: number; // 0 to 1
  physicsExplanation: string;
  anatomyVulnerability: string;
}

export interface TraumaAnalysis {
  summary: string;
  predictedInjuries: PredictedInjury[];
  severityScore: 'Low' | 'Moderate' | 'High' | 'Critical';
  immediateActions: string[];
}
