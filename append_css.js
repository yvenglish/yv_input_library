const fs = require('fs');
let css = `
/* Theme Toggle */
[data-theme="dark"] {
  --bg: #121212;
  --paper: #1e1e1e;
  --ink: #e0e0e0;
  --muted: #a0a0a0;
  --purple-dark: #d5b8ff;
  --purple-soft: #3700b3;
  --line: rgba(255, 255, 255, 0.1);
  --shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
}
[data-theme="dark"] body {
  background: radial-gradient(circle at top left,rgba(187, 134, 252, .13),transparent 30%),radial-gradient(circle at bottom right,rgba(184,100,53,.10),transparent 28%),linear-gradient(180deg,#1e1e1e 0%,var(--bg) 100%);
}
[data-theme="dark"] .page { background: rgba(30,30,30,0.84); }

/* Flashcards */
.flashcard {
  perspective: 1000px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  height: 140px;
}
.flashcard-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
  cursor: pointer;
}
.flashcard.flipped .flashcard-inner {
  transform: rotateY(180deg);
}
.flashcard-front, .flashcard-back {
  position: absolute;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 22px;
  box-shadow: 0 18px 40px rgba(0,0,0,.06);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.flashcard-back {
  transform: rotateY(180deg);
}

/* Theme Button */
.theme-btn {
  background: transparent;
  font-size: 1.5rem;
  padding: 0 10px;
}

/* Tag Hover */
.tag-pill { cursor: pointer; transition: 0.2s; }
.tag-pill:hover { background: var(--orange); color: white; }

/* Hide heart style background */
.fav-icon:hover { opacity: 0.8; transform: scale(1.1); }
`;
fs.appendFileSync('public/styles.css', css);
console.log('Appended CSS successfully');
