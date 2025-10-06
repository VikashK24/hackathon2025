import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { Socket as NetSocket } from 'net';
import WorkingStressProcessor, { ParsedArduinoData } from '../../lib/arduino-serial-parser';

interface SocketServer extends NetServer {
  io?: IOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

let stressProcessor: WorkingStressProcessor;

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
): void {
  
  if (!res.socket.server.io) {
    console.log('🚀 Starting Working Stress Detection Server...');
    
    const io = new IOServer(res.socket.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });
    
    res.socket.server.io = io;
    
    // Initialize processor (will start with test data immediately)
    const ports = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyACM2', '/dev/ttyUSB0'];
    stressProcessor = new WorkingStressProcessor(ports[0], 115200);
    
    stressProcessor.onDataReceived = (data: ParsedArduinoData) => {
      console.log('📡 Broadcasting raw data ######:', data.eegBands);
      console.log('📡 Broadcasting working data:', {
        delta: `${(data.eegBands!.delta * 100).toFixed(1)}%`,
        alpha: `${(data.eegBands!.alpha * 100).toFixed(1)}%`,
        beta: `${(data.eegBands!.beta * 100).toFixed(1)}%`,
        ratio: data.betaAlphaRatio?.toFixed(2),
        stress: `${data.stressLevel}%`
      });
      
      io.emit('arduino-parsed-data', data);
    };
    
    io.on('connection', (socket) => {
      console.log('🔗 Working dashboard connected');
      socket.on('disconnect', () => console.log('🔌 Dashboard disconnected'));
    });
    
    console.log('✅ Working stress processor ready with guaranteed data!');
  }
  
  res.end();
}