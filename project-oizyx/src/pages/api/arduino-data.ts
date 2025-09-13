import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { Socket as NetSocket } from 'net';
import ArduinoSerial, { SensorData } from '../../lib/arduino-serial';

interface SocketServer extends NetServer {
  io?: IOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

let arduino: ArduinoSerial;
let io: IOServer;

export default function handler(
  req: NextApiRequest, 
  res: NextApiResponseWithSocket
): void {
  if (!res.socket.server.io) {
    // Initialize Socket.io server
    io = new IOServer(res.socket.server);
    res.socket.server.io = io;
    
    // Initialize Arduino connection
    arduino = new ArduinoSerial('COM3'); // Adjust port for your system
    
    arduino.onDataReceived = (data: SensorData) => {
      io.emit('arduino-data', data);
    };
    
    io.on('connection', (socket) => {
      console.log('Client connected');
      
      socket.on('send-command', (command: string) => {
        arduino.sendCommand(command);
      });
    });
  }
  
  res.end();
}
