"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const log_1 = require("../functions/log");
const get_all_files_1 = __importDefault(require("../util/get-all-files"));
const Command_1 = __importDefault(require("./Command"));
const handle_error_1 = __importDefault(require("../functions/handle-error"));
const SlashCommands_1 = __importDefault(require("./SlashCommands"));
const path_1 = __importDefault(require("path"));
const import_file_1 = __importDefault(require("../util/import-file"));
class CommandHandler {
    commands = new Map();
    commandsDir;
    _suffix;
    _debugging;
    _defaultPrefix;
    _instance;
    _slashCommands;
    _validations = this.getValidations('run-time');
    constructor(instance, commandsDir, language) {
        this.commandsDir = commandsDir;
        this._suffix = language === "TypeScript" ? "ts" : "js";
        this._debugging = instance.debug;
        this._defaultPrefix = instance.defaultPrefix;
        this._instance = instance;
        this._slashCommands = new SlashCommands_1.default(instance.client, this._debugging ? this._debugging.showFullErrorLog : undefined);
        this.readFiles();
        this.messageListener(instance.client);
        this.interactionListener(instance.client);
    }
    getValidations(folder) {
        const validations = (0, get_all_files_1.default)(path_1.default.join(__dirname, `./validations/${folder}`))
            .map(filePath => (0, import_file_1.default)(filePath).then((file) => file));
        return validations;
    }
    async readFiles() {
        const validations = this.getValidations('syntax');
        const files = (0, get_all_files_1.default)(this.commandsDir);
        for (const file of files) {
            const commandProperty = file.split(/[/\\]/).pop().split(".");
            const commandName = commandProperty[0];
            const commandSuffix = commandProperty[1];
            if (commandSuffix !== this._suffix)
                continue;
            try {
                const commandObject = this._suffix === "js"
                    ? require(file)
                    : await (0, import_file_1.default)(file);
                const { type: commandType, testOnly, description, delete: del, aliases = [], init = () => { } } = commandObject;
                if (del) {
                    if (testOnly) {
                        for (const guildId of this._instance.testServers) {
                            this._slashCommands.delete(commandName, guildId);
                        }
                    }
                    else {
                        this._slashCommands.delete(commandName);
                    }
                    continue;
                }
                ;
                const command = new Command_1.default(this._instance, commandName, commandObject);
                for (const validation of validations) {
                    validation
                        .then((validate) => validate(command))
                        .catch(err => {
                        const showFullErrorLog = this._debugging ? this._debugging.showFullErrorLog : false;
                        (0, handle_error_1.default)(err, showFullErrorLog, command.commandName);
                    });
                }
                ;
                await init(this._instance.client, this._instance);
                this.commands.set(command.commandName, command);
                if (commandType === types_1.NoCliCommandType.Slash || commandType === types_1.NoCliCommandType.Both) {
                    const options = commandObject.options || this._slashCommands.createOptions(commandObject);
                    if (testOnly) {
                        for (const guildId of this._instance.testServers) {
                            this._slashCommands.create(commandName, description, options ?? [], guildId);
                        }
                    }
                    else
                        this._slashCommands.create(commandName, description, options ?? []);
                }
                if (commandType !== types_1.NoCliCommandType.Slash) {
                    const names = [command.commandName, ...aliases];
                    for (const name of names)
                        this.commands.set(name, command);
                }
            }
            catch (err) {
                const showFullErrorLog = this._debugging
                    ? this._debugging.showFullErrorLog
                    : false;
                (0, handle_error_1.default)(err, showFullErrorLog, commandName);
            }
        }
        const noCommands = this.commands.size === 0;
        const isOneOnly = this.commands.size === 1;
        (0, log_1.log)("NoCliHandler", "info", noCommands ? "No commands found" : `Loaded ${this.commands.size} command${isOneOnly ? "" : "s"}`);
    }
    async runCommand(commandName, args, message, interaction) {
        const command = this.commands.get(commandName);
        if (!command) {
            if (interaction)
                interaction.reply({
                    content: `This command is either deleted or is improperly registered`,
                    ephemeral: true,
                });
            return;
        }
        ;
        const usage = {
            client: this._instance.client,
            message,
            interaction,
            args,
            text: args.join(" "),
            guild: message ? message.guild : interaction.guild,
            member: message ? message.member : interaction.member,
            user: message ? message.author : interaction.user,
            channel: message ? message.channel : interaction.channel,
        };
        if (message && command.commandObject.type === types_1.NoCliCommandType.Slash)
            return;
        for (const validation of this._validations) {
            const valid = await validation.then(validate => validate(command, usage, message ? this._defaultPrefix : '/'));
            if (!valid)
                return;
        }
        try {
            const { deferReply = false, callback, ephemeralReply = false, reply = false } = command.commandObject;
            if (deferReply)
                interaction
                    ? await interaction.deferReply({ ephemeral: ephemeralReply })
                    : await message.channel.sendTyping();
            return { response: await callback(usage), deferReply, ephemeralReply, reply };
        }
        catch (err) {
            const showFullErrorLog = this._debugging ? this._debugging.showFullErrorLog : false;
            (0, handle_error_1.default)(err, showFullErrorLog);
        }
    }
    async messageListener(client) {
        client.on("messageCreate", async (message) => {
            const { author, content } = message;
            if (author.bot)
                return;
            if (!content.startsWith(this._defaultPrefix))
                return;
            const args = content.split(/\s+/);
            const commandName = args.shift()
                ?.substring(this._defaultPrefix.length)
                .toLowerCase();
            if (!commandName)
                return;
            const res = await this.runCommand(commandName, args, message, null);
            if (res) {
                const { response, reply } = res;
                reply
                    ? message.reply(response).catch(() => { })
                    : message.channel.send(response).catch(() => { });
            }
        });
    }
    async interactionListener(client) {
        client.on("interactionCreate", async (interaction) => {
            if (!interaction.isChatInputCommand())
                return;
            const args = interaction.options.data.map(({ value }) => String(value));
            const res = await this.runCommand(interaction.commandName, args, null, interaction);
            if (res) {
                const { response, deferReply, ephemeralReply } = res;
                deferReply
                    ? interaction.followUp(response).catch(() => { })
                    : typeof response === "string"
                        ? interaction.reply({ content: response, ephemeral: ephemeralReply }).catch(() => { })
                        : interaction.reply(response).catch(() => { });
            }
        });
    }
}
exports.default = CommandHandler;
