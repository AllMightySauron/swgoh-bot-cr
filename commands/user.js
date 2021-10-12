/*jshint esversion: 8 */

const { SwgohGGApi, StatTypeEnum } = require('swgoh-api-swgohgg');
const { SwgohHelpApi } = require('swgoh-api-swgohhelp');
const { AsciiTable3 } = require('ascii-table3');

const Command = require('./command.js');

/**
 * Class for handling bot USER commands.
 */
class UserCommand extends Command {
    /**
    * Default constructor.
    * @param {module} Discord       Discord JS module. 
    * @param {json} config          Bot config settings.
    * @param {object} registry      The user registry.
    * @param {SwgohGGApi} swgohGGApi    The API to access swgoh.gg data.
    * @param {SwgohHelpApi} swgohHelpApi  The API to acceso swgoh.help data.
    * @param {object} logger        The log4js logger.
    */
    constructor(Discord, config, registry, swgohGGApi, swgohHelpApi, logger) {
        super(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);
    }

    /**
     * Replies with bot register message to sender.
     * @param {*} message The discord message object.
     * @param {string]} command The bot command.
     * @param {string[]} args Array of arguments for this message.
     */
    processRegister(message, command, args) {
        this.logger.info('register command detected');

        const allyCode = Command.getProperAllyCode(command.split('.')[0]);

        if (allyCode.length != 9) {
            // reply with register message
            message.channel.send(this.getReplyEmbedMsg('Register', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
        } else {
            var userId;

            // check for mentions
            if (message.mentions.users.size > 0) {
                userId = message.mentions.users.first().id;
            } else {
                // no arguments -> use message issuer
                userId = message.author.id;
            }

            var result = this.registry.registerUser(userId, allyCode);

            if (result) {
                message.channel.send(this.getReplyEmbedMsg('Register', `<@${userId}> You're now a soldier of our squadron!`));
            } else {
                message.channel.send(this.getReplyEmbedMsg('Register', `<@${userId}> You're already a member of our squadron! Why are you trying to enlist twice???`));
            }
        }
    }

    /**
     * Replies with bot unregister message to sender.
     * @param {*} message The discord message object.
     * @param {string]} command The bot command.
     * @param {string[]} args Array of arguments for this message.
     */
    processUnregister(message, command, args) {
        this.logger.info('unregister command detected');

        // get mandatory ally code
        const allyCode = Command.getProperAllyCode(command.split('.')[0]);

        if (allyCode.length != 9) {
            // reply with register message
            message.channel.send(this.getReplyEmbedMsg('Unregister', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
        } else {
            var userId;

            // check for mentions
            if (message.mentions.users.size > 0) {
                userId = message.mentions.users.first().id;
            } else {
                // no arguments -> use message issuer
                userId = this.registry.getDiscordId(allyCode);
            }

            if (userId) {
                var result = this.registry.unregisterUser(userId, allyCode);

                if (result) {
                    message.channel.send(this.getReplyEmbedMsg('Unregister', `<@${userId}> You're oficialy out of our squadron. Don't bother to come back!`));
                } else {
                    message.channel.send(this.getReplyEmbedMsg('Unregister', `<@${userId}> You don't seem to be a member of our squadron. Try enlisting first!`));
                }
            } else {
                message.channel.send(this.getReplyEmbedMsg('Unregister', `<@${message.author.id}> "${allyCode}" does not seem to be a member of our squadron...`));
            }
        }
    }

    /**
     * Replies with bot guild list message to sender.
     * @param {*} message The discord message object.
     * @param {string]} command The bot command.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGuildList(message, command, args) {
        this.logger.info('guildlist command detected');

        var allyCode;

        if (args.length == 1) {
            // get ally code from first parameter
            allyCode = Command.getProperAllyCode(args[0]);
        } else {
            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Guild List', `<@${message.author.id}> You don't seem to be a member of our squadron. Try enlisting first!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Guild List');

                if (!allyCode) return;
            }
        }

        if (typeof allyCode == 'undefined') {
            message.channel.send(this.getReplyEmbedMsg('Guild List', `<@${message.author.id}> You don't seem to be a member of our squadron. Try enlisting first!`));
        } else if (allyCode.length != 9 || !allyCode.match('[0-9]+')) {
            // reply with check message
            message.channel.send(this.getReplyEmbedMsg('Check', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
        } else {
            // get guild data
            const guild = this.swgohHelpApi.getGuild(allyCode);

            if (typeof guild == 'undefined') {
                message.channel.send(this.getReplyEmbedMsg('Guild List', `<@${message.author.id}> Cannot fetch guild data for ally code "${allyCode}" from swgoh.help!`));
                return;
            }

            var list = "";
            var unregisteredList = "";

            var count = 0;

            // loop over guild payers
            for (var i = 0; i < guild.roster.length; i++) {
                const player = guild.roster[i];

                // get discord id (if registered)
                const discordId = this.registry.getDiscordId(player.allyCode);

                // check if user is already registerd
                if (typeof discordId == "undefined") {
                    unregisteredList = `${unregisteredList}\n\`${player.allyCode}\` **${player.name}**`;
                } else {
                    count++;

                    list = `${list}\n\`${player.allyCode}\` **${player.name}** <@${discordId}>`;
                }
            }

            var replyMsg =
                this.getReplyEmbedMsg('Guild list',
                    `<@${message.author.id}> Here\'s the full list of registered soldiers for squadron "${guild.name}" (${count}/${guild.roster.length} members).`,
                    'via swgoh.help');

            Command.addFields(replyMsg, 'Registered', list);
            Command.addFields(replyMsg, 'Unregistered', unregisteredList);

            // reply  message
            message.channel.send(replyMsg);
        }
    }

    /**
     * Replies with bot my profile message to sender.
     * @param {*} message The discord message object.
     */
    async processMyProfile(message) {
        this.logger.info('myprofile command detected');

        // get possible allycodes
        const allyCodes = this.registry.getAllyCodes(message.author.id);

        var allyCode;

        if (allyCodes.length == 0) {
            message.channel.send(this.getReplyEmbedMsg('My Profile', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        } else if (allyCodes.length == 1) {
            // single ally code
            allyCode = allyCodes[0];
        } else {
            allyCode = await this.getAllyCodeReaction(message, allyCodes, 'My Profile');

            if (!allyCode) return;
        }

        const playerData = this.swgohGGApi.getPlayer(allyCode);
        const playerMods = this.swgohGGApi.getPlayerMods(allyCode);

        if (playerData && playerMods) {
            var replyMsg =
                this.getReplyEmbedMsg(`${playerData.data.name}'s Profile (${allyCode})`,
                    `<@${message.author.id}> Just got the intel you requested:\n
**URL:** https://swgoh.gg${playerData.data.url}
**Guild:** ${playerData.data.guild_name}`, 'via swgoh.gg');

            // max size for columns
            const MAX_HEADER_SIZE = 17;
            const MAX_DATA_SIZE = new Intl.NumberFormat().format(playerData.data.galactic_power).length + 4;

            const genTable = new AsciiTable3()
                .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                .addRow('Level', playerData.data.level)
                .addRow('GP', new Intl.NumberFormat().format(playerData.data.galactic_power))
                .addRow('Char GP', new Intl.NumberFormat().format(playerData.data.character_galactic_power))
                .addRow('Ship GP', new Intl.NumberFormat().format(playerData.data.ship_galactic_power))
                .addRow('Arena Rank', new Intl.NumberFormat().format(playerData.data.arena_rank))
                .addRow('Ship Rank', new Intl.NumberFormat().format(playerData.data.fleet_arena.rank));
            replyMsg.addField('General', `\`\`\`\n${genTable.toString()}\`\`\``);

            const summaryData = SwgohGGApi.getPlayerStatsSummary(playerData);

            const charsTable = new AsciiTable3()
                .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                .addRow('Level 85', summaryData.chars.levels[84]) // level 85
                .addRow('7 stars', summaryData.chars.rarities[6]) // 7 star
                .addRow('Gear 11', summaryData.chars.gear[10])   // gear 11
                .addRow('Gear 12', summaryData.chars.gear[11])   // gear 12
                .addRow('Gear 13', summaryData.chars.gear[12])   // gear 13
                .addRow('Gear 13 (R5+)', summaryData.chars.relic5Above)
                .addRow('Speed 300+', playerData.units.filter(unit => unit.data.stats[StatTypeEnum.StatSpeed] >= 300).length) // speedy
                .addRow('GLs', summaryData.chars.galacticLegendCount)
                .addRow('Zetas', summaryData.chars.zetas);
            replyMsg.addField(`Characters (${summaryData.chars.count})`, `\`\`\`${charsTable.toString()}\`\`\``, false);

            // secondary stat mods
            var plus25Speed = 0;
            playerMods.mods.forEach(
                mod => plus25Speed += mod.secondary_stats.filter(stat => stat.stat_id == StatTypeEnum.StatSpeed && stat.value >= 250000).length
            );

            var plus20Speed = 0;
            playerMods.mods.forEach(
                mod => plus20Speed += mod.secondary_stats.filter(stat => stat.stat_id == StatTypeEnum.StatSpeed && stat.value >= 200000 && stat.value < 250000 ).length
            );

            var plus15Speed = 0;
            playerMods.mods.forEach(
                mod => plus15Speed += mod.secondary_stats.filter(stat => stat.stat_id == StatTypeEnum.StatSpeed && stat.value >= 150000 && stat.value < 200000 ).length
            );

            const modsTable = new AsciiTable3()
                .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                .addRow('Tier 6+', playerMods.mods.filter(mod => mod.rarity >= 6).length) 
                .addRow('+25 Speed', plus25Speed)
                .addRow('+20 Speed', plus20Speed)
                .addRow('+15 Speed', plus15Speed);
                
            replyMsg.addField(`Mods (${new Intl.NumberFormat().format(playerMods.count)})`, `\`\`\`${modsTable.toString()}\`\`\``, false);

            const shipsTable = new AsciiTable3()
                .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                .addRow('Level 85', summaryData.ships.levels[84])  // level 85
                .addRow('7 stars', summaryData.ships.rarities[6]);  // 7 star
            replyMsg.addField(`Ships (${summaryData.ships.count})`, `\`\`\`\n${shipsTable.toString()}\`\`\``, false);

            // reply with register message
            message.channel.send(replyMsg);
        } else {
            // reply with error message
            message.channel.send(this.getReplyEmbedMsg('My Profile', `<@${message.author.id}> Weird error fetching intel data from swgoh.gg...`));
        }
    }

    /**
     * Replies with stats on a specific character to sender.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processMyStats(message, args) {
        this.logger.info('mystats command detected');

        var charName;

        // check parameters
        if (args.length == 1) {
            charName = args[0];
        } else {
            message.channel.send(this.getReplyEmbedMsg('My Stats', `<@${message.author.id}> Tell me the name of the soldier you want status for!`));
            return;
        }

        // get possible allycodes
        const allyCodes = this.registry.getAllyCodes(message.author.id);

        var allyCode;

        if (allyCodes.length == 0) {
            message.channel.send(this.getReplyEmbedMsg('My Stats', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        } else if (allyCodes.length == 1) {
            // single ally code
            allyCode = allyCodes[0];
        } else {
            allyCode = await this.getAllyCodeReaction(message, allyCodes, 'My Stats');

            if (!allyCode) return;
        }

        if (allyCode.length != 9 || !allyCode.match('[0-9]+')) {
            // reply with check message
            message.channel.send(
                this.getReplyEmbedMsg('My Stats', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
        } else {
            // try to get unit from generic cache
            const char = this.swgohGGApi.findCharacter(charName);

            if (char) {
                const playerData = this.swgohGGApi.getPlayer(allyCode);

                if (playerData) {
                    // find player char
                    const playerChar = playerData.units.find(searchChar => searchChar.data.base_id == char.base_id);

                    if (playerChar) {
                        var reply = this.getReplyEmbedMsg(`${playerData.data.name}'s ${playerChar.data.name} Stats`,
                            `<@${message.author.id}> Here are your roster stats for "${charName}".`, 'via swgoh.gg');

                        reply.setImage(char.image);

                        const MAX_HEADER_SIZE = 'Critical Avoidance'.length + 2;
                        const MAX_DATA_SIZE = 12;

                        const infoTable = new AsciiTable3()
                            .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                            .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                            .addRow('Level', playerChar.data.level)
                            .addRow('Rarity', `${playerChar.data.rarity}*`)
                            .addRow('GP', new Intl.NumberFormat().format(playerChar.data.power))
                            .addRow('Gear', playerChar.data.gear_level);
                        if (playerChar.data.gear_level == 13) infoTable.addRow('Relic Tier', playerChar.data.relic_tier - 2);
                        reply.addField('Info', `\`\`\`\n${infoTable.toString()}\n\`\`\``);

                        const baTable = new AsciiTable3()
                            .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                            .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                            .addRow('Strength (STR)', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatStrength]))
                            .addRow('Agility (AGI)', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatAgility]))
                            .addRow('Tactics (TAC)',  new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatTactics]));
                        reply.addField('Base attributes', `\`\`\`\n${baTable.toString()}\n\`\`\``);

                        const generalTable = new AsciiTable3()
                            .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                            .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                            .addRow('Health', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatHealth]))
                            .addRow('Protection', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatProtection]))
                            .addRow('Speed', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatSpeed]))
                            .addRow('Crit Damage', `${(playerChar.data.stats[StatTypeEnum.StatCriticalDamage] * 100).toFixed(2)}%`)
                            .addRow('Potency', `${(playerChar.data.stats[StatTypeEnum.StatPotency] * 100).toFixed(2)}%`)
                            .addRow('Tenacity', `${(playerChar.data.stats[StatTypeEnum.StatTenaticy] * 100).toFixed(2)}%`)
                            .addRow('Health Steal', `${(playerChar.data.stats[StatTypeEnum.StatHealthSteal] * 100).toFixed(2)}%`)
                            .addRow('Defense Pen', playerChar.data.stats[StatTypeEnum.StatDefensePenetration]);
                        reply.addField('General', `\`\`\`\n${generalTable.toString()}\n\`\`\``);

                        const poTable = new AsciiTable3()
                            .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                            .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                            .addRow('Damage', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatPhysicalDamage]))
                            .addRow('Crit Chance', `${(playerChar.data.stats[StatTypeEnum.StatPhysicalCriticalChance]).toFixed(2)}%`)
                            .addRow('Armor Pen', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatArmorPenetration]))
                            .addRow('Accuracy', `${(playerChar.data.stats[StatTypeEnum.StatPhysicalAccuracy]).toFixed(2)}%`);
                        reply.addField('Physical Offense', `\`\`\`\n${poTable.toString()}\n\`\`\``);

                        const psTable = new AsciiTable3()
                            .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                            .setWidth(1, MAX_HEADER_SIZE).setWidth(2, MAX_DATA_SIZE)
                            .addRow('Armor', new Intl.NumberFormat().format(playerChar.data.stats[StatTypeEnum.StatArmor]))
                            .addRow('Dodge Chance', `${(playerChar.data.stats[StatTypeEnum.StatDodgeChance]).toFixed(2)}%`)
                            .addRow('Critical Avoidance', `${(playerChar.data.stats[StatTypeEnum.StatSpecialCriticalAvoidance]).toFixed(2)}%`);
                        reply.addField('Physical Survivability', `\`\`\`\n${psTable.toString()}\n\`\`\``);

                        message.channel.send(reply);
                    } else {
                        message.channel.send(
                            this.getReplyEmbedMsg('My Stats',
                                `<@${message.author.id}> Sorry, could not find soldier "${char.name}" in your roster!`, 'via swgoh.gg'));
                    }
                }
            } else {
                message.channel.send(
                    this.getReplyEmbedMsg('My Stats',
                        `<@${message.author.id}> I know Echo. I know Fives. Who the fuck is "${charName}"?`));
            }
        }
    }

    /**
     * Replies with equipped mods for a specific character to sender.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processMyMods(message, args) {
        this.logger.info('mymods command detected');

        var charName;

        // check parameters
        if (args.length == 1) {
            charName = args[0];
        } else {
            message.channel.send(this.getReplyEmbedMsg('My Mods', `<@${message.author.id}> Tell me the name of the soldier you want status for!`));
            return;
        }

        // try to get unit from generic cache
        const char = this.swgohGGApi.findCharacter(charName);

        if (char) {
            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            var allyCode;

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('My Mods', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'My Mods');

                if (!allyCode) return;
            }

            // get player data
            const player = this.swgohGGApi.getPlayer(allyCode);

            // get all mods for player
            const modsData = this.swgohGGApi.getPlayerMods(allyCode);

            // get mods for desired char only
            const charMods = modsData.mods.filter(mod => mod.character == char.base_id);

            if (charMods.length > 0) {
                const slotSymbols = [ '⬜', '↗️', '🔷', '🔺', '🟡', '❌' ];

                const reply = 
                    this.getReplyEmbedMsg(`${player.data.name}'s ${char.name} Mods`, 
                                        `<@${message.author.id}> Here are your mods for ${charName}:`, 'via swgoh.gg');

                // loop over slots
                for (var slot = 1; slot <= 6; slot++) {
                    const slotData = charMods.find(mod => mod.slot == slot);

                    var stats = `**${slotData.primary_stat.display_value} ${slotData.primary_stat.name}**`;
                    slotData.secondary_stats.forEach(stat => {
                        stats = stats + `\n(${stat.roll}) ${stat.display_value} ${stat.name}`;
                    });

                    reply.addField(`${slotSymbols[slot - 1]} (${slotData.rarity}* Lvl: ${slotData.level})`, `${stats}`, true);
                }

                message.channel.send(reply);
            } else {
                message.channel.send(
                    this.getReplyEmbedMsg('My Mods', `<@${message.author.id}> Sorry, could not find any mods for soldier "${char.name}" in your roster!`, 'via swgoh.gg'));
            }
        } else {
            message.channel.send(
                this.getReplyEmbedMsg('My Mods', `<@${message.author.id}> I know Echo. I know Fives. Who the fuck is "${charName}"?`));
        }
    }

    /**
     * Replies with bot ally code message to sender.
     * @param {*} message The discord message object.
     */
    processAllyCode(message) {
        this.logger.info('allycode command detected');

        var userId;

        // check for mentions
        if (message.mentions.users.size > 0) {
            userId = message.mentions.users.first().id;
        } else {
            // no arguments -> use message issuer
            userId = message.author.id;
        }

        // get ally code for discord user
        const allyCodes = this.registry.getAllyCodes(userId);

        if (allyCodes) {
            if (allyCodes.length == 1) {
                // only one ally code
                message.channel.send(this.getReplyEmbedMsg('Ally code', `<@${message.author.id}> Your ally code is ${allyCodes[0]}!`));
            } else {
                const replyMsg = this.getReplyEmbedMsg('Ally code', `<@${message.author.id}> These are the allycodes registered to your @user:`);

                var list = '';

                // loop over ally codes
                allyCodes.forEach(code => {
                    const player = this.swgohHelpApi.getPlayer(code);

                    // sanity check
                    if (player) {
                        list = `${list}\n\`${code}\` **${player.name}**`;
                    } else {
                        list = `${list}\n\`${code}\` **???**`;
                    }
                });

                replyMsg.addField('Ally codes', `${list}`);

                message.channel.send(replyMsg);
            }

        } else {
            message.channel.send(this.getReplyEmbedMsg('Ally code',
                `<@${message.author.id}> You do not seem to have a registered your ally code. Please use \`cr.<ally code>.register\` first...`));
        }
    }

}

module.exports = UserCommand;