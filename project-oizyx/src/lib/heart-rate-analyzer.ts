// interface HeartRateResult {
//   bpm: number;           // Heart rate in beats per minute
//   isValid: boolean;      // Whether the result is reliable
//   confidence: number;    // Confidence level (0-1)
//   rPeaksDetected: number; // Number of R-peaks detected
//   rrInterval: number;    // Latest R-R interval in ms
//   timestamp: number;     // Timestamp of calculation
// }

// class SimpleECGHeartRate {
//   private ecgBuffer: number[] = [];
//   private rPeaks: number[] = [];
//   private sampleCount = 0;
//   private smoothedBPM = 0;
//   private signalThreshold = 0.3;
//   private lastPeakTime = 0;
  
//   private readonly SAMPLE_RATE = 250;     // Hz (from Arduino)
//   private readonly BUFFER_SIZE = 750;     // 3 seconds of data
//   private readonly MIN_PEAK_DISTANCE = 50; // ~200ms between peaks
//   private readonly SMOOTHING = 0.25;      // BPM smoothing factor

//   public calculateDynamicHeartRate(rawEcgData: number[]): HeartRateResult {
//     // Convert Arduino ADC (0-1023) to voltage, remove DC bias
//     const voltage = rawEcgData.map(v => (v - 512) * (3.3 / 1024));
    
//     // Add to buffer and maintain size
//     this.ecgBuffer.push(...rawEcgData);
//     if (this.ecgBuffer.length > this.BUFFER_SIZE) {
//       const excess = this.ecgBuffer.length - this.BUFFER_SIZE;
//       this.ecgBuffer.splice(0, excess);
//       this.rPeaks = this.rPeaks.map(peak => peak - excess).filter(peak => peak > 0);
//     }
    
//     // Process ECG through Pan-Tompkins pipeline
//     const processedData = this.processECGSignal(voltage);
    
//     // Detect R-peaks and calculate BPM
//     const newPeaks = this.detectRPeaks(processedData);
//     this.rPeaks.push(...newPeaks);
//     this.sampleCount += rawEcgData.length;
    
//     return this.calculateBPMFromRRIntervals();
//   }
  
//   // ... (full implementation in previous response)
// }

// // Global instance for easy integration
// const heartRateAnalyzer = new SimpleECGHeartRate();

// // DIRECT REPLACEMENT - Just replace your existing function with this:
// function calculateDynamicHeartRate(rawEcgData: number[]): HeartRateResult {
//   return heartRateAnalyzer.calculateDynamicHeartRate(rawEcgData);
// }
