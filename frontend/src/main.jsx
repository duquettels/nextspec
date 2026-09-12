import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import sidebar from './components/Sidebar.jsx';
import "./global.css";

//this will be my main entry point for App.jsx
createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
)