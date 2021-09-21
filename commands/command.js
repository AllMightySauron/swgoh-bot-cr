/*jshint esversion: 8 */

const fs = require('fs');

/**
 * Simple ally code regex (9 digits: xxxxxxxxx).
 */
const REGEX_SIMPLE_ALLYCODE = '\\d+';

/**
 * Simple ally code regex (9 digits separated by dashes: xxx-xxx-xxx).
 */
const REGEX_DASHED_ALLYCODE = '\\d+-\\d+-\\d+';

/**
 * Default class for handling bot commands.
 */
class Command {
    /**
     * Default constructor.
     * @param {module} Discord      Discord JS module. 
     * @param {json} config         Bot config settings.
     * @param {object} registry     The user registry.
     * @param {object} swgohGGApi   The API to access swgoh.gg data.
     * @param {object} swgohHelpApi The API to acceso swgoh.help data.
     * @param {object} logger       The log4js logger.
     */
    constructor(Discord, config, registry, swgohGGApi, swgohHelpApi, logger) {
        this.logger = logger;

        this.Discord = Discord;
        this.config = config;
        this.registry = registry; 

        // initialize data access apis
        this.swgohGGApi = swgohGGApi; 
        this.swgohHelpApi = swgohHelpApi;
    }

    /**
     * Gets a reply embed message for the discord bot.
     * @param {string} msgTitle The message title.
     * @param {string} msgText The message text.
     * @param {string} footerMsg The footer message text (optional).
     */
    getReplyEmbedMsg(msgTitle, msgText, footerMsg) {
        // REX image
        const REX_IMAGE_URL = 'https://game-assets.swgoh.gg/tex.charui_trooperclone_rex.png';

        const result =
            new this.Discord.MessageEmbed()
             .setColor('#0099ff')
             .setTitle(msgTitle)
             .setDescription(msgText)
             .setThumbnail(REX_IMAGE_URL)
             .setTimestamp();

        // get package metadata
        const pkgMetadata = JSON.parse(fs.readFileSync("package.json"));

        if (footerMsg) {
            result.setFooter(`Captain Rex ${pkgMetadata.version} - ${footerMsg}`, REX_IMAGE_URL);
        } else {
            result.setFooter(`Captain Rex ${pkgMetadata.version}`, REX_IMAGE_URL);
        }
            
        return result;
    }

    /**
     * Checks for valid ally code.
     * Must be either a 9 digit number string (XXXXXXXXX) or 9 digit number dash separated (XXX-XXX-XXX).
     * @static
     * @param {string} allyCode 
     * @returns {boolean} Whether the ally code is properly formated.
     */
    static isAllyCode(allyCode) {
        const trimmedAllyCode = allyCode.trim();

        return (trimmedAllyCode.match(REGEX_SIMPLE_ALLYCODE) && trimmedAllyCode.length == 9) ||
                (trimmedAllyCode.match(REGEX_DASHED_ALLYCODE) && trimmedAllyCode.length == 11);
    }

    /**
     * Gets a properly formatted ally code from either a 9 digit number string (XXXXXXXXX) or dash separated (XXX-XXX-XXX).
     * @static
     * @param {string} allyCode 
     * @returns {string} Formatted allycode with 9 digits.
     */
    static getProperAllyCode(allyCode) {
        var result = allyCode.trim();

        if (result.match(REGEX_SIMPLE_ALLYCODE) && result.length == 9) {
            // first case - xxxxxxxxx
        } else if (result.match(REGEX_DASHED_ALLYCODE) && result.length == 11) {
            // second case - xxx-xxx-xxx
            result = result.replace(new RegExp('-', 'g'), '');
        }

        return result;
    }

    /**
     * Add fields to reply message splitting size to fit limits.
     * @static
     * @param {object} message The reply message.
     * @param {string} name The field name.
     * @param {string} value The field text.
     */
    static addFields(message, name, value) {
        const MAX_FIELD_SIZE = 1024;

        // check if field value size does not exceed limits
        if (value.length > MAX_FIELD_SIZE) {
            const lines = value.split("\n");

            var fieldCount = 0;
            var lineNum = 0;

            while (lineNum < lines.length) {
                var thisValue = "";

                // loop over lines
                while (lineNum < lines.length && thisValue.length + lines[lineNum].length < MAX_FIELD_SIZE) {
                    thisValue = thisValue == "" ? lines[lineNum] : `${thisValue}\n${lines[lineNum]}`;
                    lineNum++;
                }
      
                var finalValue = thisValue;

                // check for code blocks
                if (value.startsWith('```') && value.endsWith('```')) {
                    if (!finalValue.startsWith('```')) {
                        finalValue = '```' + finalValue;
                    }

                    if (!finalValue.endsWith('```')) {
                        finalValue += '```';
                    }
                }

                message.addField(++fieldCount == 1 ? name : '...', finalValue);
            }
        } else if (value != "") {
            message.addField(name, value);
        }
    }

    /**
     * Gets desired ally code from reactions (when discord user has multiple ally codes).
     * @param {object} message The original message.
     * @param {*} allyCodes    The array of possible ally codes.
     * @param {string} title   The message title when asking for reactions.
     * @returns {string} Ally code the user reacted to.
     */
    async getAllyCodeReaction(message, allyCodes, title) {
        var result;

        // possible options to react to
        const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

        var options = '';
        // generate options for reply message
        for (var i = 0; i < allyCodes.length; i++) {
            // get current code
            const code = allyCodes[i];

            // get player data for this code
            const player = this.swgohHelpApi.getPlayer(code);
            
            const name = player ? player.name : '???';
            options = options + '\n' + `${reactions[i]} \`${code}\` **${name}**`;
        }

        var reply = this.getReplyEmbedMsg(`${title}`,
                                        `<@${message.author.id}> You have multiple ally codes registered. Which one do you want?\n${options}`);

        // publish reply message
        const replyMsg = await message.channel.send(reply);

        var count = 0;
        // generate message reactions
        allyCodes.forEach(async () => {
            await replyMsg.react(reactions[count++]);
        });

        // filter reactions 
        const filter = (reaction, user) => {
            return reactions.includes(reaction.emoji.name) && user.id === message.author.id;
        };

        // max reaction time (in seconds)
        const MAX_REACTION_TIME = 30;

        // First argument is a filter function
        await replyMsg.awaitReactions(filter, { max: 1, time: MAX_REACTION_TIME * 1000 }).then(collected => {
            // find index for reaction
            const idx = reactions.findIndex(reaction => reaction == collected.first().emoji.name);

            // apply to ally code array
            result = allyCodes[idx];
        }).catch(() => {
            message.reply(`No reaction after ${MAX_REACTION_TIME} seconds, operation canceled`);
        });

        return result;
    }
    
}

module.exports = Command;