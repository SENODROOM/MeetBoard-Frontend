# ⬡ QuantumMeet Client

The frontend portion of **QuantumMeet**, a real-time P2P video conferencing application. Built with React and designed entirely from scratch with raw `CSS Modules` to deliver a premium, dark-mode, animated user experience.

## ✨ Features Supported

- **WebRTC Peer-to-Peer Video**: Connect directly with other browsers for high-performance low-latency video.
- **Picture-in-Picture (PiP)**: Pop out your video to continue watching while switching tabs natively using the Document PiP API.
- **Fully Responsive**: Scaled beautifully to work on any mobile device, tablet, or large screen display.
- **Rich Interactive Panels**:
  - Live Chat
  - Q&A & Upvoting
  - Real-time Polling
  - Speech-to-Text Transcription (`SpeechRecognition` API)
  - Collaborative Whiteboard
- **SecretMeet Mode**: A randomized 1-on-1 networking module.

## 🛠️ Built With
- **React 18**
- **React Router v6** (for routing logic)
- **Socket.io-client** (for WebRTC signaling)
- **CSS Modules** (for scoped, zero-dependency styling)

## 🚀 Running The Client Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Specify backend URL (Optional, defaults to local):
   ```bash
   cp .env.example .env
   # Ensure REACT_APP_SERVER_URL=http://localhost:5000 is set
   ```

3. Start development server:
   ```bash
   npm start
   ```

4. The app runs on `http://localhost:3000`. Open the URL in your browser to start meeting!

---

<p align="center">Designed and crafted for QuantumMeet.</p>
