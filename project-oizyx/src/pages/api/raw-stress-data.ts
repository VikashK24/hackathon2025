import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { Socket as NetSocket } from 'net';
import RawDataStreamer, { RawSensorData } from '../../lib/raw-data-serial';

interface SocketServer extends NetServer {
    io?: IOServer | undefined;
}

interface SocketWithIO extends NetSocket {
    server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
    socket: SocketWithIO;
}

let rawStreamer: RawDataStreamer;
let io: IOServer;

export default function handler(
    req: NextApiRequest,
    res: NextApiResponseWithSocket
): void {
    if (!res.socket.server.io) {
        io = new IOServer(res.socket.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        res.socket.server.io = io;

        // Initialize raw data streamer
        rawStreamer = new RawDataStreamer('/dev/ttyUSB0', 115200);

        rawStreamer.onDataReceived = (data: RawSensorData) => {
            // Forward raw data to all connected clients
            io.emit('raw-sensor-data', data);
        };

        io.on('connection', (socket) => {
            console.log('Client connected to raw data stream');

            socket.on('disconnect', () => {
                console.log('Client disconnected from raw data stream');
            });
        });
    }

    res.end();
}