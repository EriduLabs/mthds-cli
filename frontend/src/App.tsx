import { useState, useEffect } from 'react';
import { Board } from './components/Board'
import { BoardModal } from './components/BoardModal'
import { Toast } from './components/Toast'
import api from './api/client'
import type { BoardData } from './types/kanban'
import './index.css'

interface AppProps {
  boardId: number;
  boardName: string;
}

function App({ boardId, boardName }: AppProps) {
  const [boards, setBoards] = useState<BoardData[]>([])
  const [showWorkspaces, setShowWorkspaces] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [recentBoards, setRecentBoards] = useState<{ id: number, title: string }[]>([])
  const [localBoardName, setLocalBoardName] = useState(boardName)
  const [showBoardModal, setShowBoardModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Load Recent boards from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentBoards')
    if (saved) {
      try {
        setRecentBoards(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse recent boards from localStorage', e);
      }
    }
  }, [])

  useEffect(() => {
    if (boardId && boardName) {
      const currentOpt: { id: number, title: string } = { id: boardId, title: boardName }
      setRecentBoards(prev => {
        const filtered = prev.filter(b => b.id !== currentOpt.id)
        const updated = [currentOpt, ...filtered].slice(0, 5)
        localStorage.setItem('recentBoards', JSON.stringify(updated))
        return updated
      })
    }
  }, [boardId, boardName])

  useEffect(() => {
    api.get<BoardData[]>('/boards/').then(res => {
      setBoards(res.data)
    }).catch(console.error)
  }, [])

  const handleCreateBoard = async () => {
    const name = prompt("Enter new board name:")
    if (!name) return
    try {
      const res = await api.post<BoardData>('/boards/', { name })
      window.location.href = `/board/${res.data.id}/`
    } catch (e) {
      console.error(e);
    }
  }

  const handleUpdateBoardName = (newName: string) => {
    setLocalBoardName(newName)
  }

  const handleLogout = async () => {
    try {
      await api.post('/logout/')
      window.location.href = '/accounts/login/'
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="h-screen bg-gray-900 text-gray-100 font-sans flex flex-col overflow-hidden selection:bg-blue-500/30 w-full relative">
      {/* Trello Top Navigation Bar */}
      <nav className="min-h-14 bg-gray-800 border-b border-gray-700/50 px-4 py-2 flex flex-wrap items-center justify-between shrink-0 shadow-sm z-50 w-full relative gap-2">
        <div className="flex flex-wrap items-center gap-4">
          {/* Logo / Title Area */}
          <a href="/dashboard/" className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-md hover:bg-gray-700 cursor-pointer transition-colors no-underline">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center shadow-inner">
              <div className="w-1.5 h-2.5 bg-white rounded-sm drop-shadow"></div>
            </div>
            <h1 className="text-lg font-bold text-gray-100">
              MTHDs
            </h1>
          </a>

          <div className="h-4 w-px bg-gray-600"></div>

          <div className="flex gap-1 relative">
            <div className="relative">
              <button
                onClick={() => { setShowWorkspaces(!showWorkspaces); setShowRecent(false); }}
                className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-700/50 rounded-md transition-colors"
              >
                Workspaces
              </button>
              {showWorkspaces && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-[9999] overflow-hidden">
                  <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50">Your Boards</div>
                  <div className="max-h-60 overflow-y-auto">
                    {boards.map(b => (
                      <a
                        key={b.id}
                        href={`/board/${b.id}/`}
                        className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        {b.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowRecent(!showRecent); setShowWorkspaces(false); }}
                className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-700/50 rounded-md transition-colors"
              >
                Recent
              </button>
              {showRecent && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-xl z-[9999] overflow-hidden">
                  <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50">Recent Boards</div>
                  <div className="max-h-60 overflow-y-auto">
                    {recentBoards.length === 0 ? <p className="p-3 text-sm text-gray-500">No recent boards</p> :
                      recentBoards.map(b => (
                        <a
                          key={b.id}
                          href={`/board/${b.id}/`}
                          className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                          {b.title}
                        </a>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleCreateBoard} className="px-3 py-1.5 text-sm font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-md transition-colors border border-blue-500/20 shadow-sm cursor-pointer relative z-50">Create</button>
          </div>
        </div>

        {/* Right Side Nav */}
        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-700/80 text-sm text-gray-200 rounded-md pl-3 pr-8 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full md:w-48 md:focus:w-64"
            />
          </div>
          <div className="relative">
            <div
              onClick={() => { setShowProfileMenu(!showProfileMenu); setShowWorkspaces(false); setShowRecent(false); }}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 border-2 border-gray-700 cursor-pointer flex items-center justify-center text-sm font-bold shadow-md hover:ring-2 hover:ring-blue-500 transition-all">
              Me
            </div>
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-xl transition-all z-[9999] overflow-hidden">
                <a href="/dashboard/" className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors">Dashboard</a>
                <button
                  onClick={handleLogout}
                  className="w-full text-left cursor-pointer block px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 border-t border-gray-700 transition-colors"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="h-auto w-full bg-[#1d2125] pb-2 px-6 pt-6 shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 relative z-10 text-white">
          <h2
            onClick={() => setShowBoardModal(true)}
            className="text-2xl font-bold tracking-tight cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors -ml-2 text-white"
          >
            {localBoardName}
          </h2>
          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-sm">Public</span>
          <button onClick={() => setShowBoardModal(true)} className="ml-4 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded transition-colors shadow-sm cursor-pointer">
            Board Settings
          </button>
        </div>
      </div>

      {/* Main Board Area (Scrollable horizontal/vertical) */}
      <main className="flex-1 w-full flex flex-col overflow-hidden relative bg-[#1d2125]">
        {/* Render Kanban Board component, passing the dynamic boardId and search filter */}
        <Board boardId={boardId} searchQuery={searchQuery} />
      </main>

      {showBoardModal && (
        <BoardModal
          boardId={boardId}
          initialName={localBoardName}
          onClose={() => setShowBoardModal(false)}
          onUpdate={handleUpdateBoardName}
        />
      )}
      <Toast />
    </div >
  )
}

export default App
