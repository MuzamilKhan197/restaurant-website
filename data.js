export const restaurant = {
  name: 'Saffron & Ember',
  tagline: 'Good food. Great company.',
  currency: 'PKR',
  locale: 'en-PK',
  timeZone: 'Asia/Karachi',
  location: 'Lahore, Pakistan',
  locationNote: 'Sample location — replace with your restaurant address.',
  email: 'hello@example.com',
  phone: '',
  deliveryFee: 200,
  taxRate: 0,
  bookingInterval: 30,
  maxPartySize: 12,
  maxBookingDays: 60,
  reservationDuration: 60,
  seatCapacity: 36,
  closedDates: [],
  orderingEnabled: true,
  reservationsEnabled: true,
  deliveryEnabled: true,
  deliveryAreas: ['Gulberg', 'DHA', 'Model Town'],
  minimumDelivery: 1000,
  sampleBusiness: true,
  // Opening and last reservation times, in the restaurant's local time.
  hours: {
    0: { open: '12:00', close: '22:00', lastBooking: '21:00' },
    1: { open: '12:00', close: '22:00', lastBooking: '21:00' },
    2: { open: '12:00', close: '22:00', lastBooking: '21:00' },
    3: { open: '12:00', close: '22:00', lastBooking: '21:00' },
    4: { open: '12:00', close: '22:00', lastBooking: '21:00' },
    5: { open: '12:00', close: '23:00', lastBooking: '22:00' },
    6: { open: '12:00', close: '23:00', lastBooking: '22:00' }
  },
  hoursDisplay: [
    ['Sunday – Thursday', '12:00 pm – 10:00 pm'],
    ['Friday – Saturday', '12:00 pm – 11:00 pm']
  ]
};

export const categories = ['All dishes', 'Starters', 'Mains', 'From the grill', 'Desserts', 'Drinks'];

export const dishes = [
  { id: 'burrata', name: 'Garden burrata', category: 'Starters', price: 1450, description: 'Creamy burrata, heirloom tomatoes, fresh basil and a bright herb dressing.', image: 'salad', tags: ['Vegetarian'], allergens: 'Milk', featured: true },
  { id: 'hummus', name: 'Smoky hummus', category: 'Starters', price: 750, description: 'Silky chickpea hummus, smoked paprika, extra virgin olive oil and warm flatbread.', image: 'hummus', tags: ['Vegan'], allergens: 'Sesame, wheat' },
  { id: 'soup', name: 'Roasted tomato soup', category: 'Starters', price: 650, description: 'Slow-roasted tomatoes, basil oil and a slice of toasted sourdough.', image: 'soup', tags: ['Vegan'], allergens: 'Wheat' },
  { id: 'chicken', name: 'Ember-roasted chicken', category: 'From the grill', price: 1950, description: 'Flame-kissed chicken, saffron rice, charred lemon and our signature green sauce.', image: 'chicken', tags: ['Signature', 'Gluten-free'], allergens: 'Milk', featured: true },
  { id: 'steak', name: 'Peppercorn steak', category: 'From the grill', price: 3250, description: 'Grilled beef steak, silky potato mash, seasonal greens and peppercorn sauce.', image: 'steak', tags: ['Gluten-free'], allergens: 'Milk' },
  { id: 'salmon', name: 'Citrus grilled salmon', category: 'From the grill', price: 2850, description: 'Grilled salmon with roasted vegetables, lemon butter and garden herbs.', image: 'salmon', tags: ['Gluten-free'], allergens: 'Fish, milk' },
  { id: 'pasta', name: 'Wild mushroom pasta', category: 'Mains', price: 1650, description: 'Ribbon pasta, sautéed mushrooms, parmesan and a little truffle warmth.', image: 'pasta', tags: ['Vegetarian'], allergens: 'Wheat, egg, milk', featured: true },
  { id: 'bowl', name: 'Harvest grain bowl', category: 'Mains', price: 1250, description: 'Herbed grains, roasted seasonal vegetables, avocado and a lemon-tahini drizzle.', image: 'salad', tags: ['Vegan'], allergens: 'Wheat, sesame' },
  { id: 'cake', name: 'Chocolate indulgence', category: 'Desserts', price: 850, description: 'A rich chocolate cake with dark chocolate ganache and a soft, fudgy heart.', image: 'cake', tags: ['Vegetarian'], allergens: 'Wheat, egg, milk', featured: true },
  { id: 'cheesecake', name: 'Berry cheesecake', category: 'Desserts', price: 850, description: 'Vanilla cheesecake, a buttery biscuit base and a spoonful of berry compote.', image: 'cheesecake', tags: ['Vegetarian'], allergens: 'Wheat, egg, milk' },
  { id: 'lemonade', name: 'Mint & lime cooler', category: 'Drinks', price: 450, description: 'Fresh lime, garden mint and sparkling water. Bright, crisp and refreshing.', image: 'lemonade', tags: ['Vegan', 'Gluten-free'], allergens: 'None listed' },
  { id: 'coffee', name: 'House iced latte', category: 'Drinks', price: 550, description: 'A double shot of espresso over ice, finished with cold milk.', image: 'coffee', tags: ['Vegetarian', 'Gluten-free'], allergens: 'Milk' }
];
