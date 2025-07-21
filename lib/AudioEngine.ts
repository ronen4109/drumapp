class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private instrumentGains: (GainNode | null)[] = [];
  private buffers: (AudioBuffer | null)[] = [];
  private instruments: { name: string; sound: string; icon: string }[];

  // Sequencer state
  private isPlaying = false;
  private tempo = 120;
  private grid: boolean[][] = [];
  private stepCount = 16;
  private currentStep = 0;
  private stepsPerBeat = 4; // Default to 16th notes

  // Per-instrument volume state
  private previousInstrumentVolumes: number[] = [];

  // Scheduling
  private schedulerInterval: NodeJS.Timeout | null = null;
  private nextNoteTime = 0;
  private onStepChange: (step: number) => void = () => {};

  constructor(instruments: { name: string; sound: string; icon: string }[], onStepChange: (step: number) => void) {
    this.instruments = instruments;
    this.onStepChange = onStepChange;
    this.grid = instruments.map(() => Array(16).fill(false));
    this.previousInstrumentVolumes = instruments.map(() => 1); // Initialize with full volume
  }

  async init() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.connect(this.audioCtx.destination);

    this.instrumentGains = this.instruments.map((_, index) => {
      const gain = this.audioCtx!.createGain();
      gain.connect(this.masterGain!);
      // Set initial volume from previousInstrumentVolumes
      gain.gain.setValueAtTime(this.previousInstrumentVolumes[index], this.audioCtx.currentTime);
      return gain;
    });

    await this.loadBuffers();
    console.log("AudioEngine initialized.");
  }

  private async loadBuffers() {
    if (!this.audioCtx) return;
    console.log("Loading audio buffers...");
    const promises = this.instruments.map(async (inst) => {
      try {
        const res = await fetch(inst.sound);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);
        console.log(`Loaded ${inst.name}: ${inst.sound}`);
        return audioBuffer;
      } catch (e) {
        console.error(`Failed to load sound: ${inst.sound}`, e);
        return null;
      }
    });
    this.buffers = await Promise.all(promises);
    console.log("All audio buffers loaded.");
  }

  // --- Public API ---

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.resume();
    if (!this.audioCtx) return;
    console.log("AudioEngine started.");

    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    this.schedulerInterval = setInterval(() => this.scheduler(), 25); // lookahead
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.currentStep = 0;
    this.onStepChange(this.currentStep);
    console.log("AudioEngine stopped.");
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  setMasterVolume(volume: number) {
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      console.log(`Master volume set to: ${volume}`);
    }
  }

  setInstrumentVolume(instrumentIndex: number, volume: number) {
    if (this.instrumentGains[instrumentIndex] && this.audioCtx) {
      this.instrumentGains[instrumentIndex]!.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      this.previousInstrumentVolumes[instrumentIndex] = volume; // Update previous volume
      console.log(`Instrument ${this.instruments[instrumentIndex].name} volume set to: ${volume}`);
    }
  }

  setInstrumentMute(instrumentIndex: number, isMuted: boolean) {
    if (this.instrumentGains[instrumentIndex] && this.audioCtx) {
      if (isMuted) {
        // Save current volume before muting
        this.previousInstrumentVolumes[instrumentIndex] = this.instrumentGains[instrumentIndex]!.gain.value;
        this.instrumentGains[instrumentIndex]!.gain.setValueAtTime(0, this.audioCtx.currentTime);
      } else {
        // Restore previous volume when unmuting
        this.instrumentGains[instrumentIndex]!.gain.setValueAtTime(this.previousInstrumentVolumes[instrumentIndex], this.audioCtx.currentTime);
      }
      console.log(`Instrument ${this.instruments[instrumentIndex].name} muted: ${isMuted}`);
    }
  }

  setTempo(tempo: number) {
    this.tempo = tempo;
    console.log(`Tempo set to: ${tempo}`);
  }

  setGrid(grid: boolean[][]) {
    this.grid = grid;
    // console.log("Grid updated."); // Too verbose
  }

  setStepCount(count: number) {
    this.stepCount = count;
    console.log(`Step count set to: ${count}`);
  }

  setStepsPerBeat(steps: number) {
    this.stepsPerBeat = steps;
    console.log(`Steps per beat set to: ${steps}`);
  }

  // --- Private scheduling logic ---

  private scheduler() {
    if (!this.audioCtx) return;

    const scheduleAheadTime = 0.1; // seconds

    while (this.nextNoteTime < this.audioCtx.currentTime + scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += this.getStepDuration();
      this.currentStep = (this.currentStep + 1) % this.stepCount;
    }
  }

  private getStepDuration() {
    const secondsPerBeat = 60.0 / this.tempo;
    return secondsPerBeat / this.stepsPerBeat;
  }

  private scheduleNote(step: number, time: number) {
    this.grid.forEach((row, instrumentIdx) => {
      if (row[step] && this.buffers[instrumentIdx]) {
        this.playBuffer(instrumentIdx, time);
      }
    });

    // Update UI on time
    const timeout = (time - this.audioCtx!.currentTime) * 1000;
    setTimeout(() => this.onStepChange(step), timeout);
  }

  private playBuffer(instrumentIndex: number, time: number) {
    if (!this.audioCtx || !this.instrumentGains[instrumentIndex] || !this.buffers[instrumentIndex]) return;
    console.log(`Playing ${this.instruments[instrumentIndex].name} at time ${time}`);
    const source = this.audioCtx.createBufferSource();
    source.buffer = this.buffers[instrumentIndex];
    source.connect(this.instrumentGains[instrumentIndex]!);
    source.start(time);
  }

  private resume() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
      console.log("AudioContext resumed.");
    }
  }
}

export default AudioEngine;
