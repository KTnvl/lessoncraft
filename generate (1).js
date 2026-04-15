exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { topic, grade, subject } = body;
  if (!topic) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Topic is required' }) };
  }

  const prompt = `You are an experienced teacher creating classroom materials for "${topic}" (${grade || 'Grade 5-6'}, ${subject || 'General'}).

Return ONLY valid JSON, no markdown, no extra text:
{
  "lessonPlan": {
    "objectives": "2-3 clear learning objectives for this topic and grade level",
    "materials": "List of materials needed for this lesson",
    "introduction": "Engaging hook and introduction activity (10 minutes)",
    "mainActivity": "Step-by-step main teaching activity (25 minutes)",
    "closure": "Summary activity and exit ticket (10 minutes)",
    "assessment": "How to assess student understanding"
  },
  "worksheet": [
    {"type": "open", "question": "An open-ended question requiring explanation or analysis about ${topic}"},
    {"type": "truefalse", "question": "A true/false statement about ${topic}", "answer": "True"},
    {"type": "fillin", "question": "A fill-in-the-blank sentence about ${topic} with _____ for the missing word", "answer": "the missing word"},
    {"type": "open", "question": "A second open-ended question asking students to apply knowledge of ${topic}"},
    {"type": "truefalse", "question": "Another true/false statement about ${topic}", "answer": "False"}
  ],
  "differentiation": {
    "below": "Specific modified activity for below-level learners — simpler language, more scaffolding, visual supports, sentence starters",
    "on": "Core activity for on-level learners — standard expectations with some student choice",
    "above": "Extended challenge for above-level learners — deeper thinking, creative application, real-world connections, research extension"
  }
}

All content must be specific to "${topic}" and appropriate for ${grade} ${subject} students.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, body: JSON.stringify({ error: 'API error', detail: err }) };
    }

    const data = await response.json();
    const text = data.content[0].text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
