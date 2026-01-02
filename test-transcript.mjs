import { YoutubeTranscript } from 'youtube-transcript';

const videoId = 'lZc6gCj2_QY';

console.log('Testing transcript fetch for video:', videoId);
console.log('URL: https://www.youtube.com/watch?v=' + videoId);
console.log('');

// Try different language options
const languages = ['es', 'es-419', 'es-ES', 'en', 'vi', null];

for (const lang of languages) {
    try {
        console.log(`Trying language: ${lang || 'auto'}...`);
        const result = lang
            ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
            : await YoutubeTranscript.fetchTranscript(videoId);

        if (result && result.length > 0) {
            console.log(`✓ Success! Got ${result.length} items in ${lang || 'auto'}`);
            console.log('First 5 segments:');
            result.slice(0, 5).forEach((item, i) => {
                console.log(`  ${i + 1}. [${(item.offset / 1000).toFixed(1)}s] "${item.text}"`);
            });
            console.log('');
        } else {
            console.log(`  ✗ ${lang || 'auto'}: Empty result (0 items)`);
        }
    } catch (error) {
        console.log(`  ✗ ${lang || 'auto'}: ${error.message}`);
    }
}

// Also try without any options
console.log('\nTrying default fetch (no options)...');
try {
    const defaultResult = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Got ${defaultResult.length} items`);
    if (defaultResult.length > 0) {
        console.log('First 5:');
        defaultResult.slice(0, 5).forEach((item, i) => {
            console.log(`  ${i + 1}. [${(item.offset / 1000).toFixed(1)}s] "${item.text}"`);
        });
    }
} catch (error) {
    console.log('Error:', error.message);
}
