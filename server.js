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
    const systemPrompt = `You are HormoneIQ, a warm, empathetic AI coach specializing in perimenopause wellness.`;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HormoneIQ running on port ${PORT}`);
});
