import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server;

export function createSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join machine room for targeted updates
    socket.on('join:machine', (machineId: string) => {
      socket.join(`machine:${machineId}`);
      console.log(`Socket ${socket.id} joined machine:${machineId}`);
    });

    socket.on('leave:machine', (machineId: string) => {
      socket.leave(`machine:${machineId}`);
    });

    // Heartbeat from TV player
    socket.on('heartbeat', (payload: unknown) => {
      // Will be handled in machine routes
      socket.emit('heartbeat:ack', { received: true });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call createSocketServer first.');
  }
  return io;
}
