// src/lib/websocketBetaAlpha.ts

const socket = new WebSocket('ws://localhost:8080');

socket.addEventListener('open', () => console.log('Sender connected to WebSocket server'));

type Message = {
    type: string;
    PMR: number;
};

export function processBetaAlphaRatioFactory() {
    const sampleRate = 100;             
    const initialPhaseSeconds = 5 * 60; 
    const slidingWindowSeconds = 3;     
    const tolerance = 2;                

    let initialSamples: number[] = [];
    let slidingWindow: number[] = [];
    let m1: number | null = null;
    let std1: number | null = null;
    let t = 0;

    function change_tab(PMR: number) {
        if (socket.readyState === WebSocket.OPEN) {
            const message: Message = { type: 'open_yt_link', PMR };
            socket.send(JSON.stringify(message));
            console.log('Sent open_yt_link:', PMR);
        }
    }

    return function processSample(value: number) {
        if (t < initialPhaseSeconds * sampleRate) {
            initialSamples.push(value);
            m1 = initialSamples.reduce((a, b) => a + b, 0) / initialSamples.length;
            std1 = Math.sqrt(initialSamples.reduce((sum, x) => sum + (x - m1!) ** 2, 0) / initialSamples.length);
        }

        slidingWindow.push(value);
        if (slidingWindow.length > slidingWindowSeconds * sampleRate) slidingWindow.shift();

        if (m1 !== null && std1 !== null && slidingWindow.length === slidingWindowSeconds * sampleRate) {
            const filtered = slidingWindow.filter(v => Math.abs(v - m1!) <= tolerance * std1!);
            if (filtered.length === 0) return;
            const m2 = filtered.reduce((a, b) => a + b, 0) / filtered.length;
            if (m2 > m1 + 2 * std1) {
                change_tab(m2);
            }
        }

        t++;
    }
}
