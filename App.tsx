
import React, { useState, useRef, useEffect } from 'react';
import { AccidentData, TraumaAnalysis } from './types';
import { analyzeTraumaData } from './services/geminiService';
import InjuryChart from './components/InjuryChart';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// Helper functions for Gemini Live API as per documentation
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TraumaAnalysis | null>(null);
  const [formData, setFormData] = useState<AccidentData>({
    accidentDescription: ''
  });

  // Voice Interaction State
  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({ accidentDescription: e.target.value });
  };

  const stopListening = () => {
    if (sessionRef.current) {
      sessionRef.current = null; // Promise will be replaced
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
  };

  const startListening = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = inputAudioContext;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
            setIsListening(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setFormData(prev => ({
                ...prev,
                accidentDescription: prev.accidentDescription + (prev.accidentDescription ? ' ' : '') + text
              }));
            }
          },
          onerror: (e) => {
            console.error('Live API Error:', e);
            stopListening();
          },
          onclose: () => {
            setIsListening(false);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'You are a silent transcriber for a medical trauma app. Just transcribe what the user says exactly. Do not respond verbally.',
        },
      });

      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error("Failed to start voice session:", err);
      alert("Microphone access is required for voice input.");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) stopListening();
    
    if (!formData.accidentDescription.trim()) {
      alert("Please provide an accident description.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeTraumaData(formData);
      setAnalysis(result);
    } catch (err) {
      alert("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (score: string) => {
    switch (score) {
      case 'Critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'Moderate': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-green-600 bg-green-100 border-green-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-red-600 p-2 rounded-lg text-white">
              <i className="fas fa-heartbeat text-xl"></i>
            </span>
            <h1 className="text-3xl font-bold text-slate-800">TraumaPredict AI</h1>
          </div>
          <p className="text-slate-500 font-medium">Dera Ismail Khan Hospital • Emergency Department</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Status</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-semibold text-emerald-600">AI Core Active</span>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Form Column */}
        <section className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-6 sticky top-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <i className="fas fa-pen-nib text-blue-600"></i>
                <h2 className="text-xl font-bold text-slate-800">Case Narrative</h2>
              </div>
              <div className="flex gap-1">
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-full uppercase tracking-tighter">
                  Eng + Roman Urdu
                </span>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2 italic">
                  Describe the accident:
                </label>
                <div className="relative group">
                  <textarea 
                    name="accidentDescription"
                    required
                    autoFocus
                    value={formData.accidentDescription}
                    onChange={handleInputChange}
                    placeholder="e.g., 'Motorcycle wala tezi se ja raha tha...' or 'Car hit a pole...'"
                    className="w-full rounded-lg border-slate-300 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 min-h-[250px] text-sm p-4 pr-12 leading-relaxed resize-none shadow-inner transition-all focus:bg-white"
                  />
                  
                  {/* Talk to Message Button */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-white text-blue-600 hover:bg-blue-50 border border-slate-200'
                    }`}
                    title={isListening ? "Stop Listening" : "Talk to Message"}
                  >
                    <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'}`}></i>
                  </button>
                </div>
                
                {isListening && (
                  <div className="absolute top-1 right-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-red-500 animate-pulse">RECORDING LIVE</span>
                    <div className="flex gap-0.5 items-end h-3">
                      <div className="w-0.5 h-1 bg-red-500 animate-[bounce_0.6s_infinite]"></div>
                      <div className="w-0.5 h-2 bg-red-500 animate-[bounce_0.8s_infinite]"></div>
                      <div className="w-0.5 h-1.5 bg-red-500 animate-[bounce_0.5s_infinite]"></div>
                    </div>
                  </div>
                )}

                <p className="mt-2 text-[10px] text-slate-400">
                  <i className="fas fa-info-circle mr-1"></i>
                  Click the mic to speak in English or Roman Urdu.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="fas fa-circle-notch animate-spin"></i>
                    Processing Narrative...
                  </>
                ) : (
                  <>
                    <i className="fas fa-bolt"></i>
                    Run Injury Prediction
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Results Column */}
        <section className="lg:col-span-8">
          {!analysis && !loading && (
            <div className="h-full flex flex-col items-center justify-center bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400">
              <div className="bg-slate-50 p-6 rounded-full mb-6">
                <i className="fas fa-file-medical-alt text-5xl"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-600 mb-2">Awaiting Case Details</h3>
              <p className="max-w-xs">Type or speak the accident description to start the biomechanical prediction engine.</p>
            </div>
          )}

          {loading && (
            <div className="animate-pulse space-y-6">
              <div className="h-40 bg-slate-200 rounded-2xl"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-64 bg-slate-200 rounded-2xl"></div>
                <div className="h-64 bg-slate-200 rounded-2xl"></div>
              </div>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Summary Header */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-slate-800">Clinical Prediction</h2>
                  <span className={`px-4 py-1 rounded-full text-sm font-bold border ${getSeverityColor(analysis.severityScore)}`}>
                    Severity: {analysis.severityScore}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed text-lg italic border-l-4 border-slate-200 pl-4 py-2">
                  "{analysis.summary}"
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InjuryChart injuries={analysis.predictedInjuries} />
                
                {/* Immediate Actions */}
                <div className="bg-slate-900 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-2 mb-4 text-white">
                    <i className="fas fa-exclamation-triangle text-amber-400"></i>
                    <h3 className="text-lg font-bold">Priority Interventions</h3>
                  </div>
                  <ul className="space-y-3">
                    {analysis.immediateActions.map((action, idx) => (
                      <li key={idx} className="flex gap-3 text-slate-300 text-sm">
                        <span className="w-6 h-6 flex-shrink-0 bg-slate-800 rounded flex items-center justify-center font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Detailed Findings */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 px-1 flex items-center gap-2">
                  <i className="fas fa-microscope text-blue-500"></i>
                  Biomechanical Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.predictedInjuries.map((injury, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-5 border border-slate-200 hover:border-blue-200 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {injury.bodyRegion}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-12 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${injury.probability * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-slate-800">{Math.round(injury.probability * 100)}%</span>
                        </div>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">{injury.injuryName}</h4>
                      
                      <div className="space-y-3 text-sm">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <p className="text-slate-500 font-bold text-[10px] uppercase mb-1">Physics Logic</p>
                          <p className="text-slate-700 leading-tight italic">{injury.physicsExplanation}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50/50 border border-red-100/50">
                          <p className="text-red-500 font-bold text-[10px] uppercase mb-1">Biological Vulnerability</p>
                          <p className="text-slate-700 leading-tight">{injury.anatomyVulnerability}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex gap-4 items-start">
                <i className="fas fa-info-circle text-slate-400 mt-1"></i>
                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong>DI KHAN ED PROTOCOL:</strong> This AI tool assists in identifying potential "occult" injuries based on crash biomechanics. Please correlate with physical exams and trauma imaging.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
        <p>&copy; {new Date().getFullYear()} TraumaPredict AI System - Dera Ismail Khan Emergency Medicine Research Division</p>
      </footer>
    </div>
  );
};

export default App;
