export const CATEGORIES = ["Rent", "Salaries", "Utilities", "Transport", "Marketing", "Supplies", "Miscellaneous"];
export const METHODS = ["Cash", "Bank", "UPI", "Card"];
export const ACCOUNTS = ["HDFC Current A/c", "SBI Savings A/c", "Business UPI"];
export const STATUSES = ["Paid", "Partially paid", "Unpaid"];
export const TYPES = ["Fixed", "Variable"];

// Default type picked when a category is chosen (admin can change it).
export const DEFAULT_TYPE = {
  Rent: "Fixed", Salaries: "Fixed", Utilities: "Variable", Transport: "Variable",
  Marketing: "Variable", Supplies: "Variable", Miscellaneous: "Variable",
};

// Monthly spending limits per category (will be editable in Admin settings later).
export const LIMITS = {
  Rent: 50000, Salaries: 130000, Utilities: 20000, Transport: 25000,
  Marketing: 35000, Supplies: 30000, Miscellaneous: 20000,
};

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
export const today = () => day(0);

// Mock data. Replace with FastAPI calls later.
export const seedExpenses = [
  { id: 1, ref: "EXP-377", date: day(-1), vendor: "City Power Board", category: "Utilities", type: "Variable", method: "UPI", account: "Business UPI", status: "Paid", amount: 8600, paid: 8600, due: "", repeat: false, notes: "" },
  { id: 2, ref: "EXP-376", date: day(-2), vendor: "Office landlord", category: "Rent", type: "Fixed", method: "Bank", account: "HDFC Current A/c", status: "Paid", amount: 45000, paid: 45000, due: "", repeat: true, frequency: "Monthly", notes: "" },
  { id: 3, ref: "EXP-379", date: day(-4), vendor: "PrintHub Supplies", category: "Supplies", type: "Variable", method: "Bank", account: "SBI Savings A/c", status: "Unpaid", amount: 9400, paid: 0, due: day(3), repeat: false, notes: "" },
  { id: 4, ref: "EXP-375", date: day(-8), vendor: "AdBoost Media", category: "Marketing", type: "Variable", method: "Card", account: "HDFC Current A/c", status: "Partially paid", amount: 38000, paid: 20000, due: day(-2), repeat: false, notes: "Balance after campaign report" },
  { id: 5, ref: "EXP-374", date: day(-10), vendor: "Staff payroll", category: "Salaries", type: "Fixed", method: "Bank", account: "HDFC Current A/c", status: "Paid", amount: 120000, paid: 120000, due: "", repeat: true, frequency: "Monthly", notes: "" },
];