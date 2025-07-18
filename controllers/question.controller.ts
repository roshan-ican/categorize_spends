// import { Request, Response } from 'express';
// import { questionPrompt, analzeQuestionPrompt } from "../prompts/question.prompt";
// import { executeQueryString } from "../service/executeQueryString";
// import { response_from_ai } from "../service/genAi";

// export const askQuestion = async (req: Request, res: Response): Promise<void> => {
//   const { message } = req.query;
//   console.log('message', message as string);

//   const prompt = `${questionPrompt} 
//   ${message as string}
//   `;

//   const queryCode = await response_from_ai(prompt);

//   const result = await executeQueryString(queryCode);

//   const prompt2 = analzeQuestionPrompt(message as string, result);

//   const finalResult = await response_from_ai(prompt2);

//   const objectResult = JSON.parse(finalResult);

//   console.log('result:', result, objectResult);
//   res.send({ message: 'done', queryCode, result, objectResult });
// };