const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})
// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }

  next()
})

app.use(express.json())

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

// Save symptom log
app.post('/api/symptoms/log', async (req, res) => {
  try {
    const { userId, logDate, symptoms, energy, stress, sleepQuality, notes } = req.body;

    const { data, error } = await supabase
      .from('symptom_logs')
      .insert([{
        user_id: userId,
        log_date: logDate,
        symptoms,
        energy,
        stress,
        sleep_quality: sleepQuality,
        notes
      }]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get user's symptom logs
app.get('/api/symptoms/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(30);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save chat message
const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { userId, message, context } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing userId or message' });
    }

    const systemPrompt = `You are Peri, a warm, empathetic AI coach specializing in perimenopause wellness. Your role is to:

1. Listen with compassion and validate the user's experience
2. Provide practical, evidence-based advice tailored to perimenopause symptoms
3. Ask clarifying questions when helpful
4. Be conversational and human — speak like a supportive friend, not a medical textbook
5. Keep responses concise but thorough (2-3 paragraphs max)
6. Avoid markdown formatting, bullet points, and technical language
7. Focus on actionable wellness strategies they can implement today

${context ? `The user's recent symptom history: ${context}` : ''}

Always respond warmly, never dismiss concerns, and remind them to consult a healthcare provider for medical concerns.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: message
        }
      ]
    });

    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : 'I encountered an error processing your question.';

    res.json({
      response: aiResponse,
      userId: userId
    });
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get response from Claude'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Peri backend running on port ${PORT}`);
});

// Get chat history
app.get('/api/chat/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Claude API endpoint (AI Coach)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }]
      })
    });

    const result = await response.json();
console.log('Claude response:', JSON.stringify(result, null, 2));
    if (!result.content || !Array.isArray(result.content) || result.content.length === 0) {
      return res.status(400).json({ error: 'Invalid response from Claude API' });
    }

    const aiResponse = result.content[0].text;

    await supabase.from('chat_messages').insert([
      { user_id: userId, role: 'user', content: message },
      { user_id: userId, role: 'assistant', content: aiResponse }
    ]);

    res.json({ response: aiResponse });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
console.log(`Server running on port ${PORT}`);
});