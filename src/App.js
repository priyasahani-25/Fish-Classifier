import React, { useState, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { UploadCloud, Cpu, CheckCircle, Leaf } from 'lucide-react';
import './App.css';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

function App() {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [results, setResults] = useState(null);
  const [isInferencing, setIsInferencing] = useState(false);
  const [sustainabilityReport, setSustainabilityReport] = useState(null);
  
  const imageRef = useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setImageFile(file);
      setResults(null); 
      setSustainabilityReport(null);
    }
  };

  // Convert file to base64 for Gemini Vision
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // --- GEMINI SUSTAINABILITY REPORT ---
  const generateSustainabilityReport = async (fishName) => {
    setSustainabilityReport("Consulting global supply chain database via Gemini...");
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are a marine sustainability expert. The user has identified a ${fishName} in their supply chain. Give a brief, 2-sentence summary about the ecological impact of commercial fishing for this species. Relate it directly to UN SDG 12: Responsible Consumption and Production.`;
      
      const result = await model.generateContent(prompt);
      setSustainabilityReport(result.response.text());
    } catch (error) {
      console.error("Gemini API Error:", error);
      setSustainabilityReport("Error: Could not retrieve SDG 12 data. Check API Key.");
    }
  };

  // --- GEMINI VISION CLASSIFICATION ---
  const runInference = async () => {
    if (!imageFile) return;
    setIsInferencing(true);
    setResults(null);
    setSustainabilityReport(null);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const base64Data = await fileToBase64(imageFile);
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: imageFile.type,
        },
      };

      const prompt = `You are a marine biologist and fish species classifier. Analyze this image and identify the fish species shown.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences, just raw JSON):
{
  "species": "Common Name of the Fish",
  "scientific_name": "Scientific name",
  "confidence": 0.85,
  "all_matches": [
    {"label": "Species 1", "value": 0.85},
    {"label": "Species 2", "value": 0.10},
    {"label": "Species 3", "value": 0.05}
  ]
}

Rules:
- "confidence" must be a number between 0 and 1 representing how sure you are.
- "all_matches" should list the top 3 most likely species with their probabilities summing to roughly 1.
- If the image does not contain a fish, set species to "NOT A FISH" and confidence to 0.
- Be accurate and honest about your confidence level.`;

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();
      
      // Parse the JSON response
      let parsed;
      try {
        // Remove markdown code fences if present
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.error("Failed to parse Gemini response:", responseText);
        setResults([{ label: "PARSE ERROR", value: 0 }]);
        setIsInferencing(false);
        return;
      }

      console.log("🎯 Gemini Vision Output:", parsed);

      if (parsed.all_matches && parsed.all_matches.length > 0) {
        const sortedResults = parsed.all_matches.sort((a, b) => b.value - a.value);
        setResults(sortedResults);
        generateSustainabilityReport(sortedResults[0].label);
      } else {
        setResults([{ label: parsed.species || "UNKNOWN", value: parsed.confidence || 0 }]);
        if (parsed.species && parsed.species !== "NOT A FISH") {
          generateSustainabilityReport(parsed.species);
        }
      }

      setIsInferencing(false);
    } catch (err) {
      console.error("Classification error:", err);
      setResults([{ label: "ERROR", value: 0 }]);
      setSustainabilityReport("Classification failed. Please check your API key and try again.");
      setIsInferencing(false);
    }
  };

  const topMatch = results && results.length > 0 ? results[0] : { label: "UNKNOWN", value: 0 };
  const hasResults = results && results.length > 0 && topMatch.label !== "UNKNOWN" && topMatch.label !== "ERROR";

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1><img src="/logo.png" alt="Logo" className="header-logo" /> Marine Supply Chain Tracker</h1>
          <p className="header-subtitle">SDG 12: Responsible Consumption and Production</p>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Left Column - Input */}
        <div className="card vision-container">
          <h2 className="card-title"><UploadCloud size={20} /> Vision Input</h2>
          
          <div className="upload-section">
            <div className="file-input-wrapper">
              <button className="btn btn-secondary">Choose Image</button>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
            </div>
          </div>

          <div className="image-workspace">
            {imagePreview ? (
              <img ref={imageRef} src={imagePreview} alt="Uploaded fish" className="fish-image" />
            ) : (
              <div className="placeholder-text">
                <UploadCloud size={32} />
                <p>Upload an image to run inference...</p>
              </div>
            )}
          </div>
          
          <button className="btn" onClick={runInference} disabled={!imageFile || isInferencing} style={{width: '100%', justifyContent: 'center'}}>
            {isInferencing ? <><Cpu className="animate-spin" size={18} /> Analyzing...</> : <><Cpu size={18} /> Run AI Classification</>}
          </button>
        </div>

        {/* Right Column - Results */}
        <div className="card info-panel">
          <h2 className="card-title"><CheckCircle size={20} /> Classification Results</h2>
          
          <div className="result-stats">
            <div className="result-stat">
              <span className="stat-label">Species Detected</span>
              <span className="stat-value">{topMatch.label.replace(/-/g, ' ').toUpperCase()}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Confidence</span>
              <span className="stat-value">{(topMatch.value * 100).toFixed(1)}%</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Supply Chain Status</span>
              {hasResults ? (
                <span className="stat-value verified"><CheckCircle size={16} /> Verified</span>
              ) : (
                <span className="stat-value" style={{color: 'var(--text-secondary)'}}>Pending</span>
              )}
            </div>
          </div>

          {/* Show all candidate matches if available */}
          {results && results.length > 1 && (
            <div className="report-box" style={{borderLeftColor: 'var(--border-color)'}}>
              <h4>All Candidate Matches</h4>
              {results.map((r, i) => (
                <div key={i} className="result-stat">
                  <span className="stat-label">{r.label}</span>
                  <span className="stat-value">{(r.value * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
          
          <div className="report-box">
            <h4><Leaf size={18} /> SDG 12 Impact Report</h4>
            <p>
              {sustainabilityReport ? sustainabilityReport : "Waiting for successful species identification to generate report..."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;