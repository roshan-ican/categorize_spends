export const questionPrompt = `You are a MongoDB expert with access to a Mongoose model named Receipt.

Schema:
Receipt {
  filename: String,
  uploadedAt: Date,
  items: [
    {
      name: String,
      price: Number
    }
  ]
}

Based on this schema, write a JavaScript (Node.js) MongoDB query using async/await syntax.

Important Rules:
- Only return **plain JavaScript query code**.
- Do not include markdown formatting (like \`\`\`).
- Do not add comments or explanation.
- Always return valid code that can be executed inside an \`async () => {}\` wrapper.
- If aggregation is required, use \`Receipt.aggregate([...])\`.
- The output should always return the final result using \`return\`.

User question:
    `;


export const analzeQuestionPrompt = (message: string, data: any): string => {
    return `You are a personal finance assistant. Below is the user data 
    ${JSON.stringify(data)}

    Tell the user:
- What category they spent the most on
- Is anything unusually high or low?
- One suggestion to optimize their spending
- and custom question answers ${message} (if the question is valid) (note: i have already provided you data require for question , answer based on that data)

Important Rules:
- Return (JSON)Array of Object [{question:"",answer:""}] in these format
- Only return **JSON**.
- Do not include markdown formatting (like \`\`\`) .
- Do not add comments or explanation.
- Always return valid JSON that can be used in code and parsed .
    `
}