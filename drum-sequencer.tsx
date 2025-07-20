"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

type TimeSignature = "4/4" | "3/4"
type Subdivision = "1/16" | "1/8" | "1/4" | "1/8T"

// 1. Instruments constant with name, sound, and icon
const instruments = [
  { name: "Hi-hat", sound: "/audio/hi_hat.wav", icon: "/icons/hihat.png" },
  { name: "Kick", sound: "/audio/kick.wav", icon: "/icons/kick.png" },
  { name: "Snare", sound: "/audio/snare.wav", icon: "/icons/snare.png" },
  { name: "Tom 1", sound: "/audio/tom1.wav", icon: "/icons/tom1.png" },
  { name: "Tom 2", sound: "/audio/tom2.wav", icon: "/icons/tom2.png" },
  { name: "Floor Tom", sound: "/audio/floor.wav", icon: "/icons/floortom.png" },
  { name: "Crash", sound: "/audio/crash.wav", icon: "/icons/crash.png" },
  { name: "Ride", sound: "/audio/ride.wav", icon: "/icons/ride.png" },
]

// Define row colors for each instrument
const rowColors = [
  {
    active: "bg-cyan-500 border-cyan-400 shadow-lg shadow-cyan-500/50",
    beat: "border-l-2 border-white",
    faint: "shadow-cyan-500/20",
  },
  {
    active: "bg-red-500 border-red-400 shadow-lg shadow-red-500/50",
    beat: "border-l-2 border-red-300",
    faint: "shadow-red-500/20",
  },
  {
    active: "bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/50",
    beat: "border-l-2 border-orange-300",
    faint: "shadow-orange-500/20",
  },
  {
    active: "bg-purple-500 border-purple-400 shadow-lg shadow-purple-500/50",
    beat: "border-l-2 border-purple-300",
    faint: "shadow-purple-500/20",
  },
  {
    active: "bg-pink-500 border-pink-400 shadow-lg shadow-pink-500/50",
    beat: "border-l-2 border-pink-300",
    faint: "shadow-pink-500/20",
  },
  {
    active: "bg-yellow-400 border-yellow-300 shadow-lg shadow-yellow-400/50",
    beat: "border-l-2 border-yellow-200",
    faint: "shadow-yellow-400/20",
  },
  {
    active: "bg-green-500 border-green-400 shadow-lg shadow-green-500/50",
    beat: "border-l-2 border-green-300",
    faint: "shadow-green-500/20",
  },
  {
    active: "bg-teal-500 border-teal-400 shadow-lg shadow-teal-500/50",
    beat: "border-l-2 border-teal-300",
    faint: "shadow-teal-500/20",
  },
]

export default function DrumSequencer() {
  // 2. State variables
  const [timeSignature, setTimeSignature] = useState<TimeSignature>("4/4")
  const [subdivision, setSubdivision] = useState<Subdivision>("1/16")
  const [grid, setGrid] = useState<boolean[][]>(
    () => instruments.map(() => Array(16).fill(false))
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [tempo, setTempo] = useState(120)
  const [masterVolume, setMasterVolume] = useState(0.75)

  // Add state for saved beats and load modal
  const [savedBeats, setSavedBeats] = useState<{ name: string; data: any }[]>([])
  const [showLoadDropdown, setShowLoadDropdown] = useState(false)

  // Load saved beats from localStorage on mount
  useEffect(() => {
    const beats = JSON.parse(localStorage.getItem("drumapp_beats") || "[]")
    setSavedBeats(beats)
  }, [])

  // Save a beat
  const handleSave = () => {
    const name = prompt("Enter a name for your beat:")
    if (!name) return
    const beatData = {
      name,
      data: {
        grid,
        tempo,
        timeSignature,
        subdivision,
        masterVolume,
      },
    }
    let beats = JSON.parse(localStorage.getItem("drumapp_beats") || "[]")
    // Overwrite if name exists
    beats = beats.filter((b: any) => b.name !== name)
    beats.push(beatData)
    localStorage.setItem("drumapp_beats", JSON.stringify(beats))
    setSavedBeats(beats)
    alert("Beat saved!")
  }

  // Load a beat
  const handleLoad = (beat: { name: string; data: any }) => {
    setGrid(beat.data.grid)
    setTempo(beat.data.tempo)
    setTimeSignature(beat.data.timeSignature)
    setSubdivision(beat.data.subdivision)
    setMasterVolume(beat.data.masterVolume || 0.75)
    setShowLoadDropdown(false)
  }

  // Delete a beat
  const handleDelete = (name: string) => {
    let beats = JSON.parse(localStorage.getItem("drumapp_beats") || "[]")
    beats = beats.filter((b: any) => b.name !== name)
    localStorage.setItem("drumapp_beats", JSON.stringify(beats))
    setSavedBeats(beats)
  }

  // Calculate grid dimensions (columns, beatHeaders) before any effect that uses columns
  const { columns, beatHeaders, tripletGroup } = useMemo(() => {
    const beats = timeSignature === "4/4" ? 4 : 3
    let subdivisions: number
    let tripletGroup = 0
    if (subdivision === "1/16") {
      subdivisions = 4
    } else if (subdivision === "1/8") {
      subdivisions = 2
    } else if (subdivision === "1/4") {
      subdivisions = 1
    } else if (subdivision === "1/8T") {
      subdivisions = 3
      tripletGroup = 3
    } else {
      subdivisions = 4
    }
    const totalColumns = beats * subdivisions
    // Create headers array with correct beat positioning
    const headers = new Array(totalColumns).fill("")
    for (let beat = 1; beat <= beats; beat++) {
      const position = (beat - 1) * subdivisions
      headers[position] = beat.toString()
    }
    return { columns: totalColumns, beatHeaders: headers, tripletGroup }
  }, [timeSignature, subdivision])

  // Web Audio API: AudioContext, buffers, and master gain
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const buffersRef = useRef<(AudioBuffer | null)[]>([])
  const schedulerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const nextNoteTimeRef = useRef<number>(0)
  const stepRef = useRef<number>(0)

  // --- Click and drag logic ---
  const isMouseDownRef = useRef(false)
  const dragModeRef = useRef<boolean>(false)

  // Handle mouseup globally (in case mouse leaves grid)
  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Initialize AudioContext and master gain node
  useEffect(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      masterGainRef.current = audioCtxRef.current.createGain()
      masterGainRef.current.connect(audioCtxRef.current.destination)
    }
  }, [])

  // Update master volume
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(masterVolume, audioCtxRef.current?.currentTime || 0)
    }
  }, [masterVolume])

  // Preload and decode all drum sounds
  useEffect(() => {
    let isMounted = true
    const loadBuffers = async () => {
      if (!audioCtxRef.current) return
      const ctx = audioCtxRef.current
      const promises = instruments.map(async (inst) => {
        const res = await fetch(inst.sound)
        const arrayBuffer = await res.arrayBuffer()
        return ctx.decodeAudioData(arrayBuffer)
      })
      const decoded = await Promise.all(promises)
      if (isMounted) buffersRef.current = decoded
    }
    loadBuffers()
    return () => {
      isMounted = false
    }
  }, [])

  // Calculate step duration in seconds
  const getStepDuration = () => (60 / tempo) / 4 // 16 steps per bar

  // Scheduler logic
  useEffect(() => {
    if (!isPlaying) {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current)
        schedulerIntervalRef.current = null
      }
      return
    }
    if (!audioCtxRef.current || !masterGainRef.current) return
    const ctx = audioCtxRef.current
    const lookahead = 25 // ms
    const scheduleAheadTime = 0.1 // seconds
    nextNoteTimeRef.current = ctx.currentTime + 0.05
    stepRef.current = currentStep

    // Get current number of columns (steps)
    const stepCount = columns

    function scheduleNote(step: number, time: number) {
      grid.forEach((row, instrumentIdx) => {
        if (step < stepCount && row[step] && buffersRef.current[instrumentIdx]) {
          const source = ctx.createBufferSource()
          source.buffer = buffersRef.current[instrumentIdx]
          source.connect(masterGainRef.current!)
          source.start(time)
        }
      })
      // For UI: update currentStep at the right time
      setTimeout(() => {
        setCurrentStep(step)
      }, (time - ctx.currentTime) * 1000)
    }

    function scheduler() {
      while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
        scheduleNote(stepRef.current, nextNoteTimeRef.current)
        const secondsPerStep = getStepDuration()
        nextNoteTimeRef.current += secondsPerStep
        stepRef.current = (stepRef.current + 1) % stepCount
      }
    }

    schedulerIntervalRef.current = setInterval(scheduler, lookahead)
    return () => {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current)
        schedulerIntervalRef.current = null
      }
    }
  }, [isPlaying, tempo, grid, columns])

  // On stop, reset step
  useEffect(() => {
    if (!isPlaying) setCurrentStep(0)
  }, [isPlaying])

  // Update sequencer state when grid size changes
  const adjustedSequencerState = useMemo(() => {
    return grid.map((row) => {
      const newRow = [...row]
      if (newRow.length < columns) {
        // Extend with false values
        return [...newRow, ...new Array(columns - newRow.length).fill(false)]
      } else if (newRow.length > columns) {
        // Truncate
        return newRow.slice(0, columns)
      }
      return newRow
    })
  }, [grid, columns])

  // Toggle cell (single click)
  const toggleCell = (instrumentIndex: number, stepIndex: number) => {
    setGrid((prev) => {
      const newState = [...prev]
      newState[instrumentIndex] = [...newState[instrumentIndex]]
      newState[instrumentIndex][stepIndex] = !newState[instrumentIndex][stepIndex]
      return newState
    })
  }

  // Handle mouse down on a cell
  const handleCellMouseDown = (instrumentIndex: number, stepIndex: number) => {
    setGrid((prev) => {
      const newState = [...prev]
      newState[instrumentIndex] = [...newState[instrumentIndex]]
      const newValue = !newState[instrumentIndex][stepIndex]
      newState[instrumentIndex][stepIndex] = newValue
      dragModeRef.current = newValue
      return newState
    })
    isMouseDownRef.current = true
  }

  // Handle mouse enter (drag over)
  const handleCellMouseEnter = (instrumentIndex: number, stepIndex: number) => {
    if (!isMouseDownRef.current) return
    setGrid((prev) => {
      const newState = [...prev]
      newState[instrumentIndex] = [...newState[instrumentIndex]]
      newState[instrumentIndex][stepIndex] = dragModeRef.current
      return newState
    })
  }

  // Play Button handler
  const handlePlay = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    // Resume context if suspended (required by browsers)
    audioCtxRef.current.resume()
    setIsPlaying((prev) => !prev)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center">Drum Machine Sequencer</h1>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Time Signature */}
            <div className="space-y-2">
              <Label htmlFor="time-signature" className="text-sm font-medium text-gray-300">
                Time Signature
              </Label>
              <Select value={timeSignature} onValueChange={(value: TimeSignature) => setTimeSignature(value)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="4/4" className="text-white hover:bg-gray-600">
                    4/4
                  </SelectItem>
                  <SelectItem value="3/4" className="text-white hover:bg-gray-600">
                    3/4
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subdivision */}
            <div className="space-y-2">
              <Label htmlFor="subdivision" className="text-sm font-medium text-gray-300">
                Subdivision
              </Label>
              <Select value={subdivision} onValueChange={(value: Subdivision) => setSubdivision(value)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="1/16" className="text-white hover:bg-gray-600">
                    1/16
                  </SelectItem>
                  <SelectItem value="1/8" className="text-white hover:bg-gray-600">
                    1/8
                  </SelectItem>
                  <SelectItem value="1/4" className="text-white hover:bg-gray-600">
                    1/4
                  </SelectItem>
                  <SelectItem value="1/8T" className="text-white hover:bg-gray-600">
                    1/8T (Triplet)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tempo */}
            <div className="space-y-2">
              <Label htmlFor="tempo" className="text-sm font-medium text-gray-300">
                Tempo (BPM)
              </Label>
              <Input
                id="tempo"
                type="number"
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
                min={60}
                max={200}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            {/* Master Volume */}
            <div className="space-y-2">
              <Label htmlFor="master-volume" className="text-sm font-medium text-gray-300">
                Master Volume
              </Label>
              <div className="flex items-center gap-2">
                <button onClick={() => setMasterVolume(masterVolume > 0 ? 0 : 0.75)}>
                  {masterVolume > 0 ? (
                    <Volume2 className="w-5 h-5 text-gray-400" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <Slider
                  id="master-volume"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[masterVolume]}
                  onValueChange={(value) => setMasterVolume(value[0])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Play and Clear Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handlePlay}
                size="lg"
                className={`h-12 ${
                  isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                } text-white font-semibold`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Play
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-12 bg-gray-600 hover:bg-gray-700 text-white font-semibold"
                onClick={() => setGrid(instruments.map(() => Array(16).fill(false)))}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                onClick={() => setShowLoadDropdown((v) => !v)}
              >
                Load
              </Button>
            </div>
            {showLoadDropdown && (
              <div className="absolute mt-2 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 p-4 min-w-[220px]">
                <div className="mb-2 text-white font-semibold">Saved Beats</div>
                {savedBeats.length === 0 && <div className="text-gray-400">No beats saved.</div>}
                <ul className="space-y-2">
                  {savedBeats.map((beat) => (
                    <li key={beat.name} className="flex items-center justify-between gap-2">
                      <button
                        className="text-left flex-1 text-blue-300 hover:underline"
                        onClick={() => handleLoad(beat)}
                      >
                        {beat.name}
                      </button>
                      <button
                        className="text-xs text-red-400 hover:text-red-600 px-2"
                        onClick={() => handleDelete(beat.name)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-4 w-full text-sm text-gray-300 hover:text-white"
                  onClick={() => setShowLoadDropdown(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sequencer Grid */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg overflow-x-auto">
          <div className="min-w-fit">
            {/* Beat Headers */}
            <div
              className="grid gap-1 mb-4"
              style={{
                gridTemplateColumns: `140px repeat(${columns}, 40px)`,
              }}
            >
              <div></div>
              {beatHeaders.map((header, index) => (
                <div
                  key={index}
                  className="text-center text-sm font-bold text-gray-300 py-2 flex items-center justify-center"
                >
                  {header as string}
                </div>
              ))}
            </div>

            {/* Sequencer Rows */}
            <div className="space-y-2">
              {instruments.map((instrument, instrumentIndex) => {
                return (
                  <div
                    key={instrument.name}
                    className="grid gap-1 items-center"
                    style={{
                      gridTemplateColumns: `140px repeat(${columns}, 40px)`,
                    }}
                  >
                    {/* Instrument Label with Icon */}
                    <div className="flex items-center justify-end gap-3 pr-4">
                      <img src={instrument.icon} alt={instrument.name} className="w-8 h-8" />
                      <span className="text-sm font-medium text-gray-300">{instrument.name}</span>
                    </div>

                    {/* Step Buttons */}
                    {adjustedSequencerState[instrumentIndex].slice(0, columns).map((isActive: boolean, stepIndex: number) => {
                      const subdivisionsVal = subdivision === "1/16" ? 4 : subdivision === "1/8" ? 2 : subdivision === "1/4" ? 1 : 3;
                      const isFirstOfBeat = stepIndex % subdivisionsVal === 0;
                      const isTripletGroup = subdivision === "1/8T" && stepIndex % 3 === 0;
                      const color = rowColors[instrumentIndex % rowColors.length];
                      // Add a prominent ring to active beat squares
                      const activeBeatRing = isActive && isFirstOfBeat ? "ring-2 ring-white" : "";
                      return (
                        <button
                          key={stepIndex}
                          onMouseDown={() => handleCellMouseDown(instrumentIndex, stepIndex)}
                          onMouseEnter={() => handleCellMouseEnter(instrumentIndex, stepIndex)}
                          onMouseUp={() => {
                            isMouseDownRef.current = false
                          }}
                          className={`
                            w-10 h-10 rounded border-2 transition-all duration-150 hover:scale-110
                            ${
                              isActive
                                ? color.active
                                : "bg-gray-700 border-gray-600 hover:border-gray-500 " + color.faint
                            }
                            ${!isActive && isFirstOfBeat ? color.beat : ""}
                            ${isPlaying && currentStep === stepIndex ? "ring-2 ring-yellow-400" : ""}
                            ${activeBeatRing}
                            ${isTripletGroup ? "bg-gray-800" : ""}
                          `}
                          aria-label={`${instrument.name} step ${stepIndex + 1}`}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">
            Grid: {columns} steps ({timeSignature} time, {subdivision} subdivision) • Tempo: {tempo} BPM
          </p>
        </div>
      </div>
    </div>
  )
}
