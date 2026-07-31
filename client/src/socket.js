import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL, { autoConnect: false });

export function connectSocket(userId) {
  if (!socket.connected) socket.connect();
  socket.emit("identify", userId);
}

export function disconnectSocket() {
  socket.disconnect();
}

export default socket;
