import React, { useState } from 'react';
import './App.css';

// Use the Render backend URL in production, otherwise use the local server
const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://codeanalysnew.onrender.com' // Your live Render backend URL
  : 'http://localhost:3000';             // Your local backend URL

function App() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!code) {
      setError('Please enter some code to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch(`${API_URL}/analyze-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, language }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to get analysis.');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
      console.error('Error during analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Code Analyzer AI</h1>
        <p>Get complexity analysis, optimizations, and video tutorials for your code.</p>
      </header>
      <main>
        <div className="input-section">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="csharp">C#</option>
            <option value="cpp">C++</option>
            <option value="ruby">Ruby</option>
            <option value="go">Go</option>
          </select>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your code here..."
            rows="15"
          />
          <button onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Code'}
          </button>
        </div>

        {error && <div className="error"><p>Error: {error}</p></div>}

        {analysis && (
          <div className="results-section">
            <h2>Analysis Results</h2>
            <div className="analysis-card">
              <h3>Identified Problem</h3>
              <p>{analysis.identified_problem}</p>
            </div>
            <div className="analysis-card">
              <h3>Time Complexity: {analysis.time_complexity}</h3>
              <p>{analysis.time_complexity_explanation}</p>
            </div>
            <div className="analysis-card">
              <h3>Space Complexity: {analysis.space_complexity}</h3>
              <p>{analysis.space_complexity_explanation}</p>
            </div>
            <div className="analysis-card">
              <h3>Optimization Suggestions</h3>
              <ul>
                {analysis.optimization_suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>

            {analysis.alternative_implementations && analysis.alternative_implementations.length > 0 && (
              <div className="analysis-card">
                <h3>Alternative Implementations</h3>
                {analysis.alternative_implementations.map((alt, index) => (
                  <div key={index} className="alternative">
                    <h4>{alt.title}</h4>
                    <pre><code>{alt.code}</code></pre>
                  </div>
                ))}
              </div>
            )}

            {analysis.youtube_videos && analysis.youtube_videos.length > 0 && (
                <div className="video-section">
                    <h3>Recommended Videos</h3>
                    <div className="video-list">
                        {analysis.youtube_videos.map((video, index) => (
                            <a key={index} href={video.url} target="_blank" rel="noopener noreferrer" className="video-card">
                                <img src={video.thumbnail} alt={video.title} />
                                <div className="video-info">
                                    <h4>{video.title}</h4>
                                    <p>{video.channelTitle}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
