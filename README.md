# AI_Cars_ALP
RAG-LLM-Response System for Car Sales

## Overview

This project implements an AI-powered car sales assistant using Retrieval Augmented Generation (RAG) and Large Language Models (LLM). The system helps customers find and learn about cars for sale by intelligently retrieving relevant vehicles from the inventory and generating natural, helpful responses.

## Features

- **Intelligent Car Search**: Natural language queries to find cars matching customer preferences
- **RAG-Based Retrieval**: Retrieves relevant cars from inventory based on query context
- **LLM Integration**: Generates human-like responses using OpenAI's GPT models (optional)
- **Template Fallback**: Works without API keys using template-based responses
- **Rich Inventory**: Sample car inventory with detailed specifications
- **Interactive CLI**: Easy-to-use command-line interface

## Installation

1. Clone the repository:
```bash
git clone https://github.com/angelpluz/AI_Cars_ALP.git
cd AI_Cars_ALP
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. (Optional) Configure OpenAI API key:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Usage

### Interactive Mode

Run the car sales assistant for interactive conversations:
```bash
python car_sales_llm.py
```

### Demo Mode

Run a quick demonstration of the system:
```bash
python demo.py
```

### Example Queries

- "Show me electric cars"
- "I'm looking for a Toyota under $30,000"
- "What SUVs do you have?"
- "Show me all available cars"
- "I need a reliable family car"
- "What's the cheapest car you have?"

## Project Structure

```
AI_Cars_ALP/
├── car_sales_llm.py      # Main application with RAG-LLM implementation
├── car_inventory.json    # Car inventory database
├── test_car_sales.py     # Comprehensive test suite
├── demo.py               # Demo script for quick showcase
├── requirements.txt      # Python dependencies
├── .env.example         # Example environment configuration
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## How It Works

1. **User Query**: Customer asks a question in natural language
2. **Retrieval (RAG)**: System analyzes the query and retrieves relevant cars from inventory
3. **Context Building**: Selected cars are formatted into context for the LLM
4. **Generation**: LLM generates a natural, helpful response based on the context
5. **Response**: Customer receives personalized car recommendations

## Architecture

### Components

- **CarInventory**: Manages car data and search operations
- **CarRAGSystem**: Implements retrieval logic for finding relevant cars
- **CarSalesLLM**: Handles LLM integration and response generation

### RAG Implementation

The system uses a simplified RAG approach:
- Query analysis to extract search criteria (price range, make, fuel type, etc.)
- Filtering inventory based on extracted criteria
- Context creation from relevant results
- LLM-based response generation with retrieved context

## Configuration

### With OpenAI API (Recommended for best results)

1. Get an API key from [OpenAI](https://platform.openai.com/)
2. Create a `.env` file:
```
OPENAI_API_KEY=your_actual_api_key_here
```

### Without OpenAI API

The system works without an API key using template-based responses. While less sophisticated, it still provides helpful car recommendations based on inventory search.

## Extending the System

### Adding More Cars

Edit `car_inventory.json` to add more vehicles:
```json
{
  "id": 9,
  "make": "Brand",
  "model": "Model Name",
  "year": 2023,
  "price": 30000,
  "mileage": 10000,
  "color": "Color",
  "transmission": "Automatic",
  "fuel_type": "Gasoline",
  "features": ["Feature1", "Feature2"],
  "description": "Description here"
}
```

### Customizing Search Logic

Modify the `retrieve_relevant_cars()` method in `CarRAGSystem` class to add more sophisticated retrieval logic, such as:
- Vector embeddings for semantic search
- Machine learning-based ranking
- User preference learning

## Dependencies

- `openai>=1.0.0`: OpenAI API client (for LLM integration)
- `python-dotenv>=1.0.0`: Environment variable management
- `numpy>=1.24.0`: Numerical operations
- `scikit-learn>=1.3.0`: Machine learning utilities

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an issue on GitHub.
