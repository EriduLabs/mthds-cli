import React, { useState, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { Loader2, X, Users, UserPlus } from 'lucide-react';
import api from '../api/client';
import type { BoardData } from '../types/kanban';
import { KanbanList } from './KanbanList';
import { ChatAgent } from './ChatAgent';
import { CardModal } from './CardModal';
import type { TaskCard } from '../types/kanban';

interface BoardProps {
    boardId: number;
    searchQuery?: string;
}

export const Board: React.FC<BoardProps> = ({ boardId, searchQuery = '' }) => {
    const [board, setBoard] = useState<BoardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddingList, setIsAddingList] = useState(false);
    const [newListTitle, setNewListTitle] = useState('');
    const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
    const [showArchive, setShowArchive] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportIncludeArchived, setExportIncludeArchived] = useState(false);
    const [archivedItems, setArchivedItems] = useState<{ lists: any[], cards: any[] }>({ lists: [], cards: [] });
    // Members State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteUsername, setInviteUsername] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    // Compute selectedCard from board state to keep it fresh

    useEffect(() => {
        fetchBoard();
    }, [boardId]);

    // Setup WebSocket connection to listen for real-time updates
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/board/${boardId}/`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'board_update') {
                    // Refetch board data silently on changes
                    fetchBoard();
                }
            } catch (e) {
                console.error('Error parsing WS message', e);
            }
        };

        return () => ws.close();
    }, [boardId]);

    const fetchBoard = async () => {
        try {
            const response = await api.get<BoardData>(`/boards/${boardId}/active/`);
            setBoard(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to load board data. Is the backend running?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddList = async () => {
        if (!newListTitle.trim() || !board) return;
        try {
            await api.post(`/lists/`, {
                board_id: boardId,
                name: newListTitle.trim()
            });
            await fetchBoard();
        } catch (err) {
            console.error('Failed to create list', err);
        } finally {
            setIsAddingList(false);
            setNewListTitle('');
        }
    };

    const fetchArchived = async () => {
        try {
            const res = await api.get(`/boards/${boardId}/archived/`);
            setArchivedItems(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const unarchiveCard = async (id: number) => {
        try {
            await api.put(`/cards/${id}/archive/`);
            fetchArchived();
            fetchBoard();
        } catch (e) {
            console.error(e);
        }
    };

    const unarchiveList = async (id: number) => {
        try {
            await api.put(`/lists/${id}/archive/`);
            fetchArchived();
            fetchBoard();
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (showArchive) fetchArchived();
    }, [showArchive]);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination || !board) return;

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) return;

        // Capture previous state for rollback on error
        const previousBoard = JSON.parse(JSON.stringify(board)) as BoardData;

        // --- Optimistic State Update ---
        const newBoard = JSON.parse(JSON.stringify(board)) as BoardData;

        // Find source and destination lists (columns)
        const sourceList = newBoard.lists.find(l => l.id.toString() === source.droppableId);
        const destList = newBoard.lists.find(l => l.id.toString() === destination.droppableId);

        if (!sourceList || !destList) return;

        // Remove card from source
        const [movedCard] = sourceList.cards.splice(source.index, 1);

        // Update the card's list_id conceptually 
        movedCard.list_id = parseInt(destination.droppableId);

        // Insert card into destination
        destList.cards.splice(destination.index, 0, movedCard);

        // Update state immediately for snap-to-grid feel
        setBoard(newBoard);

        // --- Async API Call ---
        try {
            await api.put(`/cards/${draggableId}/move/`, {
                new_list_id: parseInt(destination.droppableId),
                new_order: destination.index,
            });
            await fetchBoard();
        } catch (err) {
            console.error('API Error during drag:', err);
            // Revert to previous state completely
            setBoard(previousBoard);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteError('');
        setInviteSuccess('');
        try {
            await api.post(`/boards/${boardId}/members/`, { username: inviteUsername });
            setInviteSuccess(`Successfully added ${inviteUsername}!`);
            setInviteUsername('');
            fetchBoard(); // Refresh board to see new member
            setTimeout(() => {
                setShowInviteModal(false);
                setInviteSuccess('');
            }, 1500);
        } catch (err: any) {
            setInviteError(err.response?.data?.error || 'Failed to add user. Ensure username exists.');
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
                    <p className="text-gray-400 animate-pulse">Loading board...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 mx-auto mt-8 max-w-lg bg-red-900/50 border border-red-500/50 rounded-xl">
                <p className="text-red-200 text-center">{error}</p>
            </div>
        );
    }

    if (!board) return null;

    return (
        <div className="flex-1 w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar flex flex-col">
            <div className="flex items-center gap-4 p-4 shrink-0">
                <h1 className="text-xl font-bold text-white px-3 py-1 bg-white/20 rounded cursor-pointer hover:bg-white/30 transition-colors">{board.title}</h1>
                <button className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded font-medium text-sm transition-colors">
                    Public
                </button>
                <div className="flex items-center gap-1 border-l border-white/20 pl-4 ml-2">
                    <Users className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium ml-1 mr-2">{1 + (board.members?.length || 0)} members</span>
                    <button onClick={() => setShowInviteModal(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
                        <UserPlus className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="min-w-max flex-1 px-4 pb-6 flex items-start flex-nowrap shrink-0 overflow-y-hidden">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex h-full items-start">
                        {board.lists.map(list => {
                            // Filter logic
                            const filteredList = {
                                ...list,
                                cards: list.cards.filter(c =>
                                    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    c.description.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                            };
                            return (
                                <KanbanList key={list.id} list={filteredList} onListChange={fetchBoard} onCardClick={(card: TaskCard) => setSelectedCardId(card.id)} />
                            );
                        })}
                        {/* Add Another List Section */}
                        {isAddingList ? (
                            <div className="bg-[#101204] rounded-xl w-[272px] flex-shrink-0 mx-1.5 p-2 flex flex-col gap-2 shadow-sm text-sm">
                                <input
                                    autoFocus
                                    value={newListTitle}
                                    onChange={(e) => setNewListTitle(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
                                    placeholder="Enter list title..."
                                    className="w-full bg-[#22272b] border-[#579dff] text-[#b6c2cf] shadow-[0_1px_1px_#091e4240,0_0_1px_1px_#579dff] rounded-lg p-2 focus:outline-none"
                                />
                                <div className="flex items-center gap-2 mt-1">
                                    <button onClick={handleAddList} className="bg-[#579dff] hover:bg-[#85b8ff] text-[#1d2125] px-3 py-1.5 rounded font-semibold transition-colors">
                                        Add list
                                    </button>
                                    <button onClick={() => { setIsAddingList(false); setNewListTitle(''); }} className="text-[#9fadbc] hover:bg-[#a6c5e229] hover:text-[#b6c2cf] p-1.5 rounded transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mx-1.5 shrink-0">
                                <button
                                    onClick={() => setIsAddingList(true)}
                                    className="bg-[#ffffff3d] hover:bg-[#ffffff29] text-white transition-colors rounded-xl w-[272px] flex flex-shrink-0 cursor-pointer text-sm font-bold min-h-[44px] items-center px-4"
                                >
                                    <span className="text-xl leading-none mr-2">+</span> Add another list
                                </button>
                                {/* Archive & Export Buttons */}
                                <button
                                    onClick={() => {
                                        api.get(`/boards/${boardId}/export-context/`)
                                            .then(response => {
                                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data, null, 2));
                                                const link = document.createElement('a');
                                                link.href = dataStr;
                                                link.setAttribute('download', `board_context_${boardId}.json`);
                                                document.body.appendChild(link);
                                                link.click();
                                                if (link.parentNode) link.parentNode.removeChild(link);
                                            })
                                            .catch(error => console.error('Export Context failed:', error));
                                    }}
                                    className="bg-[#ffffff3d] hover:bg-[#ffffff29] text-white transition-colors rounded-xl w-[272px] flex flex-shrink-0 cursor-pointer text-sm font-bold min-h-[44px] items-center px-4"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg> Convert to App
                                </button>
                                <button
                                    onClick={() => setShowExportModal(true)}
                                    className="bg-[#ffffff3d] hover:bg-[#ffffff29] text-white transition-colors rounded-xl w-[272px] flex flex-shrink-0 cursor-pointer text-sm font-bold min-h-[44px] items-center px-4"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 0 01.707.293l5.414 5.414a1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Export
                                </button>
                                <button
                                    onClick={() => setShowArchive(true)}
                                    className="bg-[#ffffff3d] hover:bg-[#ffffff29] text-white transition-colors rounded-xl w-[272px] flex flex-shrink-0 cursor-pointer text-sm font-bold min-h-[44px] items-center px-4"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg> Archive
                                </button>
                            </div>
                        )}
                    </div>
                </DragDropContext>
            </div>

            {showArchive && (
                <div className="fixed inset-y-0 right-0 w-80 bg-gray-800 shadow-2xl z-[9999] p-4 overflow-y-auto transform transition-transform duration-300 border-l border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold">Archive</h2>
                        <button onClick={() => setShowArchive(false)} className="text-gray-400 hover:text-white p-1">X</button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cards</h3>
                            {archivedItems.cards.length === 0 ? <p className="text-gray-500 text-sm">No archived cards.</p> : null}
                            <div className="space-y-2">
                                {archivedItems.cards.map(c => (
                                    <div key={c.id} className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between items-center group">
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-medium text-gray-200 truncate">{c.title}</p>
                                            <p className="text-xs text-gray-500 truncate">in {c.list__name}</p>
                                        </div>
                                        <button onClick={() => unarchiveCard(c.id)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">Restore</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Lists</h3>
                            {archivedItems.lists.length === 0 ? <p className="text-gray-500 text-sm">No archived lists.</p> : null}
                            <div className="space-y-2">
                                {archivedItems.lists.map(l => (
                                    <div key={l.id} className="bg-gray-900 p-3 rounded-lg border border-gray-700 flex justify-between items-center group">
                                        <p className="text-sm font-medium text-gray-200 truncate">{l.name}</p>
                                        <button onClick={() => unarchiveList(l.id)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">Restore</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showExportModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-[#282e33] rounded-xl w-full max-w-sm shadow-xl p-6 text-[#b6c2cf]">
                        <h2 className="text-lg font-bold text-[#c7d1db] mb-4">Export Board</h2>
                        <p className="text-sm mb-6 text-[#9fadbc]">
                            Download a comprehensive HTML report of your entire board, including all lists, cards, checklists, and comments.
                        </p>

                        <label className="flex items-center gap-2 mb-6 cursor-pointer text-sm">
                            <input
                                type="checkbox"
                                checked={exportIncludeArchived}
                                onChange={(e) => setExportIncludeArchived(e.target.checked)}
                                className="w-4 h-4 rounded bg-[#22272b] border-[#579dff] text-[#579dff] focus:ring-offset-0 focus:ring-0"
                            />
                            Include archived items
                        </label>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="px-4 py-2 rounded font-semibold text-[#b6c2cf] hover:bg-[#a6c5e229] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    api.get(`/boards/${boardId}/export/?include_archived=${exportIncludeArchived ? 'true' : 'false'}`, { responseType: 'blob' })
                                        .then(response => {
                                            const url = window.URL.createObjectURL(new Blob([response.data]));
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', `board_export_${boardId}.html`);
                                            document.body.appendChild(link);
                                            link.click();
                                            if (link.parentNode) link.parentNode.removeChild(link);
                                            setShowExportModal(false);
                                        })
                                        .catch(error => {
                                            console.error('Export failed:', error);
                                            setShowExportModal(false);
                                        });
                                }}
                                className="bg-[#579dff] hover:bg-[#85b8ff] text-[#1d2125] px-4 py-2 rounded font-semibold transition-colors"
                            >
                                Download Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ChatAgent boardId={boardId} onActionSuccess={fetchBoard} />

            {/* Render Card Modal overlay */}
            {
                selectedCardId && board && (
                    <CardModal
                        card={board.lists.flatMap(l => l.cards).find(c => c.id === selectedCardId)!}
                        boardId={boardId}
                        onClose={() => setSelectedCardId(null)}
                        onCardUpdate={fetchBoard}
                    />
                )
            }
            {/* Invite Modal */}
            {
                showInviteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                        <div className="bg-[#282e33] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-4 border-b border-gray-700 mx-2 mt-2">
                                <h2 className="text-xl font-bold text-gray-200">Invite to Board</h2>
                                <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-200 transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6">
                                <form onSubmit={handleAddMember} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Username or Email</label>
                                        <input
                                            type="text"
                                            value={inviteUsername}
                                            onChange={(e) => setInviteUsername(e.target.value)}
                                            placeholder="Enter exact username..."
                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                                            required
                                        />
                                    </div>
                                    {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
                                    {inviteSuccess && <p className="text-green-400 text-sm">{inviteSuccess}</p>}
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-colors">
                                        Send Invite
                                    </button>
                                </form>
                                <div className="mt-6">
                                    <h4 className="text-sm font-semibold text-gray-400 mb-3">Board Members</h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                                                {board.owner.username.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-200 text-sm font-medium">{board.owner.username}</span>
                                                <span className="text-xs text-gray-500">Board Admin</span>
                                            </div>
                                        </div>
                                        {board.members?.map((member: any) => (
                                            <div key={member.id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                                                    {member.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-200 text-sm font-medium">{member.username}</span>
                                                    <span className="text-xs text-gray-500">Member</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};
