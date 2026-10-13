import { api } from './api';
import { AIUnavailableError, createCallGemini, describeAIError } from './aiClient';

// The AI features (Quick Add, bill scanning, Ask Spending) import from here. The call goes
// through the PocketBudz server, which holds the Gemini API key - see services/aiClient.js.
export { AIUnavailableError, describeAIError };
export const callGemini = createCallGemini(api);
