import FFT from 'fft.js';

interface EEGBands {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
}

interface EEGAnalysisResult {
    bands: EEGBands;
    isValid: boolean;
    samplesProcessed: number;
    timestamp: number;
}

class RealTimeEEGAnalyzer {
    private static readonly SAMPLE_RATE = 250;
    private static readonly FFT_SIZE = 128;
    private static readonly BAND_DEFINITIONS = {
        delta: { min: 0.5, max: 4.0 },
        theta: { min: 4.0, max: 8.0 },
        alpha: { min: 8.0, max: 13.0 },
        beta: { min: 13.0, max: 30.0 },
        gamma: { min: 30.0, max: 100.0 }
    } as const;

    private readonly fft: FFT;
    private readonly dataBuffer: number[] = [];
    private readonly fftOutput: number[];

    constructor() {
        this.fft = new FFT(RealTimeEEGAnalyzer.FFT_SIZE);
        this.fftOutput = this.fft.createComplexArray();
    }

    public analyzeEEGData(rawEegData: number[]): EEGAnalysisResult {
        const voltageData = this.convertAdcToVoltage(rawEegData);
        this.updateBuffer(voltageData);

        const timestamp = Date.now();

        if (!this.hasEnoughData()) {
            return {
                bands: this.getEmptyBands(),
                isValid: false,
                samplesProcessed: this.dataBuffer.length,
                timestamp
            };
        }

        const bands = this.performFFTAnalysis();

        return {
            bands,
            isValid: this.isValidResult(bands),
            samplesProcessed: RealTimeEEGAnalyzer.FFT_SIZE,
            timestamp
        };
    }

    private convertAdcToVoltage(rawData: number[]): number[] {
        return rawData.map(value => (value - 512) * (3.3 / 1024));
    }

    private updateBuffer(data: number[]): void {
        this.dataBuffer.push(...data);
        if (this.dataBuffer.length > RealTimeEEGAnalyzer.FFT_SIZE) {
            this.dataBuffer.splice(0, this.dataBuffer.length - RealTimeEEGAnalyzer.FFT_SIZE);
        }
    }

    private hasEnoughData(): boolean {
        return this.dataBuffer.length >= RealTimeEEGAnalyzer.FFT_SIZE;
    }

    private performFFTAnalysis(): EEGBands {
        try {
            const windowedData = this.applyWindow([...this.dataBuffer]);
            this.fft.realTransform(this.fftOutput, windowedData);
            return this.extractBandPowers();
        } catch (error) {
            console.error('FFT Analysis failed:', error);
            return this.getEmptyBands();
        }
    }

    private applyWindow(data: number[]): number[] {
        return data.map((value, i) => {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (data.length - 1)));
            return value * window;
        });
    }

    private extractBandPowers(): EEGBands {
        const frequencyResolution = RealTimeEEGAnalyzer.SAMPLE_RATE / RealTimeEEGAnalyzer.FFT_SIZE;
        const powers = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0, total: 0 };

        for (let i = 1; i < RealTimeEEGAnalyzer.FFT_SIZE / 2; i++) {
            const real = this.fftOutput[i * 2];
            const imag = this.fftOutput[i * 2 + 1];
            const power = real * real + imag * imag;
            const frequency = i * frequencyResolution;

            const bandName = this.classifyFrequency(frequency);
            if (bandName) {
                powers[bandName] += power;
            }
            powers.total += power;
        }

        return this.normalizePowers(powers);
    }

    private classifyFrequency(frequency: number): keyof EEGBands | null {
        for (const [band, range] of Object.entries(RealTimeEEGAnalyzer.BAND_DEFINITIONS)) {
            if (frequency >= range.min && frequency < range.max) {
                return band as keyof EEGBands;
            }
        }
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private normalizePowers(powers: any): EEGBands {
        if (powers.total <= 0) return this.getEmptyBands();

        return {
            delta: powers.delta / powers.total,
            theta: powers.theta / powers.total,
            alpha: powers.alpha / powers.total,
            beta: powers.beta / powers.total,
            gamma: powers.gamma / powers.total
        };
    }

    private getEmptyBands(): EEGBands {
        return { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    }

    private isValidResult(bands: EEGBands): boolean {
        const sum = bands.delta + bands.theta + bands.alpha + bands.beta + bands.gamma;
        return sum > 0.95 && sum < 1.05;
    }

    public reset(): void {
        this.dataBuffer.length = 0;
    }
}

export { RealTimeEEGAnalyzer };