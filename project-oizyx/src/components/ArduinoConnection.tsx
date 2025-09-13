"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SensorData {
  gsr: number;
  heartRate: number;
  stressLevel: number;
  temperature: number;
  timestamp: number;
}

export default function ArduinoConnection() {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    // Connect to Arduino via WebSocket (adjust IP for WiFi method)
    const ws = new WebSocket('ws://192.168.1.100:81');

    ws.onopen = (): void => {
      setConnected(true);
      console.log('Connected to Arduino R4');
    };

    ws.onmessage = (event: MessageEvent): void => {
      try {
        const data: SensorData = JSON.parse(event.data);
        setSensorData(data);
      } catch (error) {
        console.error('Error parsing sensor data:', error);
      }
    };

    ws.onclose = (): void => {
      setConnected(false);
      console.log('Disconnected from Arduino');
    };

    ws.onerror = (error: Event): void => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    return () => ws.close();
  }, []);

  const getStressColor = (level: number): string => {
    if (level < 30) return "text-green-500";
    if (level < 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getStressLabel = (level: number): string => {
    if (level < 30) return "Low Stress";
    if (level < 70) return "Moderate Stress";
    return "High Stress";
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
          ></div>
          Arduino R4 Stress Monitor
          <span className="text-sm font-normal text-gray-500">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {sensorData ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-500 mb-1">
                {sensorData.heartRate}
              </div>
              <div className="text-sm text-gray-600">BPM</div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-500 mb-1">
                {sensorData.gsr}
              </div>
              <div className="text-sm text-gray-600">GSR</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-500 mb-1">
                {sensorData.temperature.toFixed(1)}°C
              </div>
              <div className="text-sm text-gray-600">Temperature</div>
            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className={`text-3xl font-bold mb-1 ${getStressColor(sensorData.stressLevel)}`}>
                {sensorData.stressLevel}%
              </div>
              <div className="text-sm text-gray-600">
                {getStressLabel(sensorData.stressLevel)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {connected ? 'Waiting for sensor data...' : 'Please connect Arduino R4'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
