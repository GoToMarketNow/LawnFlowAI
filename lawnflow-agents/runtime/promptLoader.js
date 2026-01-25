"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptLoader = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var PromptLoader = /** @class */ (function () {
    function PromptLoader(basePath) {
        if (basePath === void 0) { basePath = './prompts'; }
        this.basePath = basePath;
    }
    PromptLoader.prototype.loadShared = function () {
        var shared = ['system_core', 'finops_policy', 'brand_tone', 'tool_contracts', 'json_schemas', 'routing_rules'];
        var result = {};
        for (var _i = 0, shared_1 = shared; _i < shared_1.length; _i++) {
            var file = shared_1[_i];
            try {
                result[file] = this.loadFile((0, path_1.join)('shared', "".concat(file, ".md")));
            }
            catch (error) {
                console.warn("Failed to load shared prompt: ".concat(file));
                result[file] = '';
            }
        }
        return result;
    };
    PromptLoader.prototype.loadAgent = function (agentName) {
        try {
            return this.loadFile((0, path_1.join)('agents', "".concat(agentName, ".md")));
        }
        catch (error) {
            throw new Error("Failed to load agent prompt: ".concat(agentName));
        }
    };
    PromptLoader.prototype.loadSubagent = function (subagentName) {
        try {
            return this.loadFile((0, path_1.join)('subagents', "".concat(subagentName, ".md")));
        }
        catch (error) {
            throw new Error("Failed to load subagent prompt: ".concat(subagentName));
        }
    };
    PromptLoader.prototype.loadFile = function (filePath) {
        return (0, fs_1.readFileSync)((0, path_1.join)(this.basePath, filePath), 'utf-8');
    };
    PromptLoader.prototype.composePrompt = function (agentName, isSubagent) {
        if (isSubagent === void 0) { isSubagent = false; }
        var shared = this.loadShared();
        var agent = isSubagent ? this.loadSubagent(agentName) : this.loadAgent(agentName);
        var sharedContent = Object.values(shared).filter(function (content) { return content.length > 0; }).join('\n\n');
        return sharedContent + '\n\n' + agent;
    };
    return PromptLoader;
}());
exports.PromptLoader = PromptLoader;
