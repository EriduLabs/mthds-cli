import React, { useState, useEffect } from 'react';
import { X, AlignLeft, CheckSquare, MessageSquare, Paperclip, Clock, Tag, Archive, CornerUpRight, Plus, Users, Trash2 } from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';
import type { TaskCard, Checklist, BoardLabel, User } from '../types/kanban';
import api from '../api/client';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CardModalProps {
    card: TaskCard;
    boardId: number;
    onClose: () => void;
    onCardUpdate: () => void;
}

const CARD_COLORS = [
    { name: 'none', value: '', label: 'Remove color' },
    // Solids
    { name: 'blue', value: 'bg-[#0c66e4]' },
    { name: 'green', value: 'bg-[#216e4e]' },
    { name: 'orange', value: 'bg-[#a54800]' },
    { name: 'red', value: 'bg-[#ae2e24]' },
    { name: 'purple', value: 'bg-[#5e4db2]' },
    // Gradients
    { name: 'grad-blue', value: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
    { name: 'grad-purple', value: 'bg-gradient-to-r from-purple-600 to-pink-600' },
    { name: 'grad-green', value: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
    { name: 'grad-fire', value: 'bg-gradient-to-r from-orange-500 to-red-500' },
    // Glows
    { name: 'glow-blue', value: 'bg-[#282e33] shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-blue-500/50' },
    { name: 'glow-purple', value: 'bg-[#282e33] shadow-[0_0_20px_rgba(168,85,247,0.5)] border border-purple-500/50' },
];

export const CardModal: React.FC<CardModalProps> = ({ card, boardId, onClose, onCardUpdate }) => {
    // Editing State
    const [title, setTitle] = useState(card.title);
    const [description, setDescription] = useState(card.description || '');
    const [isEditingDesc, setIsEditingDesc] = useState(false);

    // Checklists State
    const [newChecklistTitle, setNewChecklistTitle] = useState('');
    const [newItemTexts, setNewItemTexts] = useState<Record<number, string>>({});

    // Comments State
    const [newComment, setNewComment] = useState('');

    // Attachments State
    const [uploading, setUploading] = useState(false);
    const [viewingAttachment, setViewingAttachment] = useState<{ url: string, filename: string } | null>(null);

    // Dynamic Popover States
    const [showLabelsPopover, setShowLabelsPopover] = useState(false);
    const [showDatesPopover, setShowDatesPopover] = useState(false);
    const [showAssigneesPopover, setShowAssigneesPopover] = useState(false);
    const [showChecklistPopover, setShowChecklistPopover] = useState(false);
    const [showCoverPopover, setShowCoverPopover] = useState(false);

    // Label State
    const [newCustomLabelName, setNewCustomLabelName] = useState('');
    const [isAddingCustomLabel, setIsAddingCustomLabel] = useState(false);

    // Available Board Data (Fetched dynamically)
    const [availableLabels, setAvailableLabels] = useState<BoardLabel[]>([]);
    const [availableMembers, setAvailableMembers] = useState<User[]>([]);

    useEffect(() => {
        if (showLabelsPopover || showAssigneesPopover) {
            // Fetch board details to get available labels and members
            api.get(`/boards/${boardId}/active/`).then(res => {
                setAvailableLabels(res.data.labels || []);
            });
            api.get(`/boards/${boardId}/search_members/`).then(res => {
                setAvailableMembers(res.data || []);
            });
        }
    }, [showLabelsPopover, showAssigneesPopover, boardId]);

    // Click outside to close helper
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    // --- API Handlers ---
    const updateCard = async (payload: any) => {
        try {
            await api.put(`/cards/${card.id}/`, payload);
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };

    const handleTitleBlur = () => {
        if (title.trim() !== card.title) {
            updateCard({ title: title.trim() });
        }
    };

    const handleDescSave = () => {
        updateCard({ description: description.trim() });
        setIsEditingDesc(false);
    };

    const toggleArchive = async () => {
        try {
            await api.put(`/cards/${card.id}/archive/`);
            onCardUpdate();
            onClose(); // auto close when archived
        } catch (e) {
            console.error(e);
        }
    };

    // --- Checklists ---
    const addChecklist = async (overrideTitle?: string) => {
        const titleToUse = overrideTitle || newChecklistTitle;
        if (!titleToUse.trim()) return;
        try {
            await api.post(`/cards/${card.id}/checklists/`, { title: titleToUse.trim() });
            setNewChecklistTitle('');
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };

    const addChecklistItem = async (checklistId: number) => {
        const text = newItemTexts[checklistId];
        if (!text || !text.trim()) return;
        try {
            await api.post(`/checklists/${checklistId}/items/`, { text: text.trim() });
            setNewItemTexts({ ...newItemTexts, [checklistId]: '' });
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };

    const toggleItem = async (itemId: number) => {
        try {
            await api.put(`/items/${itemId}/toggle/`);
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };

    // --- Comments ---
    const addComment = async () => {
        if (!newComment.trim()) return;
        try {
            await api.post(`/cards/${card.id}/comments/`, { text: newComment.trim() });
            setNewComment('');
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };

    // --- Attachments ---
    const deleteAttachment = async (attachmentId: number) => {
        if (!confirm('Are you sure you want to delete this attachment?')) return;
        try {
            await api.delete(`/attachments/${attachmentId}/`);
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            await api.post(`/cards/${card.id}/attachments/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onCardUpdate();
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    const handleChangeColor = async (colorInfo: typeof CARD_COLORS[0]) => {
        try {
            await api.put(`/cards/${card.id}/`, { color_boost: colorInfo.value });
            setShowCoverPopover(false);
            onCardUpdate();
        } catch (err) {
            console.error('Failed to change color:', err);
        }
    };

    const addCustomLabel = async () => {
        if (!newCustomLabelName.trim()) return;
        try {
            // First create the label for the board
            const res = await api.post(`/boards/${boardId}/labels/`, {
                name: newCustomLabelName.trim(),
                color: "#8590a2" // Default color for custom text labels
            });
            const newLabel = res.data;
            // Then attach to card
            await api.post(`/cards/${card.id}/labels/${newLabel.id}/`);

            setNewCustomLabelName('');
            setIsAddingCustomLabel(false);

            // Refresh available labels
            api.get(`/boards/${boardId}/active/`).then(res => {
                setAvailableLabels(res.data.labels || []);
            });
            onCardUpdate();
        } catch (e) {
            console.error(e);
        }
    };


    // Components
    const renderChecklistProgress = (checklist: Checklist) => {
        if (!checklist.items || checklist.items.length === 0) return null;
        const completed = checklist.items.filter(i => i.is_completed).length;
        const percent = Math.round((completed / checklist.items.length) * 100);
        return (
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 w-8">{percent}%</span>
                <div className="h-2 flex-1 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        );
    };

    // Determine Cover Image
    const imageAttachments = card.attachments?.filter(a => a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)) || [];
    const coverImage = card.metadata?.cover_image || (imageAttachments.length > 0 ? imageAttachments[0].file_url : null);
    const coverColor = card.color_boost;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-12 px-4 custom-scrollbar"
            onClick={handleOverlayClick}
        >
            <div className={`w-full max-w-3xl rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${coverColor ? coverColor : 'bg-[#282e33] border border-[#333c43]'}`}>

                {/* Cover Area (Only for images now) */}
                {coverImage && !coverColor && (
                    <div className="h-40 w-full bg-[#1d2125] bg-cover bg-center rounded-t-xl overflow-hidden" style={{ backgroundImage: `url(${coverImage})` }} />
                )}

                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 relative">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-gray-900/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Left Column (Main Content) */}
                    <div className="flex-1 space-y-8">

                        {/* Title Section */}
                        <div className="flex gap-4">
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                onBlur={handleTitleBlur}
                                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                                className="text-2xl font-bold bg-transparent text-gray-100 focus:outline-none focus:bg-gray-900/50 focus:ring-1 focus:ring-blue-500 rounded px-2 -ml-2 py-1 flex-1 w-full"
                            />
                        </div>

                        {/* Labels & Dates & Assignees */}
                        {(card.labels?.length > 0 || card.board_labels?.length > 0 || card.due_date || card.assignees?.length > 0) && (
                            <div className="flex flex-wrap gap-4 ml-6">
                                {(card.labels?.length > 0 || card.board_labels?.length > 0) && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Labels</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {card.board_labels?.map(l => (
                                                <span key={`bl-${l.id}`} className="px-3 py-1 bg-gray-700/50 text-gray-200 text-sm rounded font-medium border border-gray-600">{l.name}</span>
                                            ))}
                                            {card.labels?.map(l => (
                                                <span key={`l-${l}`} className="px-3 py-1 bg-[#2c3e5d] text-[#579dff] text-sm rounded font-medium">{l}</span>
                                            ))}
                                            <button onClick={() => setShowLabelsPopover(true)} className="flex items-center justify-center w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {card.due_date && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Due Date</h4>
                                        <button
                                            onClick={() => setShowDatesPopover(true)}
                                            className="flex items-center gap-2 bg-gray-700/50 hover:bg-gray-700 px-3 py-1.5 rounded text-sm text-gray-200 font-medium transition-colors"
                                        >
                                            <Clock className="w-4 h-4 text-blue-400" />
                                            {new Date(card.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </button>
                                    </div>
                                )}
                                {card.assignees?.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Assignees</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {card.assignees.map(user => (
                                                <div key={user.id} className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-white text-sm shadow cursor-pointer" title={user.username} onClick={() => setShowAssigneesPopover(true)}>
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            <button onClick={() => setShowAssigneesPopover(true)} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors shadow">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Description Section */}
                        <div className="flex gap-4">
                            <AlignLeft className="w-6 h-6 text-gray-400 shrink-0 mt-1" />
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <h3 className="text-lg font-semibold text-gray-200">Description</h3>
                                    {!isEditingDesc && (
                                        <button
                                            onClick={() => setIsEditingDesc(true)}
                                            className="px-3 py-1 bg-gray-700/50 hover:bg-gray-600 text-sm font-medium rounded transition-colors"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                                {isEditingDesc ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            className="w-full bg-gray-900 border border-blue-500 rounded p-3 text-sm text-gray-100 focus:outline-none min-h-[120px]"
                                            placeholder="Add a more detailed description..."
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={handleDescSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-medium text-sm transition-colors">Save</button>
                                            <button onClick={() => setIsEditingDesc(false)} className="px-4 py-1.5 hover:bg-gray-700 text-gray-300 rounded font-medium text-sm transition-colors">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => setIsEditingDesc(true)}
                                        className={`p-3 rounded-lg text-sm transition-colors cursor-pointer ${description ? 'hover:bg-gray-700/30 prose prose-invert prose-sm max-w-none' : 'bg-gray-700/30 font-medium text-gray-400 hover:bg-gray-700/50 min-h-[60px]'}`}
                                    >
                                        {description ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown> : "Add a more detailed description..."}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Attachments Section */}
                        {card.attachments && card.attachments.length > 0 && (
                            <div className="flex gap-4">
                                <Paperclip className="w-6 h-6 text-[#9fadbc] shrink-0 mt-1" />
                                <div className="flex-1 mt-1">
                                    <h3 className="text-lg font-semibold text-[#b6c2cf] mb-3">Attachments</h3>
                                    <div className="flex flex-col gap-3">
                                        {card.attachments.map(att => {
                                            const isImage = att.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                            return (
                                                <div
                                                    key={att.id}
                                                    className="flex items-center gap-4 hover:bg-[#a6c5e229] p-2 -ml-2 rounded group transition-colors relative"
                                                >
                                                    <div
                                                        className="flex items-center gap-4 flex-1 cursor-pointer"
                                                        onClick={() => setViewingAttachment({ url: att.file_url, filename: att.filename })}
                                                    >
                                                        {isImage ? (
                                                            <div
                                                                className="w-28 h-20 bg-[#1d2125] rounded bg-cover bg-center shrink-0 border border-[#333c43]"
                                                                style={{ backgroundImage: `url(${att.file_url})` }}
                                                            />
                                                        ) : (
                                                            <div className="w-28 h-20 bg-[#22272b] rounded flex items-center justify-center shrink-0 border border-[#333c43]">
                                                                <span className="text-[#9fadbc] font-bold uppercase text-lg">{att.filename.split('.').pop()}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col justify-center">
                                                            <span className="text-sm font-bold text-[#b6c2cf] group-hover:underline">{att.filename}</span>
                                                            <span className="text-xs text-[#9fadbc] mt-1 flex items-center gap-1 group-hover:text-[#b6c2cf]">
                                                                <CornerUpRight className="w-3.5 h-3.5" /> View document
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                                                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded transition-all mr-2"
                                                        title="Delete attachment"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Checklists Section */}
                        <div className="flex gap-4">
                            <CheckSquare className="w-6 h-6 text-gray-400 shrink-0 mt-1" />
                            <div className="flex-1 space-y-6">
                                {card.checklists?.map(cl => (
                                    <div key={cl.id} className="w-full">
                                        <h3 className="text-lg font-semibold text-gray-200 mb-2">{cl.title}</h3>
                                        {renderChecklistProgress(cl)}
                                        <div className="space-y-2 mb-3">
                                            {cl.items?.map(item => (
                                                <div key={item.id} className="flex items-start gap-3 group">
                                                    <div
                                                        onClick={() => toggleItem(item.id)}
                                                        className={`mt-0.5 w-4 h-4 shrink-0 rounded border cursor-pointer flex items-center justify-center transition-colors ${item.is_completed ? 'bg-blue-500 border-blue-500' : 'border-gray-500 group-hover:border-gray-400'}`}
                                                    >
                                                        {item.is_completed && <CheckSquare className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className={`text-sm ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                                                        {item.text}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Add Item Input */}
                                        <div className="pl-7">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={newItemTexts[cl.id] || ''}
                                                    onChange={e => setNewItemTexts({ ...newItemTexts, [cl.id]: e.target.value })}
                                                    onKeyDown={e => e.key === 'Enter' && addChecklistItem(cl.id)}
                                                    placeholder="Add an item..."
                                                    className="flex-1 bg-gray-900 border border-gray-700 focus:border-blue-500 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none"
                                                />
                                                <button onClick={() => addChecklistItem(cl.id)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors">Add</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Activity Section (Comments & Logs) */}
                        <div className="flex gap-4">
                            <MessageSquare className="w-6 h-6 text-gray-400 shrink-0 mt-1" />
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-200 mb-4">Activity</h3>

                                <div className="flex items-start gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 shrink-0 flex items-center justify-center font-bold text-sm shadow">
                                        E
                                    </div>
                                    <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700/50 p-1 flex shadow-inner">
                                        <input
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addComment()}
                                            placeholder="Write a comment..."
                                            className="w-full bg-transparent px-3 py-2 text-sm text-white focus:outline-none"
                                        />
                                        <button
                                            onClick={addComment}
                                            disabled={!newComment.trim()}
                                            className="px-4 py-1.5 m-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded font-medium text-sm transition-colors text-white"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Merge and sort comments and activity logs */}
                                    {[
                                        ...(card.comments || []).map(c => ({ ...c, type: 'comment' })),
                                        ...(card.activity_logs || []).map(l => ({ ...l, type: 'log' }))
                                    ]
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                        .map((item: any) => {
                                            if (item.type === 'comment') {
                                                return (
                                                    <div key={`comment-${item.id}`} className="flex items-start gap-3">
                                                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-sm shadow ${item.is_ai ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-tr from-purple-500 to-indigo-500'}`}>
                                                            {item.is_ai ? 'AI' : (item.author_name ? item.author_name.charAt(0).toUpperCase() : 'E')}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-baseline gap-2 mb-1">
                                                                <span className="font-semibold text-sm text-gray-200">{item.is_ai ? 'Vertex Agent' : (item.author_name || 'You')}</span>
                                                                <span className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</span>
                                                            </div>
                                                            <div className={`text-sm p-3 rounded-lg shadow-sm ${item.is_ai ? 'bg-green-900/20 border border-green-500/20 text-gray-300' : 'bg-gray-800 border border-gray-700 text-gray-300'}`}>
                                                                <div className="prose prose-invert prose-sm max-w-none">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                        {item.text}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div key={`log-${item.id}`} className="flex items-start gap-3">
                                                        <div className="w-8 h-8 shrink-0 flex items-center justify-center text-gray-500 pt-1">
                                                            {/* Simple log icon indicator */}
                                                            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1.5 pt-1.5">
                                                                <span className="font-semibold text-sm text-gray-300">{item.user?.username || 'System'}</span>
                                                                <span className="text-sm text-gray-400">{item.description}</span>
                                                                <span className="text-xs text-gray-600 ml-2">{new Date(item.created_at).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        })}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column (Sidebar Actions) */}
                    <div className="w-full md:w-48 shrink-0 space-y-6">

                        <div className="space-y-2 relative">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Add to card</h4>

                            <button
                                onClick={() => { setShowAssigneesPopover(!showAssigneesPopover); setShowLabelsPopover(false); setShowDatesPopover(false); setShowChecklistPopover(false); setShowCoverPopover(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm font-medium transition-colors text-gray-300"
                            >
                                <Users className="w-4 h-4" /> Members
                            </button>

                            <button
                                onClick={() => { setShowLabelsPopover(!showLabelsPopover); setShowAssigneesPopover(false); setShowDatesPopover(false); setShowChecklistPopover(false); setShowCoverPopover(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm font-medium transition-colors text-gray-300"
                            >
                                <Tag className="w-4 h-4" /> Labels
                            </button>

                            <button
                                onClick={() => { setShowChecklistPopover(!showChecklistPopover); setShowLabelsPopover(false); setShowAssigneesPopover(false); setShowDatesPopover(false); setShowCoverPopover(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm font-medium transition-colors text-gray-300"
                            >
                                <CheckSquare className="w-4 h-4" /> Checklist
                            </button>

                            <button
                                onClick={() => { setShowDatesPopover(!showDatesPopover); setShowLabelsPopover(false); setShowAssigneesPopover(false); setShowChecklistPopover(false); setShowCoverPopover(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm font-medium transition-colors text-gray-300"
                            >
                                <Clock className="w-4 h-4" /> Dates
                            </button>

                            <label className={`w-full flex items-center gap-2 px-3 py-1.5 ${uploading ? 'bg-blue-600/50 cursor-wait' : 'bg-gray-700/50 hover:bg-gray-600 cursor-pointer'} rounded text-sm font-medium transition-colors text-gray-300`}>
                                <Paperclip className="w-4 h-4" />
                                <span>{uploading ? 'Uploading...' : 'Attachment'}</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={handleFileUpload}
                                />
                            </label>

                            <button
                                onClick={() => { setShowCoverPopover(!showCoverPopover); setShowLabelsPopover(false); setShowAssigneesPopover(false); setShowDatesPopover(false); setShowChecklistPopover(false); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm font-medium transition-colors text-gray-300"
                            >
                                <div className={`w-4 h-4 rounded ${card.color_boost || 'bg-gray-500'}`} /> Cover
                            </button>

                            {showLabelsPopover && (
                                <div className="absolute top-12 left-0 w-64 bg-[#282e33] border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-gray-200">Labels</h4>
                                        <button onClick={() => setShowLabelsPopover(false)}><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>

                                    <div className="space-y-1 max-h-64 overflow-y-auto mb-3 pr-1 custom-scrollbar">
                                        {availableLabels.map(l => {
                                            const isActive = card.board_labels?.some(bl => bl.id === l.id);
                                            return (
                                                <div
                                                    key={l.id}
                                                    onClick={async () => {
                                                        if (isActive) {
                                                            await api.delete(`/cards/${card.id}/labels/${l.id}/`);
                                                        } else {
                                                            await api.post(`/cards/${card.id}/labels/${l.id}/`);
                                                        }
                                                        onCardUpdate();
                                                    }}
                                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${isActive ? 'bg-blue-900/40 text-blue-400' : 'hover:bg-gray-700 text-gray-300'}`}
                                                >
                                                    <span className="text-sm font-medium truncate flex-1 block mr-2" title={l.name || 'Unnamed'}>{l.name || 'Unnamed'}</span>
                                                    {isActive && <CheckSquare className="w-4 h-4 shrink-0" />}
                                                </div>
                                            );
                                        })}
                                        {availableLabels.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No labels for this board.</p>}
                                    </div>

                                    {/* Custom Label Section */}
                                    <div className="border-t border-gray-700 pt-3">
                                        {isAddingCustomLabel ? (
                                            <div className="space-y-2">
                                                <input
                                                    autoFocus
                                                    value={newCustomLabelName}
                                                    onChange={e => setNewCustomLabelName(e.target.value)}
                                                    placeholder="Custom label name"
                                                    className="w-full bg-gray-900 border border-blue-500 rounded p-1.5 text-sm text-gray-100 focus:outline-none"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') addCustomLabel();
                                                        if (e.key === 'Escape') setIsAddingCustomLabel(false);
                                                    }}
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={addCustomLabel} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors">Save</button>
                                                    <button onClick={() => setIsAddingCustomLabel(false)} className="hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs font-medium transition-colors">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsAddingCustomLabel(true)}
                                                className="w-full py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                                            >
                                                Add custom label
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {showAssigneesPopover && (
                                <div className="absolute top-12 left-0 w-64 bg-[#282e33] border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-gray-200">Members</h4>
                                        <button onClick={() => setShowAssigneesPopover(false)}><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {availableMembers.map(u => {
                                            const isActive = card.assignees?.some(ca => ca.id === u.id);
                                            return (
                                                <div
                                                    key={u.id}
                                                    onClick={async () => {
                                                        if (isActive) {
                                                            await api.delete(`/cards/${card.id}/assignees/${u.id}/`);
                                                        } else {
                                                            await api.post(`/cards/${card.id}/assignees/${u.id}/`);
                                                        }
                                                        onCardUpdate();
                                                    }}
                                                    className="flex justify-between items-center p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                                >
                                                    <span className="text-sm text-gray-200">{u.username}</span>
                                                    {isActive && <CheckSquare className="w-4 h-4 text-blue-500" />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {showCoverPopover && (
                                <div className="absolute top-12 left-0 w-64 bg-[#282e33] border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-gray-200">Cover</h4>
                                        <button onClick={() => setShowCoverPopover(false)}><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <h5 className="text-xs font-medium text-gray-400 mb-2">Colors</h5>
                                    <div className="grid grid-cols-5 gap-2 mb-3">
                                        {CARD_COLORS.filter(c => c.value !== '').map(colorInfo => (
                                            <button
                                                key={colorInfo.name}
                                                onClick={() => handleChangeColor(colorInfo)}
                                                className={`h-8 rounded cursor-pointer relative hover:opacity-80 transition-opacity ${colorInfo.value}`}
                                                title={colorInfo.name}
                                            >
                                                {card.color_boost === colorInfo.value && <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md"><CheckSquare className="w-4 h-4" /></div>}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handleChangeColor({ name: 'none', value: '', label: 'Remove color' })}
                                        className="w-full py-1.5 bg-gray-700/50 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                                    >
                                        Remove color
                                    </button>
                                </div>
                            )}

                            {showDatesPopover && (
                                <div className="absolute top-32 left-0 bg-[#282e33] border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-gray-200">Dates</h4>
                                        <button onClick={() => setShowDatesPopover(false)}><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <DatePicker
                                        selected={card.due_date ? new Date(card.due_date) : null}
                                        onChange={(date: Date | null) => {
                                            updateCard({ due_date: date ? date.toISOString() : null });
                                            setShowDatesPopover(false);
                                        }}
                                        inline
                                        showTimeSelect
                                        timeFormat="HH:mm"
                                        timeIntervals={15}
                                        dateFormat="MMMM d, yyyy h:mm aa"
                                    />
                                    <div className="mt-2 flex justify-end">
                                        <button
                                            onClick={() => { updateCard({ due_date: null }); setShowDatesPopover(false); }}
                                            className="text-xs text-red-400 hover:text-red-300"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showChecklistPopover && (
                                <div className="absolute top-32 left-0 w-64 bg-[#282e33] border border-gray-700 rounded-lg shadow-xl z-50 p-3">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-gray-200">Add Checklist</h4>
                                        <button onClick={() => setShowChecklistPopover(false)}><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <div className="space-y-2">
                                        <input
                                            autoFocus
                                            value={newChecklistTitle}
                                            onChange={(e) => setNewChecklistTitle(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addChecklist();
                                                    setShowChecklistPopover(false);
                                                }
                                            }}
                                            placeholder="Checklist title"
                                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button
                                            onClick={() => {
                                                addChecklist();
                                                setShowChecklistPopover(false);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-1.5 rounded transition-colors w-full mt-2"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Actions</h4>
                            <button
                                onClick={toggleArchive}
                                className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 hover:text-red-400 rounded text-sm font-medium transition-colors text-gray-300"
                            >
                                <Archive className="w-4 h-4" /> Archive
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {viewingAttachment && (
                <DocumentViewer
                    url={viewingAttachment.url}
                    filename={viewingAttachment.filename}
                    onClose={() => setViewingAttachment(null)}
                />
            )}
        </div>
    );
};
