// Test transcript endpoint
const videoId = 'jm2jBW462bU';
const url = `http://127.0.0.1:3002/api/transcript/${videoId}?lang=es`;

console.log('Testing:', url);

try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.log('❌ Error:', data.error);
    } else {
        console.log('✓ Success!');
        console.log('Language:', data.language);
        console.log('Segments:', data.segments?.length || 'N/A');
        console.log('\nFirst 3 segments:');
        (data.segments || data).slice(0, 3).forEach((seg, i) => {
            console.log(`${i + 1}. [${seg.start.toFixed(1)}s] "${seg.text}"`);
        });
    }
} catch (error) {
    console.error('❌ Fetch error:', error.message);
}
