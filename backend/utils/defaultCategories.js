// Default category tree used for first-run seeding and full application reset.
const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', type: 'expense', subs: ['Restaurants', 'Cafe & Coffee', 'Groceries'] },
  { name: 'Shopping & Groceries', type: 'expense', subs: ['Clothing', 'Electronics', 'Supermarket'] },
  { name: 'Utilities', type: 'expense', subs: ['Electricity & Water', 'Internet & Phone'] },
  { name: 'Transportation & Travel', type: 'expense', subs: ['Fuel & Gas', 'Public Transport', 'Flights & Lodging'] },
  { name: 'Entertainment', type: 'expense', subs: ['Movies & Streaming', 'Gaming & Hobbies'] },
  { name: 'Medical & Health', type: 'expense', subs: ['Pharmacy & Meds', 'Doctor & Clinic'] },
  { name: 'Credit Card Payment', type: 'both', subs: [] },
  { name: 'Transfers & Salary', type: 'both', subs: ['Salary & Bonus', 'Investment Income'] },
  { name: 'Fees & Taxes', type: 'expense', subs: ['Bank Fees', 'Late Fees & Taxes'] },
  { name: 'Others', type: 'both', subs: [] }
];

// Income-typed leaf categories regardless of their parent's type.
const INCOME_SUBCATEGORIES = ['Salary & Bonus', 'Investment Income'];

function subCategoryType(subName, parentType) {
  if (INCOME_SUBCATEGORIES.includes(subName)) return 'income';
  if (parentType === 'expense') return 'expense';
  return parentType;
}

module.exports = { DEFAULT_CATEGORIES, subCategoryType };
