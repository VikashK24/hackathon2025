// app/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Heart, Activity, Brain, Shield } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            {/* Animated pulse icon */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                  <Activity className="w-10 h-10 text-white" />
                </div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-blue-200 rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Main heading */}
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Monitor Your{" "}
              {/* <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"> */}
              Stress Levels
              {/* </span>{" "} */}
              in Real-Time
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Advanced AI-powered stress detection using Electroencephalogram(EEG) and Electrocardiogram(ECG) signals. Our device also analyzes heart rate variability,
              skin conductance, and breathing patterns to help you maintain optimal wellness.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/project">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
                  Start Monitoring
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="px-8 py-4 text-lg rounded-full border-2 border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          {/* <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Our Stress Detector?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Cutting-edge technology meets intuitive design for comprehensive stress monitoring
            </p>
          </div> */}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-red-400 to-pink-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Heart Rate Monitoring
              </h3>
              <p className="text-gray-600">
                Real-time HRV analysis using photoplethysmography for accurate stress detection
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Breathing Analysis
              </h3>
              <p className="text-gray-600">
                Thermistor-based respiration rate tracking to identify stress patterns
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                AI-Powered Analysis
              </h3>
              <p className="text-gray-600">
                Machine learning algorithms process multiple biomarkers for precise stress level assessment
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Safe & Secure
              </h3>
              <p className="text-gray-600">
                Battery-powered isolation ensures complete safety during bioelectric monitoring
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {/* <section className="py-20 px-4 bg-white">
        <div className="container mx-auto text-center">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="p-8">
              <div className="text-4xl font-bold text-blue-600 mb-2">98%</div>
              <div className="text-gray-600">Accuracy Rate</div>
            </div>
            <div className="p-8">
              <div className="text-4xl font-bold text-purple-600 mb-2">24/7</div>
              <div className="text-gray-600">Continuous Monitoring</div>
            </div>
            <div className="p-8">
              <div className="text-4xl font-bold text-green-600 mb-2">Real-Time</div>
              <div className="text-gray-600">Instant Results</div>
            </div>
          </div>
        </div>
      </section> */}
    </main>
  );
}
