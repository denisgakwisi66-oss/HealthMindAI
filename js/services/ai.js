/**
 * ============================================
 * HEALTHMIND AI — AI SERVICE
 * ============================================
 */

import API from './api.js';

const AIService = {
  // ===== CONVERSATIONS =====

  /**
   * Get all conversations
   */
  getConversations: async (params = {}) => {
    return API.get('/ai/conversations', { params });
  },

  /**
   * Get a specific conversation
   */
  getConversation: async (id) => {
    return API.get(`/ai/conversations/${id}`);
  },

  /**
   * Delete a conversation
   */
  deleteConversation: async (id) => {
    return API.delete(`/ai/conversations/${id}`);
  },

  /**
   * Update conversation title
   */
  updateConversationTitle: async (id, title) => {
    return API.put(`/ai/conversations/${id}/title`, { title });
  },

  /**
   * Search conversations
   */
  searchConversations: async (query) => {
    return API.get('/ai/conversations/search', { params: { q: query } });
  },

  // ===== MESSAGES =====

  /**
   * Send a message (non-streaming)
   */
  sendMessage: async (message, conversationId = null, context = null) => {
    return API.post('/ai/chat', {
      message,
      conversation_id: conversationId,
      context,
    });
  },

  /**
   * Send a message with streaming support
   */
  sendMessageStreaming: async (message, conversationId = null, context = null, onChunk = null) => {
    const url = `${API.CONFIG.BASE_URL}/ai/chat/stream`;
    const body = JSON.stringify({ message, conversation_id: conversationId, context });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API.getAccessToken()}`,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get response');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            if (onChunk) onChunk(null, true);
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (onChunk) onChunk(parsed);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  },

  /**
   * Regenerate a response
   */
  regenerate: async (conversationId, messageId) => {
    return API.post('/ai/regenerate', {
      conversation_id: conversationId,
      message_id: messageId,
    });
  },

  /**
   * Get suggested prompts
   */
  getSuggestions: async (context = null) => {
    return API.get('/ai/suggestions', { params: { context } });
  },

  /**
   * Execute an AI action
   */
  executeAction: async (action, data, confirmation = false) => {
    return API.post('/ai/actions', { action, data, confirmation });
  },
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}

export default AIService;