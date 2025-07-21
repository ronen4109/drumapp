"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import AudioEngine from "@/lib/AudioEngine"

type TimeSignature = "4/4" | "3/4"
type Subdivision = "1/16" | "1/8" | "1/4" | "1/8T"

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
  // --- State ---
  const [timeSignature, setTimeSignature] = useState<TimeSignature>("4/4")
  const [subdivision, setSubdivision] = useState<Subdivision>("1/16")
  const [grid, setGrid] = useState<boolean[][]>(() => instruments.map(() => Array(16).fill(false)))
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [tempo, setTempo] = useState(120)
  const [masterVolume, setMasterVolume] = useState(0.75)
  const [instrumentVolumes, setInstrumentVolumes] = useState<number[]>(() => instruments.map(() => 1))
  const [instrumentMutes, setInstrumentMutes] = useState<boolean[]>(() => instruments.map(() => false))

  const [savedBeats, setSavedBeats] = useState<{ name: string; data: any }[]>([])
  const [showLoadDropdown, setShowLoadDropdown] = useState(false)

  // --- Refs ---
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const isMouseDownRef = useRef(false)
  const dragModeRef = useRef<boolean>(false)

  // --- Memoized calculations ---
  const { columns, beatHeaders, stepsPerBeat } = useMemo(() => {
    const beats = timeSignature === "4/4" ? 4 : 3
    let steps: number
    if (subdivision === "1/16") steps = 4
    else if (subdivision === "1/8") steps = 2
    else if (subdivision === "1/4") steps = 1
    else if (subdivision === "1/8T") steps = 3
    else steps = 4

    const totalColumns = beats * steps
    const headers = new Array(totalColumns).fill("").map((_, i) => {
      if (i % steps === 0) return (i / steps + 1).toString()
      return ""
    })
    return { columns: totalColumns, beatHeaders: headers, stepsPerBeat: steps }
  }, [timeSignature, subdivision])

  // --- Callbacks ---
  const onStepChange = useCallback((step: number) => {
    setCurrentStep(step)
  }, [])

  // --- Effects ---

  // Initialize AudioEngine
  useEffect(() => {
    audioEngineRef.current = new AudioEngine(instruments, onStepChange)
    audioEngineRef.current.init()
    // Load saved beats from localStorage
    const beats = JSON.parse(localStorage.getItem("drumapp_beats") || "[]")
    setSavedBeats(beats)
  }, [onStepChange])

  // Update AudioEngine with state changes
  useEffect(() => {
    if (!audioEngineRef.current) return
    audioEngineRef.current.setTempo(tempo)
    audioEngineRef.current.setGrid(grid)
    audioEngineRef.current.setStepCount(columns)
    audioEngineRef.current.setMasterVolume(masterVolume)
  }, [tempo, grid, columns, masterVolume])

  // Update AudioEngine with subdivision changes
  useEffect(() => {
    if (!audioEngineRef.current) return
    audioEngineRef.current.setStepsPerBeat(stepsPerBeat)
  }, [stepsPerBeat])

  // Update AudioEngine with per-instrument volume and mute changes
  useEffect(() => {
    if (!audioEngineRef.current) return
    instrumentVolumes.forEach((volume, index) => {
      audioEngineRef.current?.setInstrumentVolume(index, volume)
    })
    instrumentMutes.forEach((isMuted, index) => {
      audioEngineRef.current?.setInstrumentMute(index, isMuted)
    })
  }, [instrumentVolumes, instrumentMutes])

  // Handle mouseup globally
  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false
    }
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  // Adjust grid size when columns change
  useEffect(() => {
    setGrid((prevGrid) =>
      prevGrid.map((row) => {
        const newRow = [...row]
        if (newRow.length < columns) {
          return [...newRow, ...new Array(columns - newRow.length).fill(false)]
        } else if (newRow.length > columns) {
          return newRow.slice(0, columns)
        }
        return newRow
      })
    )
  }, [columns])

  // --- Handlers ---

  const handlePlayPause = () => {
    if (!audioEngineRef.current) return
    if (isPlaying) {
      audioEngineRef.current.stop()
      setIsPlaying(false)
    } else {
      audioEngineRef.current.start()
      setIsPlaying(true)
    }
  }

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
        instrumentVolumes,
        instrumentMutes,
      },
    }
    let beats = JSON.parse(localStorage.getItem("drumapp_beats") || "[]")
    beats = beats.filter((b: any) => b.name !== name)
    beats.push(beatData)
    localStorage.setItem("drumapp_beats", JSON.stringify(beats))
    setSavedBeats(beats)
    alert("Beat saved!")
  }

  const handleLoad = (beat: { name: string; data: any }) => {
    setGrid(beat.data.grid)
    setTempo(beat.data.tempo)
    setTimeSignature(beat.data.timeSignature)
    setSubdivision(beat.data.subdivision)
    setMasterVolume(beat.data.masterVolume ?? 0.75)
    setInstrumentVolumes(beat.data.instrumentVolumes ?? instruments.map(() => 1))
    setInstrumentMutes(beat.data.instrumentMutes ?? instruments.map(() => false))
    setShowLoadDropdown(false)
  }

  const handleDelete = (name: string) => {
    const beats = JSON.parse(localStorage.getItem("drumapp_beats") || "[]").filter((b: any) => b.name !== name)
    localStorage.setItem("drumapp_beats", JSON.stringify(beats))
    setSavedBeats(beats)
  }

  const handleCellMouseDown = (instrumentIndex: number, stepIndex: number) => {
    const newValue = !grid[instrumentIndex][stepIndex]
    const newGrid = [...grid]
    newGrid[instrumentIndex] = [...newGrid[instrumentIndex]]
    newGrid[instrumentIndex][stepIndex] = newValue
    setGrid(newGrid)
    dragModeRef.current = newValue
    isMouseDownRef.current = true
  }

  const handleCellMouseEnter = (instrumentIndex: number, stepIndex: number) => {
    if (!isMouseDownRef.current) return
    if (grid[instrumentIndex][stepIndex] === dragModeRef.current) return
    const newGrid = [...grid]
    newGrid[instrumentIndex] = [...newGrid[instrumentIndex]]
    newGrid[instrumentIndex][stepIndex] = dragModeRef.current
    setGrid(newGrid)
  }

  const handleClear = () => {
    setGrid(instruments.map(() => Array(columns).fill(false)))
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Rhythm Composer</h1>
          <p className="text-gray-400">Built with Next.js, React, and Web Audio API</p>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Time & Tempo */}
            <div className="space-y-2 bg-gray-700/50 p-3 rounded-md">
              <Label className="text-sm font-medium text-gray-300">Time & Tempo</Label>
              <div className="flex gap-2">
                <Select value={timeSignature} onValueChange={(v) => setTimeSignature(v as TimeSignature)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value="4/4">4/4</SelectItem>
                    <SelectItem value="3/4">3/4</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={subdivision} onValueChange={(v) => setSubdivision(v as Subdivision)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600 text-white">
                    <SelectItem value="1/16">1/16</SelectItem>
                    <SelectItem value="1/8">1/8</SelectItem>
                    <SelectItem value="1/4">1/4</SelectItem>
                    <SelectItem value="1/8T">1/8T</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  min={40}
                  max={240}
                  className="bg-gray-700 border-gray-600 text-white w-24"
                />
              </div>
            </div>

            {/* Global Controls */}
            <div className="space-y-2 bg-gray-700/50 p-3 rounded-md">
              <Label className="text-sm font-medium text-gray-300">Global Controls</Label>
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="master-volume" className="text-xs">
                    Volume
                  </Label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMasterVolume(masterVolume > 0 ? 0 : 0.75)}>
                      {masterVolume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </button>
                    <Slider
                      id="master-volume"
                      min={0}
                      max={1}
                      step={0.01}
                      value={[masterVolume]}
                      onValueChange={(v) => {
                        setMasterVolume(v[0]);
                        audioEngineRef.current?.setMasterVolume(v[0]);
                      }}
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            </div>

            

            {/* Main Transport */}
            <div className="flex gap-2 items-center justify-center md:justify-start">
              <Button onClick={handlePlayPause} size="lg" className="w-28 h-12 bg-green-600 hover:bg-green-700">
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>
              <Button onClick={handleClear} variant="secondary" size="lg" className="h-12">
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>

            {/* Presets */}
            <div className="flex gap-2 items-center justify-center md:justify-end">
              <Button onClick={handleSave} variant="outline" className="bg-blue-600 hover:bg-blue-700">
                Save
              </Button>
              <div className="relative">
                <Button onClick={() => setShowLoadDropdown((v) => !v)} variant="outline" className="bg-purple-600 hover:bg-purple-700">
                  Load
                </Button>
                {showLoadDropdown && (
                  <div className="absolute right-0 mt-2 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 p-2 min-w-[200px]">
                    {savedBeats.length === 0 ? (
                      <div className="text-gray-400 p-2">No saved beats.</div>
                    ) : (
                      <ul className="space-y-1">
                        {savedBeats.map((beat) => (
                          <li key={beat.name} className="flex items-center justify-between gap-2 p-1 rounded hover:bg-gray-700">
                            <button className="text-left flex-1" onClick={() => handleLoad(beat)}>
                              {beat.name}
                            </button>
                            <button
                              className="text-xs text-red-400 hover:text-red-600"
                              onClick={() => handleDelete(beat.name)}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sequencer Grid */}
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg overflow-x-auto">
          <div className="min-w-max">
            {/* Headers */}
            <div
              className="grid gap-1 mb-2"
              style={{
                gridTemplateColumns: `220px repeat(${columns}, minmax(32px, 1fr))`,
              }}
            >
              <div className="sticky left-0 bg-gray-800 z-10"></div>
              {beatHeaders.map((header, index) => (
                <div
                  key={index}
                  className={`text-center text-xs font-bold ${header ? "text-white" : "text-gray-500"}`}
                >
                  {header || "·"}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="space-y-1">
              {instruments.map((instrument, instIndex) => (
                <div
                  key={instrument.name}
                  className="grid gap-1 items-center"
                  style={{
                    gridTemplateColumns: `220px repeat(${columns}, minmax(32px, 1fr))`,
                  }}
                >
                  {/* Instrument Controls */}
                  <div className="flex items-center gap-2 sticky left-0 bg-gray-800 z-10 p-2 rounded">
                    <img src={instrument.icon} alt={instrument.name} className="w-7 h-7" />
                    <span className="text-sm font-medium text-gray-300 flex-1">{instrument.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newMutes = [...instrumentMutes]
                          newMutes[instIndex] = !newMutes[instIndex]
                          setInstrumentMutes(newMutes)
                          audioEngineRef.current?.setInstrumentMute(instIndex, newMutes[instIndex])
                        }}
                        className="text-gray-400 hover:text-white"
                      >
                        {instrumentMutes[instIndex] ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[instrumentVolumes[instIndex]]}
                        onValueChange={(value) => {
                          const newVolumes = [...instrumentVolumes]
                          newVolumes[instIndex] = value[0]
                          setInstrumentVolumes(newVolumes)
                          audioEngineRef.current?.setInstrumentVolume(instIndex, value[0])
                        }}
                        className="w-20"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Steps */}
                  {Array.from({ length: columns }).map((_, stepIndex) => {
                    const isActive = grid[instIndex]?.[stepIndex] ?? false
                    const isFirstOfBeat = stepIndex % (columns / (timeSignature === "4/4" ? 4 : 3)) === 0
                    const color = rowColors[instIndex % rowColors.length]
                    const isCurrent = isPlaying && currentStep === stepIndex

                    return (
                      <button
                        key={stepIndex}
                        onMouseDown={() => handleCellMouseDown(instIndex, stepIndex)}
                        onMouseEnter={() => handleCellMouseEnter(instIndex, stepIndex)}
                        className={`
                          w-full h-10 rounded border transition-all duration-100
                          ${
                            isActive
                              ? color.active
                              : `bg-gray-700/50 border-gray-600/80 hover:border-gray-500 ${
                                  isFirstOfBeat ? "border-l-gray-500" : ""
                                }`
                          }
                          ${isCurrent ? "ring-2 ring-yellow-400 scale-110" : ""}
                        `}
                        aria-label={`${instrument.name} step ${stepIndex + 1}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
