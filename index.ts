import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

const app = new Hono();

// Serve static files from public directory
app.use('/public/*', serveStatic({ root: './' }));

// Keyword matching logic
const keywordResponses: Record<string, string> = {
  'car': 'I found information about cars. Would you like to know about electric, sports, or family cars?',
  'electric': 'Electric cars are environmentally friendly vehicles powered by batteries. Popular models include Tesla, Rivian, and Nissan Leaf.',
  'sports': 'Sports cars are high-performance vehicles designed for speed and handling. Examples include Ferrari, Porsche, and Corvette.',
  'family': 'Family cars prioritize space, safety, and comfort. Popular choices include Honda Odyssey, Toyota Highlander, and Subaru Outback.',
  'price': 'Car prices vary widely based on make, model, and features. What type of car are you interested in?',
  'safety': 'Modern cars come with advanced safety features like ABS, airbags, lane assist, and collision detection.',
  'fuel': 'Fuel efficiency depends on the car type. Electric cars have zero emissions, hybrids offer great MPG, and traditional cars vary.',
  'maintenance': 'Regular maintenance includes oil changes, tire rotations, brake checks, and fluid levels. Electric cars require less maintenance.'
};

// Home page route
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI Cars Terminal</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .cursor-blink {
          animation: blink 1s infinite;
        }
        .terminal-input:focus {
          outline: none;
        }
        .suggestion-btn {
          transition: all 0.2s ease;
        }
        .suggestion-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        }
      </style>
    </head>
    <body class="bg-black min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-4xl">
        <!-- Header -->
        <div class="mb-8 text-center">
          <h1 class="text-4xl font-bold text-green-500 mb-2">AI Cars Terminal</h1>
          <p class="text-green-400 text-sm">Type your query or select a suggestion below</p>
        </div>

        <!-- Terminal Container -->
        <div class="bg-gray-900 rounded-lg border-2 border-green-500 shadow-2xl overflow-hidden">
          <!-- Terminal Header -->
          <div class="bg-gray-800 px-4 py-2 flex items-center border-b-2 border-green-500">
            <div class="flex space-x-2">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div class="flex-1 text-center text-green-400 text-sm font-mono">AI_Cars_Terminal_v1.0</div>
          </div>

          <!-- Chat Output Area -->
          <div id="output" class="p-4 min-h-[300px] max-h-[400px] overflow-y-auto font-mono text-sm">
            <div class="text-green-400 mb-2">
              <span class="text-green-500">system@ai-cars:~$</span> Welcome to AI Cars Terminal
            </div>
            <div class="text-green-400 mb-4">
              <span class="text-green-500">system@ai-cars:~$</span> How can I assist you today?
            </div>
          </div>

          <!-- Input Area -->
          <div class="border-t-2 border-green-500 p-4 bg-gray-800">
            <form id="chatForm" class="flex items-center space-x-2">
              <span class="text-green-500 font-mono">$</span>
              <input 
                type="text" 
                id="userInput"
                class="terminal-input flex-1 bg-transparent text-green-400 font-mono border-none placeholder-green-600"
                placeholder="Type your query here..."
                autocomplete="off"
              />
              <button type="submit" class="bg-green-600 hover:bg-green-700 text-black font-bold px-4 py-2 rounded transition duration-200">
                Send
              </button>
            </form>
          </div>
        </div>

        <!-- Suggestion Buttons -->
        <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="Tell me about electric cars">
            ⚡ Electric Cars
          </button>
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="What are the best sports cars?">
            🏎️ Sports Cars
          </button>
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="Show me family cars">
            👨‍👩‍👧‍👦 Family Cars
          </button>
          <button class="suggestion-btn bg-gray-900 hover:bg-gray-800 border-2 border-green-500 text-green-400 font-mono py-3 px-4 rounded-lg" data-query="Car maintenance tips">
            🔧 Maintenance
          </button>
        </div>
      </div>

      <script>
        const output = document.getElementById('output');
        const chatForm = document.getElementById('chatForm');
        const userInput = document.getElementById('userInput');
        const suggestionBtns = document.querySelectorAll('.suggestion-btn');

        // Add message to output
        function addMessage(message, isUser = false) {
          const messageDiv = document.createElement('div');
          messageDiv.className = isUser ? 'text-blue-400 mb-2' : 'text-green-400 mb-4';
          messageDiv.innerHTML = \`<span class="\${isUser ? 'text-blue-500' : 'text-green-500'}">$\{isUser ? 'user' : 'ai-assistant'}@ai-cars:~$</span> \${message}\`;
          output.appendChild(messageDiv);
          output.scrollTop = output.scrollHeight;
        }

        // Handle form submission
        chatForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const query = userInput.value.trim();
          if (!query) return;

          // Show user message
          addMessage(query, true);
          userInput.value = '';

          // Send to backend
          try {
            const response = await fetch('/api/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query })
            });
            const data = await response.json();
            addMessage(data.response);
          } catch (error) {
            addMessage('Error: Unable to process your request.', false);
          }
        });

        // Handle suggestion button clicks
        suggestionBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            userInput.value = btn.getAttribute('data-query');
            chatForm.dispatchEvent(new Event('submit'));
          });
        });

        // Focus input on load
        userInput.focus();
      </script>
    </body>
    </html>
  `);
});

// API route for keyword matching
app.post('/api/query', async (c) => {
  const { query } = await c.req.json();
  
  if (!query) {
    return c.json({ response: 'Please enter a query.' });
  }

  const lowerQuery = query.toLowerCase();
  
  // Check for keyword matches - more specific keywords first
  const orderedKeywords = ['maintenance', 'safety', 'fuel', 'price', 'electric', 'sports', 'family', 'car'];
  
  for (const keyword of orderedKeywords) {
    if (lowerQuery.includes(keyword) && keywordResponses[keyword]) {
      return c.json({ response: keywordResponses[keyword] });
    }
  }
  
  // Default response if no keywords match
  return c.json({ 
    response: 'I understand you\'re asking about cars. Try asking about electric, sports, family cars, price, safety, fuel, or maintenance!'
  });
});

// Start server
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};