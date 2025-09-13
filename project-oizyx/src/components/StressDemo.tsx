"use client";

import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StressDemo() {
  const [heartRate, setHeartRate] = useState(72);
  const [stressLevel, setStressLevel] = useState(20);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate(prev => prev + Math.floor(Math.random() * 10 - 5));
      setStressLevel(prev => Math.max(0, Math.min(100, prev + Math.floor(Math.random() * 20 - 10))));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStressColor = (level: number) => {
    if (level < 30) return "bg-green-500";
    if (level < 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStressLabel = (level: number) => {
    if (level < 30) return "Low Stress";
    if (level < 70) return "Moderate Stress";
    return "High Stress";
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            Heart Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-500">{heartRate} BPM</div>
          <p className="text-gray-600 mt-2">Real-time monitoring</p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Stress Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-3xl font-bold">{stressLevel}%</div>
            <Progress value={stressLevel} className="h-3" />
            <div className={`inline-block px-3 py-1 rounded-full text-white text-sm ${getStressColor(stressLevel)}`}>
              {getStressLabel(stressLevel)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
