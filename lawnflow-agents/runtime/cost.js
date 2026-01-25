"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostEstimator = void 0;
var CostEstimator = /** @class */ (function () {
    function CostEstimator() {
    }
    CostEstimator.prototype.estimateTokens = function (text) {
        // OpenAI token estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    };
    CostEstimator.prototype.estimateToolCallCost = function (toolName) {
        // Estimated token costs for different tool calls
        var costs = {
            'state.get': 10,
            'state.search': 20,
            'state.upsert': 15,
            'comms.send_sms': 15,
            'comms.send_email': 25,
            'ops.route_optimize': 50,
            'ops.schedule': 20,
            'billing.create_quote': 25,
            'billing.create_invoice': 20,
            'analytics.log': 10
        };
        return costs[toolName] || 10;
    };
    CostEstimator.prototype.calculateEnvelopeCost = function (envelope) {
        var _a;
        var tokensOut = this.estimateTokens(JSON.stringify(envelope));
        var toolCalls = ((_a = envelope.next_actions) === null || _a === void 0 ? void 0 : _a.filter(function (a) { return a.type === 'tool_call'; }).length) || 0;
        return {
            tokens_in: 0, // Would need input tracking
            tokens_out: tokensOut,
            tool_calls: toolCalls
        };
    };
    CostEstimator.prototype.checkBudget = function (currentUsage, budget) {
        return currentUsage <= budget;
    };
    return CostEstimator;
}());
exports.CostEstimator = CostEstimator;
