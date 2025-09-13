import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

interface SensorData {
  timestamp: number;
  gsr: number;
  temperature: number;
  heartRate: number;
  stressLevel: number;
}

type DataCallback = (data: SensorData) => void;

class ArduinoSerial {
  private port: SerialPort;
  private parser: ReadlineParser;
  public onDataReceived?: DataCallback;

  constructor(portPath: string = 'COM3', baudRate: number = 9600) {
    this.port = new SerialPort({ 
      path: portPath, 
      baudRate: baudRate 
    });
    
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    this.port.on('open', () => {
      console.log('Arduino connected successfully');
    });
    
    this.parser.on('data', (data: string) => {
      this.handleArduinoData(data);
    });
  }
  
  private handleArduinoData(data: string): void {
    try {
      const sensorData: SensorData = JSON.parse(data);
      console.log('Received:', sensorData);
      
      if (this.onDataReceived) {
        this.onDataReceived(sensorData);
      }
    } catch (error) {
      console.error('Error parsing Arduino data:', error);
    }
  }
  
  public sendCommand(command: string): void {
    this.port.write(command + '\n');
  }
}

export default ArduinoSerial;
export type { SensorData };
