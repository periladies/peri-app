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
app.options('/api/chat/message', (req, res) => {
  res.sendStatus(200)
})

app.post('/api/chat/message', async (req, res) => {
  try {
    const { userId, role, content } = req.body;

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{
        user_id: userId,
        role,
        content
      }]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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