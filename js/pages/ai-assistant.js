/**
 * ============================================
 * HEALTHMIND AI — AI ASSISTANT PAGE
 * ============================================
 * Smart AI assistant with predefined responses and Gemini fallback
 * Gemini API key is configured server-side (backend/.env -> GEMINI_API_KEY)
 */

import App from '/js/app.js';
import AuthService from '/js/services/auth.js';
import Navigation from '/js/navigation.js';
import Theme from '/js/theme.js';
import API from '/js/services/api.js';

// =============================================================================
// PREDEFINED RESPONSES (Quick Replies - Checked First)
// =============================================================================

const PREDEFINED_RESPONSES = {
    // ===== Greetings =====
    'hello': {
        response: "Hello! 👋 I'm HealthMind AI, your healthcare assistant. How can I help you today?",
        action: null
    },
    'hi': {
        response: "Hi there! 👋 I'm here to help with your health questions. What would you like to know?",
        action: null
    },
    'hey': {
        response: "Hey! 👋 How can I assist you with your health today?",
        action: null
    },
    'good morning': {
        response: "Good morning! 🌅 I hope you're feeling well today. How can I help you?",
        action: null
    },
    'good afternoon': {
        response: "Good afternoon! ☀️ I'm here to help with your health questions.",
        action: null
    },
    'good evening': {
        response: "Good evening! 🌙 I'm still here to help with anything you need.",
        action: null
    },

    // ===== Appointments =====
    'appointment': {
        response: "I can help you with appointments! Would you like to:\n• View your upcoming appointments\n• Book a new appointment\n• Cancel or reschedule an appointment",
        action: "SHOW_APPOINTMENTS"
    },
    'book appointment': {
        response: "I'll help you book an appointment. Let me find available doctors for you...",
        action: "BOOK_APPOINTMENT"
    },
    'my appointments': {
        response: "Let me fetch your upcoming appointments for you...",
        action: "SHOW_APPOINTMENTS"
    },
    'upcoming appointments': {
        response: "Here are your upcoming appointments...",
        action: "SHOW_APPOINTMENTS"
    },
    'cancel appointment': {
        response: "I can help you cancel an appointment. Which appointment would you like to cancel?",
        action: "SHOW_APPOINTMENTS"
    },
    'reschedule appointment': {
        response: "I can help you reschedule an appointment. Which appointment would you like to change?",
        action: "SHOW_APPOINTMENTS"
    },

    // ===== Medications =====
    'medication': {
        response: "I can help with your medications! Would you like to:\n• View your current medications\n• Set a medication reminder\n• Track your adherence",
        action: "SHOW_MEDICATION"
    },
    'my medications': {
        response: "Let me show you your current medications...",
        action: "SHOW_MEDICATION"
    },
    'remind me': {
        response: "I'll help you set a medication reminder. What medication would you like to be reminded about?",
        action: "CREATE_REMINDER"
    },
    'set reminder': {
        response: "I'll help you set a medication reminder. What medication and time?",
        action: "CREATE_REMINDER"
    },
    'medicine': {
        response: "I can help with your medications! Would you like to:\n• View your current medications\n• Set a medication reminder\n• Track your adherence",
        action: "SHOW_MEDICATION"
    },
    'pill': {
        response: "I can help with your medication schedule. Would you like to set a reminder?",
        action: "CREATE_REMINDER"
    },

    // ===== Medical Records =====
    'records': {
        response: "I can help with your medical records! Would you like to:\n• View your records\n• Get an AI summary\n• Upload a new record",
        action: "SHOW_MEDICAL_RECORD"
    },
    'my records': {
        response: "Let me fetch your medical records...",
        action: "SHOW_MEDICAL_RECORD"
    },
    'lab results': {
        response: "I can help you understand your lab results. Which lab results would you like to review?",
        action: "SHOW_MEDICAL_RECORD"
    },
    'medical history': {
        response: "I can help you review your medical history. Would you like to see your past records?",
        action: "SHOW_MEDICAL_RECORD"
    },

    // ===== Emergency =====
    'emergency': {
        response: "🚨 If this is a medical emergency, please call 911 immediately. If you need assistance, I'm here to help.",
        action: "EMERGENCY_WARNING"
    },
    'help': {
        response: "I'm here to help! What do you need assistance with? I can help with:\n• Appointments\n• Medications\n• Medical records\n• Finding doctors\n• Health questions",
        action: null
    },
    '911': {
        response: "🚨 Please call 911 immediately if this is a medical emergency. Do not wait.",
        action: "EMERGENCY_WARNING"
    },
    'sos': {
        response: "🚨 Emergency alert triggered. Please call 911 immediately if this is a medical emergency.",
        action: "EMERGENCY_WARNING"
    },

    // ===== Doctors =====
    'find doctor': {
        response: "I'll help you find a doctor. What specialty are you looking for? (e.g., Cardiology, Dermatology, etc.)",
        action: "SHOW_HOSPITALS"
    },
    'doctor near me': {
        response: "Let me find doctors near your location...",
        action: "SHOW_HOSPITALS"
    },
    'specialist': {
        response: "I can help you find a specialist. What type of specialist do you need?",
        action: "SHOW_HOSPITALS"
    },

    // ===== Health Questions =====
    'blood pressure': {
        response: "Blood pressure measures the force of blood against your artery walls. Normal blood pressure is around 120/80 mmHg. If you're concerned about your blood pressure, please consult your doctor.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },
    'heart rate': {
        response: "A normal resting heart rate for adults is between 60-100 beats per minute. If you're experiencing heart palpitations or chest pain, please seek medical attention immediately.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },
    'fever': {
        response: "A normal body temperature is around 98.6°F (37°C). A fever is generally considered to be 100.4°F (38°C) or higher. If you have a fever, rest and stay hydrated. Seek medical attention if the fever persists or is accompanied by other symptoms.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },
    'diabetes': {
        response: "Diabetes is a condition where your body doesn't properly process sugar (glucose). There are two main types: Type 1 (insulin-dependent) and Type 2 (lifestyle-related). If you have concerns about diabetes, please consult your healthcare provider.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },
    'headache': {
        response: "Headaches can be caused by stress, dehydration, or other factors. If you have a severe headache, especially with other symptoms like vision changes or confusion, please seek medical attention.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },
    'cough': {
        response: "A cough can be caused by many things including colds, allergies, or other conditions. If you have a persistent cough or trouble breathing, please consult your healthcare provider.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },
    'allergy': {
        response: "Allergies occur when your immune system reacts to a substance (allergen). Common allergens include pollen, dust, and certain foods. If you're experiencing allergy symptoms, consult your healthcare provider.",
        action: null,
        safety_notice: "This is informational only. Please consult your healthcare provider for medical advice."
    },

    // ===== General =====
    'thank you': {
        response: "You're welcome! 😊 Is there anything else I can help you with?",
        action: null
    },
    'thanks': {
        response: "You're welcome! 😊 Let me know if you need anything else.",
        action: null
    },
    'bye': {
        response: "Goodbye! 👋 Take care of your health. I'm here whenever you need me.",
        action: null
    },
    'goodbye': {
        response: "Goodbye! 👋 Wishing you good health. I'll be here when you need me.",
        action: null
    },
    'who are you': {
        response: "I'm HealthMind AI, your intelligent healthcare assistant. I'm here to help you with appointments, medications, medical records, and answer health questions.",
        action: null
    },
    'what can you do': {
        response: "I can help you with:\n• 📅 Appointments - Book, view, or cancel\n• 💊 Medications - Track and set reminders\n• 📋 Medical Records - View and understand\n• 🏥 Find Doctors - Locate healthcare providers\n• ❤️ Health Questions - Get information\n\nJust ask me anything!",
        action: null
    }
};

// =============================================================================
// AI ASSISTANT CONTROLLER
// =============================================================================

const AIAssistant = (() => {
    // ===== STATE =====
    let currentConversationId = null;
    let conversations = [];
    let messages = [];
    let isProcessing = false;
    let isOnline = navigator.onLine;

    // ===== DOM REFS =====
    const elements = {
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        sendBtn: document.getElementById('send-btn'),
        conversationList: document.getElementById('conversation-list'),
        conversationSearch: document.getElementById('conversation-search'),
        welcomeMessage: document.getElementById('welcome-message'),
        newChatBtn: document.getElementById('new-chat-btn'),
        newChatSidebar: document.getElementById('new-chat-sidebar'),
    };

    // ===== INITIALIZE =====
    const init = async () => {
        try {
            const userRole = AuthService.getRole() || 'patient';
            Navigation.init(userRole, true);

            // Check network status
            setupNetworkListeners();

            // Load conversations
            await loadConversations();

            // Setup event listeners
            setupEventListeners();

            // Auto-resize textarea
            autoResizeTextarea();

            // Hide loading
            App.hideLoading();

            console.log('🤖 AI Assistant initialized');
            

        } catch (error) {
            App.handleError(error);
            App.hideLoading();
        }
    };

    // ===== NETWORK STATUS =====
    const setupNetworkListeners = () => {
        window.addEventListener('online', () => {
            isOnline = true;
            App.showToast('info', 'Connected', 'You are back online.');
        });

        window.addEventListener('offline', () => {
            isOnline = false;
            App.showToast('warning', 'Offline', 'You are offline. Using predefined responses.');
        });
    };

    // ===== LOAD CONVERSATIONS =====
    const loadConversations = async () => {
        try {
            if (!isOnline) {
                renderConversations();
                return;
            }

            const response = await API.get('/ai/conversations', {
                params: { limit: 50, offset: 0 }
            });

            conversations = response.conversations || [];
            renderConversations();

            if (conversations.length > 0) {
                await loadConversation(conversations[0].id);
            }

        } catch (error) {
            console.error('Error loading conversations:', error);
            renderConversations();
        }
    };

    // ===== LOAD CONVERSATION =====
    const loadConversation = async (conversationId) => {
        try {
            currentConversationId = conversationId;

            if (!isOnline) {
                renderMessages();
                renderConversations();
                return;
            }

            const response = await API.get(`/ai/conversations/${conversationId}`);
            messages = response.messages || [];

            renderMessages();
            renderConversations();

            if (elements.welcomeMessage) {
                elements.welcomeMessage.style.display = 'none';
            }

            scrollToBottom();

        } catch (error) {
            console.error('Error loading conversation:', error);
            App.showToast('error', 'Error', 'Failed to load conversation.');
        }
    };

    // ===== CREATE NEW CONVERSATION =====
    const createNewConversation = () => {
        currentConversationId = null;
        messages = [];
        renderMessages();
        renderConversations();

        if (elements.welcomeMessage) {
            elements.welcomeMessage.style.display = 'flex';
        }

        if (elements.chatInput) {
            elements.chatInput.value = '';
            elements.chatInput.focus();
        }

        closeConversationsSidebar();
    };

    // =========================================================================
    // MATCH PREDEFINED RESPONSE (CHECKED FIRST)
    // =========================================================================
    const getPredefinedResponse = (message) => {
        const lowerMsg = message.toLowerCase().trim();

        // Exact match
        if (PREDEFINED_RESPONSES[lowerMsg]) {
            return PREDEFINED_RESPONSES[lowerMsg];
        }

        // Partial match - check if any key is in the message
        const keys = Object.keys(PREDEFINED_RESPONSES);
        for (const key of keys) {
            if (key.length > 3 && lowerMsg.includes(key)) {
                return PREDEFINED_RESPONSES[key];
            }
        }

        // Check for specific keywords
        const keywords = {
            'appointment': 'appointment',
            'book': 'book appointment',
            'cancel': 'cancel appointment',
            'reschedule': 'reschedule appointment',
            'medication': 'medication',
            'medicine': 'medication',
            'pill': 'medication',
            'records': 'records',
            'record': 'records',
            'lab': 'lab results',
            'doctor': 'find doctor',
            'emergency': 'emergency',
            'help': 'help',
            'hello': 'hello',
            'hi': 'hi',
            'hey': 'hey',
            'thank': 'thank you',
            'thanks': 'thanks',
            'bye': 'bye',
            'goodbye': 'goodbye',
            'blood': 'blood pressure',
            'heart': 'heart rate',
            'fever': 'fever',
            'cough': 'cough',
            'diabetes': 'diabetes',
            'allergy': 'allergy',
            'headache': 'headache',
            'sos': 'sos',
            '911': '911',
        };

        for (const [word, key] of Object.entries(keywords)) {
            if (lowerMsg.includes(word)) {
                return PREDEFINED_RESPONSES[key];
            }
        }

        return null;
    };

    // =========================================================================
    // SEND MESSAGE
    // =========================================================================
    const sendMessage = async () => {
        const input = elements.chatInput;
        const message = input.value.trim();

        if (!message || isProcessing) return;

        input.value = '';
        input.style.height = 'auto';

        if (elements.welcomeMessage) {
            elements.welcomeMessage.style.display = 'none';
        }

        // Add user message
        addMessage('user', message);

        isProcessing = true;
        elements.sendBtn.disabled = true;

        try {
            // STEP 1: Check for predefined response FIRST
            const predefined = getPredefinedResponse(message);

            if (predefined) {
                // Use predefined response (no AI needed)
                await handlePredefinedResponse(message, predefined);
            } else if (!isOnline) {
                // Offline - use generic offline message
                await handleOfflineResponse(message);
            } else {
                // STEP 2: Not predefined - CONNECT TO GEMINI AI
                await handleGeminiResponse(message);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            // If Gemini fails, try to find a fallback response
            const fallback = getPredefinedResponse('help');
            if (fallback) {
                addMessage('ai', fallback.response);
                App.showToast('warning', 'Fallback Mode', 'Using predefined response.');
            } else {
                addMessage('ai', "I'm sorry, I'm having trouble connecting to the AI service. Please try again later.");
                App.showToast('error', 'Error', 'Failed to get response.');
            }
        } finally {
            isProcessing = false;
            elements.sendBtn.disabled = false;
            elements.chatInput.focus();
        }
    };

    // =========================================================================
    // HANDLE PREDEFINED RESPONSE (NO AI)
    // =========================================================================
    const handlePredefinedResponse = async (message, predefined) => {
        const responseMsg = predefined.response;
        const action = predefined.action;

        // Add AI response
        addMessage('ai', responseMsg);

        // Handle action if present
        if (action) {
            handleAIAction(action, message);
        }

        // Save conversation (if online)
        if (isOnline && currentConversationId) {
            try {
                await saveConversation(message, responseMsg);
            } catch (e) {
                console.log('Conversation not saved');
            }
        }

        // Update conversation list
        if (currentConversationId) {
            await loadConversations();
        }

        scrollToBottom();
    };

    // =========================================================================
    // HANDLE OFFLINE RESPONSE
    // =========================================================================
    const handleOfflineResponse = async (message) => {
        const offlineMsg = "I'm currently offline. Please connect to the internet for full AI capabilities. I can help with:\n• Appointments\n• Medications\n• Medical records\n• Finding doctors";

        addMessage('ai', offlineMsg);

        if (currentConversationId) {
            try {
                await saveConversation(message, offlineMsg);
            } catch (e) {
                console.log('Conversation not saved');
            }
        }

        scrollToBottom();
    };

    // =========================================================================
    // HANDLE GEMINI AI RESPONSE (FALLBACK - AI IS CALLED HERE)
    // =========================================================================
    const handleGeminiResponse = async (message) => {
        try {
            // Show typing indicator
            showTyping();

            console.log('🤖 Connecting to Gemini AI...');
            

            // Send to backend which uses Gemini
            const response = await API.post('/ai/chat', {
                message: message,
                conversation_id: currentConversationId,
            });

            // Remove typing indicator
            removeTyping();

            if (response.message) {
                // Check if this is a new conversation
                if (response.conversation_id && !currentConversationId) {
                    currentConversationId = response.conversation_id;
                    await loadConversations();
                }

                // Add AI message from Gemini
                addMessage('ai', response.message);

                // Handle AI action if present
                if (response.action) {
                    handleAIAction(response.action, response.action_data);
                }

                // Update conversation list
                if (currentConversationId) {
                    await loadConversations();
                }
            }

        } catch (error) {
            removeTyping();
            console.error('Gemini AI Error:', error);

            // If Gemini fails, try predefined response as fallback
            const fallback = getPredefinedResponse(message);
            if (fallback) {
                addMessage('ai', fallback.response);
                if (fallback.action) {
                    handleAIAction(fallback.action);
                }
                App.showToast('warning', 'Fallback Mode', 'Using predefined response (AI unavailable).');
            } else {
                // Generic fallback
                addMessage('ai', "I understand you're asking about that. However, I need to connect to my AI service to give you the best response. Please try again or ask me about appointments, medications, or medical records.");
                App.showToast('warning', 'AI Unavailable', 'Using offline mode.');
            }
        }
    };

    // =========================================================================
    // SAVE CONVERSATION
    // =========================================================================
    const saveConversation = async (userMsg, aiMsg) => {
        try {
            // The conversation is already saved by the backend
            await loadConversations();
        } catch (error) {
            console.error('Error saving conversation:', error);
        }
    };

    // =========================================================================
    // ADD MESSAGE
    // =========================================================================
    const addMessage = (role, content, timestamp = null) => {
        const message = {
            id: Date.now() + Math.random(),
            role: role,
            content: content,
            timestamp: timestamp || new Date().toISOString(),
        };

        messages.push(message);
        renderMessages();
        scrollToBottom();

        return message;
    };

    // =========================================================================
    // RENDER MESSAGES
    // =========================================================================
    const renderMessages = () => {
        const container = elements.chatMessages;
        if (!container) return;

        const messagesContainer = container.querySelector('.messages-container') || document.createElement('div');
        messagesContainer.className = 'messages-container';

        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            if (elements.welcomeMessage) {
                elements.welcomeMessage.style.display = 'flex';
            }
            const existing = container.querySelector('.messages-container');
            if (existing) existing.remove();
            return;
        }

        if (elements.welcomeMessage) {
            elements.welcomeMessage.style.display = 'none';
        }

        messages.forEach((msg) => {
            const messageEl = createMessageElement(msg);
            messagesContainer.appendChild(messageEl);
        });

        const existing = container.querySelector('.messages-container');
        if (existing) {
            existing.replaceWith(messagesContainer);
        } else {
            container.appendChild(messagesContainer);
        }
    };

    // =========================================================================
    // CREATE MESSAGE ELEMENT
    // =========================================================================
    const createMessageElement = (message) => {
        const div = document.createElement('div');
        div.className = `message message-${message.role}`;

        const isUser = message.role === 'user';
        const avatar = isUser ? '👤' : '🤖';
        const avatarClass = isUser ? 'message-avatar-user' : 'message-avatar-ai';

        // Render markdown for AI responses
        const content = isUser ? escapeHtml(message.content) : renderMarkdown(message.content);

        div.innerHTML = `
            <div class="message-avatar ${avatarClass}">${avatar}</div>
            <div class="message-content">
                ${content}
                <span class="message-time">${formatTime(message.timestamp)}</span>
                ${!isUser ? `
                    <div class="message-actions">
                        <button class="copy-message" title="Copy">📋</button>
                        <button class="regenerate-message" title="Regenerate">🔄</button>
                    </div>
                ` : ''}
            </div>
        `;

        // Copy handler
        const copyBtn = div.querySelector('.copy-message');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(message.content).then(() => {
                    App.showToast('success', 'Copied!', 'Message copied to clipboard.');
                }).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = message.content;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    textarea.remove();
                    App.showToast('success', 'Copied!', 'Message copied to clipboard.');
                });
            });
        }

        // Regenerate handler
        const regenerateBtn = div.querySelector('.regenerate-message');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', async () => {
                const index = messages.findIndex(m => m.id === message.id);
                if (index > 0) {
                    const previous = messages[index - 1];
                    if (previous && previous.role === 'user') {
                        messages = messages.slice(0, index);
                        renderMessages();
                        // Re-send the message to AI
                        if (elements.chatInput) {
                            elements.chatInput.value = previous.content;
                            await sendMessage();
                        }
                    }
                }
            });
        }

        return div;
    };

    // =========================================================================
    // RENDER MARKDOWN
    // =========================================================================
    const renderMarkdown = (text) => {
        let html = escapeHtml(text);

        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${escapeHtml(code)}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            return `<code>${escapeHtml(code)}</code>`;
        });

        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    };

    // =========================================================================
    // ESCAPE HTML
    // =========================================================================
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // =========================================================================
    // FORMAT TIME
    // =========================================================================
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // =========================================================================
    // TYPING INDICATOR
    // =========================================================================
    const showTyping = () => {
        removeTyping();

        const container = elements.chatMessages;
        if (!container) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <span class="typing-text">HealthMind AI is thinking...</span>
        `;

        const messagesContainer = container.querySelector('.messages-container');
        if (messagesContainer) {
            messagesContainer.appendChild(typingDiv);
        } else {
            container.appendChild(typingDiv);
        }

        scrollToBottom();
    };

    const removeTyping = () => {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    };

    // =========================================================================
    // RENDER CONVERSATIONS
    // =========================================================================
    const renderConversations = () => {
        const container = elements.conversationList;
        if (!container) return;

        if (!conversations || conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-conversations">
                    <div class="empty-icon">💬</div>
                    <div class="empty-title">No conversations yet</div>
                    <div class="empty-description">Start a new chat to begin</div>
                </div>
            `;
            return;
        }

        container.innerHTML = conversations.map(conv => {
            const isActive = conv.id === currentConversationId;
            const time = conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : 'Recent';
            const preview = conv.preview || 'No messages yet';

            return `
                <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${conv.id}">
                    <span class="conversation-icon">💬</span>
                    <div class="conversation-info">
                        <div class="conversation-title">${escapeHtml(conv.title || 'New Conversation')}</div>
                        <div class="conversation-preview">${escapeHtml(preview)}</div>
                    </div>
                    <span class="conversation-time">${time}</span>
                    <button class="conversation-delete" data-id="${conv.id}" aria-label="Delete conversation">✕</button>
                </div>
            `;
        }).join('');

        // Click handlers
        container.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.conversation-delete')) return;
                const id = item.dataset.id;
                if (id) loadConversation(id);
                closeConversationsSidebar();
            });
        });

        // Delete handlers
        container.querySelectorAll('.conversation-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (id && confirm('Delete this conversation?')) {
                    await deleteConversation(id);
                }
            });
        });
    };

    // =========================================================================
    // DELETE CONVERSATION
    // =========================================================================
    const deleteConversation = async (conversationId) => {
        try {
            if (!isOnline) {
                App.showToast('warning', 'Offline', 'Cannot delete while offline.');
                return;
            }

            await API.delete(`/ai/conversations/${conversationId}`);

            conversations = conversations.filter(c => c.id !== conversationId);

            if (currentConversationId === conversationId) {
                currentConversationId = null;
                messages = [];
                renderMessages();
                renderConversations();
                if (elements.welcomeMessage) {
                    elements.welcomeMessage.style.display = 'flex';
                }
            } else {
                renderConversations();
            }

            App.showToast('success', 'Deleted', 'Conversation deleted successfully.');

        } catch (error) {
            App.showToast('error', 'Error', 'Failed to delete conversation.');
        }
    };

    // =========================================================================
    // AI ACTION HANDLER
    // =========================================================================
    const handleAIAction = (action, data) => {
        const modal = document.getElementById('action-modal');
        if (!modal) return;

        const modalBody = document.getElementById('action-modal-body');
        const modalTitle = document.getElementById('action-modal-title');
        const confirmBtn = document.getElementById('action-modal-confirm');
        const cancelBtn = document.getElementById('action-modal-cancel');

        let title = 'Action Required';
        let content = '';
        let confirmLabel = 'Confirm';

        switch (action) {
            case 'SHOW_APPOINTMENTS':
                title = '📅 View Appointments';
                content = `
                    <p>Redirecting you to your appointments...</p>
                    <div style="margin-top: var(--spacing-4);">
                        <button class="btn btn-primary" onclick="window.location.href='/appointments.html'">
                            Go to Appointments
                        </button>
                    </div>
                `;
                confirmLabel = 'OK';
                break;

            case 'BOOK_APPOINTMENT':
                title = '📅 Book Appointment';
                content = `
                    <p>Let's book an appointment for you.</p>
                    <div style="margin-top: var(--spacing-4);">
                        <button class="btn btn-primary" onclick="window.location.href='/appointments.html'">
                            Go to Booking
                        </button>
                    </div>
                `;
                confirmLabel = 'OK';
                break;

            case 'CREATE_REMINDER':
                title = '💊 Set Reminder';
                content = `
                    <p>Set a medication reminder.</p>
                    <div style="margin-top: var(--spacing-4);">
                        <button class="btn btn-primary" onclick="window.location.href='/medications.html'">
                            Go to Medications
                        </button>
                    </div>
                `;
                confirmLabel = 'OK';
                break;

            case 'SHOW_MEDICAL_RECORD':
                title = '📋 Medical Records';
                content = `
                    <p>Accessing your medical records...</p>
                    <div style="margin-top: var(--spacing-4);">
                        <button class="btn btn-primary" onclick="window.location.href='/medical-records.html'">
                            Go to Records
                        </button>
                    </div>
                `;
                confirmLabel = 'OK';
                break;

            case 'SHOW_MEDICATION':
                title = '💊 Medications';
                content = `
                    <p>Accessing your medications...</p>
                    <div style="margin-top: var(--spacing-4);">
                        <button class="btn btn-primary" onclick="window.location.href='/medications.html'">
                            Go to Medications
                        </button>
                    </div>
                `;
                confirmLabel = 'OK';
                break;

            case 'SHOW_HOSPITALS':
                title = '🏥 Find Hospitals';
                content = `
                    <p>Finding hospitals near you...</p>
                    <div style="margin-top: var(--spacing-4);">
                        <button class="btn btn-primary" onclick="window.location.href='/emergency.html'">
                            View Emergency Options
                        </button>
                    </div>
                `;
                confirmLabel = 'OK';
                break;

            case 'EMERGENCY_WARNING':
                title = '🚨 Emergency Alert';
                content = `
                    <div style="background: var(--color-danger-surface); padding: var(--spacing-4); border-radius: var(--radius-lg); border: 2px solid var(--color-danger);">
                        <p style="color: var(--color-danger); font-weight: var(--font-weight-bold);">
                            Please call 911 immediately if this is a medical emergency.
                        </p>
                        <p style="margin-top: var(--spacing-2);">
                            <strong>Do not wait. Call emergency services now.</strong>
                        </p>
                    </div>
                    <div style="margin-top: var(--spacing-4);">
                        <a href="/emergency.html" class="btn btn-danger btn-block">Go to Emergency</a>
                    </div>
                `;
                confirmLabel = 'I Understand';
                break;

            default:
                content = `<p>${data?.message || 'Action requested.'}</p>`;
                confirmLabel = 'OK';
        }

        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        confirmBtn.textContent = confirmLabel;

        // Remove old listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newConfirmBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.querySelector('.modal-close')?.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        modal.classList.add('active');
    };

    // =========================================================================
    // SCROLL TO BOTTOM
    // =========================================================================
    const scrollToBottom = () => {
        const container = elements.chatMessages;
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    };

    // =========================================================================
    // AUTO-RESIZE TEXTAREA
    // =========================================================================
    const autoResizeTextarea = () => {
        const textarea = elements.chatInput;
        if (!textarea) return;

        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    };

    // =========================================================================
    // TOGGLE CONVERSATIONS SIDEBAR
    // =========================================================================
    const toggleConversationsSidebar = () => {
        const sidebar = document.querySelector('.conversations-sidebar');
        const overlay = document.querySelector('.conversations-sidebar-overlay');
        if (sidebar) {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        }
    };

    const closeConversationsSidebar = () => {
        const sidebar = document.querySelector('.conversations-sidebar');
        const overlay = document.querySelector('.conversations-sidebar-overlay');
        if (sidebar) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        }
    };

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================
    const setupEventListeners = () => {
        // Send message
        if (elements.sendBtn) {
            elements.sendBtn.addEventListener('click', sendMessage);
        }

        // New chat buttons
        if (elements.newChatBtn) {
            elements.newChatBtn.addEventListener('click', createNewConversation);
        }
        if (elements.newChatSidebar) {
            elements.newChatSidebar.addEventListener('click', createNewConversation);
        }

        // Conversation search
        if (elements.conversationSearch) {
            elements.conversationSearch.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const items = document.querySelectorAll('.conversation-item');
                items.forEach(item => {
                    const title = item.querySelector('.conversation-title')?.textContent?.toLowerCase() || '';
                    const preview = item.querySelector('.conversation-preview')?.textContent?.toLowerCase() || '';
                    const match = title.includes(query) || preview.includes(query);
                    item.style.display = match ? '' : 'none';
                });
            });
        }

        // Suggested prompts
        document.querySelectorAll('.suggested-prompt').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                if (prompt && elements.chatInput) {
                    elements.chatInput.value = prompt;
                    sendMessage();
                }
            });
        });

        // Mobile sidebar toggle
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleConversationsSidebar();
            });
        }

        // Theme toggle
        document.querySelector('.theme-toggle')?.addEventListener('click', () => {
            Theme.toggle();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (elements.chatInput) {
                    elements.chatInput.focus();
                }
            }
        });
    };

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    return {
        init,
        sendMessage,
        createNewConversation,
        loadConversation,
        deleteConversation,
    };
})();

export default AIAssistant;