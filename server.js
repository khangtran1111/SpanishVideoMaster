import express from 'express'
import cors from 'cors'
import { YoutubeTranscript } from 'youtube-transcript'
import { getSubtitles } from 'youtube-caption-extractor'
import { translate } from '@vitalets/google-translate-api'

const app = express()
const PORT = 3002

app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3000'],
    credentials: true
}))
app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' })
})

// Helper to fetch transcript directly from YouTube page
async function fetchTranscriptDirect(videoId) {
    console.log('Starting direct transcript fetch for:', videoId)

    // Method: Use YouTube's innertube API to get captions
    const innertubeUrl = 'https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false'

    const innertubePayload = {
        context: {
            client: {
                hl: 'en',
                gl: 'US',
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00'
            }
        },
        params: Buffer.from(`\n\x0b${videoId}`).toString('base64')
    }

    console.log('Trying innertube API...')

    try {
        const innertubeResponse = await fetch(innertubeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(innertubePayload)
        })

        const innertubeData = await innertubeResponse.json()

        if (innertubeData.actions) {
            const transcriptRenderer = innertubeData.actions[0]?.updateEngagementPanelAction?.content?.transcriptRenderer
            const cueGroups = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments

            if (cueGroups && cueGroups.length > 0) {
                const segments = []
                for (const cue of cueGroups) {
                    const segment = cue.transcriptSegmentRenderer
                    if (segment) {
                        const startMs = parseInt(segment.startMs)
                        const endMs = parseInt(segment.endMs)
                        const text = segment.snippet?.runs?.map(r => r.text).join('') || ''

                        if (text.trim()) {
                            segments.push({
                                offset: startMs,
                                duration: endMs - startMs,
                                text: text.trim()
                            })
                        }
                    }
                }

                if (segments.length > 0) {
                    console.log(`✓ Innertube API: Got ${segments.length} segments`)
                    return segments
                }
            }
        }
        console.log('Innertube API: No transcript data in response')
    } catch (innertubeError) {
        console.log('Innertube API failed:', innertubeError.message)
    }

    // Fallback: Fetch page and extract caption URL with full tokens
    console.log('Falling back to page scraping...')
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    const response = await fetch(videoUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
        }
    })

    const html = await response.text()

    // Find caption URL with all tokens
    const captionTracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
    if (!captionTracksMatch) {
        throw new Error('No caption tracks found in video page')
    }

    let captionTracks
    try {
        // Fix JSON escaping
        const tracksJson = captionTracksMatch[1].replace(/\\"/g, '"')
        captionTracks = JSON.parse(tracksJson)
    } catch (e) {
        // Try alternate extraction
        const baseUrlMatch = html.match(/"baseUrl":\s*"([^"]+)"/);
        if (!baseUrlMatch) {
            throw new Error('Could not parse caption tracks')
        }

        const captionUrl = baseUrlMatch[1]
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/')

        console.log('Using single caption URL')
        const captionResponse = await fetch(captionUrl)
        const captionXml = await captionResponse.text()

        return parseXmlCaptions(captionXml)
    }

    console.log(`Found ${captionTracks.length} caption tracks`)

    // Try each caption track
    for (const track of captionTracks) {
        const lang = track.languageCode || 'en'
        let url = track.baseUrl
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/')

        // Try with different formats
        for (const fmt of ['json3', 'srv3', '']) {
            try {
                const fetchUrl = fmt ? `${url}&fmt=${fmt}` : url
                console.log(`Trying track ${lang} with fmt=${fmt || 'default'}...`)

                const captionResponse = await fetch(fetchUrl)
                const captionData = await captionResponse.text()

                if (!captionData || captionData.length < 50) {
                    console.log(`  Empty response`)
                    continue
                }

                console.log(`  Got response: ${captionData.length} bytes`)

                // Try JSON parse first
                if (fmt === 'json3' || captionData.startsWith('{')) {
                    try {
                        const json = JSON.parse(captionData)
                        if (json.events) {
                            const segments = []
                            for (const event of json.events) {
                                if (event.segs) {
                                    const text = event.segs.map(s => s.utf8 || '').join('').trim()
                                    if (text) {
                                        segments.push({
                                            offset: event.tStartMs || 0,
                                            duration: event.dDurationMs || 2000,
                                            text
                                        })
                                    }
                                }
                            }
                            if (segments.length > 0) {
                                console.log(`✓ Got ${segments.length} segments from JSON`)
                                return segments
                            }
                        }
                    } catch (jsonErr) {
                        // Not JSON, try XML
                    }
                }

                // Try XML parse
                const segments = parseXmlCaptions(captionData)
                if (segments.length > 0) {
                    console.log(`✓ Got ${segments.length} segments from XML`)
                    return segments
                }
            } catch (fetchErr) {
                console.log(`  Fetch error: ${fetchErr.message}`)
            }
        }
    }

    throw new Error('Could not fetch captions from any track')
}

// Helper to parse XML captions
function parseXmlCaptions(xml) {
    const segments = []
    const textMatches = xml.matchAll(/<text[^>]*start="([^"]+)"[^>]*(?:dur="([^"]+)")?[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/text>/g)

    for (const match of textMatches) {
        const start = parseFloat(match[1]) * 1000
        const duration = match[2] ? parseFloat(match[2]) * 1000 : 2000
        let text = match[3]
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\n/g, ' ')
            .trim()

        if (text) {
            segments.push({ offset: start, duration, text })
        }
    }

    return segments
}

// Endpoint to fetch YouTube transcript with language preference
app.get('/api/transcript/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params
        const { lang } = req.query
        console.log(`\n=== Fetching transcript for video: ${videoId} ===`)
        console.log(`URL: https://www.youtube.com/watch?v=${videoId}`)
        console.log(`Requested language: ${lang || 'auto-detect'}`)

        let rawTranscript = null
        let detectedLanguage = 'unknown'

        // Method 1: Try youtube-caption-extractor first (most reliable)
        const languagesToTry = lang ? [lang, 'es', 'en'] : ['es', 'en']

        for (const tryLang of languagesToTry) {
            try {
                console.log(`Trying youtube-caption-extractor in: ${tryLang}...`)
                const result = await getSubtitles({ videoID: videoId, lang: tryLang })

                if (result && result.length > 0) {
                    // Convert to our format
                    rawTranscript = result.map(item => ({
                        offset: parseFloat(item.start) * 1000,
                        duration: parseFloat(item.dur) * 1000,
                        text: item.text
                    }))
                    detectedLanguage = tryLang
                    console.log(`✓ youtube-caption-extractor: Got ${result.length} items in ${tryLang}`)
                    break
                } else {
                    console.log(`  - ${tryLang}: No results`)
                }
            } catch (extractorError) {
                console.log(`  - ${tryLang}: ${extractorError.message}`)
            }
        }

        // Method 2: Try youtube-transcript library as fallback
        if (!rawTranscript || rawTranscript.length === 0) {
            console.log('Trying youtube-transcript library...')
            for (const tryLang of ['es', 'es-419', 'es-ES', 'en', 'auto']) {
                try {
                    console.log(`  Trying ${tryLang}...`)
                    const result = tryLang === 'auto'
                        ? await YoutubeTranscript.fetchTranscript(videoId)
                        : await YoutubeTranscript.fetchTranscript(videoId, { lang: tryLang })

                    if (result && result.length > 0) {
                        rawTranscript = result
                        detectedLanguage = tryLang
                        console.log(`✓ youtube-transcript: Got ${result.length} items in ${tryLang}`)
                        break
                    }
                } catch (langError) {
                    console.log(`    - ${langError.message}`)
                }
            }
        }

        // Method 3: Try direct fetch as last resort
        if (!rawTranscript || rawTranscript.length === 0) {
            console.log('Trying direct fetch method...')
            try {
                rawTranscript = await fetchTranscriptDirect(videoId)
                detectedLanguage = 'direct-fetch'
                console.log(`✓ Direct fetch: Got ${rawTranscript.length} items`)
            } catch (directError) {
                console.log(`  - Direct fetch failed: ${directError.message}`)
            }
        }

        if (!rawTranscript || rawTranscript.length === 0) {
            throw new Error('No transcript available for this video. The video might not have captions enabled, or captions may be disabled by the uploader.')
        }

        // Clean HTML entities and tags from transcript text
        const cleanText = (text) => {
            return text
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .replace(/<[^>]*>/g, '')
                .replace(/\[.*?\]/g, '')
                .trim()
        }

        // Format transcript for our app
        const formattedTranscript = rawTranscript
            .map(item => {
                const text = cleanText(item.text)
                if (!text || text.length === 0) return null

                const start = item.offset / 1000
                const duration = item.duration / 1000
                const end = start + duration

                return {
                    start,
                    end,
                    text,
                    words: text.split(/\s+/).filter(w => w.length > 0).map((word, idx, arr) => ({
                        text: word,
                        start: start + (idx * duration / arr.length),
                        end: start + ((idx + 1) * duration / arr.length)
                    }))
                }
            })
            .filter(item => item !== null)

        if (formattedTranscript.length === 0) {
            throw new Error('Transcript contains no valid text data after cleaning')
        }

        console.log(`✓ Successfully formatted ${formattedTranscript.length} segments`)
        console.log(`Method: ${detectedLanguage}`)
        console.log('First 3 segments:', formattedTranscript.slice(0, 3).map(s => s.text))
        console.log('Sending to frontend...\n')

        res.json({
            language: detectedLanguage,
            segments: formattedTranscript
        })
    } catch (error) {
        console.error('❌ Error:', error.message, '\n')
        res.status(500).json({ error: error.message })
    }
})

// Translation endpoint with multiple fallbacks
app.post('/api/translate', async (req, res) => {
    const { text } = req.body

    try {
        if (!text) {
            return res.status(400).json({ error: 'Text is required' })
        }

        // Method 1: Try Google Translate (unlimited, but unofficial)
        try {
            const result = await translate(text, { from: 'es', to: 'vi' })
            if (result && result.text) {
                console.log('✓ Google Translate:', text.substring(0, 30), '→', result.text.substring(0, 30))
                return res.json({ translation: result.text })
            }
        } catch (googleError) {
            console.log('Google Translate failed:', googleError.message)
        }

        // Method 2: Fallback to MyMemory API
        try {
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=es|vi`
            )
            const data = await response.json()

            if (data.responseStatus === 200 && data.responseData) {
                console.log('✓ MyMemory:', text.substring(0, 30), '→', data.responseData.translatedText.substring(0, 30))
                return res.json({ translation: data.responseData.translatedText })
            }
        } catch (mymemoryError) {
            console.log('MyMemory failed:', mymemoryError.message)
        }

        // Method 3: Last resort - return original text
        console.log('⚠️ All translation methods failed, returning original')
        res.json({ translation: text })
    } catch (error) {
        console.error('Translation error:', error)
        res.json({ translation: text || '' })
    }
})

// Summarize video endpoint
app.post('/api/summarize', async (req, res) => {
    const { transcript } = req.body

    try {
        if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
            return res.status(400).json({ error: 'Transcript array is required' })
        }

        console.log('=== Generating Summary ===')
        console.log('Transcript segments:', transcript.length)

        // Combine all transcript text
        const fullText = transcript.map(seg => seg.text).join(' ')
        const wordCount = fullText.split(/\s+/).length
        console.log('Total words:', wordCount)

        // Extract key information from transcript
        const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0)

        // Get unique words for vocabulary extraction
        const words = fullText.toLowerCase().split(/\s+/)
        const wordFrequency = {}
        words.forEach(word => {
            const clean = word.replace(/[^a-záéíóúñü]/gi, '')
            if (clean.length > 3) {
                wordFrequency[clean] = (wordFrequency[clean] || 0) + 1
            }
        })

        // Get top frequent words (likely key vocabulary)
        const topWords = Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([word]) => word)

        // Create summary sections
        // Take first few sentences for intro
        const introSentences = sentences.slice(0, 3).join('. ').trim()
        // Take sentences from middle for main content
        const middleStart = Math.floor(sentences.length * 0.3)
        const middleSentences = sentences.slice(middleStart, middleStart + 3).join('. ').trim()
        // Take last sentences for conclusion
        const conclusionSentences = sentences.slice(-3).join('. ').trim()

        // Build Spanish summary (200-500 words target)
        let spanishSummary = `📝 RESUMEN DEL VIDEO

📌 INTRODUCCIÓN:
${introSentences}.

📖 CONTENIDO PRINCIPAL:
${middleSentences}.

Este video contiene aproximadamente ${wordCount} palabras y ${transcript.length} segmentos de contenido.

🎯 PUNTOS CLAVE:
${sentences.slice(0, 5).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')}.

📚 VOCABULARIO IMPORTANTE:
${topWords.slice(0, 10).join(', ')}

🔚 CONCLUSIÓN:
${conclusionSentences}.

---
📊 Estadísticas:
- Duración del contenido: ${Math.floor(transcript[transcript.length - 1]?.end || 0)} segundos
- Total de segmentos: ${transcript.length}
- Palabras totales: ${wordCount}`

        // Translate summary to Vietnamese
        console.log('Translating summary to Vietnamese...')
        let vietnameseSummary = ''

        try {
            const result = await translate(spanishSummary, { from: 'es', to: 'vi' })
            if (result && result.text) {
                vietnameseSummary = result.text
                console.log('✓ Summary translated to Vietnamese')
            }
        } catch (translateError) {
            console.log('Translation failed, trying fallback:', translateError.message)

            // Try MyMemory as fallback
            try {
                const response = await fetch(
                    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(spanishSummary.substring(0, 500))}&langpair=es|vi`
                )
                const data = await response.json()
                if (data.responseStatus === 200 && data.responseData) {
                    vietnameseSummary = data.responseData.translatedText
                }
            } catch (e) {
                console.log('MyMemory fallback failed:', e.message)
            }
        }

        // If translation failed, provide a basic Vietnamese version
        if (!vietnameseSummary) {
            vietnameseSummary = `📝 TÓM TẮT VIDEO

(Bản dịch tự động không khả dụng. Vui lòng đọc phiên bản tiếng Tây Ban Nha.)

📊 Thống kê:
- Thời lượng: ${Math.floor(transcript[transcript.length - 1]?.end || 0)} giây
- Tổng số đoạn: ${transcript.length}
- Tổng số từ: ${wordCount}`
        }

        console.log('✓ Summary generated successfully')

        res.json({
            spanish: spanishSummary,
            vietnamese: vietnameseSummary,
            stats: {
                wordCount,
                segmentCount: transcript.length,
                duration: Math.floor(transcript[transcript.length - 1]?.end || 0),
                topVocabulary: topWords.slice(0, 10)
            }
        })

    } catch (error) {
        console.error('Summarize error:', error)
        res.status(500).json({ error: error.message })
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
})
