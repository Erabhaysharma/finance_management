// Mock data. Replace with FastAPI calls later.
export const kpis = [
  { key: "income", label: "Total income", value: 428500, change: 12.4 },
  { key: "expense", label: "Total expenses", value: 296200, change: 5.1 },
  { key: "profit", label: "Operating profit", value: 132300, change: 21.8 },
  { key: "cash", label: "Available cash", value: 214800, change: -2.3 },
];

export const monthly = [
  { m: "May", income: 310000, expense: 241000 },
  { m: "Jun", income: 335000, expense: 252000 },
  { m: "Jul", income: 352000, expense: 270000 },
  { m: "Aug", income: 371000, expense: 279000 },
  { m: "Sep", income: 381000, expense: 288000 },
  { m: "Oct", income: 428500, expense: 296200 },
];

export const expenseByCategory = [
  { name: "Salaries", value: 120000 },
  { name: "Rent", value: 45000 },
  { name: "Marketing", value: 38000 },
  { name: "Supplies", value: 32000 },
  { name: "Transport", value: 24200 },
  { name: "Utilities", value: 18000 },
  { name: "Misc", value: 19000 },
];

export const incomeBySource = [
  { name: "Sales", value: 252000 },
  { name: "Services", value: 118000 },
  { name: "Commissions", value: 38500 },
  { name: "Other", value: 20000 },
];

export const accounts = [
  { name: "Cash", value: 46200 },
  { name: "Bank", value: 141600 },
  { name: "UPI", value: 27000 },
];

export const transactions = [
  { id: "INV-1042", party: "Sharma Traders", type: "income", amount: 42000, method: "Bank", date: "14 Oct" },
  { id: "EXP-377", party: "City Power Board", type: "expense", amount: 8600, method: "UPI", date: "13 Oct" },
  { id: "INV-1041", party: "Mehra & Sons", type: "income", amount: 18500, method: "Cash", date: "13 Oct" },
  { id: "EXP-376", party: "Office landlord", type: "expense", amount: 45000, method: "Bank", date: "12 Oct" },
  { id: "INV-1040", party: "Kaur Enterprises", type: "income", amount: 27000, method: "UPI", date: "11 Oct" },
];

export const pending = [
  { id: "INV-1038", party: "Verma Retail", amount: 36000, due: "Overdue 6 days", status: "overdue" },
  { id: "INV-1043", party: "Gupta Agency", amount: 22000, due: "Due 18 Oct", status: "pending" },
  { id: "EXP-379", party: "PrintHub Supplies", amount: 9400, due: "Due 20 Oct", status: "pending" },
];

export const alerts = [
  { level: "danger", text: "Marketing spend is at 112% of its monthly limit." },
  { level: "warn", text: "2 invoices are overdue, totalling ₹58,000." },
  { level: "info", text: "Bank balance has not been reconciled for 9 days." },
];
