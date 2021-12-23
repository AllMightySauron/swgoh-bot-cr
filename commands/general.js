/*jshint esversion: 8 */

const Command = require('./command.js');

const { SwgohGGApi, StatTypeEnum } = require('swgoh-api-swgohgg');
const { SwgohHelpApi, CombatTypeEnum, ModUnitStatEnum } = require('swgoh-api-swgohhelp');
const { AsciiTable3 } = require('ascii-table3');
const fs = require('fs');

/**
 * Class for handling bot GENERAL commands.
 */
class GeneralCommand extends Command {

    /**
     * Default constructor.
     * @param {module} Discord      Discord JS module. 
     * @param {json} config         Bot config settings.
     * @param {object} registry     The user registry.
     * @param {SwgohGGApi} swgohGGApi   The API to access swgoh.gg data.
     * @param {SwgohHelpApi} swgohHelpApi The API to acceso swgoh.help data.
     * @param {object} logger       The log4js logger.
     */
    constructor(Discord, config, registry, swgohGGApi, swgohHelpApi, logger) {
        super(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);
    }

    /**
     * Replies with bot help message to sender.
     * @param {object} message Discord message with request.
     * @param {string[]} args Command arguments.
     */
    processHelp(message, args) {    
        this.logger.info('processHelp@general.js: help command detected');

        var replyMsg;

        const helpData = JSON.parse(fs.readFileSync('config/help.json'));

        if (args.length == 0) {
            replyMsg = this.getReplyEmbedMsg('Help', `<@${message.author.id}> So, you need help... Available options are:`);

            helpData.forEach(area => {
                var commandsText = '';

                area.commands.forEach(command => commandsText += command.syntax + '\n');
                
                replyMsg.addField(area.area, `\`\`\`${commandsText}\`\`\``);
            });
        } else if (args.length == 1) {
            const commandName = args[0].toLowerCase();

            this.logger.debug(`processHelp@general.js: requesting help for command "${commandName}"`);

            var command;

            helpData.forEach(area => {
                if (!command)
                    command = area.commands.find(commandData => commandData.name == commandName);
            });

            // sanity check
            if (command) {
                replyMsg = this.getReplyEmbedMsg(
                    `Help on "${commandName}"`, 
                    `<@${message.author.id}> Here's the help you have requested:\n\n` +
                    `**Syntax**: ${command.syntax}\n` +
                    `**Description**: ${command.description}\n` +
                    `**Example**: \`${command.example}\``);
            } else {
                replyMsg = this.getReplyEmbedMsg('Help', `<@${message.author.id}> Stop wasting my time! There is no such command as "${commandName}"!`);    
            }
        } else {
            replyMsg = this.getReplyEmbedMsg('Help', `<@${message.author.id}> Stop fooling around soldier! Will you tell me the command you need help for?`);
        }

        // send help reply
        message.channel.send(replyMsg);
    }

    /**
     * Replies with bot welcome message to sender.
     * @param {object} message Discord message with request.
     */
    processWelcome(message) {
        this.logger.info('processWelcome@general.js: welcome command detected');

        // list of possible replies
        const replies = [ 
            "This Ship Is Going Down And Those Soldiers, My Brothers, Are Willing To Die And Take You And Me Along With Them.",
            "I'm No Jedi.",
            "Gives Us Clones A Mixed Feelings About The War. Many People Wish It Never Happened. But Without It, We Clones Wouldn't Exist.",
            "The War Left Its Scars On All Of Us.",
            "If That's Where You Feel Your Place Is, Then That's Where You Belong.",
            "Find Him. Find Him. Fives. Find Him!",
            "I'm Always First, Kid.",
            "We're soldiers. We have a duty to follow orders and, if we must, lay down our lives for victory.", 
            "I Used To Believe That Being A Good Soldier Meant Doing Everything They Told You. That's How They Engineered Us. But We're Not Droids. We're Not Programmed. You Have To Learn To Make Your Own Decisions.",
            "In My Book, Experience Outranks Everything." ];

        // get random index for message
        var index = Math.floor(Math.random() * replies.length);

        // reply
        message.channel.send(this.getReplyEmbedMsg('Welcome', `<@${message.author.id}> ${replies[index]}`));
    }

    /**
     * Replies with bot info messange to sender.
     * @param {object} message Discord message with request.
     * @param {number} countRequests The number of requests answered by the bot.
     */
    processInfo(message, countRequests) {
        this.logger.info('processInfo@general.js: info command detected');

        const pkg = require('../package.json');

        var msgText = "We are part of the most pivotal moment in the history of the Republic. " +
                    "If we fail, then our children, and their children, could be forced to live under an evil I can't well imagine.\n\n" +
                    "**General:**\n" +
                    `- version: **${pkg.version}** \n` +
                    `- prefix: **${this.config.bot.prefix}**\n` + 
                    '- [Invite me to your server](https://discord.com/oauth2/authorize?client_id=757958949646368898&scope=bot&permissions=805829696)\n\n' +
                    "**Statistics:**\n" +
                    `- requests processed: **${new Intl.NumberFormat().format(countRequests)}**\n`+ 
                    `- registered users: **${new Intl.NumberFormat().format(this.registry.getUserCount())}**`;

        // get ally code for current discord user
        const allyCode = this.registry.getAllyCode(message.author.id);

        if (typeof allyCode != 'undefined') {
            // get player data from swgoh.gg
            const playerData1 = this.swgohGGApi.getPlayer(allyCode);

            var lastUpdated;
            if (playerData1) {
                // get last update (converting from millisecond epoch)
                const millisecs = Date.parse(playerData1.data.last_updated);

                lastUpdated = new Date(0);
                lastUpdated.setUTCMilliseconds(millisecs);
            }

            msgText = msgText + `\n\n**Updates:**\n- swgoh.gg: ${lastUpdated}`;

            // get player data from swgoh.help
            const playerData2 = this.swgohHelpApi.getPlayer(allyCode);

            var lastUpdated2;
            if (playerData2) {
                // get last update (converting from millisecond epoch)
                lastUpdated2 = new Date(0);
                lastUpdated2.setUTCMilliseconds(playerData2.updated);
            }

            msgText = msgText + `\n- swgoh.help: ${lastUpdated2}`;
        }

        msgText = msgText + "\n\nBetter hurry sir, you're missing out all the fun!";

        var replyMsg = 
            this.getReplyEmbedMsg('Info', `<@${message.author.id}> ${msgText}`);

        // reply
        message.channel.send(replyMsg);
    }

    /**
     * Replies with bot check message to sender.
     * @param {object} message Discord message with request.
     * @param {string[]} args Array of arguments for this message.
     */
    processCheck(message, args) {    
        this.logger.info('processCheck@general.js: check command detected');

        if (args.length == 1) {
            const allyCode = Command.getProperAllyCode(args[0]);

            if(allyCode.length != 9) {
                // reply with check message
                message.channel.send(this.getReplyEmbedMsg('Check', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
            } else {
                const playerData = this.swgohHelpApi.getPlayer(allyCode);

                if (playerData) {
                    const count = this.swgohHelpApi.statsCalculator.calcPlayerStats(playerData);

                    var replyMsg = 
                        this.getReplyEmbedMsg(`Check on ${playerData.name} (${allyCode})`, 
                                        `<@${message.author.id}> Just got the intel you requested:\n\n**Guild:** ${playerData.guildName}`, 
                                        'via swgoh.help');

                    // max size for first column
                    const MAX_HEADER_SIZE = 17;
                    const MAX_DATA_SIZE = 
                        new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(playerData, 'Galactic Power:')).length + 4;

                    const genTable =  new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                        .addRow('Level', playerData.level)
                        .addRow('GP', new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(playerData, 'Galactic Power:')))
                        .addRow('Char GP', new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(playerData, 'Galactic Power (Characters):')))
                        .addRow('Ship GP', new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(playerData, 'Galactic Power (Ships):')))
                        .addRow('Arena Rank', new Intl.NumberFormat().format(playerData.arena.char.rank))
                        .addRow('Ship Rank', new Intl.NumberFormat().format(playerData.arena.ship.rank));
                    replyMsg.addField('General', `\`\`\`\n${genTable.toString()}\`\`\``);
        
                    const summaryData = SwgohHelpApi.getPlayerStatsSummary(playerData);

                    const charsTable = new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                        .addRow('Level 85', summaryData.chars.levels[84]) // level 85
                        .addRow('7 star', summaryData.chars.rarities[6])  // 7 stars
                        .addRow('Gear 11', summaryData.chars.gear[10])    // gear 11
                        .addRow('Gear 12', summaryData.chars.gear[11])    // gear 12
                        .addRow('Gear 13', summaryData.chars.gear[12])    // gear 13
                        .addRow('Gear 13 (R5+)', summaryData.chars.relic5Above)
                        .addRow('Speed +300', 
                            playerData.roster.
                            filter(unit => unit.combatType == CombatTypeEnum.CombatTypeChar).
                            filter(unit => 
                                    (unit.stats.base[ModUnitStatEnum.StatSpeed] +
                                    (unit.stats.mods[ModUnitStatEnum.StatSpeed] ? unit.stats.mods[ModUnitStatEnum.StatSpeed] : 0)) >= 300
                            ).length    // speedy
                        )
                        .addRow('GLs', summaryData.chars.galacticLegendCount)
                        .addRow('Zetas', summaryData.chars.zetas);
                    replyMsg.addField(`Characters (${summaryData.chars.count})`, `\`\`\`\n${charsTable.toString()}\`\`\``, false);

                    // count
                    var modCount = 0;
                    playerData.roster.forEach(unit => modCount += unit.mods.length);

                    // rarity
                    var plus6Rarity = 0;
                    playerData.roster.forEach(unit => plus6Rarity += unit.mods.filter(mod => mod.pips >= 6).length);

                    // secondary stat mods
                    var plus25Speed = 0;
                    playerData.roster.forEach(unit => 
                        unit.mods.forEach(mod =>
                            plus25Speed += mod.secondaryStat.filter(stat => stat.unitStat == StatTypeEnum.StatSpeed && stat.value >= 25).length
                        )
                    );

                    var plus20Speed = 0;
                    playerData.roster.forEach(unit => 
                        unit.mods.forEach(mod =>
                            plus20Speed += mod.secondaryStat.filter(stat => stat.unitStat == StatTypeEnum.StatSpeed && stat.value >= 20 && stat.value < 25).length
                        )
                    );

                    var plus15Speed = 0;
                    playerData.roster.forEach(unit => 
                        unit.mods.forEach(mod =>
                            plus15Speed += mod.secondaryStat.filter(stat => stat.unitStat == StatTypeEnum.StatSpeed && stat.value >= 15 && stat.value < 20).length
                        )
                    );

                    const modsTable = new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                        .addRow('Tier 6+', plus6Rarity) 
                        .addRow('+25 Speed', plus25Speed)
                        .addRow('+20 Speed', plus20Speed)
                        .addRow('+15 Speed', plus15Speed);
                        
                    replyMsg.addField(`Mods (${new Intl.NumberFormat().format(modCount)})`, `\`\`\`${modsTable.toString()}\`\`\``, false);

                    const shipsTable = new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                        .addRow('Level 85', summaryData.ships.levels[84]) // level 84
                        .addRow('7 star', summaryData.ships.rarities[6]); // 7 star
                    replyMsg.addField(`Ships (${summaryData.ships.count})`, `\`\`\`\n${shipsTable.toString()}\`\`\``, false);
        
                    // reply with register message
                    message.channel.send(replyMsg);
                } else {
                    // reply with error message
                    message.channel.send(this.getReplyEmbedMsg('Check', `<@${message.author.id}> Weird error fetching intel data from swgoh.help...`));        
                }
            }
        } else {
            // reply with error message
            message.channel.send(this.getReplyEmbedMsg('Check', `<@${message.author.id}> Give me the ally code. Now!`));        
        }
    }

    /**
     * Replies with bot character gear message to sender.
     * @param {object} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processCharGear(message, args) {
        this.logger.info('processCharGear@general.js: chargear command detected');

        if (args.length == 1) {
            const charName = args[0];

            const char = this.swgohGGApi.findCharacter(charName);

            // check for found
            if (char) {
                var desc;

                // special case for Rex
                if (char.base_id == "CT7567") {
                    desc = `<@${message.author.id}> Hey, that's ME you're talking about! Here's the character gear I need.`;
                } else {
                    desc = `<@${message.author.id}> Here's the character gear needed for "${charName}".`;
                }

                var replyMsg = this.getReplyEmbedMsg('Character gear', desc, 'via swgoh.gg');
                replyMsg.setImage(char.image);
                replyMsg.addField('Name', char.name, false);
                replyMsg.addField('Description', char.description, false);
                replyMsg.addField('URL', char.url, true);

                // loop over gear levels (excluding G13)
                for (var i = 0; i < char.gear_levels.length - 1; i++) {
                    var gearLevel = char.gear_levels[i];

                    var gearMsg = '';

                    // loop over gear for this level
                    for (var j = 0; j < gearLevel.gear.length; j++) {
                        var gear = this.swgohGGApi.getGear(gearLevel.gear[j]);

                        //gearMsg = gearMsg + `- [${gear.name}](https://${gear.url})\n`;
                        gearMsg = gearMsg + `- ${gear.name}\n`;
                    }

                    replyMsg.addField(`Gear level ${gearLevel.tier}`, gearMsg, false);
                }

                // reply with chargear message
                message.channel.send(replyMsg);
            } else {
                message.channel.send(this.getReplyEmbedMsg('Character Gear', `I know Echo. I know Fives. Who the fuck is "${charName}"?`));
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Character Gear', `Stop wasting my time! Which soldier are you referring to?`)); 
        }
    }

    /**
     * Replies with bot character abilities message to sender.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processCharAbilities(message, args) {
        this.logger.info('processCharAbilities@general.js: charabilities command detected');

        if (args.length == 1) {
            var allyCode;

                // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Character Abilities', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Character Abilities');

                if (!allyCode) return;
            }

            // get character name
            const charName = args[0]; 

            // get standard char data
            const standardChar = this.swgohGGApi.findCharacter(charName);

            // check for found
            if (standardChar) {
                // get player character data (from roster)
                const char = this.swgohGGApi.getPlayerUnit(allyCode, standardChar.name);
                
                if (char) {
                    var desc;

                    // special case for Rex
                    if (char.base_id == "CT7567") {
                        desc = `<@${message.author.id}> Hey, that's ME you're talking about! Here's my current character abilities (according to your roster).`;
                    } else {
                        desc = `<@${message.author.id}> Here's the current character abilities for "${charName}" (according to your roster).`;
                    }

                    var replyMsg = this.getReplyEmbedMsg('Character Abilities', desc, 'via swgoh.gg');
                    replyMsg.setImage(standardChar.image);
                    replyMsg.addField('Name', char.name, false);
                    replyMsg.addField('URL', `https://swgoh.gg${char.url}`, false);

                    // loop over character abilities
                    for (var i = 0; i < char.ability_data.length; i++) {
                        var abilityData = char.ability_data[i];

                        var generalAbilityData = this.swgohGGApi.getAbility(abilityData.id);

                        var gearMsg = `\`\`\`Omega: ${abilityData.is_omega}\n Zeta: ${abilityData.is_zeta}\n Tier: ${abilityData.ability_tier}/${abilityData.tier_max}\`\`\``;

                        replyMsg.addField(`${abilityData.name} (${SwgohGGApi.getAbilityTypeDescription(generalAbilityData.type)})`, gearMsg, true);
                    }

                    // reply with message
                    message.channel.send(replyMsg);
                } else {
                    message.channel.send(this.getReplyEmbedMsg('Character Abilities', `You do not seem to have enlisted "${charName}" yet.`));
                }
            } else {
                message.channel.send(this.getReplyEmbedMsg('Character Abilities', `I know Echo. I know Fives. Who the fuck is "${charName}"?`)); 
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Character Abilities', `Stop wasting my time! Which soldier are you referring to?`)); 
        }
    }

    /**
     * Replies with bot list of acronyms message to sender.
     * @param {object} message The discord message object.
     */
    processAcronyms(message, args) {
        this.logger.info('processAcronyms@general.js: acronyms command detected');

        var replyMsg;

        if (args.length == 0) {
            replyMsg = 
                this.getReplyEmbedMsg('Acronyms', 
                                    'Here\'s the list of acronyms I know:\n\n' +
                                    '**Characters**: [Char list](https://cdn.discordapp.com/attachments/758310404954521631/788432141506576454/Characters.txt)\n' +
                                    '**Ships**: [Ship list](https://cdn.discordapp.com/attachments/758310404954521631/788432170154065920/Ships.txt)');
        } else if (args.length == 1) {
            const acronym = args[0].toLowerCase();

            const char = this.swgohGGApi.findCharacter(acronym);
            const ship = this.swgohGGApi.findShip(acronym);

            if (char) {
                replyMsg = 
                    this.getReplyEmbedMsg(
                        `Acronym for "${args[0]}"`, 
                        'Here\'s the data for this acronym:\n\n' +
                        `**Name**: ${char.name}\n` +
                        `**URL**: ${char.url}`);
            } else if (ship) {
                replyMsg = 
                    this.getReplyEmbedMsg(
                        `Acronym for "${args[0]}"`, 
                        'Here\'s the data for this acronym:\n\n' +
                        `**Name**: ${ship.name}\n` +
                        `**URL**: ${ship.url}`);
            } else {
                replyMsg = this.getReplyEmbedMsg('Acronyms', `${args[0]}?? This unit is not a part of my roster details!`);
            }
        } else {
            replyMsg = this.getReplyEmbedMsg('Acronyms', 'Stop wasting my time soldier! What\'s with all these parameters?');
        }

        message.channel.send(replyMsg);
    }

    /**
     * Replies with bot default error message to sender.
     * @param {*} message The discord message object.
     */
    processError(message, command) {    
        this.logger.info('unknown command detected');

        // reply with unknown message
        message.channel.send(this.getReplyEmbedMsg('Error', `<@${message.author.id}> What do you mean by "${command}"??? My training does not include this feature.`));
    }

}

module.exports = GeneralCommand;