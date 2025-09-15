import type { NextApiRequest, NextApiResponse } from 'next';
import WorkingStressProcessor, { ParsedArduinoData } from '../../lib/arduino-serial-parser';

let stressProcessor: WorkingStressProcessor;
let latestData: ParsedArduinoData | null = null;

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
): void {
  
  // Handle GET requests to retrieve latest data
  if (req.method === 'GET') {
    if (latestData) {
      res.status(200).json({
        success: true,
        data: latestData,
        timestamp: Date.now()
      });
    } else {
      res.status(202).json({
        success: false,
        message: 'No data available yet',
        timestamp: Date.now()
      });
    }
    return;
  }

  // Handle POST requests to initialize the processor
  if (req.method === 'POST') {
    if (!stressProcessor) {
      console.log('🚀 Starting Working Stress Detection Server...');
      
      // Initialize processor (will start with test data immediately)
      const ports = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyACM2', '/dev/ttyUSB0'];
      stressProcessor = new WorkingStressProcessor(ports[0], 115200);
      
      stressProcessor.onDataReceived = (data: ParsedArduinoData) => {
        console.log('📡 Received data:', data.eegBands);
        console.log('📡 Working data:', {
          delta: `${(data.eegBands!.delta * 100).toFixed(1)}%`,
          alpha: `${(data.eegBands!.alpha * 100).toFixed(1)}%`,
          beta: `${(data.eegBands!.beta * 100).toFixed(1)}%`,
          ratio: data.betaAlphaRatio?.toFixed(2),
          stress: `${data.stressLevel}%`
        });
        
        // Store the latest data
        latestData = data;
      };
      
      console.log('✅ Working stress processor ready with guaranteed data!');
    }
    
    res.status(200).json({
      success: true,
      message: 'Stress processor initialized',
      timestamp: Date.now()
    });
    return;
  }

  // Method not allowed
  res.status(405).json({
    success: false,
    message: 'Method not allowed',
    timestamp: Date.now()
  });
}