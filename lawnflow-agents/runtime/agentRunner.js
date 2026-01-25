"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunner = void 0;
var openai_1 = require("openai");
var promptLoader_1 = require("./promptLoader");
var toolRouter_1 = require("./toolRouter");
var cost_1 = require("./cost");
var schemas_1 = require("./schemas");
var AgentRunner = /** @class */ (function () {
    function AgentRunner(apiKey) {
        this.openai = new openai_1.default({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        });
        this.promptLoader = new promptLoader_1.PromptLoader();
        this.toolRouter = new toolRouter_1.ToolRouter();
        this.costEstimator = new cost_1.CostEstimator();
    }
    AgentRunner.prototype.runAgent = function (agentName_1, event_1, stateSummary_1, finops_1) {
        return __awaiter(this, arguments, void 0, function (agentName, event, stateSummary, finops, isSubagent) {
            var prompt_1, input, messages, estimatedInputTokens, completion, rawOutput, envelope, error_1;
            var _a, _b;
            if (isSubagent === void 0) { isSubagent = false; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        prompt_1 = this.promptLoader.composePrompt(agentName, isSubagent);
                        input = {
                            event: event,
                            state_summary: stateSummary,
                            constraints: finops
                        };
                        messages = [
                            {
                                role: 'system',
                                content: prompt_1
                            },
                            {
                                role: 'user',
                                content: "INPUT:\n".concat(JSON.stringify(input, null, 2), "\n\nOUTPUT:")
                            }
                        ];
                        estimatedInputTokens = this.costEstimator.estimateTokens(JSON.stringify(messages));
                        if (!this.costEstimator.checkBudget(estimatedInputTokens, finops.token_budget)) {
                            return [2 /*return*/, this.createErrorEnvelope('TOKEN_BUDGET_EXCEEDED', 'Input exceeds token budget')];
                        }
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: 'gpt-4', // or 'gpt-3.5-turbo' for cost optimization
                                messages: messages,
                                max_tokens: Math.min(1000, finops.token_budget - estimatedInputTokens),
                                temperature: 0.1, // Low temperature for deterministic responses
                            })];
                    case 1:
                        completion = _c.sent();
                        rawOutput = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
                        envelope = this.parseOutput(rawOutput);
                        if (!envelope.next_actions.some(function (action) { return action.type === 'tool_call'; })) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.executeToolCalls(envelope)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        // Update cost estimates
                        envelope.cost.estimated_tokens_in = estimatedInputTokens;
                        envelope.cost.estimated_tokens_out = this.costEstimator.estimateTokens(rawOutput);
                        return [2 /*return*/, envelope];
                    case 4:
                        error_1 = _c.sent();
                        console.error('Agent execution error:', error_1);
                        return [2 /*return*/, this.createErrorEnvelope('EXECUTION_ERROR', error_1 instanceof Error ? error_1.message : 'Unknown error')];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AgentRunner.prototype.parseOutput = function (rawOutput) {
        try {
            var parsed = JSON.parse(rawOutput);
            if ((0, schemas_1.validateEnvelope)(parsed)) {
                return parsed;
            }
            else {
                return this.createErrorEnvelope('INVALID_ENVELOPE', 'Output does not match envelope schema');
            }
        }
        catch (error) {
            return this.createErrorEnvelope('PARSE_ERROR', 'Failed to parse JSON output');
        }
    };
    AgentRunner.prototype.executeToolCalls = function (envelope) {
        return __awaiter(this, void 0, void 0, function () {
            var toolActions, _i, toolActions_1, action, toolCall, result, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        toolActions = envelope.next_actions.filter(function (action) { return action.type === 'tool_call'; });
                        _i = 0, toolActions_1 = toolActions;
                        _a.label = 1;
                    case 1:
                        if (!(_i < toolActions_1.length)) return [3 /*break*/, 7];
                        action = toolActions_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        toolCall = JSON.parse(action.detail);
                        if (!this.toolRouter.validateToolCall(toolCall)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.toolRouter.executeTool(toolCall)];
                    case 3:
                        result = _a.sent();
                        // In a real implementation, you'd pass results back to the agent
                        console.log("Tool ".concat(toolCall.name, " executed:"), result);
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_2 = _a.sent();
                        console.error('Tool execution error:', error_2);
                        envelope.errors.push({
                            code: 'TOOL_EXECUTION_ERROR',
                            message: error_2 instanceof Error ? error_2.message : 'Unknown tool error'
                        });
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    AgentRunner.prototype.createErrorEnvelope = function (code, message) {
        return {
            status: 'error',
            agent: 'system',
            summary: 'Agent execution failed',
            cost: {
                estimated_tokens_in: 0,
                estimated_tokens_out: 0,
                tool_calls: 0
            },
            data: null,
            next_actions: [],
            errors: [{ code: code, message: message }]
        };
    };
    return AgentRunner;
}());
exports.AgentRunner = AgentRunner;
