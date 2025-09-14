#include <math.h>

#define SAMPLE_RATE 512 // 500 samples per second
#define FFT_SIZE 256    // FFT resolution: 256 samples
#define BAUD_RATE 115200
#define INPUT_PIN A0

#define SAMPLE_RATE 125
#define BAUD_RATE 115200
#define HRV_INPUT_PIN A1
#define BUZZER_PIN 8    //Can connect external buzzer at digital pin 8 for boards other than Maker Uno
#define OUTPUT_PIN 13
#define DATA_LENGTH 16

// EEG Frequency Bands
#define DELTA_LOW 0.5
#define DELTA_HIGH 4.0
#define THETA_LOW 4.0
#define THETA_HIGH 8.0
#define ALPHA_LOW 8.0
#define ALPHA_HIGH 13.0
#define BETA_LOW 13.0
#define BETA_HIGH 30.0
#define GAMMA_LOW 30.0
#define GAMMA_HIGH 45.0



// Smoothing factor (0.0 to 1.0) - Lower values = more smoothing
#define SMOOTHING_FACTOR 0.63
const float EPS = 1e-6f; // small guard value against divide-by-zero

int data_index = 0;
bool peak = false;

unsigned long lastPeakTime = 0;
unsigned long currentRRInterval = 0;
bool firstPeak = true;

// Structure to hold bandpower results
typedef struct
{
  float delta;
  float theta;
  float alpha;
  float beta;
  float gamma;
  float total;
} BandpowerResults;

// Structure for smoothed bandpower values
typedef struct
{
  float delta;
  float theta;
  float alpha;
  float beta;
  float gamma;
  float total;
} SmoothedBandpower;

SmoothedBandpower smoothedPowers = {0}; // Global smoothed values

// --- Filter Functions ---
// Band-Stop Butterworth IIR digital filter, generated using filter_gen.py.
// Sampling rate: 500.0 Hz, frequency: [48.0, 52.0] Hz.
// Filter is order 2, implemented as second-order sections (biquads).
// Reference: https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.butter.html
float Notch(float input)
{
  float output = input;
  {
    static float z1 = 0, z2 = 0;
    float x = output - (-1.56858163f * z1) - (0.96424138f * z2);
    output = 0.96508099f * x + (-1.56202714f * z1) + (0.96508099f * z2);
    z2 = z1;
    z1 = x;
  }
  {
    static float z1 = 0, z2 = 0;
    float x = output - (-1.61100358f * z1) - (0.96592171f * z2);
    output = 1.00000000f * x + (-1.61854514f * z1) + (1.00000000f * z2);
    z2 = z1;
    z1 = x;
  }
  return output;
}

// Low-Pass Butterworth IIR digital filter, generated using filter_gen.py.
// Sampling rate: 500.0 Hz, frequency: 45.0 Hz.
// Filter is order 2, implemented as second-order sections (biquads).
// Reference: https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.butter.html
float EEGFilter(float input)
{
  float output = input;
  {
    static float z1, z2;
    float x = output - -1.22465158 * z1 - 0.45044543 * z2;
    output = 0.05644846 * x + 0.11289692 * z1 + 0.05644846 * z2;
    z2 = z1;
    z1 = x;
  }
  return output;
}

// --- FFT Setup ---
float inputBuffer[FFT_SIZE];
float fftOutputBuffer[FFT_SIZE];
float powerSpectrum[FFT_SIZE / 2];

volatile uint16_t sampleIndex = 0;
volatile bool bufferReady = false;

// Apply exponential moving average smoothing
void smoothBandpower(BandpowerResults *raw, SmoothedBandpower *smoothed)
{
  smoothed->delta = SMOOTHING_FACTOR * raw->delta + (1 - SMOOTHING_FACTOR) * smoothed->delta;
  smoothed->theta = SMOOTHING_FACTOR * raw->theta + (1 - SMOOTHING_FACTOR) * smoothed->theta;
  smoothed->alpha = SMOOTHING_FACTOR * raw->alpha + (1 - SMOOTHING_FACTOR) * smoothed->alpha;
  smoothed->beta = SMOOTHING_FACTOR * raw->beta + (1 - SMOOTHING_FACTOR) * smoothed->beta;
  smoothed->gamma = SMOOTHING_FACTOR * raw->gamma + (1 - SMOOTHING_FACTOR) * smoothed->gamma;
  smoothed->total = SMOOTHING_FACTOR * raw->total + (1 - SMOOTHING_FACTOR) * smoothed->total;
}

// Calculate bandpower for different frequency bands
BandpowerResults calculateBandpower(float *powerSpectrum, float binResolution, uint16_t halfSize)
{
  BandpowerResults results = {0};

  for (uint16_t i = 1; i < halfSize; i++)
  {
    float freq = i * binResolution;
    float power = powerSpectrum[i];
    results.total += power;

    if (freq >= DELTA_LOW && freq < DELTA_HIGH)
    {
      results.delta += power;
    }
    else if (freq >= THETA_LOW && freq < THETA_HIGH)
    {
      results.theta += power;
    }
    else if (freq >= ALPHA_LOW && freq < ALPHA_HIGH)
    {
      results.alpha += power;
    }
    else if (freq >= BETA_LOW && freq < BETA_HIGH)
    {
      results.beta += power;
    }
    else if (freq >= GAMMA_LOW && freq < GAMMA_HIGH)
    {
      results.gamma += power;
    }
  }

  return results;
}

// Simple FFT implementation (replaces ARM math)
void simpleFFT(float* input, float* output, int n) {
  // This is a simplified FFT - for production use, consider a proper FFT library
  // For now, we'll use a basic implementation that works for power-of-2 sizes
  if (n <= 1) {
    output[0] = input[0];
    output[1] = 0;
    return;
  }
  
  // Bit-reverse permutation
  for (int i = 0; i < n; i++) {
    int j = 0;
    for (int k = 0; k < 8; k++) { // Assuming n <= 256
      j = (j << 1) | ((i >> k) & 1);
    }
    if (i < j) {
      float temp = input[2*i];
      input[2*i] = input[2*j];
      input[2*j] = temp;
      temp = input[2*i+1];
      input[2*i+1] = input[2*j+1];
      input[2*j+1] = temp;
    }
  }
  
  // FFT computation
  for (int len = 2; len <= n; len <<= 1) {
    float angle = -2 * PI / len;
    float wlen_real = cos(angle);
    float wlen_imag = sin(angle);
    for (int i = 0; i < n; i += len) {
      float w_real = 1;
      float w_imag = 0;
      
      for (int j = 0; j < len/2; j++) {
        float u_real = input[2*(i+j)];
        float u_imag = input[2*(i+j)+1];
        float v_real = input[2*(i+j+len/2)] * w_real - input[2*(i+j+len/2)+1] * w_imag;
        float v_imag = input[2*(i+j+len/2)] * w_imag + input[2*(i+j+len/2)+1] * w_real;
        
        input[2*(i+j)] = u_real + v_real;
        input[2*(i+j)+1] = u_imag + v_imag;
        input[2*(i+j+len/2)] = u_real - v_real;
        input[2*(i+j+len/2)+1] = u_imag - v_imag;
        
        float next_w_real = w_real * wlen_real - w_imag * wlen_imag;
        float next_w_imag = w_real * wlen_imag + w_imag * wlen_real;
        w_real = next_w_real;
        w_imag = next_w_imag;
      }
    }
  }
  
  // Copy to output
  for (int i = 0; i < n; i++) {
    output[2*i] = input[2*i];
    output[2*i+1] = input[2*i+1];
  }
}

// Process FFT and calculate bandpower
void processFFT()
{
  // Prepare input buffer (interleaved real/imaginary)
  float fftInput[FFT_SIZE * 2];
  for (int i = 0; i < FFT_SIZE; i++) {
    fftInput[2*i] = inputBuffer[i];
    fftInput[2*i+1] = 0; // imaginary part
  }
  
  // Compute FFT
  simpleFFT(fftInput, fftOutputBuffer, FFT_SIZE);

  // Compute magnitudes and power spectrum
  uint16_t halfSize = FFT_SIZE / 2;
  for (uint16_t i = 0; i < halfSize; i++)
  {
    float real = fftOutputBuffer[2 * i];
    float imag = fftOutputBuffer[2 * i + 1];
    powerSpectrum[i] = real * real + imag * imag;
  }

  // Frequency resolution
  float binResolution = (float)SAMPLE_RATE / FFT_SIZE;

  // Calculate raw bandpower
  BandpowerResults rawBandpower = calculateBandpower(powerSpectrum, binResolution, halfSize);

  // Apply smoothing
  smoothBandpower(&rawBandpower, &smoothedPowers);

  Serial.print("betaperc_alphaperc_ratio:");
  Serial.print(((smoothedPowers.beta / (smoothedPowers.total + EPS)) * 100)/(smoothedPowers.alpha / (smoothedPowers.total + EPS)) * 100);

}

void setup()
{
  Serial.begin(BAUD_RATE);
  while (!Serial)
    ;

  pinMode(INPUT_PIN, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);

  // Setup Input & Output pin
  pinMode(HRV_INPUT_PIN, INPUT);
  pinMode(OUTPUT_PIN, OUTPUT);
}

void loop()
{
  static unsigned long past = 0;
  unsigned long present = micros();
  unsigned long interval = present - past;
  past = present;

  static long timer = 0;
  timer -= interval;
  if (timer < 0)
  {
    timer += 1000000 / SAMPLE_RATE;

    int rawSample = analogRead(INPUT_PIN);

    float sensor_value = analogRead(HRV_INPUT_PIN);
    float signal = ECGFilter(sensor_value)/512;

    peak = Getpeak(signal);

    Serial.print(signal);
    Serial.print(",");
    Serial.println(peak);

    digitalWrite(OUTPUT_PIN, peak);
  // Blink LED and buzz on peak
    digitalWrite(OUTPUT_PIN, peak);

    if (peak) {
        tone(BUZZER_PIN, 1000, 10); // 1000 Hz tone for 50 ms
        unsigned long currentTime = micros();
        if (!firstPeak) {
            currentRRInterval = currentTime - lastPeakTime; // RR interval in microseconds
            // Convert to milliseconds for easier filtering
            float rrIntervalMs = currentRRInterval / 1000.0;
            
            // Filter and print RR intervals based on size
            if (rrIntervalMs >= 400 && rrIntervalMs <= 2000) { // Normal RR range: 400-2000ms
                Serial.print("RR");
                Serial.print(rrIntervalMs);
            }
        }
        lastPeakTime = currentTime;
        firstPeak = false;
    } else {
        noTone(BUZZER_PIN);
    }

    float filteredSample = EEGFilter(Notch(rawSample));

    if (sampleIndex < FFT_SIZE)
    {
      inputBuffer[sampleIndex++] = filteredSample;
    }
    if (sampleIndex >= FFT_SIZE)
    {
      bufferReady = true;
    }
  }

  if (bufferReady)
  {
    processFFT();
    sampleIndex = 0;
    bufferReady = false;
  }
}


bool Getpeak(float new_sample) {
  // Buffers for data, mean, and standard deviation
  static float data_buffer[DATA_LENGTH];
  static float mean_buffer[DATA_LENGTH];
  static float standard_deviation_buffer[DATA_LENGTH];
  
  // Check for peak
  if (new_sample - mean_buffer[data_index] > (DATA_LENGTH/2) * standard_deviation_buffer[data_index]) {
    data_buffer[data_index] = new_sample + data_buffer[data_index];
    peak = true;
  } else {
    data_buffer[data_index] = new_sample;
    peak = false;
  }

  // Calculate mean
  float sum = 0.0, mean, standard_deviation = 0.0;
  for (int i = 0; i < DATA_LENGTH; ++i){
    sum += data_buffer[(data_index + i) % DATA_LENGTH];
  }
  mean = sum/DATA_LENGTH;

  // Calculate standard deviation
  for (int i = 0; i < DATA_LENGTH; ++i){
    standard_deviation += pow(data_buffer[(i) % DATA_LENGTH] - mean, 2);
  }

  // Update mean buffer
  mean_buffer[data_index] = mean;

  // Update standard deviation buffer
  standard_deviation_buffer[data_index] =  sqrt(standard_deviation/DATA_LENGTH);

  // Update data_index
  data_index = (data_index+1)%DATA_LENGTH;

  // Return peak
  return peak;
}

float ECGFilter(float input)
{
  float output = input;
  {
    static float z1, z2; // filter section state
    float x = output - 0.70682283*z1 - 0.15621030*z2;
    output = 0.28064917*x + 0.56129834*z1 + 0.28064917*z2;
    z2 = z1;
    z1 = x;
  }
  {
    static float z1, z2; // filter section state
    float x = output - 0.95028224*z1 - 0.54073140*z2;
    output = 1.00000000*x + 2.00000000*z1 + 1.00000000*z2;
    z2 = z1;
    z1 = x;
  }
  {
    static float z1, z2; // filter section state
    float x = output - -1.95360385*z1 - 0.95423412*z2;
    output = 1.00000000*x + -2.00000000*z1 + 1.00000000*z2;
    z2 = z1;
    z1 = x;
  }
  {
    static float z1, z2; // filter section state
    float x = output - -1.98048558*z1 - 0.98111344*z2;
    output = 1.00000000*x + -2.00000000*z1 + 1.00000000*z2;
    z2 = z1;
    z1 = x;
  }
  return output;
}
