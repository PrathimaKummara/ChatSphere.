# ChatSphere

ChatSphere is a secure, real-time chat application featuring End-to-End Encryption (E2EE), real-time audio and video calling, and an integrated generative AI assistant. It is built as a multi-tier system with a React frontend and a Spring Boot backend.

## Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Lucide React (Icons)
- Socket.IO Client (Real-time communication)
- Web Crypto API (End-to-End Encryption)
- WebRTC (Audio/Video calling)

### Backend
- Java 21, Spring Boot
- Spring Security & JWT (Authentication and authorization)
- Spring Data MongoDB (Message database access)
- Spring Data JPA & MySQL Driver (Relational user metadata database access)
- Socket.IO Java / Netty-SocketIO (Real-time socket communication)
- Google Gemini API (AI integration)

### Databases
- MySQL: Stores relational entities (Users, Direct Conversations, Message Requests, Call History)
- MongoDB: Stores document-based message archives

---

## Features

### Real-Time Messaging
- Messaging system powered by Socket.IO.
- Typing indicators show when the recipient is composing a message.
- Real-time read receipts ("seen" status indicator below the sender's last read message).

### End-to-End Encryption
- Cryptographic key exchange powered by the Web Crypto API.
- Generates RSA-OAEP key pairs on first login (stored securely in local storage).
- Messages are encrypted client-side using AES-GCM before transmission and database persistence.
- Keys are wrapped and shared securely using the recipient's RSA public key.

### WebRTC Calling
- Real-time peer-to-peer audio and video calls.
- Integrated premium ringtones and call status notifications (calling, connecting, incoming, active).
- Persistent call history logged in MySQL database.

### Intelligent AI Assistant
- Integrated Google Gemini AI assistant.
- Users can ask questions or receive assistance within the chat interface.

### Profile and Settings
- User profile customization (username, about bio status, and profile avatar upload).
- App-wide preferences including light/dark theme toggles and notification preferences.

---

## Getting Started

### Prerequisites
- Java Development Kit (JDK) 21 or higher
- Node.js (v18 or higher) and npm
- MySQL Server (v8 or higher)
- MongoDB Server

### Configuration

#### Backend Configuration
Configure your application settings in `java-server/src/main/resources/application.properties`:
- Database connections (MySQL and MongoDB URIs, usernames, and passwords)
- Server port settings (default backend: 5000, socket: 5001)
- Google Gemini API key configuration
- JWT token expiration parameters

#### Frontend Configuration
Configure API base URLs inside `client/src/utils/api.js` (pointing to `http://localhost:5000`) and socket base URLs inside `client/src/hooks/useSocket.js` (pointing to `http://127.0.0.1:5001`).

---

## Running the Application

### 1. Build and Run the Backend
From the `java-server` directory, compile and run the Spring Boot application:
```bash
mvn clean compile
mvn spring-boot:run
```

### 2. Run the Frontend Client
From the `client` directory, install dependencies and start the development server:
```bash
npm install
npm run dev
```

The application will be accessible locally at `http://localhost:3000`.
