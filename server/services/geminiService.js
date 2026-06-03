const { GoogleGenerativeAI } = require('@google/generative-ai');

const askGemini = async (prompt, conversationHistory = []) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.senderId === 'gemini' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    }));

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return "I'm having trouble connecting to my brain right now. Please check my API key or try again later!";
  }
};

module.exports = { askGemini };
