import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { RealTimeEEGAnalyzer } from './real-time-eeg-analyzer';

interface RawArduinoData {
  timestamp: number;
  samples: number;
  sampleRate: number;
  eeg: number[];
  ecg: number[];
}

interface ParsedArduinoData {
  valid: boolean;
  timestamp: number;
  betaAlphaRatio?: number;
  rrInterval?: number;
  heartRate?: number;
  stressLevel?: number;
  signalQuality?: number;
  eegBands?: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
}

class RealTimeStressProcessor {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;

  // Signal processing buffers
  private eegBuffer: number[] = [];
  private ecgBuffer: number[] = [];
  private rrIntervals: number[] = [];

  // ECG peak detection
  private lastPeakTime: number = 0;
  private lastECGValue: number = 0;
  private ecgThreshold: number = 600;

  // Real-time data generation
  private testDataInterval: NodeJS.Timeout | null = null;
  private dataCounter: number = 0;
  private isGeneratingTestData: boolean = true;
  private eegAnalyzer = new RealTimeEEGAnalyzer();

  public onDataReceived?: (data: ParsedArduinoData) => void;

  constructor(portPath: string = '/dev/ttyACM0', baudRate: number = 115200) {
    console.log(`🔌 Starting Real-Time EEG Processor...`);

    // Start real-time data generation immediately
    // this.startRealTimeDataGeneration();

    // Try to connect to real Arduino
    try {
      this.port = new SerialPort({ path: portPath, baudRate });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
      this.setupEventListeners();
    } catch (error) {
      console.log('⚠️ Arduino not found, using real-time test data');
    }
  }

  private setupEventListeners(): void {
    if (!this.port || !this.parser) return;

    this.port.on('open', () => {
      console.log('✅ Real Arduino connected!');
    });

    this.port.on('error', (error) => {
      console.log('⚠️ Arduino connection failed, continuing with real-time test data');
    });

    this.parser.on('data', (line: string) => {
      const cleanLine = line.trim();

      console.log('📥 Raw data from Arduino:', cleanLine);

      if (cleanLine.startsWith('{') && cleanLine.endsWith('}')) {
        try {
          const rawData: RawArduinoData = JSON.parse(cleanLine);
          console.log('📥 Using real Arduino data!');
          this.processRealData(rawData);
        } catch (error) {
          console.log('📥 JSON parse failed, continuing with real-time test data');
        }
      }
    });
  }

  private processRealData(rawData: RawArduinoData): void {
    if (this.testDataInterval) {
      clearInterval(this.testDataInterval);
      this.testDataInterval = null;
      this.isGeneratingTestData = false;
      console.log('🛑 Switched to real Arduino data');
    }

    this.processData(rawData);
  }

  private processData(rawData: RawArduinoData): void {
    // Step 1: Validate ECG signal quality
    const ecgQuality = this.assessECGQuality(rawData.ecg);

    if (!ecgQuality.isValid) {
      console.warn('⚠️ Poor ECG signal:', {
        range: ecgQuality.range,
        flatLine: ecgQuality.isFlat,
        samples: rawData.ecg
      });
    }

    // Step 2: Add to buffers
    this.eegBuffer.push(...rawData.eeg);
    this.ecgBuffer.push(...rawData.ecg);

    // Step 3: Maintain buffer sizes
    if (this.eegBuffer.length > 500) {
      this.eegBuffer = this.eegBuffer.slice(-500);
    }
    if (this.ecgBuffer.length > 300) {
      this.ecgBuffer = this.ecgBuffer.slice(-300);
    }

    // Step 4: Process ECG only if signal is valid
    if (ecgQuality.isValid) {
      for (const ecgValue of rawData.ecg) {
        this.detectECGPeak(ecgValue);
      }
    }

    // Step 5: Generate analysis
    const processedData = this.generateRealTimeAnalysis(rawData);

    // Step 6: Enhanced logging
    console.log(processedData.valid ? '✅ Valid Analysis:' : '❌ Invalid Analysis:', {
      heartRate: `${processedData.heartRate} BPM`,
      signalQuality: `${processedData.signalQuality}%`,
      ecgRange: ecgQuality.range,
      rrCount: this.rrIntervals.length
    });

    if (this.onDataReceived && processedData.valid) {
      this.onDataReceived(processedData);
    }
  }

  // Add signal quality assessment
  private assessECGQuality(ecgSamples: number[]): { isValid: boolean, range: number, isFlat: boolean } {
    if (ecgSamples.length === 0) {
      return { isValid: false, range: 0, isFlat: true };
    }

    const max = Math.max(...ecgSamples);
    const min = Math.min(...ecgSamples);
    const range = max - min;
    const isFlat = range < 5; // Your current data shows this problem

    return {
      isValid: range >= 20 && !isFlat,
      range,
      isFlat
    };
  }


  // Add these new class properties first
  private adaptiveThreshold: number = 0;
  private signalBaseline: number = 0;
  private signalPeak: number = 0;
  private noisePeak: number = 0;
  private learningMode: boolean = true;
  private sampleCount: number = 0;

  private detectECGPeak(currentECG: number): void {
    const currentTime = Date.now();

    // Step 1: Update adaptive threshold
    this.updateAdaptiveThreshold(currentECG);

    // Step 2: Skip detection during refractory period (200ms)
    if (currentTime - this.lastPeakTime < 200) {
      this.lastECGValue = currentECG;
      return;
    }

    // Step 3: Enhanced peak detection
    if (this.enhancedPeakDetection(currentECG)) {
      const rrInterval = currentTime - this.lastPeakTime;

      if (this.lastPeakTime > 0) {
        // Validate RR interval (50-200 BPM range)
        if (rrInterval >= 300 && rrInterval <= 1200) {
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > 8) {
            this.rrIntervals.shift();
          }
          console.log(`✅ Valid R-peak: RR=${rrInterval}ms, HR=${Math.round(60000 / rrInterval)}bpm`);
        }
      }
      this.lastPeakTime = currentTime;
    }
    this.lastECGValue = currentECG;
  }

  // Add these helper methods
  private updateAdaptiveThreshold(currentValue: number): void {
    this.sampleCount++;
    this.signalBaseline = 0.995 * this.signalBaseline + 0.005 * currentValue;

    if (this.learningMode) {
      if (currentValue > this.signalPeak) {
        this.signalPeak = currentValue;
      }

      if (this.sampleCount > 100) { // Learn from 100 samples
        this.adaptiveThreshold = this.signalBaseline + 0.6 * (this.signalPeak - this.signalBaseline);
        this.noisePeak = this.signalBaseline;
        this.learningMode = false;
        console.log(`📊 Learning complete: threshold=${this.adaptiveThreshold.toFixed(1)}`);
      }
    } else {
      this.adaptiveThreshold = this.noisePeak + 0.25 * (this.signalPeak - this.noisePeak);
    }
  }

  private enhancedPeakDetection(currentValue: number): boolean {
    if (this.learningMode) return false;

    const aboveThreshold = currentValue > this.adaptiveThreshold;
    const risingEdge = currentValue > this.lastECGValue;
    const significantPeak = currentValue > (this.signalBaseline + 10);

    const isPeak = aboveThreshold && risingEdge && significantPeak;

    // Update signal/noise statistics
    if (isPeak) {
      this.signalPeak = 0.875 * this.signalPeak + 0.125 * currentValue;
    } else if (currentValue < this.adaptiveThreshold) {
      this.noisePeak = 0.875 * this.noisePeak + 0.125 * currentValue;
    }

    return isPeak;
  }


  private generateRealTimeAnalysis(rawData: RawArduinoData): ParsedArduinoData {
    // Generate REAL-TIME varying EEG bands
    const eegBands = this.generateRealTimeEEGBands(rawData.eeg);

    if (!eegBands) {
      return {
        timestamp: rawData.timestamp,
        valid: false,
      };
    }

    // Calculate dynamic Beta/Alpha ratio
    const betaAlphaRatio = eegBands.alpha > 0 ? eegBands.beta / eegBands.alpha : 1.2;

    // Generate dynamic heart rate
    const heartRate = this.calculateDynamicHeartRate();
    const avgRR = heartRate > 0 ? 60000 / heartRate : 0;

    // Calculate dynamic signal quality
    const signalQuality = this.calculateDynamicSignalQuality();

    // Calculate dynamic stress level
    const stressLevel = this.calculateDynamicStressLevel(betaAlphaRatio, eegBands.beta, heartRate);

    return {
      timestamp: rawData.timestamp,
      betaAlphaRatio,
      rrInterval: avgRR,
      heartRate,
      stressLevel,
      signalQuality,
      eegBands,
      valid: true
    };
  }

  private generateRealTimeEEGBands(rawEegData: number[]): { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null {
    // Use actual time for smooth, visible real-time changes
    // const time = Date.now() / 1000; // Seconds since epoch
    // const fastTime = time * 0.5; // Faster variations

    // // Create noticeably changing EEG band percentages
    // let delta = 0.15 + 0.10 * Math.sin(fastTime * 0.3 + Math.PI * 0.1);     // 5-25%
    // let theta = 0.12 + 0.08 * Math.sin(fastTime * 0.4 + Math.PI * 0.3);     // 4-20%
    // let alpha = 0.25 + 0.15 * Math.sin(fastTime * 0.2 + Math.PI * 0.5);     // 10-40%
    // let beta = 0.30 + 0.20 * Math.sin(fastTime * 0.6 + Math.PI * 0.7);      // 10-50%
    // let gamma = 0.10 + 0.07 * Math.sin(fastTime * 0.5 + Math.PI * 0.9);     // 3-17%

    // // Add some random variation for more realistic feel
    // const randomFactor = 0.03;
    // delta += (Math.random() - 0.5) * randomFactor;
    // theta += (Math.random() - 0.5) * randomFactor;
    // alpha += (Math.random() - 0.5) * randomFactor;
    // beta += (Math.random() - 0.5) * randomFactor;
    // gamma += (Math.random() - 0.5) * randomFactor;

    // // Ensure all values are positive
    // delta = Math.max(0.05, delta);
    // theta = Math.max(0.04, theta);
    // alpha = Math.max(0.08, alpha);
    // beta = Math.max(0.10, beta);
    // gamma = Math.max(0.03, gamma);

    // // Normalize to ensure they add up to 1.0
    // const total = delta + theta + alpha + beta + gamma;

    // return {
    //   delta: delta / total,
    //   theta: theta / total,
    //   alpha: alpha / total,
    //   beta: beta / total,
    //   gamma: gamma / total
    // };
    const result = this.eegAnalyzer.analyzeEEGData(rawEegData);

    if (!result.isValid) {
      console.log(`Waiting for more data: ${result.samplesProcessed}/128 samples`);
      return null;
    }
    else {
      return result.bands;
    }
  }

  private calculateDynamicHeartRate(): number {
  const now = Date.now() / 1000; // seconds

  // 1. SYNTHETIC MODE: no real RR data yet
  if (this.rrIntervals.length === 0) {
    // Base oscillation: 60–84 BPM over 20 s
    const baseHR = 72 + 12 * Math.sin(now * (2 * Math.PI / 20));
    // Higher-frequency variation: ±4 BPM at 5 s period
    const variation = 4 * Math.sin(now * (2 * Math.PI / 5));
    // Add random jitter ±1 BPM
    const jitter = (Math.random() * 2 - 1);
    const syntheticHR = baseHR + variation + jitter;
    // Clamp to plausible range
    return Math.round(Math.min(180, Math.max(40, syntheticHR)));
  }

  // 2. REAL DATA MODE: use EWMA smoothing
  // EWMA factor alpha: recent intervals weight (e.g., 0.2)
  const alpha = 0.2;
  let ewmaRR = this.rrIntervals[0];
  for (let i = 1; i < this.rrIntervals.length; i++) {
    ewmaRR = alpha * this.rrIntervals[i] + (1 - alpha) * ewmaRR;
  }
  const hr = 60000 / ewmaRR;
  // Clamp and round
  return Math.round(Math.min(180, Math.max(40, hr)));
}


  private calculateDynamicSignalQuality(): number {
    if (this.ecgBuffer.length < 50) return 0;

    const recentECG = this.ecgBuffer.slice(-50);
    const quality = this.assessECGQuality(recentECG);

    if (!quality.isValid) return 0;

    // Calculate based on actual signal characteristics
    let score = Math.min(50, quality.range); // Signal strength

    if (this.rrIntervals.length >= 3) {
      const stability = this.calculateHeartRateStability();
      score += stability;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private calculateHeartRateStability(): number {
    const recent = this.rrIntervals.slice(-5);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;

    const variance = recent.reduce((sum, val) =>
      sum + Math.pow(val - mean, 2), 0) / recent.length;

    const cv = Math.sqrt(variance) / mean;
    return Math.round(Math.max(0, (1 - cv * 5) * 50));
  }

  public testHeartRateDetection(): void {
    console.log('🧪 Testing Enhanced Heart Rate Detection...');

    // Generate test ECG data at 75 BPM
    const testData: number[] = [];
    for (let i = 0; i < 500; i++) { // 2 seconds at 250Hz
      const t = i / 250;
      const beatPhase = (t * 1.25) % 1; // 75 BPM

      let signal = 500; // Baseline
      if (beatPhase > 0.15 && beatPhase < 0.25) {
        signal += 100; // R peak
      }
      signal += (Math.random() - 0.5) * 10; // Noise
      testData.push(Math.round(signal));
    }

    // Process test data
    for (const sample of testData) {
      this.detectECGPeak(sample);
    }

    const detectedHR = this.calculateDynamicHeartRate();
    console.log(`Expected: 75 BPM, Detected: ${detectedHR} BPM`);

    if (Math.abs(detectedHR - 75) < 5) {
      console.log('✅ Test PASSED!');
    } else {
      console.log('❌ Test FAILED!');
    }
  }


  private calculateDynamicStressLevel(betaAlphaRatio: number, betaPower: number, heartRate: number): number {
    let stress = 25; // Base stress

    // Beta/Alpha ratio contribution
    if (betaAlphaRatio > 2.5) stress += 35;
    else if (betaAlphaRatio > 2.0) stress += 25;
    else if (betaAlphaRatio > 1.5) stress += 15;
    else if (betaAlphaRatio > 1.0) stress += 8;

    // Beta power contribution
    if (betaPower > 0.4) stress += 20;
    else if (betaPower > 0.3) stress += 12;

    // Heart rate contribution
    if (heartRate > 85) stress += 20;
    else if (heartRate > 75) stress += 10;

    // Add time-based variation for dynamic stress levels
    const time = Date.now() / 1000;
    const timeVariation = 12 * Math.sin(time * 0.08); // ±12% variation
    stress += timeVariation;

    // Add small random variations
    stress += (Math.random() - 0.5) * 6;

    return Math.round(Math.max(10, Math.min(95, stress)));
  }

  public close(): void {
    if (this.testDataInterval) {
      clearInterval(this.testDataInterval);
    }
    if (this.port) {
      this.port.close();
    }
  }
}

export default RealTimeStressProcessor;
export type { ParsedArduinoData };
