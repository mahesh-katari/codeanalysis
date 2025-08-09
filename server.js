require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // For making HTTP requests
const path = require('path');
const { rmSync } = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- API Keys are now loaded from .env file ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
// ---------------------------------------------------

// Middleware
app.use(cors()); // Enable CORS for all origins (for development)
app.use(express.json()); // Parse JSON request bodies

// Serve static files from the React app 
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Endpoint to analyze code and get recommendations
app.post('/analyze-code', async (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'Code and language are required.' });
    }

    let geminiResponseData;
    let youtubeVideos = [];

    try {
        console.log('Attempting to call Gemini API...');
        // 1. Call Gemini API for Code Analysis
        const geminiPrompt = `
You are a code analyzer AI. Analyze the following ${language} code snippet.

1.  **Time Complexity:** State the Big O time complexity and provide a concise explanation.
2.  **Space Complexity:** State the Big O space complexity and provide a concise explanation.
3.  **Optimization Suggestions:** Provide actionable suggestions to optimize the code for performance or readability. If no significant optimizations are apparent, state that.
4.  **Identified Problem/Algorithm:** Briefly state what problem the code is trying to solve or what algorithm it implements (e.g., "Calculates the height of a binary tree using BFS").
5.  **Alternative Implementations:** Provide 1-2 alternative implementations for the given code or the problem it solves, if applicable. Include the title for each alternative (e.g., "Recursive Solution", "Iterative Solution with DFS") and the code snippet. If no meaningful alternatives exist, provide an empty array.

Format your response as a JSON object with the following keys:
{
  "time_complexity": "O(N)",
  "time_complexity_explanation": "Each node is visited once.",
  "space_complexity": "O(W)",
  "space_complexity_explanation": "Queue stores nodes at current level.",
  "optimization_suggestions": [
    "Use iterative approach to avoid stack overflow for very deep trees.",
    "Consider parallel processing for extremely large trees."
  ],
  "identified_problem": "Height of a Binary Tree (Level Order Traversal)",
  "alternative_implementations": [
    {
      "title": "Recursive Solution",
      "code": "int height(Node* root) {\n  if (root == nullptr) return 0;\n  return 1 + max(height(root->left), height(root->right));\n}"
    },
    {
      "title": "Iterative Solution with Depth-First Search (DFS)",
      "code": "int height(Node* root) {\n  // ... DFS code here ...\n}"
    }
  ]
}

Code:
\`\`\`${language}
${code}
\`\`\`
        `;

        const geminiPayload = {
            contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        console.log('Attempting to fetch from URL:', geminiApiUrl);

        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        console.log('Received response from Gemini API. Status:', geminiResponse.status);

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API Error:', errorText);
            return res.status(geminiResponse.status).json({ error: 'Failed to analyze code with Gemini API.', details: errorText });
        }

        const geminiResult = await geminiResponse.json();

        if (geminiResult.candidates && geminiResult.candidates.length > 0 &&
            geminiResult.candidates[0].content && geminiResult.candidates[0].content.parts &&
            geminiResult.candidates[0].content.parts.length > 0) {
            const jsonText = geminiResult.candidates[0].content.parts[0].text;
            try {
                geminiResponseData = JSON.parse(jsonText);
                console.log('Gemini Parsed Data:', geminiResponseData);
            } catch (parseError) {
                console.error('Error parsing Gemini JSON:', parseError);
                console.error('Raw Gemini response text:', jsonText);
                return res.status(500).json({ error: 'Failed to parse Gemini response.', details: parseError.message });
            }
        } else {
            console.error('Unexpected Gemini response structure:', geminiResult);
            // If the response has error details, send them back
            if (geminiResult.error) {
                 return res.status(500).json({ error: 'Gemini API returned an error.', details: geminiResult.error.message });
            }
            return res.status(500).json({ error: 'Gemini API did not return expected content.' });
        }

        // 2. Call YouTube Data API for Video Recommendations
        const searchQuery = geminiResponseData.identified_problem ?
            `${geminiResponseData.identified_problem} ${language} tutorial` :
            `${language} programming tutorial`; // Fallback search query

        console.log('Attempting to call YouTube API with query:', searchQuery);
        const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&key=${YOUTUBE_API_KEY}&maxResults=5`);
        
        console.log('Received response from YouTube API. Status:', youtubeResponse.status);

        if (!youtubeResponse.ok) {
            const errorText = await youtubeResponse.text();
            console.error('YouTube API Error:', errorText);
            return res.status(youtubeResponse.status).json({ error: 'Failed to fetch YouTube videos.', details: errorText });
        }

        const youtubeResult = await youtubeResponse.json();

        if (youtubeResult.items) {
            youtubeVideos = youtubeResult.items.map(item => ({
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.high.url, // Or default/medium
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                description: item.snippet.description
            }));
            console.log('YouTube Videos:', youtubeVideos);
        }

        // 3. Send combined results back to frontend
        res.json({
            time_complexity: geminiResponseData.time_complexity,
            time_complexity_explanation: geminiResponseData.time_complexity_explanation,
            space_complexity: geminiResponseData.space_complexity,
            space_complexity_explanation: geminiResponseData.space_complexity_explanation,
            optimization_suggestions: geminiResponseData.optimization_suggestions,
            identified_problem: geminiResponseData.identified_problem,
            alternative_implementations: geminiResponseData.alternative_implementations,
            youtube_videos: youtubeVideos
        });

        console.log('Successfully sent response to client.');

    } catch (error) {
        console.error('Error during analysis:', error);
        res.status(500).json({ error: 'Failed to analyze code or fetch recommendations.', details: error.message });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    if (!GEMINI_API_KEY || !YOUTUBE_API_KEY) {
        console.error('ERROR: API keys are missing. Please add them to your .env file.');
    }
});
