/*jshint esversion: 8 */

const { SwgohGGApi } = require('swgoh-api-swgohgg');
const { SwgohHelpApi, CombatTypeEnum, ModUnitStatEnum, GuildMemberLevelEnum } = require('swgoh-api-swgohhelp');
const { AsciiTable3 } = require('ascii-table3');
const fs = require('fs');

const Command = require('./command.js');

const MSG_DELETE_TIMEOUT = 1000;

/**
 * Class for handling bot TW commands.
 */
class TWCommand extends Command {
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
     * Replies with bot tw message to sender, comparing both guilds.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processTW(message, args) {
        this.logger.info('processTW@tw.js: territorywar command detected');

        var opponentAllyCode;

        // check for parameters (opponent ally code)
        if (args.length == 1) {
            // sanity check
            if (Command.isAllyCode(args[0])) {
                opponentAllyCode = Command.getProperAllyCode(args[0]);
            } else {
                message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> "${args[0]}" does not seem like a proper ally code to me!`));
                return;    
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Tell me an ally code of the opponent guild for intel gathering!`));
            return;
        }

        // get possible allycodes
        const allyCodes = this.registry.getAllyCodes(message.author.id);

        var allyCode;

        if (allyCodes.length == 0) {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        } else if (allyCodes.length == 1) {
            // single ally code
            allyCode = allyCodes[0];
        } else {
            allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Territory War');

            if (!allyCode) return;
        }
        
        const myGuildMsg = await message.channel.send(`<@${message.author.id}> Retrieving your guild from swgoh.help...`);
        const myGuild = this.swgohHelpApi.getGuild(allyCode);
        await myGuildMsg.delete({ timeout: MSG_DELETE_TIMEOUT });

        const myGuildPlayersMsg = await message.channel.send(`<@${message.author.id}> Retrieving your guild players from swgoh.help...`);
        const myGuildPlayers = this.swgohHelpApi.getGuildPlayers(allyCode);
        await myGuildPlayersMsg.delete({ timeout: MSG_DELETE_TIMEOUT });

        if (myGuild && myGuildPlayers) {
            const myGuildStats = SwgohHelpApi.getGuildStats(myGuild);

            const opponentGuildMsg = await message.channel.send(`<@${message.author.id}> Retrieving opponent guild from swgoh.help...`);
            const opponentGuild = this.swgohHelpApi.getGuild(opponentAllyCode);
            await opponentGuildMsg.delete({ timeout: MSG_DELETE_TIMEOUT });

            const opponentGuildPlayersMsg = await message.channel.send(`<@${message.author.id}> Retrieving opponent guild players from swgoh.help...`);
            const opponentGuildPlayers = this.swgohHelpApi.getGuildPlayers(opponentAllyCode);
            await opponentGuildPlayersMsg.delete({ timeout: MSG_DELETE_TIMEOUT });

            const outputMsg = await message.channel.send(`<@${message.author.id}> Generating command output...`);
            if (opponentGuild && opponentGuildPlayers) {
                const opponentGuildStats = SwgohHelpApi.getGuildStats(opponentGuild);

                var replyMsg =
                    this.getReplyEmbedMsg('Territory War',
                        `<@${message.author.id}> Here\'s the intel from guild comparison:`,
                        'via swgoh.help');

                const generalTable = new AsciiTable3()
                    .setStyle('reddit-markdown')
                    .setWidths([11, 13, 13]).setWrapped(2).setWrapped(3)
                    .setAlignLeft(1).setAlignRight(2).setAlignRight(3)
                    .setHeading('', myGuild.name, opponentGuild.name);

                generalTable.addRow('# Members', myGuild.members, opponentGuild.members);
                generalTable.addRow('GP', new Intl.NumberFormat().format(myGuild.gp), new Intl.NumberFormat().format(opponentGuild.gp));
                generalTable.addRow('Char GP', new Intl.NumberFormat().format(myGuildStats.gpChar), new Intl.NumberFormat().format(opponentGuildStats.gpChar));
                generalTable.addRow('Ship GP', new Intl.NumberFormat().format(myGuildStats.gpShip), new Intl.NumberFormat().format(opponentGuildStats.gpShip));

                Command.addFields(replyMsg, 'General', `\`\`\`${generalTable.toString()}\`\`\``);

                // VIP units to list
                const vipUnits = JSON.parse(fs.readFileSync("config/vip_units.json"));

                // default list of units
                var unitNames = vipUnits.tw;

                // get full list of units
                const guildReg = this.registry.getGuild(myGuild.id);
                if (guildReg) unitNames = unitNames.concat(guildReg.vipUnitsTW);

                unitNames.forEach(unitName => {
                    const unit = this.swgohHelpApi.findUnit(unitName);

                    const unitTable = new AsciiTable3()
                        .setStyle('reddit-markdown')
                        .setWidths([11, 13, 13]).setWrapped(2).setWrapped(3)
                        .setAlignLeft(1).setAlignRight(2).setAlignRight(3)
                        .setHeading('', myGuild.name, opponentGuild.name);

                    var myUnitStats = this.swgohHelpApi.getGuildUnitStatsSummary(myGuildPlayers, unitName);
                    var opponentUnitStats = this.swgohHelpApi.getGuildUnitStatsSummary(opponentGuildPlayers, unitName);

                    unitTable.addNonZeroRow('#', myUnitStats.count, opponentUnitStats.count);
                    unitTable.addNonZeroRow('7 stars', myUnitStats.rarities[6], opponentUnitStats.rarities[6]);
                    
                    if (unit.combatType == CombatTypeEnum.CombatTypeChar) {
                        unitTable.addNonZeroRow('Gear 13', myUnitStats.gear[12], opponentUnitStats.gear[12]);
                        unitTable.addNonZeroRow('Gear 12', myUnitStats.gear[11], opponentUnitStats.gear[11]);
                        unitTable.addNonZeroRow('Relic 7', myUnitStats.relics[7], opponentUnitStats.relics[7]);
                        unitTable.addNonZeroRow('Relic 6', myUnitStats.relics[6], opponentUnitStats.relics[6]);
                        unitTable.addNonZeroRow('Relic 5', myUnitStats.relics[5], opponentUnitStats.relics[5]);
                        unitTable.addNonZeroRow('6 zetas', myUnitStats.zetas.count[6], opponentUnitStats.zetas.count[6]);
                        unitTable.addNonZeroRow('3 zetas', myUnitStats.zetas.count[3], opponentUnitStats.zetas.count[3]);
                        unitTable.addRow('Min Speed', 
                            myUnitStats.count > 0 ? myUnitStats.speed.min : '-', opponentUnitStats.count > 0 ? opponentUnitStats.speed.min : '-');
                        unitTable.addRow('Max Speed', 
                            myUnitStats.count > 0 ? myUnitStats.speed.max : '-', opponentUnitStats.count > 0 ? opponentUnitStats.speed.max : '-');
                    } else if (unit.combatType == CombatTypeEnum.CombatTypeShip) {
                        unitTable.addNonZeroRow('6 stars', myUnitStats.rarities[5], opponentUnitStats.rarities[5]);
                        unitTable.addNonZeroRow('5 stars', myUnitStats.rarities[4], opponentUnitStats.rarities[4]);
                    }

                    if (myUnitStats.count > 0 || opponentUnitStats.count > 0) Command.addFields(replyMsg, unit.nameKey, `\`\`\`${unitTable.toString()}\`\`\``);
                });

                // reply  message
                message.channel.send(replyMsg);
            }
            await outputMsg.delete({ timeout: MSG_DELETE_TIMEOUT });
        }
    }

    /**
     * Replies with bot TW add message to sender, adding a new VIP unit to TW comparison.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
     async processTWAdd(message, args) {
        this.logger.info('processTWAdd@tw.js: territorywar.add command detected');

        var unitName;

        // check for parameters (unit name/acronym)
        if (args.length == 1) {
            unitName = args[0];
        } else {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Tell me the name of the unit to add!`));
            return;
        }

        // get unit
        const unit = this.swgohHelpApi.findUnit(unitName);

        // sanity check
        if (unit) {
            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            var allyCode;

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Territory War');

                if (!allyCode) return;
            }

            // get guild info
            const guildData = this.swgohHelpApi.getGuild(allyCode);

            if (!guildData) return;

            // get guild player info
            const guildPlayer = guildData.roster.find(player => player.allyCode = allyCode);

            if (guildPlayer.guildMemberLevel != GuildMemberLevelEnum.GuildMemberLevelLeader && 
                guildPlayer.guildMemberLevel != GuildMemberLevelEnum.GuildMemberLevelOfficer) {
                message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Sorry, you need to be the guild leader or an officer to use this feature!`));
                return;
            }

            const guildReg = this.registry.getGuild(guildData.id);

            if (guildReg) {
                if (guildReg.vipUnitsTW.find(aName => aName == unit.nameKey)) {
                    message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> You have already added "${unitName}" to your custom TW unit list!`));
                } else {
                    // add unit
                    guildReg.vipUnitsTW.push(unit.nameKey);

                    this.registry.saveGuilds(this.registry.getGuildsFilename());

                    message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Added "${unitName}" to your custom TW unit list!`));
                }
            } else {
                message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Your guild is not registered. Please register it first!`));
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> I know Echo, I know Fives... How the fuck is "${unitName}"???`));
        }
    }

    /**
     * Replies with bot TW remove message to sender, removing a VIP unit from TW comparison.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processTWRemove(message, args) {
        this.logger.info('processTWRemove@tw.js: territorywar.remove command detected');

        var unitName;

        // check for parameters (unit name/acronym)
        if (args.length == 1) {
            unitName = args[0];
        } else {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Tell me the name of the unit to remove!`));
            return;
        }

        // get unit
        const unit = this.swgohHelpApi.findUnit(unitName);

        // sanity check
        if (unit) {
            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            var allyCode;

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Territory War');

                if (!allyCode) return;
            }

            // get guild info
            const guildData = this.swgohHelpApi.getGuild(allyCode);

            if (!guildData) return;

            // get guild player info
            const guildPlayer = guildData.roster.find(player => player.allyCode = allyCode);

            if (guildPlayer.guildMemberLevel != GuildMemberLevelEnum.GuildMemberLevelLeader && 
                guildPlayer.guildMemberLevel != GuildMemberLevelEnum.GuildMemberLevelOfficer) {
                message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Sorry, you need to be the guild leader or an officer to use this feature!`));
                return;
            }

            const guildReg = this.registry.getGuild(guildData.id);

            if (guildReg) {
                const idx = guildReg.vipUnitsTW.findIndex(aName => aName == unit.nameKey);
                if (idx == -1) {
                    message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> It seems "${unitName}" is not part of your custom TW unit list!`));
                } else {
                    // remove unit
                    guildReg.vipUnitsTW.splice(idx, 1);

                    this.registry.saveGuilds(this.registry.getGuildsFilename());

                    message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Removed "${unitName}" from your custom TW unit list!`));
                }
            } else {
                message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Your guild is not registered. Please register it first!`));
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> I know Echo, I know Fives... How the fuck is "${unitName}"???`));
        }
    }

    /**
     * Replies with bot TW list message to sender, listing VIP units for TW comparison.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processTWList(message) {
        this.logger.info('processTWList@tw.js: tw.list command detected');

        const replyMsg = this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> Here is the list of units for TW guild comparison:`);

        // default VIP units to list
        const vipUnits = JSON.parse(fs.readFileSync("config/vip_units.json"));

        // get list of units
        var unitNames = vipUnits.tw;

        var list = '';
        // loop over units
        unitNames.forEach(unitName => {
            const unit = this.swgohHelpApi.findUnit(unitName);
            // sanity check
            if (unit) {
                list += unit.nameKey + '\n';
            }
        });

        Command.addFields(replyMsg, 'Default', list);

        // get possible allycodes
        const allyCodes = this.registry.getAllyCodes(message.author.id);

        var allyCode;

        if (allyCodes.length == 0) {
            message.channel.send(this.getReplyEmbedMsg('Territory War', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        } else if (allyCodes.length == 1) {
            // single ally code
            allyCode = allyCodes[0];
        } else {
            allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Territory War');

            if (!allyCode) return;
        }

        // get player data (to retrieve guild)
        const data = this.swgohHelpApi.getPlayer(allyCode);

        // get guild from registry
        const guildReg = this.registry.getGuild(data.guildRefId);

        // check for registered guild
        if (guildReg) {
           // guild custom VPI units
            unitNames = guildReg.vipUnitsTW;

            list = '';
            // loop over units
            unitNames.forEach(unitName => {
                const unit = this.swgohHelpApi.findUnit(unitName);
                // sanity check
                if (unit) {
                    list += unit.nameKey + '\n';
                }
            });

            Command.addFields(replyMsg, 'Custom', list);
        }

        message.channel.send(replyMsg); 
    }

    /**
     * Replies with bot GAC message to sender, comparing both players.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGAC(message, args) {
        this.logger.info('processGAC@tw.js: grandarena command detected');

        var opponentAllyCode;

        // check for parameters (opponent ally code)
        if (args.length == 1) {
            // sanity check
            if (Command.isAllyCode(args[0])) {
                opponentAllyCode = Command.getProperAllyCode(args[0]);
            } else {
                message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> "${args[0]}" does not seem like a proper ally code to me!`));
                return;    
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Tell me an opponent ally code for intel gathering!`));
            return;
        }

        // get possible allycodes
        const allyCodes = this.registry.getAllyCodes(message.author.id);

        var allyCode;

        if (allyCodes.length == 0) {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        } else if (allyCodes.length == 1) {
            // single ally code
            allyCode = allyCodes[0];
        } else {
            allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Grand Arena');

            if (!allyCode) return;
        }

        const myMsg = await message.channel.send(`<@${message.author.id}> Retrieving your data from swgoh.help...`);
        const player = this.swgohHelpApi.getPlayer(allyCode);
        await myMsg.delete({ timeout: MSG_DELETE_TIMEOUT });

        const opponentMsg = await message.channel.send(`<@${message.author.id}> Retrieving opponent data from swgoh.help...`);
        const opponent = this.swgohHelpApi.getPlayer(opponentAllyCode);
        await opponentMsg.delete({ timeout: MSG_DELETE_TIMEOUT });
        
        const outputMsg = await message.channel.send(`<@${message.author.id}> Generating command output...`);
        if (player && opponent) {
            this.swgohHelpApi.statsCalculator.calcPlayerStats(player);
            this.swgohHelpApi.statsCalculator.calcPlayerStats(opponent);

            const playerStats = SwgohHelpApi.getPlayerStatsSummary(player);
            const opponentStats = SwgohHelpApi.getPlayerStatsSummary(opponent);

            var replyMsg =
                this.getReplyEmbedMsg('Grand Arena',
                    `<@${message.author.id}> Here\'s the intel from player comparison:`,
                    'via swgoh.help');

            const generalTable = new AsciiTable3()
                .setStyle('reddit-markdown')
                .setWidths([12, 12, 12]).setWrapped(2).setWrapped(3)
                .setAlignLeft(1).setAlignRight(2).setAlignRight(3)
                .setHeading('', player.name, opponent.name);

            generalTable.addRow('GP', new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(player, "Galactic Power:")), 
                                    new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(opponent, "Galactic Power:")));
            generalTable.addRow('Char GP', new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(player, "Galactic Power (Characters):")), 
                                        new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(opponent, "Galactic Power (Characters):")));
            generalTable.addRow('Ship GP', new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(player, "Galactic Power (Ships):")), 
                                        new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(opponent, "Galactic Power (Ships):")));
            generalTable.addRow('Chars', playerStats.chars.count, opponentStats.chars.count);
            generalTable.addRow('Ships', playerStats.ships.count, opponentStats.ships.count);
            generalTable.addRow('7 star', playerStats.chars.rarities[6], opponentStats.chars.rarities[6]);
            generalTable.addRow('Zetas', playerStats.chars.zetas, opponentStats.chars.zetas);
            generalTable.addRow('GLs', playerStats.chars.galacticLegendCount, opponentStats.chars.galacticLegendCount);

            Command.addFields(replyMsg, 'General', `\`\`\`${generalTable.toString()}\`\`\``);

            const gearTable = new AsciiTable3()
                .setStyle('reddit-markdown')
                .setWidths([12, 12, 12]).setWrapped(2).setWrapped(3)
                .setAlignLeft(1).setAlignRight(2).setAlignRight(3)
                .setHeading('', player.name, opponent.name);

            gearTable.addNonZeroRow('G13', playerStats.chars.gear[12], opponentStats.chars.gear[12]);
            gearTable.addNonZeroRow('G12', playerStats.chars.gear[11], opponentStats.chars.gear[11]);
            gearTable.addNonZeroRow('Tier 5+', 
                                    playerStats.chars.relics[5] + playerStats.chars.relics[6] + playerStats.chars.relics[7], 
                                    opponentStats.chars.relics[5] + opponentStats.chars.relics[6] + opponentStats.chars.relics[7]);

            Command.addFields(replyMsg, 'Gear', `\`\`\`${gearTable.toString()}\`\`\``);

            const modsTable = new AsciiTable3()
                .setStyle('reddit-markdown')
                .setWidths([12, 12, 12]).setWrapped(2).setWrapped(3)
                .setAlignLeft(1).setAlignRight(2).setAlignRight(3)
                .setHeading('', player.name, opponent.name);

            // player mods
            var playerModStats = { plus6Rarity: 0, plus25Speed: 0, plus20Speed: 0, plus15Speed: 0 };

            player.roster.forEach(unit => playerModStats.plus6Rarity += unit.mods.filter(mod => mod.pips >= 6).length);

            player.roster.forEach(unit => 
                unit.mods.forEach(mod =>
                    playerModStats.plus25Speed += mod.secondaryStat.filter(stat => stat.unitStat == ModUnitStatEnum.StatSpeed && stat.value >= 25).length
                )
            );

            player.roster.forEach(unit => 
                unit.mods.forEach(mod =>
                    playerModStats.plus20Speed += mod.secondaryStat.filter(stat => stat.unitStat == ModUnitStatEnum.StatSpeed && stat.value >= 20 && stat.value < 25).length
                )
            );

            player.roster.forEach(unit => 
                unit.mods.forEach(mod =>
                    playerModStats.plus15Speed += mod.secondaryStat.filter(stat => stat.unitStat == ModUnitStatEnum.StatSpeed && stat.value >= 15 && stat.value < 20).length
                )
            );

            // opponent mods
            var opponentModStats = { plus6Rarity: 0, plus25Speed: 0, plus20Speed: 0, plus15Speed: 0 };
            
            opponent.roster.forEach(unit => opponentModStats.plus6Rarity += unit.mods.filter(mod => mod.pips >= 6).length);

            opponent.roster.forEach(unit => 
                unit.mods.forEach(mod =>
                    opponentModStats.plus25Speed += mod.secondaryStat.filter(stat => stat.unitStat == ModUnitStatEnum.StatSpeed && stat.value >= 25).length
                )
            );

            opponent.roster.forEach(unit => 
                unit.mods.forEach(mod =>
                    opponentModStats.plus20Speed += mod.secondaryStat.filter(stat => stat.unitStat == ModUnitStatEnum.StatSpeed && stat.value >= 20 && stat.value < 25).length
                )
            );

            opponent.roster.forEach(unit => 
                unit.mods.forEach(mod =>
                    opponentModStats.plus15Speed += mod.secondaryStat.filter(stat => stat.unitStat == ModUnitStatEnum.StatSpeed && stat.value >= 15 && stat.value < 20).length
                )
            );

            modsTable.addRow('Tier 6+', playerModStats.plus6Rarity, opponentModStats.plus6Rarity)
                    .addRow('+25 Speed', playerModStats.plus25Speed, opponentModStats.plus25Speed)
                    .addRow('+20 Speed', playerModStats.plus20Speed, opponentModStats.plus20Speed)
                    .addRow('+15 Speed',  playerModStats.plus15Speed, opponentModStats.plus15Speed)
                    .addRow('Speed +300', 
                            player.roster.
                            filter(unit => unit.stats != undefined). // make sure we have stats calculated
                            filter(unit => unit.combatType == CombatTypeEnum.CombatTypeChar). // only chars
                            filter(unit => 
                                    (unit.stats.base[ModUnitStatEnum.StatSpeed] +
                                    (unit.stats.mods[ModUnitStatEnum.StatSpeed] ? unit.stats.mods[ModUnitStatEnum.StatSpeed] : 0)) >= 300
                            ).length,
                            opponent.roster.
                            filter(unit => unit.stats != undefined). // make sure we have stats calculated
                            filter(unit => unit.combatType == CombatTypeEnum.CombatTypeChar). // only chars
                            filter(unit => 
                                    (unit.stats.base[ModUnitStatEnum.StatSpeed] +
                                    (unit.stats.mods[ModUnitStatEnum.StatSpeed] ? unit.stats.mods[ModUnitStatEnum.StatSpeed] : 0)) >= 300
                            ).length
                        );

            Command.addFields(replyMsg, 'Mods', `\`\`\`${modsTable.toString()}\`\`\``);

            // default VIP units to list
            const vipUnits = JSON.parse(fs.readFileSync("config/vip_units.json"));

            // user data
            const user = this.registry.getUser(message.author.id);

            // get full list of units
            const unitNames = vipUnits.gac.concat(user.vipUnitsGAC);

            // loop over units
            unitNames.forEach(unitName => {
                const unit = this.swgohHelpApi.findUnit(unitName);

                const unitTable = new AsciiTable3()
                    .setStyle('reddit-markdown')
                    .setWidths([12, 12, 12]).setWrapped(2).setWrapped(3)
                    .setAlignLeft(1).setAlignRight(2).setAlignRight(3)
                    .setHeading('', player.name, opponent.name);

                const myUnit = SwgohHelpApi.getPlayerUnitFromUnits(player, unit.nameKey);
                const opponentUnit = SwgohHelpApi.getPlayerUnitFromUnits(opponent, unit.nameKey);

                if (myUnit || opponentUnit) {
                    unitTable.addRow('Stars', myUnit ? myUnit.rarity : '-', opponentUnit ? opponentUnit.rarity : '-');
                
                    if (unit.combatType == CombatTypeEnum.CombatTypeChar) {
                        unitTable.addRow('Zetas', myUnit ? SwgohHelpApi.getZetaCount(myUnit) : '-', opponentUnit ? SwgohHelpApi.getZetaCount(opponentUnit) : '-');
                        unitTable.addRow('Gear', myUnit ? myUnit.gear : '-', opponentUnit ? opponentUnit.gear : '-');
                        
                        unitTable.addRow(
                            'Tier', 
                            myUnit ? (myUnit.gear == 13 ? (myUnit.relic.currentTier - 2) : '-') : '-', 
                            opponentUnit ? (opponentUnit.gear == 13 ? (opponentUnit.relic.currentTier - 2) : '-') : '-'
                        );
                        
                        unitTable.addRow(
                            'Speed', 
                            myUnit ? (myUnit.stats.base[ModUnitStatEnum.StatSpeed] + 
                                    (myUnit.stats.mods[ModUnitStatEnum.StatSpeed] ? myUnit.stats.mods[ModUnitStatEnum.StatSpeed] : 0)) : '-',
                            opponentUnit ? (opponentUnit.stats.base[ModUnitStatEnum.StatSpeed] + 
                                    (opponentUnit.stats.mods[ModUnitStatEnum.StatSpeed] ? opponentUnit.stats.mods[ModUnitStatEnum.StatSpeed] : 0)) : '-'
                        );
                    } else if (unit.combatType == CombatTypeEnum.CombatTypeShip) {
                        //unitTable.addNonZeroRow('6 stars', myUnitStats.rarities[5], opponentUnitStats.rarities[5]);
                        //unitTable.addNonZeroRow('5 stars', myUnitStats.rarities[4], opponentUnitStats.rarities[4]);
                    }

                    Command.addFields(replyMsg, unit.nameKey, `\`\`\`${unitTable.toString()}\`\`\``);
                }
            });

            // reply  message
            message.channel.send(replyMsg);
        } else {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Weird error fetching data from swgoh.help!`));
        }
        await outputMsg.delete({ timeout: MSG_DELETE_TIMEOUT });
    }

    /**
     * Replies with bot GAC add message to sender, adding a new VIP unit to GAC comparison.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGACAdd(message, args) {
        this.logger.info('processGACAdd@tw.js: grandarena.add command detected');

        var unitName;

        // check for parameters (unit name/acronym)
        if (args.length == 1) {
            unitName = args[0];
        } else {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Tell me the name of the unit to add!`));
            return;
        }

        // get user
        const user = this.registry.getUser(message.author.id);

        if (!user) {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        }

        // get unit
        const unit = this.swgohHelpApi.findUnit(unitName);

        // sanity check
        if (unit) {
            if (user.vipUnitsGAC.find(aName => aName == unit.nameKey)) {
                message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> You have already added "${unitName}" to your custom GAC unit list!`));
            } else {
                // add unit
                user.vipUnitsGAC.push(unit.nameKey);

                this.registry.saveUsers(this.registry.getUsersFilename());

                message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Added "${unitName}" to your custom GAC unit list!`));
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> I know Echo, I know Fives... How the fuck is "${unitName}"???`));
        }
    }

    /**
     * Replies with bot GAC remove message to sender, removing a VIP unit from GAC comparison.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGACRemove(message, args) {
        this.logger.info('processGACRemove@tw.js: grandarena.remove command detected');

        var unitName;

        // check for parameters (unit name/acronym)
        if (args.length == 1) {
            unitName = args[0];
        } else {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Tell me the name of the unit to remove!`));
            return;
        }

        // get user
        const user = this.registry.getUser(message.author.id);

        if (!user) {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        }

        // get unit
        const unit = this.swgohHelpApi.findUnit(unitName);

        // sanity check
        if (unit) {
            const idx = user.vipUnitsGAC.findIndex(aName => aName == unit.nameKey);
            if (idx == -1) {
                message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> You have not added "${unitName}" to your custom GAC unit list!`));
            } else {
                // remove unit
                user.vipUnitsGAC.splice(idx, 1);

                this.registry.saveUsers(this.registry.getUsersFilename());

                message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Removed "${unitName}" from your custom GAC unit list!`));
            } 
        } else {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> I know Echo, I know Fives... How the fuck is "${unitName}"???`));
        }
    }

    /**
     * Replies with bot GAC list message to sender, listing VIP units for GAC comparison.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGACList(message) {
        this.logger.info('processGACList@tw.js: grandarena.list command detected');

        // get user
        const user = this.registry.getUser(message.author.id);

        if (!user) {
            message.channel.send(this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        }

        const replyMsg = this.getReplyEmbedMsg('Grand Arena', `<@${message.author.id}> Here is the list of units for GAC comparison:`);

        // default VIP units to list
        const vipUnits = JSON.parse(fs.readFileSync("config/vip_units.json"));

        // get list of units
        var unitNames = vipUnits.gac;

        var list = '';
        // loop over units
        unitNames.forEach(unitName => {
            const unit = this.swgohHelpApi.findUnit(unitName);
            // sanity check
            if (unit) {
                list += unit.nameKey + '\n';
            }
        });

        Command.addFields(replyMsg, 'Default', list);

        // user custom VPI units
        unitNames = user.vipUnitsGAC;

        list = '';
        // loop over units
        unitNames.forEach(unitName => {
            const unit = this.swgohHelpApi.findUnit(unitName);
            // sanity check
            if (unit) {
                list += unit.nameKey + '\n';
            }
        });

        Command.addFields(replyMsg, 'Custom', list);
        
        message.channel.send(replyMsg);
    }
}

module.exports = TWCommand;