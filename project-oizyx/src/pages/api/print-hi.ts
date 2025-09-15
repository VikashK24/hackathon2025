import type { NextApiRequest, NextApiResponse } from 'next';

interface PrintHiResponse {
  success: boolean;
  message: string;
  timestamp: number;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<PrintHiResponse>
): void {
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.',
      timestamp: Date.now()
    });
    return;
  }

  try {
    // Print "Hi" to the server console
    console.log('Hi');
    console.log('🎯 Print Hi command triggered!', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.socket.remoteAddress
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Hi printed successfully on server!',
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error in print-hi endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: Date.now()
    });
  }
}