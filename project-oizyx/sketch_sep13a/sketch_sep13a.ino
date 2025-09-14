#define BAUD_RATE 115200
#define EEG_INPUT_PIN A0
#define ECG_INPUT_PIN A1
#define SAMPLE_RATE 250
#define BUFFER_SIZE 10

int eegBuffer[BUFFER_SIZE];
int ecgBuffer[BUFFER_SIZE];
int bufferIndex = 0;

void setup() {
  Serial.begin(BAUD_RATE);
  while (!Serial);
  pinMode(EEG_INPUT_PIN, INPUT);
  pinMode(ECG_INPUT_PIN, INPUT);
  Serial.println("Raw Sensor Data Streaming Started");
}

void loop() {
  static unsigned long lastSample = 0;
  if (micros() - lastSample >= 4000) {
    lastSample = micros();
    
    eegBuffer[bufferIndex] = analogRead(EEG_INPUT_PIN);
    ecgBuffer[bufferIndex] = analogRead(ECG_INPUT_PIN);
    bufferIndex++;
    
    if (bufferIndex >= BUFFER_SIZE) {
      sendRawData();
      bufferIndex = 0;
    }
  }
}

void sendRawData() {
  Serial.print("{\"timestamp\":");
  Serial.print(millis());
  Serial.print(",\"samples\":");
  Serial.print(BUFFER_SIZE);
  Serial.print(",\"sampleRate\":");
  Serial.print(SAMPLE_RATE);
  Serial.print(",\"eeg\":[");
  
  for (int i = 0; i < BUFFER_SIZE; i++) {
    Serial.print(eegBuffer[i]);
    if (i < BUFFER_SIZE - 1) Serial.print(",");
  }
  
  Serial.print("],\"ecg\":[");
  
  for (int i = 0; i < BUFFER_SIZE; i++) {
    Serial.print(ecgBuffer[i]);
    if (i < BUFFER_SIZE - 1) Serial.print(",");
  }
  
  Serial.print("]}");
  Serial.println();
}
