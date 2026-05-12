const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

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

    // Get user's symptom history for context
    const { data: symptoms } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(30);

    // Get chat history for context
    const { data: chatHistory } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build system prompt with user context
    const systemPrompt = `You are Peri, a compassionate perimenopause coach.
    
User's recent symptoms: ${symptoms?.map(s => s.symptoms).flat().join(', ') || 'None logged yet'}
Average energy this month: ${symptoms ? Math.round(symptoms.reduce((a, b) => a + b.energy, 0) / symptoms.length) : 'N/A'}/10
Average sleep: ${symptoms ? Math.round(symptoms.reduce((a, b) => a + b.sleep_quality, 0) / symptoms.length) : 'N/A'}/10

Guidelines:
- Validate her feelings
- Give evidence-based advice
- Suggest lifestyle changes
- Recommend doctor if needed
- Keep it warm and personal
- Reference her data when relevant
- Maximum 250 words`;

    // Call Claude API
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
        system: systemPrompt,
        messages: [
          ...chatHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          { role: 'user', content: message }
        ]
      })
    });

    const result = await response.json();
    const aiResponse = result.content[0].text;

    // Save both user message and AI response
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});