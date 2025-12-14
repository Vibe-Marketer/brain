import { useState } from 'react';
import { RiSparklingLine, RiSendPlaneLine, RiLightbulbLine } from '@remixicon/react';

interface AIAssistantPanelProps {
  data?: any;
}

export function AIAssistantPanel({ data }: AIAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help you generate content, analyze insights, or answer questions about your calls. What would you like to do?'
    }
  ]);

  const suggestions = [
    'Generate an email from recent insights',
    'Summarize this week\'s calls',
    'Find common pain points',
    'Create a case study outline',
  ];

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'ll help you with that. Let me analyze the data...'
      }]);
    }, 500);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[85%] rounded-lg px-4 py-2.5
                ${message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
                }
              `}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <RiSparklingLine size={14} className="text-purple-600" />
                  <span className="text-xs font-semibold text-purple-600">AI Assistant</span>
                </div>
              )}
              <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
            <RiLightbulbLine size={14} />
            <span>Suggestions</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setInput(suggestion)}
                className="text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm text-gray-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RiSendPlaneLine size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
