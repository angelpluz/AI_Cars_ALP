# AI_Cars_ALP

AI Cars Terminal - A modern web application with an AI-style chat interface for car information.

## Features

- 🎨 **Terminal-Style UI**: Beautiful zTerminal-inspired interface with Tailwind CSS
- 💬 **AI Chat Input**: Interactive chat bar for natural language queries
- 🚀 **Quick Suggestions**: 4 pre-configured suggestion buttons for common queries
- 🔍 **Keyword Matching**: Backend logic to match keywords and provide relevant responses
- ⚡ **Fast Performance**: Built with Bun runtime and Hono framework

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Bun installed on your system ([Install Bun](https://bun.sh))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/angelpluz/AI_Cars_ALP.git
cd AI_Cars_ALP
```

2. Install dependencies:
```bash
bun install
```

### Running the Application

Start the development server:
```bash
bun run index.ts
```

The application will be available at `http://localhost:3000`

## Usage

1. **Type Queries**: Use the input bar to type questions about cars
2. **Suggestion Buttons**: Click any of the 4 suggestion buttons:
   - ⚡ Electric Cars
   - 🏎️ Sports Cars
   - 👨‍👩‍👧‍👦 Family Cars
   - 🔧 Maintenance

3. **Keyword Matching**: The backend recognizes keywords like:
   - `electric`, `sports`, `family` - Car types
   - `safety`, `fuel`, `maintenance` - Car features
   - `price` - Cost information

## Project Structure

```
AI_Cars_ALP/
├── index.ts          # Main server file with Hono setup and routes
├── package.json      # Project dependencies
├── tsconfig.json     # TypeScript configuration
├── .gitignore       # Git ignore rules
└── README.md        # This file
```

## API Endpoints

- `GET /` - Serves the landing page
- `POST /api/query` - Processes user queries and returns responses

## Development

The application uses:
- Hono for routing and API endpoints
- Tailwind CSS CDN for styling (no build step required)
- TypeScript for type safety
- Bun for fast runtime performance

