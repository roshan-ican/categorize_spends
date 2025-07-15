const { questionPrompt, analzeQuestionPrompt } = require("../prompts/question.prompt");
const { executeQueryString } = require("../service/executeQueryString");
const { response_from_ai } = require("../service/genAi");



const askQuestion = async (req,res)=>{
  const {message} = req.query;
  console.log('message',message)

  const prompt = `${questionPrompt} 
  ${message}
  `;

  // const result = {};
  const queryCode = await response_from_ai(prompt)

  const result = await executeQueryString(queryCode);

  const prompt2 = analzeQuestionPrompt(message,result);

    const finalResult = await response_from_ai(prompt2);

    const objectResult = JSON.parse(finalResult)

  console.log('result:',result,objectResult)
  res.send({message:'done',queryCode,result,objectResult})
}

module.exports = {askQuestion};