import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import * as tf from '@tensorflow/tfjs-node';

interface AdvancedSensorData {
  timestamp: number;
  heartRate: number;
  hrv_rmssd: number;
  eeg_delta: number;
  eeg_theta: number;
  eeg_alpha: number;
  eeg_beta: number;
  eeg_gamma: number;
  beta_alpha_ratio: number;
  stressLevel: number;
}

interface ProcessedStressData extends AdvancedSensorData {
  mlPrediction: number;
  stressCategory: 'Low' | 'Moderate' | 'High' | 'Critical';
  confidence: number;
}

class AdvancedStressDetector {
  private port: SerialPort;
  private parser: ReadlineParser;
  private model: tf.LayersModel | null = null;
  private dataBuffer: AdvancedSensorData[] = [];
  private readonly bufferSize = 30; // 30 seconds of data
  
  public onDataReceived?: (data: ProcessedStressData) => void;

  constructor(portPath: string = '/dev/ttyUSB0', baudRate: number = 115200) {
    this.port = new SerialPort({ path: portPath, baudRate });
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    this.initializeModel();
    this.setupEventListeners();
  }

  private async initializeModel(): Promise<void> {
    try {
      // Create a simple neural network for stress detection
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [9], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 stress categories
        ]
      });

      this.model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      console.log('ML Model initialized successfully');
    } catch (error) {
      console.error('Error initializing ML model:', error);
    }
  }

  private setupEventListeners(): void {
    this.port.on('open', () => {
      console.log('Advanced Arduino connection established');
    });

    this.parser.on('data', (data: string) => {
      this.processArduinoData(data);
    });
  }

  private async processArduinoData(rawData: string): Promise<void> {
    try {
      const sensorData: AdvancedSensorData = JSON.parse(rawData);
      
      // Add to buffer
      this.dataBuffer.push(sensorData);
      if (this.dataBuffer.length > this.bufferSize) {
        this.dataBuffer.shift();
      }

      // Perform advanced processing
      const processedData = await this.performAdvancedAnalysis(sensorData);
      
      if (this.onDataReceived) {
        this.onDataReceived(processedData);
      }
    } catch (error) {
      console.error('Error processing Arduino data:', error);
    }
  }

  private async performAdvancedAnalysis(data: AdvancedSensorData): Promise<ProcessedStressData> {
    // Feature engineering
    const features = this.extractFeatures(data);
    
    // ML prediction
    let mlPrediction = 0;
    let confidence = 0.5;
    
    if (this.model && features.length === 9) {
      try {
        const prediction = this.model.predict(tf.tensor2d([features])) as tf.Tensor;
        const predictionData = await prediction.data();
        
        mlPrediction = Array.from(predictionData).indexOf(Math.max(...predictionData));
        confidence = Math.max(...predictionData);
        
        prediction.dispose();
      } catch (error) {
        console.error('ML Prediction error:', error);
      }
    }

    // Determine stress category
    const stressCategory = this.categorizeStress(data.stressLevel, mlPrediction);

    return {
      ...data,
      mlPrediction,
      stressCategory,
      confidence
    };
  }

  private extractFeatures(data: AdvancedSensorData): number[] {
    return [
      this.normalize(data.heartRate, 60, 100),
      this.normalize(data.hrv_rmssd, 0, 100),
      this.normalize(data.eeg_delta, 0, 1000),
      this.normalize(data.eeg_theta, 0, 1000),
      this.normalize(data.eeg_alpha, 0, 1000),
      this.normalize(data.eeg_beta, 0, 1000),
      this.normalize(data.eeg_gamma, 0, 1000),
      this.normalize(data.beta_alpha_ratio, 0, 5),
      this.normalize(data.stressLevel, 0, 100)
    ];
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private categorizeStress(basicStress: number, mlPrediction: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
    const combinedScore = (basicStress + mlPrediction * 25) / 2;
    
    if (combinedScore < 25) return 'Low';
    if (combinedScore < 50) return 'Moderate';
    if (combinedScore < 75) return 'High';
    return 'Critical';
  }

  // Method to train the model with collected data
  public async trainModel(trainingData: { features: number[][], labels: number[][] }): Promise<void> {
    if (!this.model) return;

    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.tensor2d(trainingData.labels);

    await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
        }
      }
    });

    xs.dispose();
    ys.dispose();
    
    console.log('Model training completed');
  }

  public getDataBuffer(): AdvancedSensorData[] {
    return [...this.dataBuffer];
  }
}

export default AdvancedStressDetector;
export type { ProcessedStressData, AdvancedSensorData };
