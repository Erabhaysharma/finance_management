export const SOURCES = ["Sales", "Services", "Commission", "Other"];
export const METHODS = ["Cash", "Bank", "UPI", "Card"];
export const ACCOUNTS = ["HDFC Current A/c", "SBI Savings A/c", "Business UPI"];
export const STATUSES = ["Received", "Partially received", "Pending"];

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

// Mock data. Replace with FastAPI calls later.
export const seedIncomes = [
  { id: 1, ref: "INV-1042", date: day(-6), customer: "Sharma Traders", source: "Sales", method: "Bank", account: "HDFC Current A/c", status: "Received", amount: 42000, received: 42000, due: "", repeat: false, notes: "" },
  { id: 2, ref: "INV-1041", date: day(-7), customer: "Mehra & Sons", source: "Services", method: "Cash", account: "", status: "Received", amount: 18500, received: 18500, due: "", repeat: false, notes: "" },
  { id: 3, ref: "INV-1040", date: day(-9), customer: "Kaur Enterprises", source: "Sales", method: "UPI", account: "Business UPI", status: "Partially received", amount: 40000, received: 27000, due: day(5), repeat: false, notes: "Balance after delivery" },
  { id: 4, ref: "INV-1038", date: day(-20), customer: "Verma Retail", source: "Sales", method: "Bank", account: "HDFC Current A/c", status: "Pending", amount: 36000, received: 0, due: day(-6), repeat: false, notes: "" },
  { id: 5, ref: "INV-1043", date: day(-2), customer: "Gupta Agency", source: "Commission", method: "Bank", account: "SBI Savings A/c", status: "Pending", amount: 22000, received: 0, due: day(4), repeat: true, frequency: "Monthly", notes: "" },
];

export const today = () => day(0);