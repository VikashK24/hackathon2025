interface RawSensorData {
  timestamp: number;
  samples: number;
  sampleRate: number;
  eeg: number[];
  ecg: number[];
}

interface ProcessedData {
  timestamp: number;
  eeg: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
    betaAlphaRatio: number;
    signalQuality: number;
  };
  ecg: {
    heartRate: number;
    rrInterval: number;
    peakDetected: boolean;
    hrv: number;
  };
  stressLevel: number;
  overallQuality: number;
}

class EnhancedFrontendProcessor {
  private eegBuffer: number[] = [];
  private ecgBuffer: number[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number = 0;
  private lastPeakValue: number = 0;

  public processRawData(rawData: RawSensorData): ProcessedData {
    // Add new samples to buffers
    this.eegBuffer.push(...rawData.eeg);
    this.ecgBuffer.push(...rawData.ecg);

    // Keep buffers manageable (last 2 seconds of data)
    const maxBufferSize = rawData.sampleRate * 2;
    if (this.eegBuffer.length > maxBufferSize) {
      this.eegBuffer = this.eegBuffer.slice(-maxBufferSize);
    }
    if (this.ecgBuffer.length > maxBufferSize) {
      this.ecgBuffer = this.ecgBuffer.slice(-maxBufferSize);
    }

    // Process EEG
    const eegResults = this.processEEG(rawData.sampleRate);
    
    // Process ECG
    const ecgResults = this.processECG(rawData.sampleRate);
    
    // Calculate stress level
    const stressLevel = this.calculateStress(eegResults, ecgResults);

    return {
      timestamp: rawData.timestamp,
      eeg: eegResults,
      ecg: ecgResults,
      stressLevel,
      overallQuality: (eegResults.signalQuality + (ecgResults.heartRate > 0 ? 80 : 20)) / 2
    };
  }

  private processEEG(sampleRate: number) {
    if (this.eegBuffer.length < 256) {
      return {
        delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0,
        betaAlphaRatio: 1, signalQuality: 0
      };
    }

    // Use last 256 samples for FFT
    const fftData = this.eegBuffer.slice(-256);
    
    // Basic preprocessing - remove DC offset
    const mean = fftData.reduce((a, b) => a + b, 0) / fftData.length;
    const centeredData = fftData.map(x => x - mean);
    
    // Simple FFT implementation
    const frequencyData = this.performSimpleFFT(centeredData);
    
    // Calculate band powers
    const bands = this.calculateBandPowers(frequencyData, sampleRate);
    
    // Signal quality based on signal variance
    const variance = centeredData.reduce((sum, val) => sum + val * val, 0) / centeredData.length;
    const signalQuality = Math.min(100, Math.max(0, (Math.sqrt(variance) / 100) * 100));

    return {
      ...bands,
      betaAlphaRatio: bands.alpha > 0 ? bands.beta / bands.alpha : 1,
      signalQuality
    };
  }

  private processECG(sampleRate: number) {
    if (this.ecgBuffer.length < 100) {
      return { heartRate: 0, rrInterval: 0, peakDetected: false, hrv: 0 };
    }

    // Simple peak detection
    const recentECG = this.ecgBuffer.slice(-100);
    const peakDetected = this.detectPeak(recentECG);
    
    // Calculate heart rate and HRV
    const { heartRate, rrInterval, hrv } = this.calculateHeartMetrics();

    return { heartRate, rrInterval, peakDetected, hrv };
  }

  private performSimpleFFT(data: number[]): number[] {
    const N = data.length;
    const result = new Array(N / 2).fill(0);
    
    // Simple DFT for demonstration
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += data[n] * Math.cos(angle);
        imag += data[n] * Math.sin(angle);
      }
      
      result[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return result;
  }

  private calculateBandPowers(fftData: number[], sampleRate: number) {
    const bands = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    const binSize = sampleRate / fftData.length;

    fftData.forEach((power, index) => {
      const frequency = index * binSize;
      
      if (frequency >= 0.5 && frequency < 4) bands.delta += power;
      else if (frequency >= 4 && frequency < 8) bands.theta += power;
      else if (frequency >= 8 && frequency < 13) bands.alpha += power;
      else if (frequency >= 13 && frequency < 30) bands.beta += power;
      else if (frequency >= 30 && frequency < 45) bands.gamma += power;
    });

    // Normalize
    const total = bands.delta + bands.theta + bands.alpha + bands.beta + bands.gamma;
    if (total > 0) {
      bands.delta /= total;
      bands.theta /= total;
      bands.alpha /= total;
      bands.beta /= total;
      bands.gamma /= total;
    }

    return bands;
  }

  private detectPeak(ecgData: number[]): boolean {
    if (ecgData.length < 10) return false;
    
    const recent = ecgData.slice(-10);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const std = Math.sqrt(recent.reduce((sum, val) => sum + (val - mean) ** 2, 0) / recent.length);
    
    const threshold = mean + 2 * std;
    const currentValue = recent[recent.length - 1];
    const previousValue = recent[recent.length - 2];
    
    // Peak detection: current > threshold and current > previous
    const isPeak = currentValue > threshold && currentValue > previousValue;
    
    if (isPeak) {
      const currentTime = Date.now();
      if (this.lastPeakTime > 0) {
        const rrInterval = currentTime - this.lastPeakTime;
        if (rrInterval > 300 && rrInterval < 2000) { // Valid RR interval
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > 20) {
            this.rrIntervals.shift();
          }
        }
      }
      this.lastPeakTime = currentTime;
    }
    
    return isPeak;
  }

  private calculateHeartMetrics() {
    if (this.rrIntervals.length < 2) {
      return { heartRate: 0, rrInterval: 0, hrv: 0 };
    }

    const avgRR = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
    const heartRate = Math.round(60000 / avgRR);
    
    // Calculate HRV (RMSSD)
    let sumSquaredDiffs = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }
    const hrv = Math.sqrt(sumSquaredDiffs / (this.rrIntervals.length - 1));

    return { heartRate, rrInterval: avgRR, hrv };
  }

  private calculateStress(
    eeg: ProcessedData['eeg'],
    ecg: ProcessedData['ecg']
  ): number {
    let stress = 0;
    
    // EEG-based stress (70% weight)
    if (eeg.betaAlphaRatio > 2.0) stress += 40;
    else if (eeg.betaAlphaRatio > 1.5) stress += 25;
    else if (eeg.betaAlphaRatio > 1.0) stress += 15;
    
    if (eeg.beta > 0.3) stress += 20;
    else if (eeg.beta > 0.2) stress += 10;
    
    // ECG-based stress (30% weight)
    if (ecg.heartRate > 90) stress += 25;
    else if (ecg.heartRate > 80) stress += 15;
    else if (ecg.heartRate > 70) stress += 10;
    
    if (ecg.hrv < 20) stress += 15;
    else if (ecg.hrv < 30) stress += 10;
    else if (ecg.hrv < 40) stress += 5;
    
    return Math.min(100, stress);
  }
}

export default EnhancedFrontendProcessor;
export type { ProcessedData, RawSensorData };
