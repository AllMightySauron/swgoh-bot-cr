/*jshint esversion: 8 */

// setup logging
const log4js = require("log4js");

const loggerConfig = require('./log4jsconf.json');
log4js.configure(loggerConfig);

const logger = log4js.getLogger();

// add config
const config = require('./config.json');

// add registry.js module
const Registry = require ('./registry.js');

// registry file
logger.info('Loading registry');
const USER_REGISTRY_FILENAME = './data/users.json';
const GUILD_REGISTRY_FILENAME = './data/guilds.json';
const registry = new Registry(USER_REGISTRY_FILENAME, GUILD_REGISTRY_FILENAME, logger);

// add swgoh.gg module
logger.info('Connecting to swgoh.gg');
const { SwgohGGApi } = require('swgoh-api-swgohgg');
const swgohGGApi = new SwgohGGApi(config.swgohgg.user, config.swgohgg.password, logger);

// add swgoh.help module
logger.info('Connecting to swgoh.help');
const { SwgohHelpApi } = require('swgoh-api-swgohhelp');
const swgohHelpApi = new SwgohHelpApi(config.swgohhelp.user, config.swgohhelp.password, logger);

// add discord.js module
logger.info('Connecting bot to discord');
const Discord = require('discord.js');
const bot = new Discord.Client();
bot.login(config.bot.token);

// add general bot commands processing
const GeneralCommand = require('./commands/general.js');
const generalCmd = new GeneralCommand(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);

// add user bot commands processing
const UserCommand = require('./commands/user.js');
const userCmd = new UserCommand(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);

// add tw bot commands processing
const TwCommand = require('./commands/tw.js');
const twCmd = new TwCommand(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);

// add guild bot commands processing
const GuildCommand = require('./commands/guild.js');
const guildCmd = new GuildCommand(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);

// add raids bot commands processing
const RaidsCommand = require('./commands/raids.js');
const raidsCmd = new RaidsCommand(Discord, config, registry, swgohGGApi, swgohHelpApi, logger);


// requests processed
var countRequests = 0;

bot.once('ready', () => {
    // set activity
    bot.user.setActivity('cr.help');

    logger.info('CR bot is ready');
});

const DiscordCommandParser = require("discord-command-parser");

bot.on('message', async message => {
    // parse command
    const parsed = DiscordCommandParser.parse(message, config.bot.prefix, { allowSpaceBeforeCommand: true, ignorePrefixCase: true });

    // skip irrelevant messages
    if (!parsed.success) return;

    countRequests++;

    // let them know we are working on it
    await message.react('🤔');

    // get command and args
    const command = parsed.command;
    const args = parsed.arguments;

    logger.info(`parsed command "${command}" from "${message.author.username}"`);

    // process command
    try {
        await processCmd(message, command, args);
        message.react('✔️');
    } catch (e) {
        logger.error(e);
        message.react('☹️');
        message.channel.send(`<@${message.author.id}> Could not complete request "${config.bot.prefix}${command} ${args}":\n${e.message}`);
    }
});

async function processCmd(message, command, args) {
    if (command.match('\\d+.register') || command.match('\\d+-\\d+-\\d+.register')) {
        userCmd.processRegister(message, command, args);
    } else if (command.match('\\d+.unregister') || command.match('\\d+-\\d+-\\d+.unregister')) {
        userCmd.processUnregister(message, command, args);
    } else {
        switch (command) {
            // GENERAL
            case "help": 
                generalCmd.processHelp(message, args);
                break;
            case "welcome": 
                generalCmd.processWelcome(message);
                break;
            case "info":
                generalCmd.processInfo(message, countRequests);
                break;
            case "check":
                generalCmd.processCheck(message, args);
                break;        
            case "chargear":
            case "cg":
                await generalCmd.processCharGear(message, args);
                break;
            case "charabilities":
            case "ca":
                await generalCmd.processCharAbilities(message, args);
                break;
            case "acronyms":
                generalCmd.processAcronyms(message, args);
                break;

            // USER
            case "myprofile":
            case "mp":
                await userCmd.processMyProfile(message);
                break;
            case "mystats":
                await userCmd.processMyStats(message, args);
                break;
            case "mymods":
                await userCmd.processMyMods(message, args);
                break;
            case "allycode":
                userCmd.processAllyCode(message);
                break;
            case "guildlist":
            case "gl":
                await userCmd.processGuildList(message, command, args);
                break;
            case "grandarena.add":
            case "gac.add":
                    await twCmd.processGACAdd(message, args);
                    break;
            case "grandarena.remove":
            case "gac.remove":
                await twCmd.processGACRemove(message, args);
                break;
            case "grandarena.list":
            case "gac.list":
                await twCmd.processGACList(message);
                break;

            // TW/GAC
            case "territorywar":
            case "tw":
                await twCmd.processTW(message, args);
                break;

            case "grandarena":
            case "gac":
                await twCmd.processGAC(message, args);
                break;

            // GUILD
            case "registerguild":
                await guildCmd.processRegisterGuild(message);
                break;
            case "unregisterguild":
                await guildCmd.processUnregisterGuild(message);
                break;
            case "guildchar":
            case "gc":
                await guildCmd.processGuildChar(message, args);
                break;
            case "guildship":
            case "gs":
                await guildCmd.processGuildShip(message, args);
                break;
            case "guildstats":
                await guildCmd.processGuildStats(message, args);
                break;
            case "territorywar.add":
            case "tw.add":
                await twCmd.processTWAdd(message, args);
                break;
            case "territorywar.remove":
            case "tw.remove":
                await twCmd.processTWRemove(message, args);
                break;
            case "territorywar.list":
            case "tw.list":
                await twCmd.processTWList(message);
                break;

            // RAID HELPER
            case "raids.helper":
                await raidsCmd.processRaidsHelper(message, args);
                break;

            default:
                generalCmd.processError(message, command);
                countRequests--;
        }
    }        
}