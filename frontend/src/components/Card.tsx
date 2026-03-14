import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { MessageSquare, CheckSquare, Paperclip, Clock, Pencil, AlignLeft } from 'lucide-react';
import type { TaskCard } from '../types/kanban';
import api from '../api/client';

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
    // Glows (we will use a custom class combo)
    { name: 'glow-blue', value: 'bg-[#22272b] shadow-[0_0_15px_rgba(59,130,246,0.6)] border border-blue-500/50' },
    { name: 'glow-purple', value: 'bg-[#22272b] shadow-[0_0_15px_rgba(168,85,247,0.6)] border border-purple-500/50' },
];

interface CardProps {
    card: TaskCard;
    index: number;
    onClick: () => void;
    onCardChange?: () => void;
}

export const Card: React.FC<CardProps> = ({ card, index, onClick, onCardChange }) => {
    const [showOptions, setShowOptions] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const optionsRef = useRef<HTMLDivElement>(null);
    const [isArchiving, setIsArchiving] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setShowOptions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const totalChecklistItems = card.checklists?.reduce((acc, cl) => acc + cl.items.length, 0) || 0;
    const completedChecklistItems = card.checklists?.reduce((acc, cl) => acc + cl.items.filter(i => i.is_completed).length, 0) || 0;
    const hasComments = card.comments?.length > 0;
    const hasAttachments = card.attachments?.length > 0;
    const hasDescription = !!card.description;

    const imageAttachments = card.attachments?.filter(a => a.filename.match(/\.(jpeg|jpg|gif|png|webp)$/i)) || [];
    const coverImage = card.metadata?.cover_image || (imageAttachments.length > 0 ? imageAttachments[0].file_url : null);
    const coverColor = card.color_boost;

    const handleArchive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            setIsArchiving(true);
            await api.put(`/cards/${card.id}/archive/`);
            if (onCardChange) {
                onCardChange();
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error(err);
            setIsArchiving(false);
        }
    };

    const handleChangeColor = async (e: React.MouseEvent, colorInfo: { value: string }) => {
        e.stopPropagation();
        try {
            await api.put(`/cards/${card.id}/`, { color_boost: colorInfo.value });
            if (onCardChange) {
                onCardChange();
            } else {
                window.location.reload();
            }
        } catch (err) {
            console.error('Failed to change color:', err);
        }
    };

    if (isArchiving) return null;

    return (
        <Draggable key={card.id.toString()} draggableId={card.id.toString()} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={(e) => {
                        if (!showOptions && !e.defaultPrevented) {
                            onClick();
                        }
                    }}
                    className={`text-[#b6c2cf] rounded-lg shadow-[0_1px_1px_#091e4240,0_0_1px_1px_#091e4221] cursor-grab group relative hover:ring-1 hover:ring-[#579dff] transition-all duration-100 flex flex-col ${showOptions ? 'z-50' : ''}
                        ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-[#579dff] opacity-90 z-50' : ''}
                        ${coverColor ? coverColor : 'bg-[#22272b] hover:bg-[#282e33]'}
                    `}
                    style={{
                        ...provided.draggableProps.style,
                    }}
                >
                    {/* Cover Area (Only for images now, colors are full-card) */}
                    {coverImage && (
                        <div className="w-full h-32 bg-[#1d2125] bg-cover bg-center rounded-t-lg flex-shrink-0" style={{ backgroundImage: `url(${coverImage})`, height: '140px' }} />
                    )}

                    <div className="p-2 sm:p-2.5 pb-1 flex flex-col gap-1">
                        {/* Labels */}
                        {(card.labels?.length > 0 || card.board_labels?.length > 0) && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {card.board_labels?.map((lbl) => (
                                    <span key={`bl-${lbl.id}`} className="px-2 py-0.5 bg-gray-800/60 text-gray-200 border border-gray-600/50 rounded text-[11px] font-semibold max-w-full truncate backdrop-blur-sm" title={lbl.name}>
                                        {lbl.name || '\u00A0'}
                                    </span>
                                ))}
                                {card.labels?.map((lbl, idx) => (
                                    <span key={`l-${idx}`} className="h-4 px-2 bg-[#2c3e5d] text-[#579dff] rounded text-[11px] font-semibold leading-4 max-w-full truncate" title={lbl}>
                                        {lbl}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Title & Edit Button */}
                        <div className="flex items-start justify-between gap-1 relative">
                            <h4 className="font-normal text-sm text-[#b6c2cf] break-words text-left flex-1" style={{ wordBreak: 'break-word', outline: 'none' }}>
                                {card.title}
                            </h4>
                            <button
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (showOptions) {
                                        setShowOptions(false);
                                    } else {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setMenuPos({ top: rect.bottom + 4, left: rect.right - 256 });
                                        setShowOptions(true);
                                    }
                                }}
                                className={`absolute top-0 right-0 p-1.5 bg-[#22272b] rounded hover:bg-[#a6c5e229] transition-colors ${showOptions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} -mt-1 -mr-1`}
                            >
                                <Pencil className="w-3.5 h-3.5 text-[#9fadbc]" />
                            </button>

                            {/* Quick Action Options Popover */}
                            {showOptions && createPortal(
                                <div ref={optionsRef} className="fixed w-64 bg-[#282e33] border border-[#333c43] rounded-lg shadow-xl z-[9999] py-2 text-[#b6c2cf] text-sm" style={{ top: menuPos.top, left: menuPos.left }}>
                                    <button onClick={(e) => { e.stopPropagation(); setShowOptions(false); onClick(); }} className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Open card</button>
                                    <button onClick={(e) => { e.stopPropagation(); setShowOptions(false); onClick(); }} className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Edit labels</button>
                                    <button onClick={(e) => { e.stopPropagation(); setShowOptions(false); onClick(); }} className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Change cover</button>

                                    <div className="mt-2 px-4 pt-2 pb-1 border-t border-[#333c43]">
                                        <span className="text-xs font-semibold text-[#8c9bab] block mb-2">Cover Color</span>
                                        <div className="grid grid-cols-5 gap-1.5 mb-2">
                                            {CARD_COLORS.filter(c => c.value !== '').map(colorInfo => (
                                                <button
                                                    key={colorInfo.name}
                                                    onClick={(e) => { setShowOptions(false); handleChangeColor(e, colorInfo); }}
                                                    className={`h-6 rounded cursor-pointer relative hover:opacity-80 transition-opacity ${colorInfo.value}`}
                                                    title={colorInfo.name}
                                                >
                                                    {card.color_boost === colorInfo.value && <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>}
                                                </button>
                                            ))}
                                        </div>
                                        <button onClick={(e) => { setShowOptions(false); handleChangeColor(e, { value: '' }); }} className="text-xs w-full bg-[#a6c5e229] hover:bg-[#a6c5e23d] transition-colors py-1 rounded text-center">
                                            Remove color
                                        </button>
                                    </div>

                                    <div className="h-px bg-[#333c43] my-1 w-full" />
                                    <button onClick={(e) => { setShowOptions(false); handleArchive(e); }} className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Archive</button>
                                </div>,
                                document.body
                            )}
                        </div>

                        {/* Badges */}
                        {(hasComments || totalChecklistItems > 0 || hasAttachments || card.due_date || hasDescription) && (
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#9fadbc] font-medium pt-1">
                                {card.due_date && (
                                    <div className="flex items-center gap-1 hover:bg-[#a6c5e229] px-1.5 py-[2px] rounded transition-colors" title="Due date">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{new Date(card.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                )}
                                {hasDescription && (
                                    <div className="flex items-center gap-1 hover:bg-[#a6c5e229] px-1 py-[2px] rounded transition-colors" title="This card has a description.">
                                        <AlignLeft className="w-3.5 h-3.5" />
                                    </div>
                                )}
                                {hasComments && (
                                    <div className="flex items-center gap-1 hover:bg-[#a6c5e229] px-1 py-[2px] rounded transition-colors" title="Comments">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>{card.comments.length}</span>
                                    </div>
                                )}
                                {hasAttachments && (
                                    <div className="flex items-center gap-1 hover:bg-[#a6c5e229] px-1 py-[2px] rounded transition-colors" title="Attachments">
                                        <Paperclip className="w-3 h-3" style={{ transform: 'rotate(-45deg)' }} />
                                        <span>{card.attachments.length}</span>
                                    </div>
                                )}
                                {totalChecklistItems > 0 && (
                                    <div className={`flex items-center gap-1 px-1.5 py-[2px] rounded transition-colors hover:bg-[#a6c5e229] ${completedChecklistItems === totalChecklistItems ? 'text-[#1f845a] bg-[#1f845a29]' : ''}`} title="Checklist items">
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span>{completedChecklistItems}/{totalChecklistItems}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Assignees */}
                        {card.assignees && card.assignees.length > 0 && (
                            <div className="flex justify-end gap-1 mt-1">
                                {card.assignees.map(user => (
                                    <div key={user.id} className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow" title={user.username}>
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
};
