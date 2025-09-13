import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { Socket as NetSocket } from 'net';
import AdvancedStressDetector, { ProcessedStressData } from './advanced-arduino-serial';

interface SocketServer extends NetServer {
  io?: IOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

let stressDetector: AdvancedStressDetector;
let io: IOServer;

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
): void {
  if (!res.socket.server.io) {
    io = new IOServer(res.socket.server);
    res.socket.server.io = io;

    // Initialize advanced stress detector
    stressDetector = new AdvancedStressDetector('/dev/ttyUSB0', 115200);

    stressDetector.onDataReceived = (data: ProcessedStressData) => {
      io.emit('advanced-stress-data', data);
    };

    io.on('connection', (socket) => {
      console.log('Advanced client connected');

      socket.on('get-historical-data', () => {
        const historicalData = stressDetector.getDataBuffer();
        socket.emit('historical-data', historicalData);
      });

      socket.on('train-model', async (trainingData) => {
        try {
          await stressDetector.trainModel(trainingData);
          socket.emit('model-training-complete', { success: true });
        } catch (error) {
          socket.emit('model-training-complete', { success: false, error: error });
        }
      });
    });
  }

  res.end();
}
