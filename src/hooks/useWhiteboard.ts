import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { fabric } from 'fabric';

export function useWhiteboard(roomId: string, token: string, canvasRef: React.RefObject<HTMLCanvasElement>) {
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(2);

    const socketRef = useRef<Socket | null>(null);
    const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = new fabric.Canvas(canvasRef.current, {
            isDrawingMode: true,
            width: 1200,
            height: 800,
        });

        fabricCanvasRef.current = canvas;
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = brushSize;

        connectSocket();

        canvas.on('path:created', (e: any) => {
            const path = e.path;
            const pathData = path?.toJSON();

            socketRef.current?.emit('whiteboard-draw', {
                roomId,
                action: 'draw',
                data: pathData,
            });
        });

        return () => {
            canvas.dispose();
            socketRef.current?.disconnect();
        };
    }, [roomId, canvasRef]);

    useEffect(() => {
        if (fabricCanvasRef.current) {
            const canvas = fabricCanvasRef.current;
            canvas.freeDrawingBrush.color = tool === 'eraser' ? '#FFFFFF' : color;
            canvas.freeDrawingBrush.width = brushSize;
        }
    }, [tool, color, brushSize]);

    const connectSocket = () => {
        const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        const socket = io(WS_URL, {
            auth: { token },
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', { roomId });
        });

        socket.on('whiteboard-update', ({ action, data }) => {
            if (!fabricCanvasRef.current) return;

            if (action === 'draw') {
                fabric.util.enlivenObjects([data], (objects: fabric.Object[]) => {
                    objects.forEach(obj => {
                        fabricCanvasRef.current?.add(obj);
                    });
                    fabricCanvasRef.current?.renderAll();
                }, '');
            } else if (action === 'clear') {
                fabricCanvasRef.current.clear();
            }
        });
    };

    const clearCanvas = () => {
        if (fabricCanvasRef.current) {
            fabricCanvasRef.current.clear();
            socketRef.current?.emit('whiteboard-draw', {
                roomId,
                action: 'clear',
            });
        }
    };

    return {
        tool,
        setTool,
        color,
        setColor,
        brushSize,
        setBrushSize,
        clearCanvas,
    };
}
