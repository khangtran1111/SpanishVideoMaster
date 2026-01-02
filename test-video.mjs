import { YoutubeTranscript } from 'youtube-transcript';

const videoId = 'jm2jBW462bU'; // User's test video

console.log('Testing transcript fetch for video:', videoId);
console.log('URL: https://www.youtube.com/watch?v=' + videoId);
console.log('');

// Try English since the server log says it's available
console.log('Trying en (English)...');
try {
    const result = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    console.log(`✓ Success! Got ${result.length} items`);
    if (result.length > 0) {
        console.log('First 5 segments:');
        result.slice(0, 5).forEach((item, i) => {
            console.log(`  ${i + 1}. [${(item.offset / 1000).toFixed(1)}s] "${item.text}"`);
        });
    } else {
        console.log('Empty result!');
    }
} catch (error) {
    console.log(`Error: ${error.message}`);
}

console.log('\nTrying without language option...');
try {
    const result = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Got ${result.length} items`);
    if (result.length > 0) {
        console.log('First 5:');
        result.slice(0, 5).forEach((item, i) => {
            console.log(`  ${i + 1}. [${(item.offset / 1000).toFixed(1)}s] "${item.text}"`);
        });
    }
} catch (error) {
    console.log('Error:', error.message);
}
