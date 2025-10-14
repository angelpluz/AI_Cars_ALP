const keywordResponses: Record<string, string> = {
  car: 'I found information about cars. Would you like to know about electric, sports, or family cars?',
  electric: 'Electric cars are environmentally friendly vehicles powered by batteries. Popular models include Tesla, Rivian, and Nissan Leaf.',
  sports: 'Sports cars are high-performance vehicles designed for speed and handling. Examples include Ferrari, Porsche, and Corvette.',
  family: 'Family cars prioritize space, safety, and comfort. Popular choices include Honda Odyssey, Toyota Highlander, and Subaru Outback.',
  price: 'Car prices vary widely based on make, model, and features. What type of car are you interested in?',
  safety: 'Modern cars come with advanced safety features like ABS, airbags, lane assist, and collision detection.',
  fuel: 'Fuel efficiency depends on the car type. Electric cars have zero emissions, hybrids offer great MPG, and traditional cars vary.',
  maintenance: 'Regular maintenance includes oil changes, tire rotations, brake checks, and fluid levels. Electric cars require less maintenance.',
};

const orderedKeywords = ['maintenance', 'safety', 'fuel', 'price', 'electric', 'sports', 'family', 'car'];

const fallbackDefault =
  "I understand you're asking about cars. Try asking about electric, sports, family cars, price, safety, fuel, or maintenance!";

export function fallbackResponse(query: string): string {
  const lower = query.toLowerCase();
  for (const keyword of orderedKeywords) {
    if (lower.includes(keyword) && keywordResponses[keyword]) {
      return keywordResponses[keyword];
    }
  }
  return fallbackDefault;
}