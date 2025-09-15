const socket = new WebSocket('ws://localhost:8080');

socket.addEventListener('open', () => console.log('Sender connected to WebSocket server'));

export function processBetaAlphaRatioFactory() {
    const sampleRate = 100;             // 100 samples per second
    const baselineSeconds = 5 * 60;     // 5-minute baseline
    const windowSeconds = 3;            // 3-second window

    let baselineSamples: number[] = [];
    let windowSamples: number[] = [];
    let baselineMean: number | null = null;
    let t = 0;

    function sendRunFunctionMessage() {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "run_function" }));
            console.log('Sent run_function message');
        }
    }

    return function processSample(value: number) {
        t++;
        // Build up the baseline first
        if (t <= baselineSeconds * sampleRate) {
            baselineSamples.push(value);
            baselineMean = baselineSamples.reduce((a, b) => a + b, 0) / baselineSamples.length;
        } else {
            // Maintain sliding 3-second window
            windowSamples.push(value);
            if (windowSamples.length > windowSeconds * sampleRate) {
                windowSamples.shift();
            }

            if (windowSamples.length === windowSeconds * sampleRate && baselineMean !== null) {
                const windowMean = windowSamples.reduce((a, b) => a + b, 0) / windowSamples.length;
                if (windowMean > baselineMean) {
                    sendRunFunctionMessage();
                }
            }
        }
    }
}
