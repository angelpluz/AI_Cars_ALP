"""
Demo script to showcase the Car Sales LLM system functionality
This script demonstrates the key features without requiring user input.
"""

from car_sales_llm import CarInventory, CarRAGSystem, CarSalesLLM


def demo():
    """Run demonstration of the car sales system."""
    print("=" * 70)
    print("AI Car Sales Assistant - DEMO")
    print("Powered by RAG-LLM Technology")
    print("=" * 70)
    print()
    
    # Initialize the system
    inventory = CarInventory()
    rag_system = CarRAGSystem(inventory)
    llm = CarSalesLLM(rag_system)
    
    print(f"✓ System initialized with {len(inventory.get_all_cars())} cars in inventory")
    print()
    
    # Demo queries
    demo_queries = [
        "Show me electric cars",
        "I'm looking for a car under $30,000",
        "What Toyota vehicles do you have?",
        "I need a reliable SUV",
    ]
    
    for i, query in enumerate(demo_queries, 1):
        print("-" * 70)
        print(f"Demo Query {i}: {query}")
        print("-" * 70)
        
        response = llm.generate_response(query)
        print(response)
        print()
    
    # Show statistics
    print("=" * 70)
    print("Inventory Statistics:")
    print("=" * 70)
    
    all_cars = inventory.get_all_cars()
    print(f"Total cars: {len(all_cars)}")
    
    electric = inventory.search_cars(fuel_type="Electric")
    print(f"Electric vehicles: {len(electric)}")
    
    affordable = inventory.search_cars(max_price=30000)
    print(f"Cars under $30,000: {len(affordable)}")
    
    new = inventory.search_cars(min_year=2022)
    print(f"2022+ models: {len(new)}")
    
    print()
    print("Demo completed successfully! ✓")


if __name__ == "__main__":
    demo()
