# P2P File Sharing and Chat Application

A peer-to-peer application built with Go and React that enables direct file sharing and messaging between connected peers.

## Features

- 🔗 Direct peer-to-peer connections
- 📁 File sharing between peers
- 💬 Real-time messaging
- 📋 Easy peer address copying and connection
- 🔄 Automatic peer discovery
- 📱 Responsive web interface

## Technology Stack

### Backend
- Go
- libp2p (P2P networking)
- Gorilla Mux (HTTP routing)
- CORS support

### Frontend
- Next.js
- React
- Tailwind CSS
- Real-time updates

## Getting Started

### Prerequisites
- Go 1.20 or later
- Node.js 18 or later
- npm or yarn

### Running the Backend

```bash
cd backend
go mod download
go run main.go
```

The backend server will start on port 8080 by default. You can change this by setting the PORT environment variable.

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will start on [http://localhost:3000](http://localhost:3000).

## Usage

1. Open the application in your browser
2. Copy your Node Address to share with other peers
3. Connect to other peers by pasting their Node Address
4. Send messages and files to connected peers
5. Download received files from the "Received Files" section

## Development

- Backend API endpoints are in `backend/handlers/handlers.go`
- P2P networking logic is in `backend/p2p/network.go`
- Frontend components are in `frontend/src/components/`


