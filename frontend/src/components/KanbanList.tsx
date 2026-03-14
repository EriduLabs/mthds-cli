import React, { useState, useRef, useEffect } from 'react';
import { StrictModeDroppable } from './StrictModeDroppable';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { Card } from './Card';
import type { ListData } from '../types/kanban';
import api from '../api/client';

interface KanbanListProps {
    list: ListData;
    onListChange: () => void;
    onCardClick: (card: any) => void;
}

const LIST_COLORS = [
    { name: 'none', value: '', label: 'Remove color' },
    { name: 'blue', value: '#0c66e4' },
    { name: 'teal', value: '#1d7f8b' },
    { name: 'green', value: '#216e4e' },
    { name: 'yellow', value: '#7f5f01' },
    { name: 'orange', value: '#a54800' },
    { name: 'red', value: '#ae2e24' },
    { name: 'purple', value: '#5e4db2' },
    { name: 'pink', value: '#943d73' },
    { name: 'gray', value: '#4b5563' }
];

export const KanbanList: React.FC<KanbanListProps> = ({ list, onListChange, onCardClick }) => {
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [newCardTitle, setNewCardTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setShowOptions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddCard = async () => {
        if (!newCardTitle.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await api.post(`/cards/`, {
                list_id: list.id,
                title: newCardTitle.trim()
            });
            onListChange();
        } catch (err) {
            console.error('Failed to add card:', err);
        } finally {
            setIsSubmitting(false);
            setNewCardTitle('');
            setIsAddingCard(false);
        }
    };

    const handleChangeColor = async (colorInfo: { value: string }) => {
        try {
            await api.put(`/lists/${list.id}/`, { color: colorInfo.value });
            onListChange();
        } catch (err) {
            console.error('Failed to change color:', err);
        }
    };

    const hasColor = list.color && list.color !== '';

    return (
        <div className={`w-[272px] flex-shrink-0 flex flex-col mx-1.5 h-full ${showOptions ? 'relative z-[100]' : ''}`}>
            <div className="rounded-xl flex flex-col max-h-full transition-colors relative" style={{ backgroundColor: hasColor ? list.color : '#101204' }}>
                {/* List Header */}
                <div className={`px-4 py-3 flex items-start justify-between relative ${hasColor ? 'bg-black/20 rounded-t-xl shadow-sm z-10' : 'bg-[#101204] rounded-t-xl'}`}>
                    <h2 className={`font-semibold text-sm flex-1 cursor-pointer py-1 ml-1 truncate ${hasColor ? 'text-white' : 'text-[#b6c2cf]'}`}>
                        {list.name}
                    </h2>

                    <div ref={optionsRef} className="">
                        <button
                            onClick={() => setShowOptions(!showOptions)}
                            className={`p-1.5 rounded transition-colors ml-1 ${hasColor ? 'text-white/80 hover:bg-white/20' : 'text-[#9fadbc] hover:bg-[#a6c5e229]'}`}
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Options Dropdown */}
                        {showOptions && (
                            <div className="absolute top-12 left-0 w-[260px] bg-[#282e33] border border-[#333c43] rounded-lg shadow-xl z-[9999] py-3 text-[#b6c2cf] text-sm">
                                <div className="flex items-center justify-between px-4 pb-3 border-b border-[#333c43] mb-2">
                                    <span className="flex-1 text-center font-semibold text-[#8c9bab]">List actions</span>
                                    <button onClick={() => setShowOptions(false)} className="hover:bg-[#a6c5e229] p-1 rounded transition-colors"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="py-1">
                                    <button onClick={() => { setIsAddingCard(true); setShowOptions(false); }} className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Add card</button>
                                    <button className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Copy list...</button>
                                    <button className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Move list...</button>
                                    <button className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors">Watch</button>
                                </div>

                                <div className="mt-3 px-4 pt-3 pb-1 border-t border-[#333c43]">
                                    <span className="text-xs font-semibold text-[#8c9bab] block mb-2">Change list color</span>
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {LIST_COLORS.filter(c => c.value !== '').map(colorInfo => (
                                            <button
                                                key={colorInfo.name}
                                                onClick={() => handleChangeColor(colorInfo)}
                                                className="h-8 rounded cursor-pointer relative hover:opacity-80 transition-opacity"
                                                style={{ backgroundColor: colorInfo.value }}
                                            >
                                                {list.color === colorInfo.value && <div className="absolute inset-0 flex items-center justify-center text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div>}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => handleChangeColor({ value: '' })} className="w-full mt-1 bg-[#a6c5e229] hover:bg-[#a6c5e23d] transition-colors py-1.5 rounded text-center">
                                        Remove color
                                    </button>
                                </div>
                                <div className="mt-2 pt-2 border-t border-[#333c43]">
                                    <button
                                        onClick={async () => {
                                            await api.put(`/lists/${list.id}/archive/`);
                                            onListChange();
                                        }}
                                        className="w-full text-left px-4 py-1.5 hover:bg-[#a6c5e229] transition-colors"
                                    >
                                        Archive this list
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Droppable Area */}
                <StrictModeDroppable droppableId={list.id.toString()} direction="vertical">
                    {(provided, snapshot) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-col gap-2 px-2 pb-2 overflow-y-auto overflow-x-hidden min-h-[40px] ${snapshot.isDraggingOver ? 'bg-black/10' : ''} pt-2`}
                            style={{ scrollbarWidth: 'thin' }}
                        >
                            {list.cards.map((card, index) => (
                                <Card key={card.id.toString()} card={card} index={index} onClick={() => onCardClick(card)} onCardChange={onListChange} />
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </StrictModeDroppable>

                {/* Add Card Footer */}
                <div className="px-2 pt-1 pb-2">
                    {isAddingCard ? (
                        <div className="flex flex-col gap-2">
                            <textarea
                                autoFocus
                                value={newCardTitle}
                                onChange={(e) => setNewCardTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddCard();
                                    }
                                }}
                                placeholder="Enter a title for this card..."
                                className="w-full bg-[#22272b] border-[#579dff] text-[#b6c2cf] shadow-[0_1px_1px_#091e4240,0_0_1px_1px_#579dff] rounded-lg p-2 text-sm focus:outline-none resize-none min-h-[60px]"
                            />
                            <div className="flex items-center gap-2">
                                <button onClick={handleAddCard} disabled={isSubmitting} className="bg-[#579dff] text-[#1d2125] font-semibold hover:bg-[#85b8ff] px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    Add card
                                </button>
                                <button onClick={() => { setIsAddingCard(false); setNewCardTitle(''); }} className="text-[#9fadbc] hover:bg-[#a6c5e229] hover:text-[#b6c2cf] p-1.5 rounded transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingCard(true)}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 bg-transparent min-h-[32px] rounded-lg transition-colors text-sm font-medium ${hasColor ? 'text-white/80 hover:bg-white/20 hover:text-white' : 'hover:bg-[#a6c5e229] hover:text-[#b6c2cf] text-[#9fadbc]'}`}
                        >
                            <Plus className="w-4 h-4" /> Add a card
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
