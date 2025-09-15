import React, { useEffect, useRef } from "react";
import { processBetaAlphaRatioFactory } from "../lib/websocketBetaAlpha";

export default function BetaAlphaMonitor({ getSample }: { getSample: () => number }) {
  const processBetaAlphaRatio = useRef(processBetaAlphaRatioFactory());

  useEffect(() => {
    const interval = setInterval(() => {
      const sample = getSample(); // getSample should return the current beta/alpha value
      processBetaAlphaRatio.current(sample);
    }, 1000 / 250); // or your preferred sampling rate

    return () => clearInterval(interval);
  }, [getSample]);
  
  return null;
}
