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
exports.ToolRouter = void 0;
var ToolRouter = /** @class */ (function () {
    function ToolRouter() {
    }
    ToolRouter.prototype.executeTool = function (call) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Stub implementations - replace with real tool integrations
                switch (call.name) {
                    case 'state.get':
                        return [2 /*return*/, this.mockStateGet(call.args.entity_type, call.args.id)];
                    case 'state.search':
                        return [2 /*return*/, this.mockStateSearch(call.args.entity_type, call.args.query, call.args.filters)];
                    case 'state.upsert':
                        return [2 /*return*/, this.mockStateUpsert(call.args.entity_type, call.args.object)];
                    case 'comms.send_sms':
                        return [2 /*return*/, this.mockSendSMS(call.args.to, call.args.body, call.args.thread_id)];
                    case 'comms.send_email':
                        return [2 /*return*/, this.mockSendEmail(call.args.to, call.args.subject, call.args.body)];
                    case 'ops.route_optimize':
                        return [2 /*return*/, this.mockRouteOptimize(call.args.stops, call.args.constraints)];
                    case 'ops.schedule':
                        return [2 /*return*/, this.mockSchedule(call.args.job_id, call.args.crew_id, call.args.start_time, call.args.duration_min)];
                    case 'billing.create_quote':
                        return [2 /*return*/, this.mockCreateQuote(call.args.customer_id, call.args.items, call.args.terms)];
                    case 'billing.create_invoice':
                        return [2 /*return*/, this.mockCreateInvoice(call.args.job_id, call.args.terms)];
                    case 'analytics.log':
                        return [2 /*return*/, this.mockAnalyticsLog(call.args.event_name, call.args.payload)];
                    default:
                        throw new Error("Unknown tool: ".concat(call.name));
                }
                return [2 /*return*/];
            });
        });
    };
    ToolRouter.prototype.validateToolCall = function (call) {
        return !!(call.name && call.args);
    };
    ToolRouter.prototype.mockStateGet = function (entityType, id) {
        return { id: id, data: "Mock ".concat(entityType, " data"), found: true };
    };
    ToolRouter.prototype.mockStateSearch = function (entityType, query, filters) {
        return [{ id: '1', data: "Mock ".concat(entityType, " result for ").concat(query) }];
    };
    ToolRouter.prototype.mockStateUpsert = function (entityType, object) {
        return true;
    };
    ToolRouter.prototype.mockSendSMS = function (to, body, threadId) {
        return { success: true, message_id: "sms_".concat(Date.now()), cost: 0.01 };
    };
    ToolRouter.prototype.mockSendEmail = function (to, subject, body) {
        return { success: true, message_id: "email_".concat(Date.now()) };
    };
    ToolRouter.prototype.mockRouteOptimize = function (stops, constraints) {
        return {
            route: stops,
            eta: 120,
            efficiency: 85,
            total_distance: 45.5
        };
    };
    ToolRouter.prototype.mockSchedule = function (jobId, crewId, startTime, durationMin) {
        return { success: true, conflicts: [] };
    };
    ToolRouter.prototype.mockCreateQuote = function (customerId, items, terms) {
        var total = items.reduce(function (sum, item) { return sum + item.price; }, 0);
        return { quote_id: "quote_".concat(Date.now()), amount: total };
    };
    ToolRouter.prototype.mockCreateInvoice = function (jobId, terms) {
        return { invoice_id: "inv_".concat(Date.now()), amount: 150.00 };
    };
    ToolRouter.prototype.mockAnalyticsLog = function (eventName, payload) {
        console.log("Analytics: ".concat(eventName), payload);
    };
    return ToolRouter;
}());
exports.ToolRouter = ToolRouter;
