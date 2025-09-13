import * as tf from '@tensorflow/tfjs';

interface ProcessedStressData {
    timestamp: number;
    heartRate: number;
    hrv_rmssd: number;
    eeg_bands: {
        delta: number;
        theta: number;
        alpha: number;
        beta: number;
        gamma: number;
    };
    beta_alpha_ratio: number;
    stressLevel: number;
    mlPrediction: number;
    stressCategory: 'Low' | 'Moderate' | 'High' | 'Critical';
    confidence: number;
}

class FrontendSignalProcessor {
    private ecgBuffer: number[] = [];
    private eegBuffer: number[] = [];
    private rrIntervals: number[] = [];
    private lastRPeakTime: number = 0;
    private model: tf.LayersModel | null = null;

    constructor() {
        this.initializeModel();
    }

    private async initializeModel(): Promise<void> {
        // Create a simple neural network for stress classification
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [8], units: 64, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({ units: 32, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({ units: 16, activation: 'relu' }),
                tf.layers.dense({ units: 4, activation: 'softmax' })
            ]
        });

        this.model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
    }

    public processRawData(rawData: { ecg: number[]; eeg: number[], timestamp: number }): ProcessedStressData {
        // Add new data to buffers
        this.ecgBuffer.push(...rawData.ecg);
        this.eegBuffer.push(...rawData.eeg);

        // Keep buffer size manageable (last 1000 samples = 4 seconds at 250 Hz)
        if (this.ecgBuffer.length > 1000) {
            this.ecgBuffer = this.ecgBuffer.slice(-1000);
        }
        if (this.eegBuffer.length > 1000) {
            this.eegBuffer = this.eegBuffer.slice(-1000);
        }

        // Process ECG for heart rate and HRV
        const { heartRate, hrv } = this.processECG();

        // Process EEG for frequency bands
        const eegBands = this.processEEG();

        // Calculate basic stress level
        const basicStressLevel = this.calculateBasicStress(heartRate, hrv, eegBands);

        // ML prediction
        const { mlPrediction, confidence } = this.performMLPrediction(
            heartRate, hrv, eegBands, basicStressLevel
        );

        // Categorize stress
        const stressCategory = this.categorizeStress(basicStressLevel, mlPrediction);

        return {
            timestamp: rawData.timestamp,
            heartRate,
            hrv_rmssd: hrv,
            eeg_bands: eegBands,
            beta_alpha_ratio: eegBands.beta / (eegBands.alpha + 0.1),
            stressLevel: basicStressLevel,
            mlPrediction,
            stressCategory,
            confidence
        };
    }

    private processECG(): { heartRate: number; hrv: number } {
        if (this.ecgBuffer.length < 100) {
            return { heartRate: 0, hrv: 0 };
        }

        // Simple R-peak detection
        const peaks = this.detectRPeaks(this.ecgBuffer);

        // Calculate heart rate
        const heartRate = peaks.length > 1 ?
            (60000 * (peaks.length - 1)) / (peaks[peaks.length - 1] - peaks[0]) : 0;

        // Calculate HRV (RMSSD)
        const hrv = this.calculateRMSSD(peaks);

        return { heartRate, hrv };
    }

    private detectRPeaks(ecgData: number[]): number[] {
        const peaks: number[] = [];
        const threshold = this.calculateThreshold(ecgData);
        let lastPeakIndex = -200; // Minimum distance between peaks

        for (let i = 1; i < ecgData.length - 1; i++) {
            if (ecgData[i] > threshold &&
                ecgData[i] > ecgData[i - 1] &&
                ecgData[i] > ecgData[i + 1] &&
                i - lastPeakIndex > 100) { // Minimum 100 samples (400ms at 250Hz)

                peaks.push(i);
                lastPeakIndex = i;
            }
        }

        return peaks;
    }

    private calculateThreshold(data: number[]): number {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const std = Math.sqrt(
            data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / data.length
        );
        return mean + 2 * std; // Threshold at mean + 2 standard deviations
    }

    private calculateRMSSD(peaks: number[]): number {
        if (peaks.length < 2) return 0;

        const rrIntervals = [];
        for (let i = 1; i < peaks.length; i++) {
            rrIntervals.push((peaks[i] - peaks[i - 1]) * 4); // Convert to milliseconds (250Hz)
        }

        const squaredDiffs = [];
        for (let i = 1; i < rrIntervals.length; i++) {
            const diff = rrIntervals[i] - rrIntervals[i - 1];
            squaredDiffs.push(diff * diff);
        }

        if (squaredDiffs.length === 0) return 0;

        const meanSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        return Math.sqrt(meanSquaredDiff);
    }

    private processEEG(): { delta: number; theta: number; alpha: number; beta: number; gamma: number } {
        if (this.eegBuffer.length < 256) {
            return { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
        }

        // Use the last 256 samples for FFT
        const fftData = this.eegBuffer.slice(-256);

        // Perform FFT using Web Audio API or manual implementation
        const frequencyData = this.performFFT(fftData);

        // Calculate band powers
        const delta = this.calculateBandPower(frequencyData, 0.5, 4, 250, 256);
        const theta = this.calculateBandPower(frequencyData, 4, 8, 250, 256);
        const alpha = this.calculateBandPower(frequencyData, 8, 13, 250, 256);
        const beta = this.calculateBandPower(frequencyData, 13, 30, 250, 256);
        const gamma = this.calculateBandPower(frequencyData, 30, 50, 250, 256);

        return { delta, theta, alpha, beta, gamma };
    }

    private performFFT(data: number[]): number[] {
        // Simple FFT implementation or use a library like ml-fft
        // For now, return magnitude spectrum simulation
        const N = data.length;
        const result = new Array(N / 2);

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

    private calculateBandPower(
        fftData: number[],
        startFreq: number,
        endFreq: number,
        sampleRate: number,
        fftSize: number
    ): number {
        const startBin = Math.floor((startFreq * fftSize) / sampleRate);
        const endBin = Math.floor((endFreq * fftSize) / sampleRate);

        let power = 0;
        for (let i = startBin; i <= endBin && i < fftData.length; i++) {
            power += fftData[i] * fftData[i];
        }

        return Math.sqrt(power / (endBin - startBin + 1));
    }

    private calculateBasicStress(
        heartRate: number,
        hrv: number,
        eegBands: { delta: number; theta: number; alpha: number; beta: number; gamma: number }
    ): number {
        let stressScore = 0;

        // Heart rate component (0-40 points)
        if (heartRate > 90) stressScore += 40;
        else if (heartRate > 80) stressScore += 25;
        else if (heartRate > 70) stressScore += 10;

        // HRV component (0-30 points) - Lower HRV = Higher stress
        if (hrv < 20) stressScore += 30;
        else if (hrv < 30) stressScore += 20;
        else if (hrv < 40) stressScore += 10;

        // EEG component (0-30 points)
        const betaAlphaRatio = eegBands.beta / (eegBands.alpha + 0.1);
        if (betaAlphaRatio > 2.0) stressScore += 30;
        else if (betaAlphaRatio > 1.5) stressScore += 20;
        else if (betaAlphaRatio > 1.0) stressScore += 10;

        return Math.min(stressScore, 100);
    }

    private performMLPrediction(
        heartRate: number,
        hrv: number,
        eegBands: { delta: number; theta: number; alpha: number; beta: number; gamma: number },
        basicStress: number
    ): { mlPrediction: number; confidence: number } {
        if (!this.model) {
            return { mlPrediction: 0, confidence: 0.5 };
        }

        try {
            const features = tf.tensor2d([[
                this.normalize(heartRate, 60, 120),
                this.normalize(hrv, 0, 100),
                this.normalize(eegBands.alpha, 0, 1000),
                this.normalize(eegBands.beta, 0, 1000),
                this.normalize(eegBands.theta, 0, 1000),
                this.normalize(eegBands.delta, 0, 1000),
                this.normalize(eegBands.gamma, 0, 1000),
                this.normalize(basicStress, 0, 100)
            ]]);

            const prediction = this.model.predict(features) as tf.Tensor;
            const predictionData = prediction.dataSync();

            const mlPrediction = Array.from(predictionData).indexOf(Math.max(...predictionData));
            const confidence = Math.max(...predictionData);

            features.dispose();
            prediction.dispose();

            return { mlPrediction: mlPrediction * 25, confidence }; // Scale to 0-100
        } catch (error) {
            console.error('ML prediction error:', error);
            return { mlPrediction: 0, confidence: 0.5 };
        }
    }

    private normalize(value: number, min: number, max: number): number {
        return Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    private categorizeStress(basicStress: number, mlPrediction: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
        const combinedScore = (basicStress + mlPrediction) / 2;

        if (combinedScore < 25) return 'Low';
        if (combinedScore < 50) return 'Moderate';
        if (combinedScore < 75) return 'High';
        return 'Critical';
    }
}

export default FrontendSignalProcessor;
export type { ProcessedStressData };