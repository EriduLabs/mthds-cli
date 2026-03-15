import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

const rootElement = document.getElementById('react-board-root');

if (rootElement) {
  const boardIdStr = rootElement.getAttribute('data-board-id');
  const boardId = boardIdStr ? parseInt(boardIdStr, 10) : 1;
  const boardName = rootElement.getAttribute('data-board-name') || 'Board';

  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App boardId={boardId} boardName={boardName} />
      </BrowserRouter>
    </StrictMode>,
  )
} else {
  // Fallback for development if index.html is used directly
  const devRoot = document.getElementById('root');
  if (devRoot) {
    createRoot(devRoot).render(
      <StrictMode>
        <BrowserRouter>
          <App boardId={1} boardName="Dev Board" />
        </BrowserRouter>
      </StrictMode>,
    )
  }
}
