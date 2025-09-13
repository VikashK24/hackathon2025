"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import io, { Socket } from 'socket.io-client';
import FrontendSignalProcessor, { ProcessedStressData } from '../lib/frontend-signal-processing';

const SmartStressDashboard: React.FC = () => {
  const [data, setData] = useState<ProcessedStressData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [processingStats, setProcessingStats] = useState({ 
    samplesProcessed: 0, 
    processingTime: 0 
  });
  
  const socketRef = useRef<Socket | null>(null);
  const processorRef = useRef<FrontendSignalProcessor | null>(null);

  useEffect(() => {
    // Initialize signal processor
    processorRef.current = new FrontendSignalProcessor();
    
    // Initialize Socket.io connection
    socketRef.current = io();
    
    socketRef.current.on('connect', () => {
      setConnected(true);
      console.log('Connected to raw data stream');
    });
    
    socketRef.current.on('raw-sensor-data', (rawData) => {
      if (processorRef.current) {
        const startTime = performance.now();
        
        // Process the raw data on frontend
        const processedData = processorRef.current.processRawData(rawData);
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        // Update state
        setData(processedData);
        setProcessingStats(prev => ({
          samplesProcessed: prev.samplesProcessed + rawData.samples,
          processingTime: Math.round(processingTime * 100) / 100
        }));
      }
    });
    
    socketRef.current.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const getStressColor = (category: string): string => {
    switch (category) {
      case 'Low': return 'bg-green-500';
      case 'Moderate': return 'bg-yellow-500';
      case 'High': return 'bg-orange-500';
      case 'Critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Smart Stress Detection System
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-600">
                {connected ? 'Real-time processing active' : 'Connection lost'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Samples: {processingStats.samplesProcessed} | 
              Processing: {processingStats.processingTime}ms
            </div>
          </div>
        </div>

        {data ? (
          <>
            {/* Main Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Stress Level
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-gray-900">
                      {data.stressLevel}%
                    </div>
                    <Badge className={`${getStressColor(data.stressCategory)} text-white`}>
                      {data.stressCategory}
                    </Badge>
                  </div>
                  <Progress value={data.stressLevel} className="mt-2" />
                  <div className="text-xs text-gray-500 mt-1">
                    ML: {data.mlPrediction}% (conf: {(data.confidence * 100).toFixed(1)}%)
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Heart Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {Math.round(data.heartRate)}
                  </div>
                  <div className="text-sm text-gray-500">BPM</div>
                  <div className="text-xs text-gray-500 mt-1">
                    HRV: {data.hrv_rmssd.toFixed(1)}ms
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Brain Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {data.beta_alpha_ratio.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">Beta/Alpha</div>
                  <div className="text-xs text-gray-500 mt-1">
                    α: {data.eeg_bands.alpha.toFixed(0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Processing Power
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {processingStats.processingTime}
                  </div>
                  <div className="text-sm text-gray-500">ms</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Frontend Processing
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* EEG Band Powers */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>EEG Frequency Analysis (Processed in Browser)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {data.eeg_bands.delta.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600">Delta</div>
                    <div className="text-xs text-gray-500">0.5-4 Hz</div>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.eeg_bands.theta.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600">Theta</div>
                    <div className="text-xs text-gray-500">4-8 Hz</div>
                  </div>
                  
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {data.eeg_bands.alpha.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600">Alpha</div>
                    <div className="text-xs text-gray-500">8-13 Hz</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {data.eeg_bands.beta.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600">Beta</div>
                    <div className="text-xs text-gray-500">13-30 Hz</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.eeg_bands.gamma.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600">Gamma</div>
                    <div className="text-xs text-gray-500">30-50 Hz</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="shadow-lg">
            <CardContent className="text-center py-12">
              <div className="text-gray-500">
                {connected ? 'Waiting for sensor data...' : 'Please connect your Arduino R4'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SmartStressDashboard;
