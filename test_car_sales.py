"""
Test script for the Car Sales LLM system
"""

import sys
from car_sales_llm import CarInventory, CarRAGSystem, CarSalesLLM


def test_car_inventory():
    """Test CarInventory functionality."""
    print("Testing CarInventory...")
    inventory = CarInventory()
    
    # Test: Load inventory
    all_cars = inventory.get_all_cars()
    assert len(all_cars) > 0, "Inventory should not be empty"
    print(f"✓ Loaded {len(all_cars)} cars")
    
    # Test: Search by make
    toyota_cars = inventory.search_cars(make="Toyota")
    assert len(toyota_cars) > 0, "Should find Toyota cars"
    print(f"✓ Found {len(toyota_cars)} Toyota cars")
    
    # Test: Search by price
    affordable_cars = inventory.search_cars(max_price=30000)
    assert len(affordable_cars) > 0, "Should find affordable cars"
    print(f"✓ Found {len(affordable_cars)} cars under $30,000")
    
    # Test: Search by fuel type
    electric_cars = inventory.search_cars(fuel_type="Electric")
    assert len(electric_cars) > 0, "Should find electric cars"
    print(f"✓ Found {len(electric_cars)} electric cars")
    
    # Test: Get car by ID
    car = inventory.get_car_by_id(1)
    assert car is not None, "Should find car with ID 1"
    assert car["make"] == "Toyota", "Car 1 should be a Toyota"
    print("✓ Successfully retrieved car by ID")
    
    print("CarInventory tests passed!\n")
    return True


def test_rag_system():
    """Test CarRAGSystem functionality."""
    print("Testing CarRAGSystem...")
    inventory = CarInventory()
    rag = CarRAGSystem(inventory)
    
    # Test: Retrieve electric cars
    query = "Show me electric cars"
    results = rag.retrieve_relevant_cars(query)
    assert len(results) > 0, "Should find electric cars"
    assert any(car["fuel_type"] == "Electric" for car in results), "Results should include electric cars"
    print(f"✓ Retrieved {len(results)} cars for query: '{query}'")
    
    # Test: Retrieve by make
    query = "I want a Toyota"
    results = rag.retrieve_relevant_cars(query)
    assert len(results) > 0, "Should find Toyota cars"
    print(f"✓ Retrieved {len(results)} cars for query: '{query}'")
    
    # Test: Format car info
    car = inventory.get_car_by_id(1)
    formatted = rag.format_car_info(car)
    assert "Toyota" in formatted, "Formatted info should contain make"
    assert "$" in formatted, "Formatted info should contain price"
    print("✓ Successfully formatted car information")
    
    # Test: Create context
    cars = inventory.get_all_cars()[:2]
    context = rag.create_context(cars)
    assert "Found 2 car(s)" in context, "Context should mention number of cars"
    print("✓ Successfully created context from cars")
    
    print("CarRAGSystem tests passed!\n")
    return True


def test_llm_system():
    """Test CarSalesLLM functionality."""
    print("Testing CarSalesLLM...")
    inventory = CarInventory()
    rag = CarRAGSystem(inventory)
    llm = CarSalesLLM(rag)
    
    # Test: Generate response for electric cars
    query = "Show me electric cars"
    response = llm.generate_response(query)
    assert len(response) > 0, "Response should not be empty"
    assert "electric" in response.lower() or "ev" in response.lower(), "Response should mention electric"
    print(f"✓ Generated response for query: '{query}'")
    print(f"  Response preview: {response[:100]}...")
    
    # Test: Generate response for price query
    query = "What cars do you have under $30000?"
    response = llm.generate_response(query)
    assert len(response) > 0, "Response should not be empty"
    print(f"✓ Generated response for query: '{query}'")
    print(f"  Response preview: {response[:100]}...")
    
    # Test: Generate response for brand query
    query = "Tell me about Toyota vehicles"
    response = llm.generate_response(query)
    assert len(response) > 0, "Response should not be empty"
    print(f"✓ Generated response for query: '{query}'")
    print(f"  Response preview: {response[:100]}...")
    
    print("CarSalesLLM tests passed!\n")
    return True


def test_integration():
    """Test full integration with sample queries."""
    print("Testing Full Integration...")
    inventory = CarInventory()
    rag = CarRAGSystem(inventory)
    llm = CarSalesLLM(rag)
    
    test_queries = [
        "Show me all electric vehicles",
        "I need a car under $25000",
        "What Toyota cars do you have?",
        "I'm looking for a new car",
    ]
    
    for query in test_queries:
        response = llm.generate_response(query)
        assert len(response) > 0, f"Response should not be empty for query: {query}"
        print(f"✓ Query: '{query}'")
        print(f"  Response length: {len(response)} characters")
    
    print("Integration tests passed!\n")
    return True


def main():
    """Run all tests."""
    print("=" * 60)
    print("Running Car Sales LLM System Tests")
    print("=" * 60)
    print()
    
    try:
        test_car_inventory()
        test_rag_system()
        test_llm_system()
        test_integration()
        
        print("=" * 60)
        print("ALL TESTS PASSED! ✓")
        print("=" * 60)
        return 0
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
