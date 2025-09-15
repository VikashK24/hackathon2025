"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// Enhanced interface to match our accurate processor output
interface ParsedArduinoData {
  timestamp: number;
  betaAlphaRatio?: number;
  rrInterval?: number;
  heartRate?: number;
  stressLevel?: number;
  signalQuality?: number;
  eegBands?: {
    delta: number;
    theta: number;
    alpha: number;
    beta: number;
    gamma: number;
  };
}

interface RecordedSession {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number; // in minutes
  dataPoints: ParsedArduinoData[];
  metadata: {
    totalSamples: number;
    averageStress: number;
    averageHeartRate: number;
    averageBetaAlpha: number;
  };
}

const EnhancedArduinoStressDashboard: React.FC = () => {
  const [data, setData] = useState<ParsedArduinoData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [dataHistory, setDataHistory] = useState<ParsedArduinoData[]>([]);

  // Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0); // in seconds
  const [recordedData, setRecordedData] = useState<ParsedArduinoData[]>([]);
  const [completedSessions, setCompletedSessions] = useState<RecordedSession[]>([]);
  const [showRecordedData, setShowRecordedData] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<RecordedSession | null>(null);
  
  // Beta:Alpha ratio monitoring states
  const [baselineBetaAlpha, setBaselineBetaAlpha] = useState<number | null>(null);
  const [baselineData, setBaselineData] = useState<ParsedArduinoData[]>([]);
  const [recentData, setRecentData] = useState<ParsedArduinoData[]>([]);
  const [printHiTriggered, setPrintHiTriggered] = useState<boolean>(false);
  
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTime = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to send print-hi command
  const sendPrintHiCommand = async () => {
    try {
      const response = await fetch('/api/print-hi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('🎯 Print Hi command sent successfully!');
        setPrintHiTriggered(true);
        
        // Reset the flag after 3 seconds
        setTimeout(() => {
          setPrintHiTriggered(false);
        }, 3000);
      } else {
        console.error('Failed to send Print Hi command:', result.message);
      }
    } catch (error) {
      console.error('Error sending Print Hi command:', error);
    }
  };

  // Function to check beta:alpha ratio condition
  const checkBetaAlphaCondition = (newData: ParsedArduinoData) => {
    if (!newData.betaAlphaRatio) return;

    // Add to recent data (keep last 3 seconds worth)
    setRecentData(prev => {
      const updated = [...prev, newData];
      // Assuming data comes every 500ms, keep last 6 data points for 3 seconds
      return updated.slice(-6);
    });

    // Add to baseline data (keep first 10 seconds worth)
    setBaselineData(prev => {
      if (prev.length < 20) { // Assuming data comes every 500ms, 20 points = 10 seconds
        return [...prev, newData];
      }
      return prev; // Keep baseline as first 10 seconds
    });

    // Calculate baseline if we have enough data
    if (baselineData.length >= 20 && baselineBetaAlpha === null) {
      const avgBaseline = baselineData
        .filter(d => d.betaAlphaRatio)
        .reduce((sum, d) => sum + d.betaAlphaRatio!, 0) / baselineData.length;
      
      setBaselineBetaAlpha(avgBaseline);
      console.log('📊 Baseline beta:alpha ratio established:', avgBaseline.toFixed(2));
    }

    // Check condition if we have baseline and recent data
    if (baselineBetaAlpha !== null && recentData.length >= 6) {
      const recentAvg = recentData
        .filter(d => d.betaAlphaRatio)
        .reduce((sum, d) => sum + d.betaAlphaRatio!, 0) / recentData.length;

      console.log('📈 Current 3s avg:', recentAvg.toFixed(2), 'vs Baseline:', baselineBetaAlpha.toFixed(2));

      // Trigger print-hi if recent average exceeds baseline
      if (recentAvg > baselineBetaAlpha && !printHiTriggered) {
        console.log('🚨 Beta:Alpha ratio exceeded baseline! Triggering print-hi...');
        sendPrintHiCommand();
      }
    }
  };

  // Function to fetch data from API
  const fetchDataFromAPI = async () => {
    try {
      const response = await fetch('/api/arduino-serial-stream');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const newData = result.data;
          setData(newData);
          setLastUpdate(new Date().toLocaleTimeString());
          setDataHistory(prev => [...prev.slice(-49), newData]);
          setConnected(true);

          // Add to recording if active
          if (isRecording) {
            setRecordedData(prev => [...prev, newData]);
          }

          // Check beta:alpha ratio condition
          checkBetaAlphaCondition(newData);
        } else {
          setConnected(false);
        }
      } else {
        setConnected(false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setConnected(false);
    }
  };

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        console.log('🚀 Initializing Enhanced Stress Detection Dashboard...');
        
        // Initialize the processor
        await fetch('/api/arduino-serial-stream', {
          method: 'POST'
        });

        console.log('✅ Processor initialized, starting data polling...');

        // Start polling for data every 500ms
        pollingIntervalRef.current = setInterval(() => {
          fetchDataFromAPI();
        }, 500);

        // Fetch initial data
        fetchDataFromAPI();

      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    };

    initializeConnection();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Manual print hi function for testing
  const manualPrintHi = () => {
    sendPrintHiCommand();
  };

  // Recording functions
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    setRecordedData([]);
    recordingStartTime.current = Date.now();
    
    console.log('🔴 Started recording stress data for 10 minutes...');
    
    // Timer for recording duration
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prevTime => {
        const newTime = prevTime + 1;
        
        // Stop recording after 10 minutes (600 seconds)
        if (newTime >= 600) {
          stopRecording();
          return 600;
        }
        
        return newTime;
      });
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    // Create session record
    const session: RecordedSession = {
      sessionId: `session_${Date.now()}`,
      startTime: recordingStartTime.current,
      endTime: Date.now(),
      duration: Math.round(recordingTime / 60 * 10) / 10, // Duration in minutes
      dataPoints: [...recordedData],
      metadata: {
        totalSamples: recordedData.length,
        averageStress: recordedData.length > 0 ? 
          Math.round(recordedData.reduce((sum, d) => sum + (d.stressLevel || 0), 0) / recordedData.length) : 0,
        averageHeartRate: recordedData.length > 0 ? 
          Math.round(recordedData.reduce((sum, d) => sum + (d.heartRate || 0), 0) / recordedData.length) : 0,
        averageBetaAlpha: recordedData.length > 0 ? 
          Math.round(recordedData.reduce((sum, d) => sum + (d.betaAlphaRatio || 0), 0) / recordedData.length * 100) / 100 : 0,
      }
    };
    
    setCompletedSessions(prev => [...prev, session]);
    
    console.log('⏹️ Recording completed!', session);
    
    // Reset recording data
    setRecordedData([]);
    setRecordingTime(0);
  };

  const downloadRecordedData = (session: RecordedSession) => {
    const dataStr = JSON.stringify(session, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `stress_session_${new Date(session.startTime).toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const viewRecordedSession = (session: RecordedSession) => {
    setSelectedSession(session);
    setShowRecordedData(true);
  };

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Utility functions (keep existing ones)
  const getStressColor = (level?: number): string => {
    if (!level) return 'bg-gray-500';
    if (level < 25) return 'bg-green-500';
    if (level < 50) return 'bg-yellow-500';
    if (level < 75) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStressCategory = (level?: number): string => {
    if (!level) return 'Unknown';
    if (level < 25) return 'Low';
    if (level < 50) return 'Moderate';
    if (level < 75) return 'High';
    return 'Critical';
  };

  const getQualityColor = (quality?: number): string => {
    if (!quality) return 'bg-gray-500';
    if (quality > 70) return 'bg-green-500';
    if (quality > 50) return 'bg-yellow-500';
    if (quality > 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getQualityCategory = (quality?: number): string => {
    if (!quality) return 'Unknown';
    if (quality > 70) return 'Excellent';
    if (quality > 50) return 'Good';
    if (quality > 30) return 'Fair';
    return 'Poor';
  };

  // Calculate averages from history
  const getAverageHeartRate = (): number => {
    const validHRs = dataHistory.filter(d => d.heartRate).map(d => d.heartRate!);
    if (validHRs.length === 0) return 0;
    return Math.round(validHRs.reduce((a, b) => a + b, 0) / validHRs.length);
  };

  const getAverageBetaAlphaRatio = (): number => {
    const validRatios = dataHistory.filter(d => d.betaAlphaRatio).map(d => d.betaAlphaRatio!);
    if (validRatios.length === 0) return 0;
    return validRatios.reduce((a, b) => a + b, 0) / validRatios.length;
  };

  const getAverageStressLevel = (): number => {
    const validStress = dataHistory.filter(d => d.stressLevel).map(d => d.stressLevel!);
    if (validStress.length === 0) return 0;
    return Math.round(validStress.reduce((a, b) => a + b, 0) / validStress.length);
  };

  const getAverageSignalQuality = (): number => {
    const validQuality = dataHistory.filter(d => d.signalQuality).map(d => d.signalQuality!);
    if (validQuality.length === 0) return 0;
    return Math.round(validQuality.reduce((a, b) => a + b, 0) / validQuality.length);
  };

  if (showRecordedData && selectedSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header for recorded session */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              📊 Recorded Session Analysis
            </h1>
            <div className="flex items-center justify-center gap-4">
              <Badge className="bg-purple-500 text-white">
                Duration: {selectedSession.duration.toFixed(1)} minutes
              </Badge>
              <Badge className="bg-blue-500 text-white">
                Samples: {selectedSession.metadata.totalSamples}
              </Badge>
              <Button 
                onClick={() => setShowRecordedData(false)} 
                variant="outline"
                size="sm"
              >
                ← Back to Live Dashboard
              </Button>
            </div>
          </div>

          {/* Session Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Average Stress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {selectedSession.metadata.averageStress}%
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Average Heart Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {selectedSession.metadata.averageHeartRate}
                </div>
                <div className="text-sm text-gray-500">BPM</div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Average Beta/Alpha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {selectedSession.metadata.averageBetaAlpha}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Session Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  Started: {new Date(selectedSession.startTime).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  Ended: {new Date(selectedSession.endTime).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Data Visualization */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>📈 Session Data Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-center space-x-1 overflow-x-auto">
                {selectedSession.dataPoints.slice(0, 100).map((point, index) => (
                  <div
                    key={index}
                    className={`w-2 ${getStressColor(point.stressLevel)} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                    style={{
                      height: `${Math.max(8, (point.stressLevel || 0) * 2.5)}px`
                    }}
                    title={`Time: ${Math.round(index * selectedSession.duration * 10 / selectedSession.dataPoints.length)}min, Stress: ${point.stressLevel}%`}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2 text-center">
                Stress levels over session (first 100 data points)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Floating Recording Button */}
        <div className="fixed bottom-8 right-8 z-50">
          <div className="flex flex-col items-end space-y-4">
            {/* Recording Status */}
            {isRecording && (
              <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
                <div className="text-sm font-semibold">🔴 RECORDING</div>
                <div className="text-lg font-bold">{formatRecordingTime(recordingTime)}</div>
                <div className="text-xs">/ 10:00</div>
                <Progress 
                  value={(recordingTime / 600) * 100} 
                  className="mt-1 h-2"
                />
              </div>
            )}

            {/* Recording Controls */}
            <div className="flex flex-col space-y-2">
              {/* Manual Print Hi Button */}
              <Button
                onClick={manualPrintHi}
                className={`${printHiTriggered ? 'bg-green-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-full p-4 shadow-lg`}
                disabled={!connected}
              >
                <div className="flex flex-col items-center">
                  <div className="text-2xl">👋</div>
                  <div className="text-xs">Print Hi</div>
                </div>
              </Button>

              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 shadow-lg"
                  disabled={!connected}
                >
                  <div className="flex flex-col items-center">
                    <div className="text-2xl">🔴</div>
                    <div className="text-xs">Record</div>
                  </div>
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-4 shadow-lg"
                >
                  <div className="flex flex-col items-center">
                    <div className="text-2xl">⏹️</div>
                    <div className="text-xs">Stop</div>
                  </div>
                </Button>
              )}

              {/* Sessions Button */}
              {completedSessions.length > 0 && (
                <Button
                  onClick={() => setShowRecordedData(true)}
                  className="bg-purple-500 hover:bg-purple-600 text-white rounded-full p-4 shadow-lg"
                >
                  <div className="flex flex-col items-center">
                    <div className="text-2xl">📊</div>
                    <div className="text-xs">{completedSessions.length}</div>
                  </div>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Panel */}
        {completedSessions.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>📁 Recorded Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedSessions.map((session, index) => (
                  <div key={session.sessionId} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">Session {index + 1}</h4>
                      <Badge className="bg-blue-500 text-white text-xs">
                        {session.duration.toFixed(1)}min
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      <div>Avg Stress: {session.metadata.averageStress}%</div>
                      <div>Avg HR: {session.metadata.averageHeartRate} BPM</div>
                      <div>Samples: {session.metadata.totalSamples}</div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => viewRecordedSession(session)}
                        size="sm"
                        variant="outline"
                      >
                        👁️ View
                      </Button>
                      <Button
                        onClick={() => downloadRecordedData(session)}
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        💾 Export
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🧠 Enhanced Stress Detection Dashboard
          </h1>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-600">
                {connected ? 'Precise Analysis Active' : 'Connecting...'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Last update: {lastUpdate || 'Never'}
            </div>
            {data?.signalQuality && (
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getQualityColor(data.signalQuality)}`}></div>
                <span className="text-xs text-gray-500">
                  Signal: {getQualityCategory(data.signalQuality)}
                </span>
              </div>
            )}
            {/* Beta:Alpha Monitoring Status */}
            <div className="flex items-center gap-2 bg-purple-50 px-3 py-1 rounded-full">
              <div className={`w-3 h-3 rounded-full ${printHiTriggered ? 'bg-red-500 animate-pulse' : baselineBetaAlpha !== null ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="text-xs text-gray-600">
                {printHiTriggered ? 'Print Hi Triggered!' : 
                 baselineBetaAlpha !== null ? 'Beta:Alpha Monitoring Active' : 'Establishing Baseline...'}
              </span>
            </div>
            {baselineBetaAlpha !== null && (
              <div className="text-xs text-gray-500">
                Baseline: {baselineBetaAlpha.toFixed(2)} | Current: {data?.betaAlphaRatio?.toFixed(2) || 'N/A'}
              </div>
            )}
          </div>
        </div>

        {/* Rest of your existing dashboard content... */}
        {data ? (
          <>
            {/* Main Metrics - Enhanced */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Existing metric cards... */}
              
              {/* Stress Level */}
              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    🎯 Stress Level
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-gray-900">
                      {data.stressLevel ? `${data.stressLevel}%` : 'N/A'}
                    </div>
                    <Badge className={`${getStressColor(data.stressLevel)} text-white`}>
                      {getStressCategory(data.stressLevel)}
                    </Badge>
                  </div>
                  <Progress value={data.stressLevel || 0} className="mt-2" />
                  <div className="text-xs text-gray-500 mt-1">
                    Avg: {getAverageStressLevel()}%
                  </div>
                </CardContent>
              </Card>

              {/* Heart Rate */}
              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    ❤️ Heart Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">
                    {data.heartRate || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500">BPM</div>
                  <div className="text-xs text-gray-500 mt-1">
                    RR: {data.rrInterval ? `${data.rrInterval.toFixed(0)}ms` : 'No ECG'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Avg: {getAverageHeartRate()} BPM
                  </div>
                </CardContent>
              </Card>

              {/* Beta/Alpha Ratio */}
              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    🌊 Beta/Alpha Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {data.betaAlphaRatio ? data.betaAlphaRatio.toFixed(2) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500">EEG Activity</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Higher = More Stress
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Avg: {getAverageBetaAlphaRatio().toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              {/* Signal Quality */}
              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    📡 Signal Quality
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${data.signalQuality && data.signalQuality > 50 ? 'text-green-600' : 'text-orange-600'}`}>
                    {data.signalQuality ? `${Math.round(data.signalQuality)}%` : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {getQualityCategory(data.signalQuality)}
                  </div>
                  <Progress value={data.signalQuality || 0} className="mt-2" />
                  <div className="text-xs text-gray-400 mt-1">
                    Avg: {getAverageSignalQuality()}%
                  </div>
                </CardContent>
              </Card>

              {/* Data Stream Status */}
              <Card className="shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    🔄 Data Stream
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${connected ? 'text-green-600' : 'text-red-600'}`}>
                    {connected ? 'LIVE' : 'OFF'}
                  </div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Samples: {dataHistory.length}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Updated: {lastUpdate}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* EEG Frequency Bands Visualization */}
            {data.eegBands && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>🧠 EEG Frequency Band Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-red-50 rounded-lg border-2 border-red-200">
                      <div className="text-3xl font-bold text-red-600">
                        {(data.eegBands.delta * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm font-semibold text-gray-700">Delta</div>
                      <div className="text-xs text-gray-500">0.5-4 Hz</div>
                      <div className="text-xs text-gray-400">Deep Sleep</div>
                    </div>

                    <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <div className="text-3xl font-bold text-blue-600">
                        {(data.eegBands.theta * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm font-semibold text-gray-700">Theta</div>
                      <div className="text-xs text-gray-500">4-8 Hz</div>
                      <div className="text-xs text-gray-400">Creativity</div>
                    </div>

                    <div className="text-center p-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                      <div className="text-3xl font-bold text-yellow-600">
                        {(data.eegBands.alpha * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm font-semibold text-gray-700">Alpha</div>
                      <div className="text-xs text-gray-500">8-13 Hz</div>
                      <div className="text-xs text-gray-400">Relaxation</div>
                    </div>

                    <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                      <div className="text-3xl font-bold text-green-600">
                        {(data.eegBands.beta * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm font-semibold text-gray-700">Beta</div>
                      <div className="text-xs text-gray-500">13-30 Hz</div>
                      <div className="text-xs text-gray-400">Focus/Stress</div>
                    </div>

                    <div className="text-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <div className="text-3xl font-bold text-purple-600">
                        {(data.eegBands.gamma * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm font-semibold text-gray-700">Gamma</div>
                      <div className="text-xs text-gray-500">30-45 Hz</div>
                      <div className="text-xs text-gray-400">High Cognitive</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Beta/Alpha Balance Visualization */}
            {data.eegBands && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>⚖️ Beta/Alpha Balance Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-80 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-6">
                    
                    {/* Beta (Upward from center) */}
                    <div className="flex flex-col items-center w-full">
                      <div className="text-xs font-semibold text-blue-600 mb-1">BETA ACTIVITY</div>
                      <div className="relative w-32 flex flex-col items-center">
                        {/* Beta percentage display */}
                        <div className="text-lg font-bold text-blue-600 mb-2">
                          {(data.eegBands.beta * 100).toFixed(1)}%
                        </div>
                        
                        {/* Beta bar extending upward */}
                        <div className="w-12 bg-gray-200 rounded-t-lg relative overflow-hidden">
                          <div 
                            className="w-full bg-gradient-to-t from-blue-400 to-blue-600 transition-all duration-1000 ease-out absolute bottom-0"
                            style={{
                              height: `${Math.max(8, data.eegBands.beta * 120)}px`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Center line and ratio display */}
                    <div className="my-4 w-full flex items-center justify-center relative">
                      <div className="absolute w-full h-0.5 bg-gray-400"></div>
                      <div className="bg-white px-6 py-2 rounded-full border-2 border-purple-300 shadow-lg z-10">
                        <div className="text-xs text-gray-600">Ratio</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {data.betaAlphaRatio ? data.betaAlphaRatio.toFixed(2) : '0.00'}
                        </div>
                      </div>
                    </div>

                    {/* Alpha (Downward from center) */}
                    <div className="flex flex-col items-center w-full">
                      <div className="relative w-32 flex flex-col items-center">
                        {/* Alpha bar extending downward */}
                        <div className="w-12 bg-gray-200 rounded-b-lg relative overflow-hidden">
                          <div 
                            className="w-full bg-gradient-to-b from-red-400 to-red-600 transition-all duration-1000 ease-out absolute top-0"
                            style={{
                              height: `${Math.max(8, data.eegBands.alpha * 120)}px`
                            }}
                          />
                        </div>
                        
                        {/* Alpha percentage display */}
                        <div className="text-lg font-bold text-red-600 mt-2">
                          {(data.eegBands.alpha * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-red-600 mt-1">ALPHA ACTIVITY</div>
                    </div>

                    {/* Status indicator */}
                    <div className="absolute top-4 right-4">
                      <Badge className={`${
                        data.betaAlphaRatio && data.betaAlphaRatio > 2.0 ? 'bg-red-500' : 
                        data.betaAlphaRatio && data.betaAlphaRatio > 1.5 ? 'bg-orange-500' :
                        data.betaAlphaRatio && data.betaAlphaRatio > 1.0 ? 'bg-yellow-500' : 'bg-green-500'
                      } text-white text-xs`}>
                        {data.betaAlphaRatio && data.betaAlphaRatio > 2.0 ? 'HIGH STRESS' : 
                         data.betaAlphaRatio && data.betaAlphaRatio > 1.5 ? 'MODERATE' :
                         data.betaAlphaRatio && data.betaAlphaRatio > 1.0 ? 'MILD' : 'RELAXED'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                      <span>Beta: Focus, Stress, Active Thinking</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
                      <span>Alpha: Relaxation, Calm, Meditation</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stress Level Trend */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>📈 Stress Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end justify-center space-x-1 overflow-hidden">
                    {dataHistory.slice(-30).map((d, index) => (
                      <div
                        key={d.timestamp}
                        className={`w-3 ${getStressColor(d.stressLevel)} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                        style={{
                          height: `${Math.max(8, (d.stressLevel || 0) * 1.8)}px`
                        }}
                        title={`${d.stressLevel}% at ${new Date(d.timestamp).toLocaleTimeString()}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    Last 30 readings
                  </div>
                </CardContent>
              </Card>

              {/* Heart Rate Trend */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>💓 Heart Rate Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end justify-center space-x-1 overflow-hidden">
                    {dataHistory.slice(-30).map((d, index) => (
                      <div
                        key={d.timestamp}
                        className="w-3 bg-red-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                        style={{
                          height: `${Math.max(8, ((d.heartRate || 60) - 40) * 3)}px`
                        }}
                        title={`${d.heartRate} BPM at ${new Date(d.timestamp).toLocaleTimeString()}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    Range: 40-140 BPM
                  </div>
                </CardContent>
              </Card>

              {/* Signal Quality Trend */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>📶 Signal Quality Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end justify-center space-x-1 overflow-hidden">
                    {dataHistory.slice(-30).map((d, index) => (
                      <div
                        key={d.timestamp}
                        className={`w-3 ${getQualityColor(d.signalQuality)} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                        style={{
                          height: `${Math.max(8, (d.signalQuality || 0) * 1.8)}px`
                        }}
                        title={`${Math.round(d.signalQuality || 0)}% at ${new Date(d.timestamp).toLocaleTimeString()}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    Signal reliability
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Live Data Display */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>🔬 Live Physiological Data Stream</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                  <div className="text-yellow-400 mb-3">Enhanced Real-time Analysis</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-cyan-400 mb-2">EEG Analysis:</div>
                      <div>beta_alpha_ratio: {data.betaAlphaRatio?.toFixed(4) || 'processing...'}</div>
                      <div>signal_quality: {data.signalQuality?.toFixed(1) || 'assessing...'}%</div>
                      {data.eegBands && (
                        <>
                          <div>alpha_power: {(data.eegBands.alpha * 100).toFixed(2)}%</div>
                          <div>beta_power: {(data.eegBands.beta * 100).toFixed(2)}%</div>
                        </>
                      )}
                    </div>
                    <div>
                      <div className="text-pink-400 mb-2">ECG Analysis:</div>
                      <div>heart_rate: {data.heartRate || 'calculating...'}bpm</div>
                      <div>rr_interval: {data.rrInterval?.toFixed(1) || 'no signal'}ms</div>
                      <div>stress_level: {data.stressLevel || 'computing...'}%</div>
                    </div>
                  </div>
                  <div className="text-gray-500 mt-4 pt-2 border-t border-gray-700">
                    timestamp: {new Date(data.timestamp).toLocaleString()} | 
                    quality: {getQualityCategory(data.signalQuality)} | 
                    status: {getStressCategory(data.stressLevel)} stress
                    {isRecording && <span className="text-red-400 ml-4">🔴 RECORDING</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="shadow-lg">
            <CardContent className="text-center py-12">
              <div className="text-gray-500 text-lg">
                {connected ? '🔄 Processing sensor signals...' : '🔌 Connecting to enhanced stress detection...'}
              </div>
              <div className="text-xs text-gray-400 mt-4">
                <div>Expected JSON format:</div>
                <div className="font-mono bg-gray-100 p-2 mt-2 rounded text-left inline-block">
                  {`{"timestamp": 12345, "samples": 10, "sampleRate": 250,`}<br/>
                  {` "eeg": [512, 515, 510, ...], "ecg": [600, 605, ...]}`}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EnhancedArduinoStressDashboard;
