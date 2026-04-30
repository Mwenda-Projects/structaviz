export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contents } = req.body;

  // API key from environment variable
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errMsg = 'Something went wrong. Please try again.';
      
      if (response.status === 429) {
        errMsg = 'Rate limit reached. Please wait a moment and try again.';
      } else if (response.status === 400) {
        errMsg = 'Bad request. Please try again.';
      } else if (response.status === 401 || response.status === 403) {
        errMsg = 'API key error. Please check your Gemini API key.';
      } else if (response.status >= 500) {
        errMsg = 'Server error. Please try again in a moment.';
      }

      return res.status(response.status).json({ error: errMsg, details: errorData });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
