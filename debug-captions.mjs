// Debug script to analyze YouTube caption availability
const videoId = 'jm2jBW462bU';

console.log('Debugging captions for video:', videoId);
console.log('');

// Test 1: Try youtube-transcript-api alternative - using Python-style endpoint
console.log('=== Test 1: Alternative transcript fetch ===');
try {
    // This mimics what youtube-transcript does internally
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': '' // No cookies needed
        }
    });

    const html = await response.text();
    console.log('Page length:', html.length);

    // Extract the ytInitialPlayerResponse which contains everything
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|<\/script>)/s);
    if (playerMatch) {
        try {
            const playerData = JSON.parse(playerMatch[1]);
            console.log('\nPlayer data found!');

            const captions = playerData.captions?.playerCaptionsTracklistRenderer;
            if (captions) {
                console.log('Captions found!');
                console.log('Caption tracks:', captions.captionTracks?.length);

                if (captions.captionTracks) {
                    for (const track of captions.captionTracks) {
                        console.log(`\n  Track: ${track.languageCode} (${track.kind || 'manual'})`);
                        console.log(`  Name: ${track.name?.simpleText}`);

                        // Get the base URL and test it
                        let url = track.baseUrl;
                        console.log('  URL (first 100):', url.substring(0, 100));

                        // Try with tlang parameter for auto-translation
                        const testUrls = [
                            url + '&fmt=json3',
                            url + '&fmt=srv1',
                            url.replace('&kind=asr', '') + '&fmt=json3', // Try without ASR flag
                        ];

                        for (const testUrl of testUrls) {
                            console.log('\n  Testing:', testUrl.substring(0, 80) + '...');
                            const res = await fetch(testUrl);
                            const text = await res.text();
                            console.log(`    Status: ${res.status}, Length: ${text.length}`);
                            if (text.length > 10) {
                                console.log('    Preview:', text.substring(0, 150));
                                break;
                            }
                        }
                    }
                }
            } else {
                console.log('No captions object in player data');
            }
        } catch (parseErr) {
            console.log('Failed to parse player response:', parseErr.message);
        }
    } else {
        console.log('No ytInitialPlayerResponse found');
    }
} catch (err) {
    console.log('Error:', err.message);
}

// Test 2: Try the /get_video_info endpoint (deprecated but might work)
console.log('\n\n=== Test 2: get_video_info endpoint ===');
try {
    const infoUrl = `https://www.youtube.com/get_video_info?video_id=${videoId}&el=embedded&ps=default&eurl=`;
    const res = await fetch(infoUrl);
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Length:', text.length);
    if (text.includes('caption')) {
        console.log('Contains caption reference!');
    }
} catch (err) {
    console.log('Error:', err.message);
};
