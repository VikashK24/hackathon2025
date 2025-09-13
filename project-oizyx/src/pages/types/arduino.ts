export interface SensorData {
  timestamp: number;
  gsr: number;
  temperature: number;
  heartRate: number;
  stressLevel: number;
}

export interface ArduinoCommand {
  type: 'STATUS' | 'CALIBRATE' | 'START' | 'STOP';
  payload?: Record<string, unknown>;
}

export interface ConnectionStatus {
  connected: boolean;
  port?: string;
  baudRate?: number;
  lastDataReceived?: number;
}
