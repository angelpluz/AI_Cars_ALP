"""
Car Sales RAG-LLM System
A Retrieval Augmented Generation system for helping customers find and learn about cars for sale.
"""

import json
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class CarInventory:
    """Manages car inventory data and retrieval operations."""
    
    def __init__(self, inventory_file: str = "car_inventory.json"):
        self.inventory_file = inventory_file
        self.cars = self._load_inventory()
    
    def _load_inventory(self) -> List[Dict[str, Any]]:
        """Load car inventory from JSON file."""
        try:
            with open(self.inventory_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: {self.inventory_file} not found. Using empty inventory.")
            return []
    
    def get_all_cars(self) -> List[Dict[str, Any]]:
        """Return all cars in inventory."""
        return self.cars
    
    def search_cars(self, **criteria) -> List[Dict[str, Any]]:
        """
        Search cars based on criteria.
        
        Args:
            **criteria: Key-value pairs to filter cars (e.g., make="Toyota", max_price=30000)
        
        Returns:
            List of cars matching the criteria
        """
        results = self.cars.copy()
        
        for key, value in criteria.items():
            if key == "max_price":
                results = [car for car in results if car.get("price", 0) <= value]
            elif key == "min_price":
                results = [car for car in results if car.get("price", 0) >= value]
            elif key == "max_mileage":
                results = [car for car in results if car.get("mileage", 0) <= value]
            elif key == "min_year":
                results = [car for car in results if car.get("year", 0) >= value]
            elif key == "fuel_type":
                results = [car for car in results if car.get("fuel_type", "").lower() == value.lower()]
            elif key == "make":
                results = [car for car in results if car.get("make", "").lower() == value.lower()]
            elif key == "model":
                results = [car for car in results if car.get("model", "").lower() == value.lower()]
            elif key == "color":
                results = [car for car in results if car.get("color", "").lower() == value.lower()]
        
        return results
    
    def get_car_by_id(self, car_id: int) -> Dict[str, Any]:
        """Get a specific car by ID."""
        for car in self.cars:
            if car.get("id") == car_id:
                return car
        return None


class CarRAGSystem:
    """Retrieval Augmented Generation system for car sales."""
    
    def __init__(self, inventory: CarInventory):
        self.inventory = inventory
    
    def retrieve_relevant_cars(self, query: str) -> List[Dict[str, Any]]:
        """
        Retrieve relevant cars based on the user query.
        
        This is a simplified retrieval system that extracts key information from the query.
        In a production system, you would use embeddings and vector similarity.
        """
        query_lower = query.lower()
        
        # Extract search criteria from query
        criteria = {}
        
        # Price-related keywords
        if "under" in query_lower or "less than" in query_lower or "cheaper" in query_lower:
            # Try to extract price
            words = query_lower.split()
            for i, word in enumerate(words):
                if word in ["under", "less", "cheaper"] and i + 1 < len(words):
                    try:
                        price = int(''.join(filter(str.isdigit, words[i + 1])))
                        criteria["max_price"] = price
                    except ValueError:
                        pass
        
        # Make/brand keywords
        makes = ["toyota", "honda", "tesla", "ford", "bmw", "chevrolet", "mazda", "hyundai"]
        for make in makes:
            if make in query_lower:
                criteria["make"] = make.capitalize()
        
        # Fuel type keywords
        if "electric" in query_lower or "ev" in query_lower:
            criteria["fuel_type"] = "Electric"
        elif "gas" in query_lower or "gasoline" in query_lower:
            criteria["fuel_type"] = "Gasoline"
        
        # Year keywords
        if "new" in query_lower or "recent" in query_lower or "latest" in query_lower:
            criteria["min_year"] = 2022
        
        # If no specific criteria, return all cars
        if criteria:
            return self.inventory.search_cars(**criteria)
        else:
            return self.inventory.get_all_cars()
    
    def format_car_info(self, car: Dict[str, Any]) -> str:
        """Format car information for display."""
        return f"""
{car['year']} {car['make']} {car['model']}
- Price: ${car['price']:,}
- Mileage: {car['mileage']:,} miles
- Color: {car['color']}
- Transmission: {car['transmission']}
- Fuel Type: {car['fuel_type']}
- Features: {', '.join(car['features'])}
- Description: {car['description']}
""".strip()
    
    def create_context(self, cars: List[Dict[str, Any]]) -> str:
        """Create context string from retrieved cars for LLM."""
        if not cars:
            return "No cars found matching the criteria."
        
        context = f"Found {len(cars)} car(s) matching your criteria:\n\n"
        for i, car in enumerate(cars, 1):
            context += f"Car {i}:\n{self.format_car_info(car)}\n\n"
        
        return context


class CarSalesLLM:
    """LLM interface for car sales responses."""
    
    def __init__(self, rag_system: CarRAGSystem):
        self.rag_system = rag_system
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.use_llm = self.api_key and self.api_key != "your_openai_api_key_here"
        
        if self.use_llm:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.api_key)
            except ImportError:
                print("Warning: OpenAI library not installed. Using template-based responses.")
                self.use_llm = False
        else:
            print("Note: No OpenAI API key configured. Using template-based responses.")
            print("To use LLM features, set OPENAI_API_KEY in .env file.")
    
    def generate_response(self, user_query: str) -> str:
        """Generate a response to user query using RAG + LLM."""
        # Retrieve relevant cars
        relevant_cars = self.rag_system.retrieve_relevant_cars(user_query)
        context = self.rag_system.create_context(relevant_cars)
        
        if self.use_llm:
            return self._generate_llm_response(user_query, context, relevant_cars)
        else:
            return self._generate_template_response(user_query, context, relevant_cars)
    
    def _generate_llm_response(self, query: str, context: str, cars: List[Dict[str, Any]]) -> str:
        """Generate response using OpenAI LLM."""
        try:
            system_prompt = """You are a helpful and knowledgeable car sales assistant. 
Your job is to help customers find the perfect car based on their needs and preferences.
Use the provided car inventory information to answer customer questions accurately.
Be friendly, professional, and highlight relevant features that match the customer's needs.
If asked about specific details, refer to the inventory data provided."""

            user_prompt = f"""Customer Query: {query}

Available Cars:
{context}

Please provide a helpful response to the customer's query based on the available inventory."""

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            return self._generate_template_response(query, context, cars)
    
    def _generate_template_response(self, query: str, context: str, cars: List[Dict[str, Any]]) -> str:
        """Generate response using templates (fallback when no LLM available)."""
        if not cars:
            return """I apologize, but I couldn't find any cars matching your specific criteria in our current inventory. 

However, we have other great options available! Could you provide more details about what you're looking for? For example:
- What's your budget range?
- Do you prefer a specific type of vehicle (sedan, SUV, truck, electric)?
- Are there any must-have features?

I'd be happy to help you find the perfect car!"""
        
        response = f"Thank you for your interest! I found {len(cars)} great option(s) for you:\n\n"
        response += context
        response += "\n\nWould you like more information about any of these vehicles? I can provide additional details about features, financing options, or schedule a test drive!"
        
        return response


def main():
    """Main function to run the car sales LLM system."""
    print("=" * 60)
    print("AI Car Sales Assistant")
    print("Powered by RAG-LLM Technology")
    print("=" * 60)
    print()
    
    # Initialize the system
    inventory = CarInventory()
    rag_system = CarRAGSystem(inventory)
    llm = CarSalesLLM(rag_system)
    
    print(f"Loaded {len(inventory.get_all_cars())} cars into inventory.")
    print()
    print("Ask me anything about our cars for sale!")
    print("Examples:")
    print("  - Show me electric cars")
    print("  - I'm looking for a Toyota under $30,000")
    print("  - What SUVs do you have?")
    print("  - Show me all available cars")
    print()
    print("Type 'quit' or 'exit' to end the conversation.")
    print("-" * 60)
    print()
    
    while True:
        user_input = input("You: ").strip()
        
        if not user_input:
            continue
        
        if user_input.lower() in ['quit', 'exit', 'bye', 'goodbye']:
            print("\nThank you for visiting! Have a great day!")
            break
        
        print("\nAssistant: ", end="")
        response = llm.generate_response(user_input)
        print(response)
        print("\n" + "-" * 60 + "\n")


if __name__ == "__main__":
    main()
