import { log } from "../../../functions/log";
import { CommandCallbackOptions } from "../../../types";
import Command from "../../Command";

export default (command: Command, usage: CommandCallbackOptions, prefix: string) => {
    const { minArgs = 0, maxArgs = -1 } = command.commandObject;
    const { length } = usage.args;

    if ((length < minArgs) || (length > maxArgs && maxArgs !== -1)) {
        let text = command.commandObject.correctSyntax ?? `Invalid Syntax! Correct Syntax: \`${prefix}${command.commandName} ${command.commandObject.expectedArgs}\``;
        const specifyUsage = command.commandObject.expectedArgs ?? "";
        if (usage.message) usage.message.reply(text.replace("[PREFIX]", prefix).replace("[ARGS]", specifyUsage));
        else if (usage.interaction) usage.interaction.reply(text.replace("[PREFIX]", prefix).replace("[ARGS]", specifyUsage));
        return false;
    }

    return true;
}