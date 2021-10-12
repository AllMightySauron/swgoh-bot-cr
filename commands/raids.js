/*jshint esversion: 8 */

const Command = require('./command.js');

const { SwgohGGApi } = require('swgoh-api-swgohgg');
const { SwgohHelpApi } = require('swgoh-api-swgohhelp');
const { AsciiTable3 } = require('ascii-table3');

const fs = require('fs');

const MSG_DELETE_TIMEOUT = 1000;

/**
 * Raid.
 * @typedef {object} Raid
 * @property {string} name Raid name.
 * @property {Team[]} teams Array of potential teams to be used on this raid.
 * @property {Player[]} players Array of players  for this raid.
 */

/**
 * Team.
 * @typedef {object} Team
 * @property {string} name Team name.
 * @property {TeamVariant[]} variants Possible variants on this team.
 */

/**
 * Team variant.
 * @typedef {object} TeamVariant
 * @property {string} name Team variant name.
 * @property {TeamMember[]} members Array of team variant members.
 * @property {number} percentDamage Expected damage from team variant when fully equipped (0%-100%).
 */

/**
 * Team member.
 * @typedef {object} TeamMember
 * @property {string} name Team member name.
 * @property {number} gear Minimum gear for team member.
 * @property {number} relic Minimum relic level for team member.
 * @property {number} zetas Minimum number of zetas for team member.
 */

/**
 * Player.
 * @typedef {object} Player
 * @property {string} name Player name.
 * @property {TeamVariantResults[]} variantResults Array with all team variant achievement results.
 */

/**
 * Team variant results.
 * @typedef {object} TeamVariantResults
 * @property {string} team Team name.
 * @property {string} variant Variant name.
 * @property {number[]} memberDones Array with individual achievement level for each team variant member.
 * @property {number} total Total achievement level for this team variant.
 * @property {number} percentDamage Expected damage from team variant when fully equipped (0%-100%).
 */

/**
 * Raids helper reporting method.
 */
const HelperMethod = {
    BEST: 0,    // best team only (total achievement % * expected damage %)
    CLOSER: 1,  // best team only (total achievement %)
    DOABLE: 2,  // only teams with total achievement % = 100 %
    FULL: 3     // full list of team alternatives
};
const HelperMethodDesc = [ "best", "closer", "doable", "full" ];

/**
 * Class for handling bot Raid helper commands.
 */
class RaidsCommand extends Command {

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
     * Get reporting method description.
     * @param {HelperMethod} method The method.
     * @returns {string} The method description.
     */
    static getMethodDescription(method) {
        return HelperMethodDesc[method];
    }

    /**
     * Replies with raid helper  message.
     * @param {*} message The discord message object.
     * @param {string[]} args Array of arguments for this message.
     */
     async processRaidsHelper(message, args) {
        this.logger.info('processRaidsHelper@guild.js: raidsHelper command detected');

        // get possible allycodes
        const allyCodes = this.registry.getAllyCodes(message.author.id);

        var allyCode;
        if (allyCodes.length == 0) {
            message.channel.send(this.getReplyEmbedMsg('Raids Helper', `<@${message.author.id}> You do not seem to be a member of our squadron!`));
            return;
        } else if (allyCodes.length == 1) {
            // single ally code
            allyCode = allyCodes[0];
        } else {
            allyCode = await this.getAllyCodeReaction(message, allyCodes, 'Raids Helper');

            if (!allyCode) return;
        }

        this.logger.info('Retrieving player data from swgoh.help');

        var guildPlayers;
        if (args.indexOf("guild") == -1) {
            // single player
            guildPlayers = this.swgohHelpApi.getPlayers(allyCode);
        } else {
            // get guild player data
            const guildPlayersMsg = await message.channel.send(`<@${message.author.id}> Retrieving guild player list from swgoh.help...`);
            const guild = this.swgohHelpApi.getGuild(allyCode);
            await guildPlayersMsg.delete({ timeout: MSG_DELETE_TIMEOUT });

            if (!guild) {
                message.channel.send(this.getReplyEmbedMsg('Raids Helper', `<@${message.author.id}> Cannot fetch guild data for ally code ${allyCode}!`));
                return;
            }

            // build guild players array
            const guildAllyCodes = [];
            guild.roster.forEach(onePlayer => guildAllyCodes.push(onePlayer.allyCode));

            // get guild players with units
            const guildRosterMsg = await message.channel.send(`<@${message.author.id}> Retrieving guild roster from swgoh.help...`);
            guildPlayers = this.swgohHelpApi.getPlayers(guildAllyCodes);
            await guildRosterMsg.delete({ timeout: MSG_DELETE_TIMEOUT });
        }

        var method;
        if (args.indexOf("doable") >= 0)
            method = HelperMethod.DOABLE;
        else if (args.indexOf("full") >= 0)
            method = HelperMethod.FULL;
        else if (args.indexOf("best") >= 0)
            method = HelperMethod.BEST;
        else 
            method = HelperMethod.CLOSER;

        this.logger.info(`Using "${RaidsCommand.getMethodDescription(method)}" reporting method`);

        const outputMsg = await message.channel.send(`<@${message.author.id}> Generating command output for method "${RaidsCommand.getMethodDescription(method)}"...`);

        // get raids metadata
        const raidsMeta = JSON.parse(fs.readFileSync("config/raids_helper.json"));

        // loop over raids
        raidsMeta.forEach(raid => {
            this.logger.info(`Processing raid "${raid.name}"`);

            this.calculateTeamAchievements(raid, guildPlayers);

            if (method == HelperMethod.DOABLE)
                this.keepDoableTeams(raid);
            else if (method == HelperMethod.BEST)
                this.keepBestTeams(raid);
            else if (method == HelperMethod.CLOSER)
                this.keepCloserTeams(raid);
            // else full -> nothing to do

            this.reportRaidResults(message, raid, method);
        });

        await outputMsg.delete({ timeout: MSG_DELETE_TIMEOUT });
    }

    /**
     * Calculates player team achievements for a specific raid.
     * @param {Raid} raid The raid object.
     * @param {*[]} guildPlayers Array with guild player roster info (as defined by swgoh.help).
     */
     calculateTeamAchievements(raid, guildPlayers) {
        this.logger.info(`Calculating team achievements for raid "${raid.name}"`);

        // setup final team player results for this raid
        raid.players = [];

        // loop over guild players
        guildPlayers.forEach(player => {
            // create player results for raid 
            const playerResults = {
                name: player.name,
                variantResults: []
            };

            raid.players.push(playerResults);
        
            // loop over raid teams
            raid.teams.forEach(team => {

                // loop over team variants
                team.variants.forEach(variant => {
                    this.logger.debug(`Processing team "${team.name}" with variant "${variant.name}"`);

                    // loop over team variant members to gather ids
                    variant.members.forEach(member => {
                        // get unit from generic cache
                        const unit = this.swgohHelpApi.findUnit(member.name);

                        member.id = unit.baseId;
                    });

                    const memberDones = [];

                    // loop over team variant members
                    variant.members.forEach(member => {
                        // search for char in player roster
                        const char = player.roster.find(searchUnit => searchUnit.defId == member.id);

                        // check if found
                        if (char) {
                            // number of zetas
                            const zetaSkills = SwgohHelpApi.getZetaCount(char);

                            var relicTier = 0;
                            if (char.gear == 13) relicTier = char.relic.currentTier - 2;

                            var done = Math.floor((char.gear + relicTier + zetaSkills) / (member.gear + member.relic + member.zetas) * 100);
                            done = done > 100 ? 100 : done;

                            memberDones.push(done);
                        } else {
                            memberDones.push(0);
                        }
                    });

                    // calculate player achievement total for this team variant
                    const totalCalc = Math.floor(memberDones.reduce((a, b) => a + b, 0) / 5);

                    // check for best computed variant
                    this.logger.debug(`Team achievement: [${memberDones}] = ${totalCalc}%`);

                    // set new best variant for this team
                    /** @type {TeamVariantResults} */
                    const variantResults = {
                        team: team.name,
                        variant: variant.name,
                        memberDones: memberDones,
                        total: totalCalc,
                        percentDamage: variant.percentDamage
                    };

                    // add new result set
                    playerResults.variantResults.push(variantResults);
                });

            });
        });
    }

    /**
     * Keep only best teams according to achievements for each player, calculated as
     * total achievement % * expected damage %.
     * @param {Raid} raid Raid with teams results.
     */
    keepBestTeams(raid) {
        // loop over players
        raid.players.forEach(player => {
            // sort results descending based on total
            player.variantResults.sort(
                function(a, b) {
                    return b.total * b.percentDamage / 100 - a.total * a.percentDamage / 100;
                  }
            );

            // keep only first team (best result)
            player.variantResults = [ player.variantResults[0] ];
        });
    }

    /**
     * Keep only best teams according to achievements for each player, calculated as
     * total achievement %.
     * @param {Raid} raid Raid with teams results.
     */
     keepCloserTeams(raid) {
        // loop over players
        raid.players.forEach(player => {
            // sort results descending based on total
            player.variantResults.sort(
                function(a, b) { return b.total - a.total; }
            );

            // keep only highest achievement teams
            player.variantResults = player.variantResults.filter(result => result.total == player.variantResults[0].total);

            // sort again and keep best percent damage
            player.variantResults.sort(
                function(a, b) { return b.percentDamage - a.percentDamage; }
            );

            // keep only first team (best result)
            player.variantResults = [ player.variantResults[0] ];
        });
    }

     /**
     * Keep only doable teams according to achievement for each player (100% achievement).
     * @param {Raid} raid Raid with teams results.
     */
    keepDoableTeams(raid) {
        // loop over players
        raid.players.forEach(player => {
            // remove not done results descending based on total
            player.variantResults = player.variantResults.filter(result => result.total == 100);
        });
    }

    /**
     * Reports player best teams for a specific raid.
     * @param {*} message Discord message object.
     * @param {Raid} raid The raid object.
     * @param {HelperMethod} method The desired helper method.
     */
    reportRaidResults(message, raid, method) {
        this.logger.info(`Reporting results for raid "${raid.name}"`);

        if (method == HelperMethod.DOABLE)
            this.reportRaidResultsSummary(message, raid, method);
        else {
            this.reportRaidResultsDetailed(message, raid, method);
        }
    }

    /**
     * Returns a comma separated string with team units.
     * @param {TeamVariant} variant Team variant object.
     * @returns {string} The team unit descriptions (comma separated).
     */
    static getTeamVariantUnits(variant) {
        var units = '';

        // loop over team variant members
        for (var i = 0; i < variant.members.length; i++) {
            const member = variant.members[i];
            
            if (i < variant.members.length - 1) 
                units += `${member.name}, `;
            else  
                units += member.name;
        }

        return units;
    }

    /**
     * Reports summary player best teams for a specific raid.
     * @param {*} message Discord message object.
     * @param {Raid} raid The raid object.
     * @param {HelperMethod} method The desired helper method.
     */
    reportRaidResultsSummary(message, raid, method) {
        var firstMessage = true;

        // setup requirements table
        const countTable = new AsciiTable3()
            .setTitle('Teams')
            .setStyle("reddit-markdown")
            .setHeading('Team Units', '% Dmg', 'Players')
            .setWidth(1, 34).setWrapped(1);

        // loop over raid teams
        raid.teams.forEach(team => {

            // loop over team variants
            team.variants.forEach(variant => {
                var units = RaidsCommand.getTeamVariantUnits(variant);

                var count = 0;

                // loop over raid player results
                raid.players.forEach(player => {
                    // search for results with same team and variant name
                    count += player.variantResults.filter(playerResults => playerResults.team == team.name && playerResults.variant == variant.name).length;
                });

                if (count > 0) countTable.addRow(units, variant.percentDamage, count);
            });

        });

        if (countTable.getRows().length > 0) {
            // sort descending by damage %
            countTable.sortColumnDesc(2);

            const replyMsg = 
                    this.getReplyEmbedMsg(`Raids Helper "${raid.name}"`, 
                            `<@${message.author.id}>, here are the ${RaidsCommand.getMethodDescription(method)} teams for this raid:`,
                            'via swgoh.help');

            replyMsg.setThumbnail();

            // add count table
            Command.addFields(replyMsg, 'Teams', `\`\`\`${countTable.toString()}\`\`\``);

            message.channel.send(replyMsg);
        }
    }

    /**
     * Reports detailed player best teams for a specific raid.
     * @param {*} message Discord message object.
     * @param {Raid} raid The raid object.
     * @param {HelperMethod} method The desired helper method.
     */
     reportRaidResultsDetailed(message, raid, method) {
        var firstMessage = true;

        // loop over raid teams
        raid.teams.forEach(team => {

            // loop over team variants
            team.variants.forEach(variant => {
                // setup requirements table
                const reqTable = new AsciiTable3()
                    .setTitle(`${team.name} (${variant.name}) - ${variant.percentDamage}%`)
                    .setStyle("reddit-markdown")
                    .setHeading('#', 'Unit', 'Gear', '+', 'Z');

                // loop over team variant members
                for (var i = 0; i < variant.members.length; i++) {
                    const member = variant.members[i];
                    
                    reqTable.addRow(`(${i + 1})`, member.name, member.gear, member.relic, member.zetas);
                }

                // setup team table
                const teamTable = new AsciiTable3()
                    .setStyle("reddit-markdown")
                    .setHeading('Name', '(1)', '(2)', '(3)', '(4)', '(5)', '%');

                // loop over raid player results
                raid.players.forEach(player => {
                    
                    // loop over variant results
                    player.variantResults.forEach(playerResults => {
                        if (playerResults.team == team.name && playerResults.variant == variant.name)
                            // add row
                            teamTable.addRow(player.name, 
                                            playerResults.memberDones[0], playerResults.memberDones[1], playerResults.memberDones[2], 
                                            playerResults.memberDones[3], playerResults.memberDones[4], playerResults.total);
                    });

                });

                if (teamTable.getRows().length > 0) {
                    var replyMsg;
                    
                    if (firstMessage) {
                        replyMsg = 
                            this.getReplyEmbedMsg(`Raids Helper "${raid.name}"`, 
                                            `<@${message.author.id}>, here are the ${RaidsCommand.getMethodDescription(method)} teams for this raid:`,
                                            'via swgoh.help');
                        firstMessage = false;
                    } else 
                        replyMsg = this.getReplyEmbedMsg(`Raids Helper "${raid.name}"`, `(continued)`, 'via swgoh.help');

                    replyMsg.setThumbnail();

                    // add requirements
                    replyMsg.addField("Requirements", `\`\`\`${reqTable.toString()}\`\`\``);

                    // sort table on totals
                    teamTable.sortColumnDesc(7);

                    // add guild status
                    Command.addFields(replyMsg, 'Status', `\`\`\`${teamTable.toString()}\`\`\``);

                    message.channel.send(replyMsg);
                }
            });
        
        });
    }

}

module.exports = RaidsCommand;