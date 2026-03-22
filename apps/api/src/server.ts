import 'dotenv/config';
import { createApp } from './app.js';
import { createSocketServer } from './socket.js';
import { prisma } from './lib/prisma.js';
import { checkStaleHeartbeats } from './services/alertService.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`JukeBox API running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Attach Socket.IO
  createSocketServer(server);

  // Start heartbeat monitor (check every 60 seconds)
  const heartbeatInterval = setInterval(() => {
    checkStaleHeartbeats().catch((err) => {
      console.error('Heartbeat check error:', err.message);
    });
  }, 60000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    clearInterval(heartbeatInterval);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
