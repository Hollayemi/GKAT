import mongoose, { Schema, Document } from 'mongoose';

export interface IBank extends Document {
  bank: string;
  code: string;
  short_code: string | null;
}

const BankSchema = new Schema<IBank>(
  {
    bank: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    short_code: { type: String, default: null },
  },
  { timestamps: true }
);

export const Banks = mongoose.model<IBank>('Bank', BankSchema);

export const seedBanks = async () => {
  const count = await Banks.countDocuments();
  if (count === 0) {
    const banks = [
      { bank: "Access Bank", code: "044", short_code: "*901#" },
      { bank: "First Bank of Nigeria", code: "011", short_code: "*894#" },
      { bank: "Guaranty Trust Bank (GTB)", code: "058", short_code: "*737#" },
      { bank: "Zenith Bank", code: "057", short_code: "*966#" },
      { bank: "United Bank for Africa (UBA)", code: "033", short_code: "*919#" },
      { bank: "Union Bank of Nigeria", code: "032", short_code: "*826#" },
      { bank: "Fidelity Bank", code: "070", short_code: "*770#" },
      { bank: "First City Monument Bank (FCMB)", code: "214", short_code: "*329#" },
      { bank: "Stanbic IBTC Bank", code: "221", short_code: "*909#" },
      { bank: "Sterling Bank", code: "232", short_code: "*822#" },
      { bank: "Ecobank Nigeria", code: "050", short_code: "*326#" },
      { bank: "Wema Bank", code: "035", short_code: "*945#" },
      { bank: "Unity Bank", code: "215", short_code: "*7799#" },
      { bank: "Heritage Bank", code: "030", short_code: "*745#" },
      { bank: "Keystone Bank", code: "082", short_code: "*533#" },
      { bank: "Jaiz Bank", code: "301", short_code: "*389#" },
      { bank: "Polaris Bank", code: "076", short_code: "*833#" },
      { bank: "Providus Bank", code: "101", short_code: null },
      { bank: "Titan Trust Bank", code: "102", short_code: null },
      { bank: "SunTrust Bank", code: "100", short_code: null },
      { bank: "Globus Bank", code: "103", short_code: null },
    ];
    await Banks.insertMany(banks);
    console.log('Banks seeded successfully');
  }
};