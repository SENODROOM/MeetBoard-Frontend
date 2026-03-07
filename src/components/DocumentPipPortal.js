import { createPortal } from 'react-dom';

export default function DocumentPipPortal({ pipWindow, children }) {
    if (!pipWindow) return null;
    return createPortal(children, pipWindow.document.body);
}
