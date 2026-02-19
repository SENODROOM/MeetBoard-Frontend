'use client';

import { useRef } from 'react';
import { useWhiteboard } from '@/hooks/useWhiteboard';
import { Pencil, Eraser, Trash2 } from 'lucide-react';

interface WhiteboardProps {
    roomId: string;
    token: string;
}

export default function Whiteboard({ roomId, token }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { tool, setTool, color, setColor, brushSize, setBrushSize, clearCanvas } = useWhiteboard(
        roomId,
        token,
        canvasRef
    );

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Whiteboard</h3>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setTool('pen')}
                        className={`p-2 rounded ${tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        title="Pen"
                    >
                        <Pencil size={20} />
                    </button>

                    <button
                        onClick={() => setTool('eraser')}
                        className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        title="Eraser"
                    >
                        <Eraser size={20} />
                    </button>

                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer"
                        title="Color"
                    />

                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="w-24"
                        title="Brush Size"
                    />

                    <button
                        onClick={clearCanvas}
                        className="p-2 rounded bg-red-500 text-white hover:bg-red-600"
                        title="Clear Canvas"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                <canvas
                    ref={canvasRef}
                    className="border border-gray-300 bg-white cursor-crosshair"
                />
            </div>
        </div>
    );
}
