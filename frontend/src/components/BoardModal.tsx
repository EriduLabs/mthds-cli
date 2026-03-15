import React, { useState } from 'react';
import { X, Archive, Users, Layout } from 'lucide-react';
import api from '../api/client';

interface BoardModalProps {
    boardId: number;
    initialName: string;
    onClose: () => void;
    onUpdate: (newName: string) => void;
}

export const BoardModal: React.FC<BoardModalProps> = ({ boardId, initialName, onClose, onUpdate }) => {
    const [name, setName] = useState(initialName);
    const [shareUsername, setShareUsername] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSaveName = async () => {
        if (!name.trim() || name === initialName) return;
        try {
            await api.put(`/boards/${boardId}/`, { name: name.trim() });
            onUpdate(name.trim());
        } catch (e) {
            alert('Failed to update board name');
        }
    };

    const handleShare = async () => {
        if (!shareUsername.trim()) return;
        setIsSubmitting(true);
        try {
            await api.post(`/boards/${boardId}/members/`, { username: shareUsername.trim() });
            alert(`Successfully added ${shareUsername}`);
            setShareUsername('');
        } catch (e: any) {
            alert(e.response?.data?.error || 'Failed to share board');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!confirm('Are you sure you want to archive this entire board?')) return;
        try {
            await api.put(`/boards/${boardId}/`, { is_archived: true });
            window.location.href = '/dashboard/';
        } catch (e) {
            alert('Failed to archive board');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            {/* Modal Container */}
            <div className="bg-[#282e33] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header Phase */}
                <div className="p-4 sm:p-6 pr-12 relative border-b border-gray-700/50">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 hover:bg-gray-700 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-start gap-4">
                        <Layout className="w-6 h-6 text-gray-400 mt-1" />
                        <div className="flex-1">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                className="w-full bg-transparent text-xl font-bold text-gray-100 placeholder-gray-500 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 px-2 py-1 -ml-2 rounded"
                            />
                            <p className="text-gray-400 text-sm mt-1 ml-1 cursor-default">
                                Board settings and privacy
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar flex flex-col md:flex-row gap-8">

                    {/* Main Column */}
                    <div className="flex-1 space-y-8">

                        {/* Share Board Segment */}
                        <div className="flex items-start gap-4">
                            <Users className="w-6 h-6 text-gray-400 mt-1" />
                            <div className="flex-1">
                                <h3 className="text-gray-100 font-semibold mb-2">Share Board</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter username to invite"
                                        value={shareUsername}
                                        onChange={(e) => setShareUsername(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleShare}
                                        disabled={isSubmitting || !shareUsername.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
                                    >
                                        Share
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Collaborators will gain full access to view and edit this board.
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* Sidebar Actions */}
                    <div className="md:w-48 space-y-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Board Actions</h4>
                        <div className="space-y-2">
                            <button
                                onClick={handleArchive}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-200 border border-red-900/50 rounded text-sm font-medium transition-colors"
                            >
                                <Archive size={16} />
                                Archive Board
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
