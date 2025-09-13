import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

interface RawSensorData {
  timestamp: number;
  sampleRate: number;
  samples: number;
  ecg: number[];
  eeg: number[];
}

class RawDataStreamer {
  private port: SerialPort;
  private parser: ReadlineParser;
  
  public onDataReceived?: (data: RawSensorData) => void;

  constructor(portPath: string = '/dev/ttyUSB0', baudRate: number = 115200) {
    this.port = new SerialPort({ path: portPath, baudRate });
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.port.on('open', () => {
      console.log('Raw data streaming connection established');
    });

    this.parser.on('data', (data: string) => {
      try {
        const sensorData: RawSensorData = JSON.parse(data);
        
        if (this.onDataReceived) {
          this.onDataReceived(sensorData);
        }
      } catch (error) {
        console.error('Error parsing raw sensor data:', error);
      }
    });

    this.port.on('error', (error) => {
      console.error('Serial port error:', error);
    });
  }

  public close(): void {
    this.port.close();
  }
}

export default RawDataStreamer;
export type { RawSensorData };
