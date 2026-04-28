import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';

// Initialize Gemini (We will paste your actual key here)
const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);

function App() {
  const [imagePreview, setImagePreview] = useState(null);
  const [results, setResults] = useState(null);
  const [isInferencing, setIsInferencing] = useState(false);
  const [sustainabilityReport, setSustainabilityReport] = useState(null);
  
  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const checkAI = setInterval(() => {
      if (window.EdgeImpulseClassifier) {
        console.log("Edge Impulse AI Loaded!");
        clearInterval(checkAI); 
      }
    }, 500);
    return () => clearInterval(checkAI);
  }, []);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setResults(null); 
      setSustainabilityReport(null);
    }
  };

  // --- GEMINI API LOGIC ---
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

  // --- EDGE IMPULSE LOGIC ---
  const runInference = async () => {
    if (!imageRef.current) return;
    setIsInferencing(true);

    try {
      const classifier = new window.EdgeImpulseClassifier();
      await classifier.init();

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageRef.current, 0, 0, 96, 96);
      
      const imgData = ctx.getImageData(0, 0, 96, 96).data;
      const features = [];
      for (let i = 0; i < imgData.length; i += 4) {
        features.push((imgData[i] << 16) | (imgData[i + 1] << 8) | imgData[i + 2]);
      }

      const res = classifier.classify(features);
      console.log("🎯 AI RAW OUTPUT:", res);
      
      if (res.results && res.results.length > 0) {
        setResults(res.results);
        generateSustainabilityReport(res.results[0].label); // Ask Gemini!
      } else {
        setResults([]); // No fish found
      }
      setIsInferencing(false);
      
    } catch (err) {
      console.error(err);
      setIsInferencing(false);
    }
  };

  // --- DEVELOPER TEST OVERRIDE ---
  // Use this for your project presentation if the CV model fails
  const simulateDetection = () => {
    const mockResult = [{ label: "BLACK-SEA-SPRAT", value: 0.92 }];
    setResults(mockResult);
    generateSustainabilityReport(mockResult[0].label);
  };

  const topMatch = results && results.length > 0 ? results[0] : { label: "UNKNOWN", value: 0 };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Marine Supply Chain Tracker</h1>
        <p>SDG 12: Responsible Consumption and Production</p>
      </header>

      <main className="dashboard-main">
        {/* Left Column */}
        <div className="vision-container">
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          <div className="image-workspace">
            {imagePreview ? (
              <img ref={imageRef} src={imagePreview} alt="Uploaded fish" className="fish-image" crossOrigin="anonymous"/>
            ) : (
              <p className="placeholder-text">Upload an image to run inference...</p>
            )}
          </div>

          <div className="ai-sensor-panel" style={{ margin: '15px 0', textAlign: 'center', color: '#00ffcc' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '12px' }}>LIVE AI SENSOR INPUT (96x96):</p>
            <canvas ref={canvasRef} width="96" height="96" style={{ border: '1px solid #333', backgroundColor: '#111' }}></canvas>
          </div>
          
          <button className="inference-btn" onClick={runInference} disabled={!imagePreview || isInferencing}>
            {isInferencing ? "Analyzing..." : "Run AI Classification"}
          </button>
          
          {/* Dev Test Button for Presentations */}
          <button onClick={simulateDetection} style={{ marginTop: '10px', background: '#444', color: 'white', padding: '5px', border: 'none', cursor: 'pointer' }}>
            [Dev Test: Force Detection]
          </button>
        </div>

        {/* Right Column */}
        <div className="info-panel">
          <h3>Classified: {topMatch.label.toUpperCase()}</h3>
          <hr />
          <p><strong>Confidence:</strong> {(topMatch.value * 100).toFixed(1)}%</p>
          <p><strong>Supply Chain Status:</strong> {results && results.length > 0 ? "Verified" : "--"}</p>
          
          <div className="gemini-output" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1a1a1a', borderRadius: '5px', borderLeft: '4px solid #00ffcc' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#00ffcc' }}>SDG 12 Impact Report:</h4>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
              {sustainabilityReport ? sustainabilityReport : "Waiting for successful species identification..."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;