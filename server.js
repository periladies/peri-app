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

// Original chat endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { userId, message, context } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing userId or message' });
    }

    const systemPrompt = `You are HormoneIQ, a warm, empathetic AI coach specializing in perimenopause wellness.

IMPORTANT: Respond in plain text ONLY. Never use markdown formatting:
- No asterisks (**) for bold
- No hash marks (#) for headers  
- No dashes (---) for lines
- No em dashes (—)
- No bullet points with dashes

Respond conversationally with regular sentences and line breaks. Be warm, supportive, and human.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
    });

    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : 'Error';
    res.json({ response: aiResponse, userId: userId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Coach endpoint for HormoneIQ app (NEW)
app.post('/api/ai-coach', async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !systemPrompt) {
      return res.status(400).json({ error: 'Missing messages or systemPrompt' });
    }

    console.log('🤖 AI Coach called with', messages.length, 'messages');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages
    });

    const aiResponse = response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'I understand. Keep tracking your symptoms and we\'ll find patterns together! 💜';

    console.log('✅ AI Coach responded');

    res.json({ text: aiResponse });
  } catch (error) {
    console.error('❌ AI Coach error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HormoneIQ running on port ${PORT}`);
});