const Receipt = require("../models/recipt");

const executeQueryString = async (queryCode) => {
  // 🛡️ 1. Security: prevent dangerous code
  const allowed = ["find", "aggregate", "sort", "limit", "project", "unwind", "match", "group"];
  const disallowed = ["delete", "update", "insert", "require", "process", "eval", "write", "remove"];

  const lower = queryCode.toLowerCase();

  if (disallowed.some(word => lower.includes(word))) {
    throw new Error("🚫 Disallowed operation detected in AI query.");
  }

  // 🧠 2. Fix: If query is just an expression without `return`
//   const isFunctionDeclaration = queryCode.trim().startsWith("async function");
//   const hasReturn = /return\s/.test(queryCode);

//   // 🧠 3. If it’s a full function like `async function getTop() { ... }`
//   if (isFunctionDeclaration) {
//     // Try to extract the function name
//     const match = queryCode.match(/async function (\w+)/);
//     const functionName = match ? match[1] : null;

//     if (!functionName) throw new Error("Unable to identify function name from AI code.");

//     // Add return call to invoke the function
//     queryCode += `\n return await ${functionName}();`;
//   }

//   // 🧠 4. If it’s just a plain query (not a function), make sure `return` exists
//   else if (!hasReturn) {
//     queryCode = `return ${queryCode}`;
//   }

  // 🧪 5. Safely execute the code in a restricted context
  const asyncFn = new Function("Receipt", `"use strict"; return (async () => { ${queryCode} })();`);
  return await asyncFn(Receipt);
};

module.exports = { executeQueryString };
