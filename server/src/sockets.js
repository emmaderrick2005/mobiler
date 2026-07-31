let ioInstance = null;

function init(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("identify", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });
}

function getIO() {
  return ioInstance;
}

function emitToUser(userId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
}

module.exports = { init, getIO, emitToUser };
