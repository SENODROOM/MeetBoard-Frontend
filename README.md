# Meet Board Frontend

Real-time communication frontend built with Next.js 14, React 18, and TypeScript.

## Features

- User authentication (register/login)
- Room management (create/join rooms)
- Multi-user video calling with WebRTC
- Screen sharing
- Real-time chat
- Collaborative whiteboard
- Responsive design with Tailwind CSS

## Prerequisites

- Node.js 20+
- Backend API running on http://localhost:3001

## Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Update .env.local with your backend URL
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building for Production

```bash
npm run build
npm start
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:3001)
- `NEXT_PUBLIC_WS_URL` - WebSocket URL (default: http://localhost:3001)

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── page.tsx      # Home page
│   │   ├── login/        # Login page
│   │   ├── register/     # Register page
│   │   ├── dashboard/    # Dashboard page
│   │   └── room/         # Room page
│   ├── components/       # React components
│   │   ├── VideoGrid.tsx
│   │   ├── Chat.tsx
│   │   └── Whiteboard.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useWebRTC.ts
│   │   ├── useChat.ts
│   │   └── useWhiteboard.ts
│   ├── services/         # API services
│   │   └── api.ts
│   ├── store/            # State management
│   │   └── authStore.ts
│   └── types/            # TypeScript types
│       └── index.ts
├── public/               # Static files
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Technologies

- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Socket.io Client** - WebSocket communication
- **Zustand** - State management
- **Axios** - HTTP client
- **Fabric.js** - Canvas for whiteboard
- **Lucide React** - Icons

## Usage

1. Register a new account or login
2. Create a new room or join an existing one
3. Allow camera and microphone permissions
4. Start video calling with other participants
5. Use chat to send messages
6. Use whiteboard for collaboration
7. Share your screen when needed

## Docker

Build and run with Docker:

```bash
docker build -t rtc-frontend .
docker run -p 3000:3000 rtc-frontend
```

## License

MIT
