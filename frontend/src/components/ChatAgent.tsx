import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, MessageSquare, X } from 'lucide-react';
import api from '../api/client';

interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
}

interface ChatAgentProps {
    boardId: number;
    onActionSuccess: () => void;
}

export const ChatAgent: React.FC<ChatAgentProps> = ({ boardId, onActionSuccess }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 'initial', role: 'agent', content: 'Hello! I can help manage your Kanban board. What would you like to do?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            // POST the prompt to the backend agent endpoint
            const response = await api.post<{ message: string }>('agent/prompt/', { prompt: userMsg.content, board_id: boardId });

            const agentMsg: Message = { id: (Date.now() + 1).toString(), role: 'agent', content: response.data.message };
            setMessages(prev => [...prev, agentMsg]);

            // Refresh board state so changes made by Agent are visible immediately
            onActionSuccess();
        } catch (error) {
            console.error('Agent API error:', error);
            const errMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: 'Sorry, I encountered an error while processing your request.'
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105 z-[9999] flex items-center justify-center"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all h-[500px] max-h-[80vh] z-[9999]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Bot className="text-blue-400" size={20} />
                    <h3 className="text-white font-medium">Board AI Agent</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-900/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-sm'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl rounded-tl-sm text-gray-400 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="text-xs">Agent is thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-gray-800 border-t border-gray-700">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="E.g., Create a 'Done' list..."
                        className="w-full bg-gray-900 text-white text-sm rounded-xl pl-4 pr-12 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
                        disabled={isTyping}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 p-1.5 text-blue-500 hover:text-blue-400 disabled:opacity-50 transition-colors bg-gray-800 rounded-lg flex items-center justify-center cursor-pointer"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};
