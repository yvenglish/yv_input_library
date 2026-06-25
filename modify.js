const fs = require('fs');
const path = 'data.js';
let data = fs.readFileSync(path, 'utf8');

// Using regex to inject hasAudio and hasVideo after audioFile
// We'll find "audioFile": "...", and right after it insert hasAudio and hasVideo
data = data.replace(/"embed":\s*"(.*?)",\s*"audioFile":\s*"(.*?)"/g, (match, embed, audio) => {
    const hasVideo = embed.trim() !== "";
    const hasAudio = audio.trim() !== "";
    return `"embed": "${embed}",\n    "audioFile": "${audio}",\n    "hasVideo": ${hasVideo},\n    "hasAudio": ${hasAudio}`;
});

fs.writeFileSync(path, data, 'utf8');
console.log('data.js updated successfully!');
