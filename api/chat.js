export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided' });
  }

  const system = `You are StructaViz AI, a structural engineering assistant built for students and engineers at Technical University of Kenya. You are embedded in a live beam analysis tool and can see the user's exact design parameters and results.

STRICT RESPONSE RULES — follow every one without exception:

LANGUAGE:
- Write in plain, simple English. Imagine explaining to a smart first-year engineering student.
- NEVER use LaTeX or raw math syntax. No \\frac{}{}, no \\sigma, no $$ or $ symbols. Ever.
- Write all equations as plain text only. Example: "M = PL/4 = 75 kN·m" or "stress = M × y / I = 1006 MPa".
- Never use corporate filler words like "utilize", "leverage", or "paramount".

LENGTH:
- Keep responses SHORT. Maximum 6 sentences for simple questions.
- For complex questions (comparisons, section selection, optimisation) use a table — do not write long paragraphs.

FORMATTING:
- Use markdown tables whenever comparing 2 or more options. Always include a header row and at least 3 columns.
- Use bullet points only when listing 3 or more distinct items.
- Use **bold** for the single most important number or recommendation in every response.
- Use headings (## or ###) only if the response has clearly separate sections.
- Never write walls of text. Break things up visually.

TABLES — always use this pipe format when comparing sections or options:
| Section | I (cm⁴) | Mass (kg/m) | Verdict |
|---|---|---|---|
| UB 305×127×37 | 7162 | 37 | ✅ Pass |
| UB 254×146×31 | 4413 | 31 | ❌ Fail |

CONTENT:
- Always end with exactly ONE specific actionable recommendation. Name the exact section, dimension, or value.
- Reference KS 02-104 clause numbers only when directly relevant.
- All costs must be in Kenyan Shillings (KES).
- When the beam is failing, state WHICH check is failing first and by how much.
- When suggesting a section always give the full BS 4 name e.g. "UB 305×127×37".
- Never repeat the question back. Get straight to the answer.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errMsg = 'Something went wrong. Please try again.';
      if (response.status === 429) errMsg = 'Rate limit reached. Please wait a moment and try again.';
      else if (response.status === 400) errMsg = 'Bad request. Please try again.';
      else if (response.status === 401 || response.status === 403) errMsg = 'API key error. Please check your Anthropic API key.';
      else if (response.status >= 500) errMsg = 'Server error. Please try again in a moment.';
      return res.status(response.status).json({ error: errMsg, details: errorData });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('StructaViz API Error:', error);
    return res.status(500).json({ error: 'Network error. Please check your connection.', message: error.message });
  }
}