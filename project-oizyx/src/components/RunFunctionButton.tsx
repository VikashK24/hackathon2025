import React, { useRef } from "react";

export default function RunFunctionButton() {
  const socketRef = useRef<WebSocket | null>(null);

  React.useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:8080");
    return () => {
      socketRef.current?.close();
    };
  }, []);

  function handleClick() {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "run_function" }));
      console.log("Sent run_function message");
    } else {
      console.log("WebSocket not connected");
    }
  }

  return (
    <button onClick={handleClick}>
      Run Function
    </button>
  );
}
