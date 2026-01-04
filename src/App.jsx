import { useState, useEffect, useRef } from 'react'
import ReactPlayer from 'react-player/youtube'
import confetti from 'canvas-confetti'

const API_BASE_URL = 'http://127.0.0.1:3002'

// Caption sync offset (negative = captions appear earlier, positive = later)
const DEFAULT_CAPTION_OFFSET = -1.5 // seconds - adjust captions to appear 1.5s earlier

// Helper function to fetch YouTube transcript via backend server
async function fetchYouTubeTranscript(videoId, preferredLang = 'es') {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transcript/${videoId}?lang=${preferredLang}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const text = await response.text()
            try {
                const error = JSON.parse(text)
                throw new Error(error.error || 'Failed to fetch transcript')
            } catch (e) {
                throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`)
            }
        }

        const data = await response.json()
        console.log('Transcript response:', data.language, data.segments?.length, 'segments')
        return {
            language: data.language,
            segments: data.segments || data
        }
    } catch (error) {
        console.error('Error fetching transcript:', error)
        throw error
    }
}

// Helper function to batch translate texts
async function batchTranslate(texts) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/translate-batch`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ texts })
        })

        if (!response.ok) {
            console.error('Batch translation API error:', response.status)
            return texts // Return original texts as fallback
        }

        const data = await response.json()
        return data.translations || texts
    } catch (error) {
        console.error('Batch translation error:', error)
        return texts
    }
}

// Helper function to translate Spanish to Vietnamese
async function translateToVietnamese(text) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        })

        if (!response.ok) {
            console.error('Translation API error:', response.status)
            return text
        }

        const data = await response.json()
        return data.translation || text
    } catch (error) {
        console.error('Translation error:', error)
        return text
    }
}

// Mock data for Spanish learning
const MOCK_DICTIONARY = {
    'Hola': {
        meaning: 'Hello',
        type: 'interjection',
        grammar: 'Common Spanish greeting interjection'
    },
    'mundo': {
        meaning: 'world',
        type: 'noun',
        grammar: 'Masculine noun (el mundo)'
    },
    '¿Cómo': {
        meaning: 'How',
        type: 'adverb',
        grammar: 'Interrogative adverb'
    },
    'estás': {
        meaning: 'you are',
        type: 'verb',
        verb: 'estar',
        conjugation: {
            present: {
                yo: 'estoy',
                tú: 'estás',
                él: 'está',
                nosotros: 'estamos',
                vosotros: 'estáis',
                ellos: 'están'
            }
        },
        grammar: 'Verb "estar" - used for temporary states'
    },
    'Buenos': {
        meaning: 'good',
        type: 'adjective',
        grammar: 'Plural masculine adjective'
    },
    'días': {
        meaning: 'days',
        type: 'noun',
        grammar: 'Plural noun (el día → los días)'
    },
    'Me': {
        meaning: 'me (reflexive)',
        type: 'pronoun',
        grammar: 'Reflexive pronoun'
    },
    'llamo': {
        meaning: 'call',
        type: 'verb',
        verb: 'llamar',
        conjugation: {
            present: {
                yo: 'llamo',
                tú: 'llamas',
                él: 'llama',
                nosotros: 'llamamos',
                vosotros: 'llamáis',
                ellos: 'llaman'
            }
        },
        grammar: 'Verb "llamar" - commonly used reflexively "Me llamo" (My name is...)'
    },
    'María': {
        meaning: 'Maria (name)',
        type: 'proper noun',
        grammar: 'Proper name'
    }
}

const MOCK_TRANSCRIPT = [
    {
        start: 0,
        end: 2.5,
        text: 'Hola mundo',
        translation: 'Hello world',
        words: [
            { text: 'Hola', start: 0.2, end: 1.0 },
            { text: 'mundo', start: 1.2, end: 2.3 }
        ]
    },
    {
        start: 2.5,
        end: 5.0,
        text: '¿Cómo estás?',
        translation: 'How are you?',
        words: [
            { text: '¿Cómo', start: 2.7, end: 3.5 },
            { text: 'estás?', start: 3.6, end: 4.8 }
        ]
    },
    {
        start: 5.0,
        end: 7.5,
        text: 'Buenos días',
        translation: 'Good morning',
        words: [
            { text: 'Buenos', start: 5.2, end: 6.0 },
            { text: 'días', start: 6.2, end: 7.3 }
        ]
    },
    {
        start: 7.5,
        end: 10.0,
        text: 'Me llamo María',
        translation: 'My name is Maria',
        words: [
            { text: 'Me', start: 7.7, end: 8.0 },
            { text: 'llamo', start: 8.1, end: 8.8 },
            { text: 'María', start: 8.9, end: 9.8 }
        ]
    }
]

const B2_TEST_QUESTIONS = [
    {
        id: 1,
        type: 'multiple-choice',
        question: 'What does the speaker say at the beginning?',
        timestamp: 0,
        options: [
            { id: 'a', text: 'Hola mundo' },
            { id: 'b', text: 'Adiós' },
            { id: 'c', text: 'Gracias' }
        ],
        correct: 'a',
        explanation: 'The speaker begins with "Hola mundo" (Hello world)'
    },
    {
        id: 2,
        type: 'true-false',
        statement: 'The speaker asks "¿Cómo estás?"',
        timestamp: 2.5,
        correct: true,
        explanation: 'Correct! The second sentence is "¿Cómo estás?" - a common greeting'
    },
    {
        id: 3,
        type: 'multiple-choice',
        question: 'What is the speaker\'s name?',
        timestamp: 7.5,
        options: [
            { id: 'a', text: 'Juan' },
            { id: 'b', text: 'María' },
            { id: 'c', text: 'Pedro' }
        ],
        correct: 'b',
        explanation: 'The speaker introduces themselves with "Me llamo María" (My name is María)'
    },
    {
        id: 4,
        type: 'gap-fill',
        sentence: 'Buenos ___',
        timestamp: 5.0,
        correct: 'días',
        options: ['días', 'noches', 'tardes'],
        explanation: '"Buenos días" means "Good morning" - a morning greeting phrase'
    },
    {
        id: 5,
        type: 'true-false',
        statement: 'The speaker uses the verb "estar"',
        timestamp: 2.5,
        correct: true,
        explanation: 'Correct! "Estás" is the conjugated form of "estar" in second person singular (tú)'
    }
]

function App() {
    const [videoUrl, setVideoUrl] = useState('')
    const [videoId, setVideoId] = useState(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isTranslating, setIsTranslating] = useState(false)
    const [translationProgress, setTranslationProgress] = useState(0)
    const [transcript, setTranscript] = useState([])
    const [currentTime, setCurrentTime] = useState(0)
    const [captionOffset, setCaptionOffset] = useState(DEFAULT_CAPTION_OFFSET)
    const [selectedWord, setSelectedWord] = useState(null)
    const [showSummary, setShowSummary] = useState(false)
    const [summary, setSummary] = useState({ spanish: '', vietnamese: '', stats: null })
    const [isSummarizing, setIsSummarizing] = useState(false)
    const [showTest, setShowTest] = useState(false)
    const [testAnswers, setTestAnswers] = useState({})
    const [testSubmitted, setTestSubmitted] = useState(false)
    const [testScore, setTestScore] = useState(0)
    const [showDrills, setShowDrills] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const playerRef = useRef(null)

    const extractVideoId = (url) => {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        ]
        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) return match[1]
        }
        return null
    }

    const processVideo = async () => {
        const id = extractVideoId(videoUrl)
        if (!id) {
            alert('❌ Invalid YouTube URL! Please enter a valid URL.')
            return
        }

        setIsProcessing(true)
        setVideoId(id)
        setTranscript([]) // Clear previous transcript
        setTranslationProgress(0)

        try {
            console.log('=== Processing Video ===')
            console.log('Video ID:', id)
            console.log('Full URL:', videoUrl)
            console.log('Fetching transcript for video:', id)

            // Fetch real YouTube transcript (prefer Spanish)
            const result = await fetchYouTubeTranscript(id, 'es')
            const fetchedTranscript = result.segments || result
            const detectedLang = result.language || 'unknown'

            console.log('✓ Fetched transcript:', fetchedTranscript.length, 'segments')
            console.log('Detected language:', detectedLang)

            if (!fetchedTranscript || fetchedTranscript.length === 0) {
                throw new Error('No transcript data received from server')
            }

            // Show first few segments for debugging
            console.log('First 3 segments:', fetchedTranscript.slice(0, 3).map(s => s.text))

            // IMMEDIATELY show video with Spanish transcript (no translation wait)
            const initialTranscript = fetchedTranscript.map(segment => ({
                ...segment,
                translation: '⏳ Translating...' // Placeholder while translating
            }))
            setTranscript(initialTranscript)
            setIsProcessing(false) // Video is ready to play immediately!
            setIsTranslating(true)

            // Translate in background using batch API for better performance
            console.log('Starting batch translation for', fetchedTranscript.length, 'segments...')

            const BATCH_SIZE = 10 // Translate 10 segments at a time
            const translatedSegments = [...initialTranscript]

            for (let i = 0; i < fetchedTranscript.length; i += BATCH_SIZE) {
                const batch = fetchedTranscript.slice(i, i + BATCH_SIZE)
                const texts = batch.map(seg => seg.text)

                try {
                    const translations = await batchTranslate(texts)

                    // Update the segments with translations
                    for (let j = 0; j < batch.length; j++) {
                        translatedSegments[i + j] = {
                            ...fetchedTranscript[i + j],
                            translation: translations[j] || fetchedTranscript[i + j].text
                        }
                    }

                    // Update state to show progress
                    setTranscript([...translatedSegments])
                    setTranslationProgress(Math.min(100, Math.round(((i + batch.length) / fetchedTranscript.length) * 100)))

                } catch (batchError) {
                    console.warn(`Batch translation failed for segments ${i}-${i + BATCH_SIZE}:`, batchError.message)
                    // Fallback: mark as original text
                    for (let j = 0; j < batch.length; j++) {
                        translatedSegments[i + j] = {
                            ...fetchedTranscript[i + j],
                            translation: fetchedTranscript[i + j].text
                        }
                    }
                    setTranscript([...translatedSegments])
                }
            }

            console.log('✓ Translation complete:', translatedSegments.length, 'segments')
            setTranscript(translatedSegments)
            setIsTranslating(false)
            setTranslationProgress(100)
        } catch (error) {
            console.error('❌ Error processing video:', error)
            const errorMessage = error.message || 'Unknown error'

            alert(`⚠️ Error: ${errorMessage}\n\nVideo ID: ${id}\n\nPossible causes:\n• Video has no captions/subtitles\n• Captions are disabled by uploader\n• Video is private/deleted\n• Network error\n\nCheck:\n1. Backend server console for details\n2. Browser console (F12) for logs\n3. Try a different video with captions\n\nUsing demo data instead.`)

            // Fallback to mock data if fetch fails
            setTranscript(MOCK_TRANSCRIPT)
            setIsProcessing(false)
            setIsTranslating(false)
        }
    }

    const handleProgress = (state) => {
        setCurrentTime(state.playedSeconds)
    }

    // Get current segment with caption offset applied
    const getCurrentSegment = () => {
        const adjustedTime = currentTime - captionOffset // Apply offset
        return transcript.find(seg =>
            adjustedTime >= seg.start && adjustedTime < seg.end
        )
    }

    const getCurrentWord = () => {
        const segment = getCurrentSegment()
        if (!segment) return null
        const adjustedTime = currentTime - captionOffset
        return segment.words?.find(word =>
            adjustedTime >= word.start && adjustedTime < word.end
        )
    }

    const handleWordClick = (word) => {
        const cleanWord = word.replace(/[¿?¡!,.]$/, '')
        const wordInfo = MOCK_DICTIONARY[cleanWord]
        if (wordInfo) {
            setSelectedWord({ word: cleanWord, ...wordInfo })
        }
    }

    const generateSummary = async () => {
        if (transcript.length === 0) {
            alert('No transcript available to summarize')
            return
        }

        setIsSummarizing(true)
        setShowSummary(true)
        setSummary({ spanish: '', vietnamese: '', stats: null })

        try {
            const response = await fetch(`${API_BASE_URL}/api/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transcript })
            })

            if (!response.ok) {
                throw new Error('Failed to generate summary')
            }

            const data = await response.json()
            setSummary({
                spanish: data.spanish,
                vietnamese: data.vietnamese,
                stats: data.stats
            })
            console.log('✓ Summary generated:', data.stats)
        } catch (error) {
            console.error('Summary error:', error)
            setSummary({
                spanish: 'Error generating summary. Please try again.',
                vietnamese: 'Lỗi khi tạo tóm tắt. Vui lòng thử lại.',
                stats: null
            })
        } finally {
            setIsSummarizing(false)
        }
    }

    const seekToTimestamp = (timestamp) => {
        if (playerRef.current) {
            playerRef.current.seekTo(timestamp, 'seconds')
            setIsPlaying(true)
        }
    }

    const submitTest = () => {
        let correct = 0
        B2_TEST_QUESTIONS.forEach(q => {
            if (q.type === 'true-false') {
                if (testAnswers[q.id] === q.correct) correct++
            } else if (q.type === 'multiple-choice' || q.type === 'gap-fill') {
                if (testAnswers[q.id] === q.correct) correct++
            }
        })
        const score = Math.round((correct / B2_TEST_QUESTIONS.length) * 100)
        setTestScore(score)
        setTestSubmitted(true)

        // Celebration if passed
        if (score >= 80) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            })
        }
    }

    const currentSegment = getCurrentSegment()
    const currentWord = getCurrentWord()

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
            {/* Header */}
            <header className="bg-black/30 backdrop-blur-md border-b border-purple-500/30 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-red-500 to-purple-500 bg-clip-text text-transparent">
                        🎬 SpanishVideoMaster
                    </h1>
                    <p className="text-sm text-gray-300 mt-1">Learn B2 Spanish through YouTube Videos</p>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6">
                {/* URL Input */}
                {!videoId && (
                    <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-purple-500/30">
                        <h2 className="text-2xl font-bold mb-4">📺 Paste YouTube URL</h2>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-purple-500/50 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                onKeyPress={(e) => e.key === 'Enter' && processVideo()}
                            />
                            <button
                                onClick={processVideo}
                                disabled={isProcessing}
                                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-bold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isProcessing ? '⏳ Processing...' : '🚀 Process Video'}
                            </button>
                        </div>
                        <div className="mt-4 text-sm text-gray-400">
                            💡 <strong>Info:</strong> Paste a YouTube URL with Spanish captions. The app will fetch real transcripts and translate to Vietnamese!
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {videoId && isProcessing && (
                    <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-12 border border-purple-500/30 text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-6"></div>
                        <h2 className="text-2xl font-bold mb-4">⏳ Processing Video...</h2>
                        <p className="text-gray-300 mb-2">Fetching transcript from YouTube</p>
                        <p className="text-gray-400 text-sm">This may take a moment...</p>
                    </div>
                )}

                {/* Main Content */}
                {videoId && !isProcessing && transcript.length > 0 && (
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Left & Center: Video + Transcript */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Video Player */}
                                <div className="bg-black rounded-2xl overflow-hidden border border-purple-500/30">
                                    <ReactPlayer
                                        ref={playerRef}
                                        url={`https://www.youtube.com/watch?v=${videoId}`}
                                        width="100%"
                                        height="300px"
                                        playing={isPlaying}
                                        onProgress={handleProgress}
                                        controls
                                        config={{
                                            youtube: {
                                                playerVars: { showinfo: 0 }
                                            }
                                        }}
                                    />
                                </div>

                                {/* Real-time Transcript (Caption Style) */}
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 flex flex-col">
                                    <h3 className="text-lg font-bold mb-4">📝 Live Transcript</h3>
                                    <div className="flex-1 flex items-center justify-center">
                                        {currentSegment ? (
                                            <div className="space-y-4 w-full">
                                                {/* Spanish Original */}
                                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                                    <div className="text-xs text-yellow-400 mb-2 font-bold">🇪🇸 Español (Spanish)</div>
                                                    <div className="text-xl font-bold text-yellow-400 flex flex-wrap gap-2">
                                                        {currentSegment.words.map((word, idx) => (
                                                            <span
                                                                key={idx}
                                                                onClick={() => handleWordClick(word.text)}
                                                                className="cursor-pointer transition-all duration-300 hover:scale-110 hover:text-yellow-300"
                                                            >
                                                                {word.text}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Vietnamese Translation */}
                                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                                    <div className="text-xs text-blue-400 mb-2 font-bold">🇻🇳 Tiếng Việt (Vietnamese)</div>
                                                    <div className="text-lg text-blue-300">
                                                        {currentSegment.translation}
                                                    </div>
                                                </div>

                                                <div className="text-center text-xs text-gray-400">
                                                    {Math.floor(currentSegment.start)}s - {Math.floor(currentSegment.end)}s
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 italic">Waiting for subtitles...</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Full Transcript List */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
                                <h3 className="text-lg font-bold mb-4">📄 Full Transcript</h3>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                    {transcript.map((seg, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => seekToTimestamp(seg.start)}
                                            className={`p-4 rounded-lg cursor-pointer transition-all ${currentSegment?.start === seg.start
                                                ? 'bg-purple-500/30 border-2 border-purple-500'
                                                : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs text-gray-400">
                                                    {Math.floor(seg.start)}s - {Math.floor(seg.end)}s
                                                </span>
                                                <button className="text-xs text-purple-400 hover:text-purple-300">
                                                    ▶️ Play
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-yellow-400 mr-2">🇪🇸</span>
                                                    <span className="font-bold text-lg">{seg.text}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-blue-400 mr-2">🇻🇳</span>
                                                    <span className="text-sm text-gray-300">{seg.translation}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Sidebar */}
                        <div className="space-y-4">
                            {/* Actions */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 space-y-3">
                                <button
                                    onClick={generateSummary}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all"
                                >
                                    📄 Summarize Video
                                </button>
                                <button
                                    onClick={() => setShowTest(true)}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-bold hover:from-green-600 hover:to-emerald-600 transition-all"
                                >
                                    ✍️ B2 Listening Test
                                </button>
                                <button
                                    onClick={() => setVideoId(null)}
                                    className="w-full px-4 py-3 bg-white/10 rounded-lg font-bold hover:bg-white/20 transition-all"
                                >
                                    🔄 New Video
                                </button>
                            </div>

                            {/* Translation Progress */}
                            {isTranslating && (
                                <div className="bg-blue-500/20 backdrop-blur-md rounded-2xl p-4 border border-blue-500/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold">🔄 Translating...</span>
                                        <span className="text-sm">{translationProgress}%</span>
                                    </div>
                                    <div className="w-full bg-white/20 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${translationProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Caption Sync Control */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
                                <h3 className="text-lg font-bold mb-3">⏱️ Caption Sync</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Offset:</span>
                                        <span className="font-bold text-yellow-400">{captionOffset.toFixed(1)}s</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-5"
                                        max="5"
                                        step="0.1"
                                        value={captionOffset}
                                        onChange={(e) => setCaptionOffset(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Earlier ←</span>
                                        <button
                                            onClick={() => setCaptionOffset(DEFAULT_CAPTION_OFFSET)}
                                            className="text-purple-400 hover:text-purple-300"
                                        >
                                            Reset
                                        </button>
                                        <span>→ Later</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        💡 Adjust if captions are out of sync with audio
                                    </p>
                                </div>
                            </div>

                            {/* Progress */}
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
                                <h3 className="text-lg font-bold mb-3">📊 Progress</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Time:</span>
                                        <span className="font-bold">{Math.floor(currentTime)}s</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Segments:</span>
                                        <span className="font-bold">{transcript.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Vocabulary:</span>
                                        <span className="font-bold">{Object.keys(MOCK_DICTIONARY).length} words</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Tips */}
                            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-md rounded-2xl p-6 border border-yellow-500/30">
                                <h3 className="text-lg font-bold mb-3">💡 Learning Tips</h3>
                                <ul className="space-y-2 text-sm text-gray-200">
                                    <li>✨ Click words for detailed meanings</li>
                                    <li>🎯 Take the test to check understanding</li>
                                    <li>🔄 Repeat videos multiple times</li>
                                    <li>📝 Note down new vocabulary</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Word Dictionary Modal */}
            {selectedWord && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedWord(null)}>
                    <div className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-2xl p-8 max-w-2xl w-full border-2 border-purple-500/50 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-3xl font-bold text-yellow-400">{selectedWord.word}</h2>
                            <button onClick={() => setSelectedWord(null)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="space-y-6">
                            {/* Meaning */}
                            <div>
                                <h3 className="text-lg font-bold text-purple-400 mb-2">📖 Meaning</h3>
                                <div className="bg-white/10 rounded-lg p-4">
                                    <span className="font-bold text-lg">{selectedWord.meaning}</span>
                                </div>
                            </div>

                            {/* Grammar */}
                            <div>
                                <h3 className="text-lg font-bold text-purple-400 mb-2">📚 Grammar</h3>
                                <div className="bg-white/10 rounded-lg p-4">
                                    <span className="text-sm bg-purple-500/30 px-3 py-1 rounded-full">{selectedWord.type}</span>
                                    <p className="mt-3 text-gray-300">{selectedWord.grammar}</p>
                                </div>
                            </div>

                            {/* Verb Conjugation */}
                            {selectedWord.conjugation && (
                                <div>
                                    <h3 className="text-lg font-bold text-purple-400 mb-2">🔄 Verb Conjugation: {selectedWord.verb}</h3>
                                    <div className="bg-white/10 rounded-lg p-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(selectedWord.conjugation.present).map(([pronoun, form]) => (
                                                <div key={pronoun} className="flex justify-between bg-white/5 p-2 rounded">
                                                    <span className="text-gray-400">{pronoun}:</span>
                                                    <span className="font-bold text-yellow-400">{form}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Modal */}
            {showSummary && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSummary(false)}>
                    <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-8 max-w-7xl w-full border-2 border-blue-500/50 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-3xl font-bold">📄 Video Summary / Tóm Tắt Video</h2>
                            <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        {isSummarizing ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
                                <p className="text-xl">Generating summary...</p>
                                <p className="text-gray-400 mt-2">Đang tạo tóm tắt...</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Spanish Summary */}
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-2xl">🇪🇸</span>
                                        <h3 className="text-xl font-bold text-yellow-400">Español (Spanish)</h3>
                                    </div>
                                    <div className="prose prose-invert max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans text-gray-200 leading-relaxed text-sm">{summary.spanish}</pre>
                                    </div>
                                </div>

                                {/* Vietnamese Summary */}
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-2xl">🇻🇳</span>
                                        <h3 className="text-xl font-bold text-blue-400">Tiếng Việt (Vietnamese)</h3>
                                    </div>
                                    <div className="prose prose-invert max-w-none">
                                        <pre className="whitespace-pre-wrap font-sans text-gray-200 leading-relaxed text-sm">{summary.vietnamese}</pre>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stats Footer */}
                        {summary.stats && (
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="flex flex-wrap gap-4 justify-center text-sm">
                                    <div className="bg-white/10 px-4 py-2 rounded-lg">
                                        <span className="text-gray-400">📊 Words:</span>
                                        <span className="font-bold ml-2">{summary.stats.wordCount}</span>
                                    </div>
                                    <div className="bg-white/10 px-4 py-2 rounded-lg">
                                        <span className="text-gray-400">📝 Segments:</span>
                                        <span className="font-bold ml-2">{summary.stats.segmentCount}</span>
                                    </div>
                                    <div className="bg-white/10 px-4 py-2 rounded-lg">
                                        <span className="text-gray-400">⏱️ Duration:</span>
                                        <span className="font-bold ml-2">{Math.floor(summary.stats.duration / 60)}m {summary.stats.duration % 60}s</span>
                                    </div>
                                </div>
                                {summary.stats.topVocabulary && (
                                    <div className="mt-4 text-center">
                                        <span className="text-gray-400 text-sm">🔤 Key Vocabulary: </span>
                                        <span className="text-yellow-400 text-sm">{summary.stats.topVocabulary.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* B2 Test Modal */}
            {showTest && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-gradient-to-br from-gray-900 to-green-900 rounded-2xl p-8 max-w-4xl w-full border-2 border-green-500/50 shadow-2xl my-8" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-3xl font-bold">✍️ B2 Listening Test - DELE Style</h2>
                                <p className="text-gray-400 mt-2">5 questions | Pass with ≥ 80%</p>
                            </div>
                            <button onClick={() => { setShowTest(false); setTestSubmitted(false); setTestAnswers({}) }} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        {!testSubmitted ? (
                            <div className="space-y-6">
                                {B2_TEST_QUESTIONS.map((q, idx) => (
                                    <div key={q.id} className="bg-white/10 rounded-xl p-6 border border-green-500/30">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-lg font-bold">Question {idx + 1}: {q.question || q.statement}</h3>
                                            <button
                                                onClick={() => seekToTimestamp(q.timestamp)}
                                                className="text-sm px-3 py-1 bg-green-500/30 rounded-lg hover:bg-green-500/50"
                                            >
                                                ▶️ {Math.floor(q.timestamp)}s
                                            </button>
                                        </div>

                                        {q.type === 'multiple-choice' && (
                                            <div className="space-y-2">
                                                {q.options.map(opt => (
                                                    <label key={opt.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-all">
                                                        <input
                                                            type="radio"
                                                            name={`q${q.id}`}
                                                            value={opt.id}
                                                            checked={testAnswers[q.id] === opt.id}
                                                            onChange={() => setTestAnswers({ ...testAnswers, [q.id]: opt.id })}
                                                            className="w-4 h-4"
                                                        />
                                                        <span>{opt.id.toUpperCase()}. {opt.text}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}

                                        {q.type === 'true-false' && (
                                            <div className="space-y-2">
                                                <div className="flex gap-4 mt-3">
                                                    <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 flex-1">
                                                        <input
                                                            type="radio"
                                                            name={`q${q.id}`}
                                                            value="true"
                                                            checked={testAnswers[q.id] === true}
                                                            onChange={() => setTestAnswers({ ...testAnswers, [q.id]: true })}
                                                            className="w-4 h-4"
                                                        />
                                                        <span>✅ True (Verdadero)</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 flex-1">
                                                        <input
                                                            type="radio"
                                                            name={`q${q.id}`}
                                                            value="false"
                                                            checked={testAnswers[q.id] === false}
                                                            onChange={() => setTestAnswers({ ...testAnswers, [q.id]: false })}
                                                            className="w-4 h-4"
                                                        />
                                                        <span>❌ False (Falso)</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {q.type === 'gap-fill' && (
                                            <div className="space-y-3">
                                                <div className="text-xl font-bold">{q.sentence}</div>
                                                <select
                                                    value={testAnswers[q.id] || ''}
                                                    onChange={(e) => setTestAnswers({ ...testAnswers, [q.id]: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white/10 border border-green-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                                >
                                                    <option value="">-- Select word --</option>
                                                    {q.options.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={submitTest}
                                    disabled={Object.keys(testAnswers).length < B2_TEST_QUESTIONS.length}
                                    className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    📝 Submit Test
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Score */}
                                <div className={`text-center p-8 rounded-2xl ${testScore >= 80 ? 'bg-green-500/20 border-2 border-green-500' : 'bg-red-500/20 border-2 border-red-500'}`}>
                                    <div className="text-6xl font-bold mb-4">{testScore}%</div>
                                    <div className="text-2xl font-bold">
                                        {testScore >= 80 ? '🎉 Congratulations! B2 Passed!' : '😢 Not B2 Yet'}
                                    </div>
                                    <p className="text-gray-300 mt-2">
                                        {testScore >= 80
                                            ? 'You passed the test! Keep learning to improve further!'
                                            : 'Don\'t give up! Review the mistakes and practice more.'}
                                    </p>
                                </div>

                                {/* Detailed Results */}
                                <div className="space-y-4">
                                    <h3 className="text-xl font-bold">📊 Detailed Results:</h3>
                                    {B2_TEST_QUESTIONS.map((q, idx) => {
                                        const userAnswer = testAnswers[q.id]
                                        const isCorrect = userAnswer === q.correct
                                        return (
                                            <div key={q.id} className={`p-4 rounded-xl border-2 ${isCorrect ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold">Question {idx + 1}</span>
                                                    <span className="text-2xl">{isCorrect ? '✅' : '❌'}</span>
                                                </div>
                                                <div className="text-sm text-gray-300 mb-2">{q.question || q.statement}</div>
                                                {!isCorrect && (
                                                    <div className="bg-white/10 p-3 rounded-lg mt-3">
                                                        <div className="font-bold text-yellow-400 mb-2">💡 Explanation:</div>
                                                        <p className="text-sm">{q.explanation}</p>
                                                        {q.type === 'multiple-choice' && (
                                                            <div className="mt-2 text-sm">
                                                                <span className="text-red-400">Your answer: {userAnswer}</span> |
                                                                <span className="text-green-400"> Correct: {q.correct}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Follow-up Drills */}
                                {testScore < 80 && (
                                    <div className="bg-blue-500/20 border-2 border-blue-500 rounded-xl p-6">
                                        <h3 className="text-xl font-bold mb-4">🎯 Follow-up Practice:</h3>
                                        <div className="space-y-3">
                                            <div className="bg-white/10 p-4 rounded-lg">
                                                <div className="font-bold">1. Flashcard: "estar" vs "ser"</div>
                                                <p className="text-sm text-gray-400 mt-1">Practice distinguishing these 2 "to be" verbs</p>
                                            </div>
                                            <div className="bg-white/10 p-4 rounded-lg">
                                                <div className="font-bold">2. Gap Fill: Reflexive Verbs</div>
                                                <p className="text-sm text-gray-400 mt-1">Conjugate "llamarse", "levantarse"</p>
                                            </div>
                                            <div className="bg-white/10 p-4 rounded-lg">
                                                <div className="font-bold">3. Listen & Write: Greetings</div>
                                                <p className="text-sm text-gray-400 mt-1">Listen and write greeting phrases</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => { setTestSubmitted(false); setTestAnswers({}); setShowTest(false) }}
                                    className="w-full px-6 py-4 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition-all"
                                >
                                    🔄 Retry
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
