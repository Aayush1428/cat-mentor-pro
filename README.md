# CAT Mentor Pro

An end-to-end, AI-powered CAT (Common Admission Test) preparation platform covering VARC, DILR, and Quantitative Aptitude — with topic-wise practice, performance analysis, vocabulary building, previous year papers, and full mock tests.

Built with React 18 + Vite 5 + Tailwind CSS. No backend database — everything (progress, cache, performance data) lives in your browser's localStorage. Deploys free to Vercel.

## Features

### 📊 My Analysis
Tracks your accuracy topic-by-topic and section-by-section. Automatically flags weak topics (below 60% accuracy) so you know exactly where to focus, and highlights your strengths. Includes a radar chart of section-wise performance.

### 📖 VARC (Verbal Ability & Reading Comprehension)
- **Reading Comprehension**: AI-generated passages (choose topic + difficulty) with Main Idea, Inference, Tone, and Vocabulary-in-Context questions
- **Para Jumbles**: Drag-to-reorder sentence arrangement with explanation of connector logic
- **Para Summary**: Choose the best one-line summary, with trap explanations
- **Grammar**: Error correction and sentence improvement questions

### 🧩 DILR (Data Interpretation & Logical Reasoning)
Topic-wise sets for every major DILR pattern:
- Seating Arrangements, Games & Tournaments, Scheduling, Grouping & Selection, Venn Diagrams, Coins & Weights
- DI: Tables, Bar Charts, Pie Charts, Line Graphs, Caselets
- Each set includes the full scenario, conditions, step-by-step solutions, and an "approach/strategy" hint

### 🔢 Quantitative Aptitude
All QA topics organized by **priority** (🔴 Must Do / 🟡 Important / 🟢 Optional) across Arithmetic, Number System, Algebra, Geometry, and Modern Math — with difficulty selection and full worked solutions + shortcuts.

### 💡 Vocabulary Builder
- **Daily Words**: 12 new high-priority words per day across 8 categories, with pronunciation, synonyms/antonyms, memory tricks, and CAT-context notes
- **Vocabulary Quiz**: Auto-generated 10-question quiz on the day's words
- **AI Predictions**: Words predicted as likely to appear based on recurring CAT passage themes (philosophy, economics, science, social issues)

### 📄 Previous Year Papers (2014–2024)
Organized by year and slot, with direct links to:
- [Cracku](https://cracku.in/cat-previous-papers/)
- [CATKing](https://catking.in/exam/cat-exam/previous-year-papers)
- [iQuanta](https://www.iquanta.in/cat-question-papers)

### 📚 Topic-wise PYQs
Practice previous-year-style questions filtered by specific topic, with the CAT year/slot noted for each question where relevant.

### 🎯 Mock Tests
Full CAT-pattern mocks (Full 120-min / Sectional / Mini) with:
- Section-wise timer, question navigator, TITA question support
- Detailed results: net score, accuracy, section-wise breakdown chart, estimated percentile, and weak-area callouts

### 🤖 AI Tutor
Chat interface for any CAT doubt — solving a specific question, explaining a concept, or exam strategy advice.

## AI Providers

This app supports two interchangeable AI providers — bring your own API key for either or both:

1. **Groq** (recommended for speed) — free tier, runs Llama 3.3 70B extremely fast
2. **DeepSeek** — strong reasoning quality at low cost

Set a "preferred provider" in Settings. If it fails or has no key, the app automatically falls back to the other.

### Getting a free Groq API key
1. Go to [console.groq.com](https://console.groq.com) → sign up (free)
2. **API Keys** → **Create API Key**
3. Copy the key (`gsk_...`) into the app's Settings screen

### Getting a DeepSeek API key
1. Go to [platform.deepseek.com](https://platform.deepseek.com) → sign up, add a small credit balance
2. **API Keys** → **Create new key**
3. Copy the key (`sk-...`) into the app's Settings screen

Keys are stored only in your browser's localStorage and sent directly (via this app's own serverless proxy) to Groq/DeepSeek — never stored on any server.

## Local Development

```bash
npm install
npm run dev
```
Open the printed local URL, go to **Settings**, and add your Groq/DeepSeek API key(s).

## Deploying to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cat-mentor-pro.git
git push -u origin main
```

### 2. Deploy on Vercel
1. [vercel.com](https://vercel.com) → sign in with GitHub
2. **Add New → Project** → import `cat-mentor-pro`
3. Vercel auto-detects Vite + `vercel.json` — no environment variables needed
4. **Deploy**

Once live, open the URL → **Settings** → add your API key(s). Each visitor's key is stored only in their own browser.

## Project Structure

```
cat-mentor-pro/
├── api/
│   ├── groq.js              # Serverless proxy to Groq
│   └── deepseek.js          # Serverless proxy to DeepSeek
├── src/
│   ├── components/
│   │   ├── layout/            # Sidebar, TopBar, Layout
│   │   └── ui/                 # Card, Badge, ScoreRing, Toast, etc.
│   ├── data/
│   │   └── curriculum.js      # All CAT topics, priorities, PYQ metadata
│   ├── modules/
│   │   ├── Dashboard.jsx
│   │   ├── Analysis.jsx        # Performance analysis + charts
│   │   ├── VARC.jsx            # RC, Para Jumbles, Para Summary, Grammar
│   │   ├── DILR.jsx            # All LR/DI topic sets
│   │   ├── Quant.jsx           # All QA topics, priority-ordered
│   │   ├── Vocabulary.jsx      # Daily words, quiz, predictions
│   │   ├── PreviousPapers.jsx  # PYQ paper links + topic-wise PYQs
│   │   ├── MockTest.jsx        # Full timed mock tests
│   │   ├── AITutor.jsx
│   │   └── Settings.jsx
│   ├── utils/
│   │   ├── ai.js               # Dual-provider AI caller with fallback + caching
│   │   └── performance.js      # Topic-wise accuracy tracking
│   ├── App.jsx
│   └── main.jsx
├── vercel.json
└── vite.config.js
```

## How the Analysis Engine Works

Every question you answer across VARC, DILR, and Quant is recorded (topic, correct/incorrect, time taken) into `localStorage` via `utils/performance.js`. The **My Analysis** page aggregates this into:
- Per-topic accuracy % (color-coded: green ≥80%, orange 60–79%, red <60%)
- A radar chart comparing your three sections
- An explicit "Focus Here" list of your weakest topics, sorted worst-first

This is what lets the app tell you *"you're weak in Time-Speed-Distance and Seating Arrangements — spend more time there"* instead of generic advice.

## Tech Stack

React 18 · Vite 5 · Tailwind CSS · Recharts · Lucide Icons · Vercel Serverless Functions
