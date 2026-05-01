export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system } = req.body;

  // API key from environment variable
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system,
        messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errMsg = 'Something went wrong. Please try again.';

      if (response.status === 429) {
        errMsg = 'Rate limit reached. Please wait a moment and try again.';
      } else if (response.status === 400) {
        errMsg = 'Bad request. Please try again.';
      } else if (response.status === 401 || response.status === 403) {
        errMsg = 'API key error. Please check your Anthropic API key.';
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