"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const NoCliCommandError_1 = __importDefault(require("../../../errors/NoCliCommandError"));
const types_1 = require("../../../types");
exports.default = (command) => {
    const { aliases = [], type } = command.commandObject;
    if (aliases.length && type === types_1.NoCliCommandType.Slash) {
        throw new NoCliCommandError_1.default(`Command ${command.commandName} is a Slash-only command but with aliases`);
    }
};
