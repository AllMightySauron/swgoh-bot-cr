/*jshint esversion: 8 */

const Command = require('./command.js');

const { SwgohGGApi } = require('swgoh-api-swgohgg');
const { SwgohHelpApi, CombatTypeEnum, ModUnitStatEnum, GuildMemberLevelEnum } = require('swgoh-api-swgohhelp');
const { AsciiTable3 } = require('ascii-table3');

/**
 * Class for handling bot GUILD commands.
 */
class GuildCommand extends Command {

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
     * Replies with guild register message.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processRegisterGuild(message) {
        this.logger.info('processRegisterGuild@guild.js: registerGuild command detected');

         // get possible allycodes
         const allyCodes = this.registry.getAllyCodes(message.author.id);

         var allyCode;

         if (allyCodes.length == 0) {
             message.channel.send(this.getReplyEmbedMsg('Register Guild', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
             return;
         } else if (allyCodes.length == 1) {
             // single ally code
             allyCode = allyCodes[0];
         } else {
             allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Register Guild');

             if (!allyCode) return;
         }

         // get guild info
         const guildData = this.swgohHelpApi.getGuild(allyCode);

         if (!guildData) return;

         // get guild registry
         const guildReg = this.registry.getGuild(guildData.id);

         if (guildReg) {
            message.channel.send(this.getReplyEmbedMsg('Register Guild', `<@${message.author.id}> Your guild is already registered. There is no need to register it twice!`));
         } else {
            this.registry.registerGuild(guildData.id);

            this.registry.saveGuilds(this.registry.getGuildsFilename());

            message.channel.send(this.getReplyEmbedMsg('Register Guild', `<@${message.author.id}> Your guild is now registered!`));
         }
    }

     /**
     * Replies with guild register message.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
      async processUnregisterGuild(message) {
        this.logger.info('processUnregisterGuild@guild.js: unregisterGuild command detected');

         // get possible allycodes
         const allyCodes = this.registry.getAllyCodes(message.author.id);

         var allyCode;

         if (allyCodes.length == 0) {
             message.channel.send(this.getReplyEmbedMsg('Unregister Guild', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
             return;
         } else if (allyCodes.length == 1) {
             // single ally code
             allyCode = allyCodes[0];
         } else {
             allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Unregister Guild');

             if (!allyCode) return;
         }

         // get guild info
         const guildData = this.swgohHelpApi.getGuild(allyCode);

         if (!guildData) return;

         // get guild player info
         const guildPlayer = guildData.roster.find(player => player.allyCode = allyCode);

         if (guildPlayer.guildMemberLevel != GuildMemberLevelEnum.GuildMemberLevelLeader && 
             guildPlayer.guildMemberLevel != GuildMemberLevelEnum.GuildMemberLevelOfficer) {
             message.channel.send(this.getReplyEmbedMsg('Unregister Guild', `<@${message.author.id}> Sorry, you need to be the guild leader or an officer to use this feature!`));
             return;
         }

         // get guild registry
         const guildReg = this.registry.getGuild(guildData.id);

         if (this.registry.unregisterGuild(guildReg.id)) {
            this.registry.saveGuilds(this.registry.getGuildsFilename());

            message.channel.send(this.getReplyEmbedMsg('Unregister Guild', `<@${message.author.id}> Your guild was unregistered.`));
         } else {
            message.channel.send(this.getReplyEmbedMsg('Unregister Guild', `<@${message.author.id}> Your guild does not seem to be registered!`));
         }
    }

    /**
     * Replies with guild data on a specific character.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGuildChar(message, args) {
        this.logger.info('processGuildChar@guild.js: guildchar command detected');

        var allyCode;
        var charName;

        // check for parameters (charname and/or ally code)
        if (args.length == 2) {
            // get desired char name
            charName = args[0];

            // use given ally code parameter
            allyCode = Command.getProperAllyCode(args[1]);
        } else if (args.length == 1) {
            // get desired char name
            charName = args[0];

            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Guild Character');

                if (!allyCode) return;
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> Tell me the name of the soldier for intel gathering!`));
            return;
        }

        if (typeof allyCode == 'undefined') {
            message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> You don't seem to be a member of our squadron!`));
        } else  if(allyCode.length != 9 || !allyCode.match('[0-9]+')) {
            // reply with check message
            message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
            return;
        }

        // get unit from generic cache
        const unit = this.swgohHelpApi.findUnit(charName);

        // check for found
        if (unit && unit.combatType == CombatTypeEnum.CombatTypeChar) {
            // get guild data
            const guild = this.swgohHelpApi.getGuild(allyCode);

            if (guild) {
                // build guild players array
                const guildAllyCodes = [];
                guild.roster.forEach(onePlayer => guildAllyCodes.push(onePlayer.allyCode));

                // get guild players with units
                const guildPlayers = this.swgohHelpApi.getPlayers(guildAllyCodes);

                // global statistics
                var statistics = {
                    count: 0, star7: 0, G11:0, G12: 0, G13: 0, 
                    zeta0: 0, zeta1: 0, zeta2: 0, zeta3: 0, zeta4: 0, zeta5: 0, zeta6: 0,
                    relic1:0 , relic2: 0, relic3: 0, relic4: 0, relic5: 0, relic6: 0, relic7: 0, relic8: 0, relic9: 0
                };

                var rosterTable = new AsciiTable3()
                    .setStyle("reddit-markdown")
                    .setAlignLeft(1).setAlignRight(2).setAlignRight(5)
                    .setWidth(2, 4)
                    .setHeading('*', '⚙', '+', 'Z', 'spd', 'Name');

                // loop over guild players
                guildPlayers.forEach(player => {
                    const char = player.roster.find(searchUnit => searchUnit.defId == unit.baseId);

                    // check if found
                    if (char) {
                        // another one
                        statistics.count++;
                        
                        char.stats = this.swgohHelpApi.statsCalculator.calcCharStats(char);                        

                        // 7 star rarity check
                        if (char.rarity == 7) statistics.star7++;

                        // relevant gear level
                        if (char.gear >= 11 && char.gear <=13) statistics['G' + char.gear]++;

                        // number of zetas
                        const zetaSkills = SwgohHelpApi.getZetaCount(char);
                        statistics['zeta' + zetaSkills]++;

                        var relicTier = '-';
                        if (char.gear == 13) relicTier = ''.concat(char.relic.currentTier - 2);
                        if (relicTier >= '1' && relicTier <= '9') statistics['relic' + relicTier]++;

                        // speed calculation (special case for chars without mods)
                        const charSpeed = 
                            char.stats.base[ModUnitStatEnum.StatSpeed] +
                            (char.stats.mods[ModUnitStatEnum.StatSpeed] ? char.stats.mods[ModUnitStatEnum.StatSpeed] : 0);

                        rosterTable.addRow(char.rarity, char.gear, relicTier, zetaSkills, charSpeed, player.name);
                    }
                });

                // none found
                if (statistics.count == 0) {
                    message.channel.send(
                        this.getReplyEmbedMsg(`${guild.name}'s ${unit.nameKey}`, 
                                            `<@${message.author.id}> This squadron doesn't seem to have this unit trained yet!`, 
                                            'via swgoh.help'));
                } else {
                    var desc;

                    // special case for Rex
                    if (unit.baseId == "CT7567") {
                        desc = `<@${message.author.id}> Hey, that's ME you're talking about! Here's my guild roster:`;
                    } else {
                        desc = `<@${message.author.id}> Here's the guild roster on character "${charName}":`;
                    }

                    // add descriptions
                    desc = desc + '\n\n' + 
                        `**Name:** ${unit.nameKey}\n` +
                        `**Description**: ${unit.descKey}`;

                    var replyMsg = this.getReplyEmbedMsg(`${guild.name}'s ${unit.nameKey}`, desc, 'via swgoh.help');
                    //replyMsg.setImage(`https://swgoh.gg${char.image}`)

                    const statsTable = new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, 8).setWidth(2, 9)
                        .addRow('#', `${statistics.count} / ${guild.roster.length}`)
                        .addNonZeroRow('7 star', statistics.star7).addNonZeroRow('6 zeta', statistics.zeta6)
                        .addNonZeroRow('5 zeta', statistics.zeta5).addNonZeroRow('4 zeta', statistics.zeta4)
                        .addNonZeroRow('3 zeta', statistics.zeta3).addNonZeroRow('2 zeta', statistics.zeta2)
                        .addNonZeroRow('1 zeta', statistics.zeta1).addNonZeroRow('0 zeta', statistics.zeta0);

                    replyMsg.addField('Statistics', `\`\`\`${statsTable.toString()}\`\`\``);
                    
                    const gearTable =  new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, 8).setWidth(2, 9)
                        .addNonZeroRow('G13', statistics.G13).addNonZeroRow('G12', statistics.G12).addNonZeroRow('G11', statistics.G11);

                    if (gearTable.getRows().length != 0) replyMsg.addField('Gear' , `\`\`\`${gearTable.toString()}\`\`\``);

                    const relicsTable = new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, 8).setWidth(2, 9)
                        .addNonZeroRow('Tier 1', statistics.relic1).addNonZeroRow('Tier 2', statistics.relic2)
                        .addNonZeroRow('Tier 3', statistics.relic3).addNonZeroRow('Tier 4', statistics.relic4)
                        .addNonZeroRow('Tier 5', statistics.relic5).addNonZeroRow('Tier 6', statistics.relic6)
                        .addNonZeroRow('Tier 7', statistics.relic7).addNonZeroRow('Tier 8', statistics.relic8)
                        .addNonZeroRow('Tier 9', statistics.relic9);

                    if (relicsTable.getRows().length != 0) replyMsg.addField('Relics', `\`\`\`${relicsTable.toString()}\`\`\``);

                    Command.addFields(replyMsg, 'Roster', `\`\`\`${rosterTable.toString()}\`\`\``);

                    // reply with guildchar message
                    message.channel.send(replyMsg);
                }

            } else {
                message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> Cannot fetch guild data for ally code ${allyCode}!`));
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> I know Echo. I know Fives. Who the fuck is "${charName}"?`));
        }
    } 

    /**
     * Replies with guild data on a specific ship.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGuildShip(message, args) {
        this.logger.info('processGuildShip@guild.js: guildship command detected');

        var allyCode;
        var shipName;

        // check for parameters (ship name and/or ally code)
        if (args.length == 2) {
            // get desired ship name
            shipName = args[0];

            // use given ally code parameter
            allyCode = Command.getProperAllyCode(args[1]);
        } else if (args.length == 1) {
            // get desired ship name
            shipName = args[0];

            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Guild Ship', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Guild Ship');

                if (!allyCode) return;
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Guild Ship', `<@${message.author.id}> Tell me the name of the ship for intel gathering!`));
            return;
        }

        if (typeof allyCode == 'undefined') {
            message.channel.send(this.getReplyEmbedMsg('Guild Ship', `<@${message.author.id}> You don't seem to be a member of our squadron. Try enlisting first!`));
        } else if (allyCode.length != 9 || !allyCode.match('[0-9]+')) {
            // reply with check message
            message.channel.send(this.getReplyEmbedMsg('Guild Ship', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
            return;
        }

        // get unit from generic cache
        const unit = this.swgohHelpApi.findUnit(shipName);

        // check for found
        if (unit && unit.combatType == CombatTypeEnum.CombatTypeShip) {
            // get player data
            const guild = this.swgohHelpApi.getGuild(allyCode);

            if (guild) {
                // build guild payers array
                const guildAllyCodes = [];
                guild.roster.forEach(onePlayer => guildAllyCodes.push(onePlayer.allyCode));

                // get guild players with units
                const guildPlayers = this.swgohHelpApi.getPlayers(guildAllyCodes);

                 // global statistics
                 var statistics = {
                    count: 0, star7: 0, star6:0, star5: 0
                };

                var rosterTable = new AsciiTable3()
                    .setStyle('reddit-markdown')
                    .setAlignLeft(1).setAlignRight(2).setAlignLeft(3)
                    .setHeading('*', '⚙', 'Name');

                // loop over guild players
                guildPlayers.forEach(player => {
                    const ship = player.roster.find(searchUnit => searchUnit.defId == unit.baseId);

                    // check if found
                    if (ship) {
                        // another one
                        statistics.count++;

                        //ship.stats = this.swgohHelpApi.statsCalculator.calcShipStats(ship);

                        // relevant rarity check
                        if (ship.rarity >= 5 && ship.rarity <= 7) statistics['star' + ship.rarity]++;

                        rosterTable.addRow(ship.rarity, ship.gear, player.name);
                    } 
                }); 

                // sort on rarity descending
                rosterTable.sortColumnDesc(1);

                // none found
                if (statistics.count == 0) {
                    message.channel.send(
                        this.getReplyEmbedMsg(`${guild.name}'s ${unit.nameKey}`, 
                                            `<@${message.author.id}> This squadron doesn't seem to have this ship equipped yet!`, 
                                            'via swgoh.help'));
                } else {
                    var desc;

                    // special case for Rex
                    if (unit.baseId == "ARC170REX") {
                        desc = `<@${message.author.id}> Hey, that's my baby you're talking about! Here's my guild roster:`;
                    } else {
                        desc = `<@${message.author.id}> Here's the guild roster on ship "${shipName}":`;
                    }

                    // add descriptions
                    desc = desc + '\n\n' + 
                        `**Name:** ${unit.nameKey}\n` +
                        `**Description**: ${unit.descKey}`;

                    var replyMsg = this.getReplyEmbedMsg(`${guild.name}'s ${unit.nameKey}`, desc, 'via swgoh.help');
                    //replyMsg.setImage(`https://swgoh.gg${char.image}`)

                    const statsTable = new AsciiTable3()
                        .setStyle("reddit-markdown").setAlignLeft(1).setAlignRight(2)
                        .setWidth(1, 8).setWidth(2, 9)
                        .addRow('#', `${statistics.count} / ${guild.roster.length}`)
                        .addNonZeroRow('7 star', statistics.star7)
                        .addNonZeroRow('6 star', statistics.star6)
                        .addNonZeroRow('5 star', statistics.star5);

                    replyMsg.addField('Statistics', `\`\`\`${statsTable.toString()}\`\`\``);
                    
                    Command.addFields(replyMsg, 'Roster', `\`\`\`${rosterTable.toString()}\`\`\``); 

                    // reply with guildchar message
                    message.channel.send(replyMsg); 
                }

            } else {
                message.channel.send(this.getReplyEmbedMsg('Guild Ship', `<@${message.author.id}> Cannot fetch guild data for ally code ${allyCode}!`));
            }
        } else {
            message.channel.send(this.getReplyEmbedMsg('Guild Ship', `<@${message.author.id}> I know I can rely on my old ARC-170. What the fuck is a "${shipName}"?`));
        }
    }

    /**
     * Replies with guild stats.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
    async processGuildStats(message, args) {
        this.logger.info('processGuildShip@guild.js: guildstats command detected');

        var allyCode;

        // check for parameters (ally code)
        if (args.length == 0) {
            // get possible allycodes
            const allyCodes = this.registry.getAllyCodes(message.author.id);

            if (allyCodes.length == 0) {
                message.channel.send(this.getReplyEmbedMsg('Guild Stats', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
                return;
            } else if (allyCodes.length == 1) {
                // single ally code
                allyCode = allyCodes[0];
            } else {
                allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Guild Stats');

                if (!allyCode) return;
            }
        } else if (args.length == 1) {
            // use given ally code parameter
            allyCode = Command.getProperAllyCode(args[0]);
        } else {
            message.channel.send(this.getReplyEmbedMsg('Guild Stats', `<@${message.author.id}> Too many info. I was only expecting an ally code!`));
            return;
        }

        if(allyCode.length != 9 || !allyCode.match('[0-9]+')) {
            // reply with check message
            message.channel.send(this.getReplyEmbedMsg('Guild Character', `<@${message.author.id}> Ummm... "${allyCode}" does not look like a valid 9 digit ally code...`));
            return;
        }

        // get guild data
        const guild = this.swgohHelpApi.getGuild(allyCode);

        if (guild) {
            // get guild stats
            const guildStats = SwgohHelpApi.getGuildStats(guild);

            // build guild payers array
            const guildAllyCodes = [];
            guild.roster.forEach(onePlayer => guildAllyCodes.push(onePlayer.allyCode));

            // get guild players with units
            const guildPlayers = this.swgohHelpApi.getPlayers(guildAllyCodes);

            // reply message
            const replyMsg = 
                this.getReplyEmbedMsg(`${guild.name}'s Stats`, 
                                    `<@${message.author.id}> Here are the guild stats for ${guild.name}:\n\n`+
                                    `**GP:** ${new Intl.NumberFormat().format(guild.gp)}\n` +
                                    `**GP char:** ${new Intl.NumberFormat().format(guildStats.gpChar)}\n` +
                                    `**GP ship:** ${new Intl.NumberFormat().format(guildStats.gpShip)}\n` +
                                    `**Leader:** ${SwgohHelpApi.getGuildLeader(guild).name}\n` +
                                    `**Members:** ${guild.roster.length}`, 
                                    'via swgoh.help');

            // guild officers
            const guildOfficers = SwgohHelpApi.getGuildOfficers(guild);

            var officers = '';

            // loop over officers
            guildOfficers.forEach(officer => {
                officers += `\`${officer.allyCode}\` **${officer.name}**\n`;
            });

            if (officers != '') replyMsg.addField(`Officers (${guildOfficers.length})`, officers);

            const rosterTable = new AsciiTable3()
                .setStyle("reddit-markdown").setHeading('Name', 'GP', 'Char GP', 'Ship GP')
                .setWidth(1, 16).setCellMargin(0)
                .setAlignLeft(1).setAlignRight(2).setAlignRight(3).setAlignRight(4);

            // loop over guild players
            guildPlayers.forEach(player => {
                rosterTable
                    .addRow(player.name,
                            new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(player, 'Galactic Power:')),
                            new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(player, 'Galactic Power (Characters):')),
                            new Intl.NumberFormat().format(SwgohHelpApi.getPlayerStat(player, 'Galactic Power (Ships):')));
            });

            // sort by GP descending
            rosterTable.sortColumnDesc(2);

            Command.addFields(replyMsg, 'Roster', `\`\`\`${rosterTable.toString()}\`\`\``);

            // reply with guildchar message
            message.channel.send(replyMsg);
        } else {
            message.channel.send(this.getReplyEmbedMsg('Guild Stats', `<@${message.author.id}> Cannot fetch guild data for ally code ${allyCode}!`));
        }
    }

}

module.exports = GuildCommand;