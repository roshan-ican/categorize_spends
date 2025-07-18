import Receipt from "../models/recipt";

export const executeQueryString = async (queryCode: string): Promise<any> => {
  // 🛡️ 1. Security: prevent dangerous code
  const disallowed = ["delete", "update", "insert", "require", "process", "eval", "write", "remove"];

  const lower = queryCode.toLowerCase();

  if (disallowed.some(word => lower.includes(word))) {
    throw new Error("🚫 Disallowed operation detected in AI query.");
  }

  // 🧪 2. Safely execute the code in a restricted context
  const asyncFn = new Function("Receipt", `"use strict"; return (async () => { ${queryCode} })();`);
  return await asyncFn(Receipt);
};