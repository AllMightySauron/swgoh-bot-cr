/*jshint esversion: 6 */

// file system access module
const fs = require('fs');

// logging
const log4js = require("log4js");

/**
 * User.
 * @typedef {object} User
 * @property {string} id User discord id.
 * @property {string[]} allyCodes Allycodes assigned to the discord user.
 * @property {string[]} vipUnitsGAC List of VIP units to use for GAC intel gathering purposes.
 */

/**
 * Guild.
 * @typedef {object} Guild
 * @property {string} id Guild id.
 * @property {string[]} vipUnitsTW List of of VIP units to use for TW intel gathering purposes.
 */

/**
 * Class to store bot registry data 
 * (players and guilds).
 */
 class Registry {
    /**
     * Default constructor.
     * @param {string} userRegistryFilename The filename for user registry storage.
     * @param {string} guildRegistryFilename The filename for guild registry storage.
     * @param {log4js.Logger} logger The log4js logger (optional).
     */
    constructor (userRegistryFilename, guildRegistryFilename, logger = log4js.getLogger()) {        
        this.logger = logger;

        // load users
        this.setUsersFilename(userRegistryFilename);
        this.users = Registry.loadUsers(this.userRegistryFilename);

        // load guilds
        this.setGuildsFilename(guildRegistryFilename);
        this.guilds = Registry.loadGuilds(this.guildRegistryFilename);
    }

    /**
     * Load registered users (player ally codes from JSON file).
     * @static
     * @param {string} fileName The user registry filename.
     * @returns {Map<string, User>} Map between discord id and user info.
     */
    static loadUsers(fileName) {
        var result = new Map();

        try {
            const tempUsers = JSON.parse(fs.readFileSync(fileName, 'utf8'));

            // add entries to map
            tempUsers.forEach(user => result.set(user.id, user));
        } catch (err) {
            console.error(`loadUsers@registry: Error loading users - ${err}`);
        }

        return result;
    }

    /**
     * Load registered guilds from JSON file.
     * @static
     * @param {string} fileName The guild registry filename.
     * @returns {Map<string, User>} Map between guild id and guild info.
     */
    static loadGuilds(fileName) {
        var result = new Map();

        try {
            const tempGuilds = JSON.parse(fs.readFileSync(fileName, 'utf8'));

            // add entries to map
            tempGuilds.forEach(guild => result.set(guild.id, guild));
        } catch (err) {
            console.error(`loadUsers@registry: Error loading guilds - ${err}`);
        }

        return result;
    }

    /**
     * Set the user registry filename.
     * @param {string} filename User registry JSON filename.
     * @returns {Registry} The registry instance.
     */
    setUsersFilename(filename) {
        this.userRegistryFilename = filename;

        return this;
    }

    /**
     * Get the user registry filename.
     * @returns {string} Users registry filename.
     */
    getUsersFilename() {
        return this.userRegistryFilename;
    }

    /**
     * Save registered users (player ally codes from JSON file).
     * @param {string} fileName User JSON filename.
     */
    saveUsers(fileName) {
        this.logger.info(`saveUsers@registry: saving users to "${fileName}"`);

        try {
            this.logger.debug(`saveUsers@registry: Saving users to file`);

            fs.writeFileSync(fileName, JSON.stringify(Array.from(this.users.values())));
        } catch (err) {
            this.logger.error(`saveUsers@registry: Error saving users - ${err}`);
        }

        this.logger.info(`saveUsers@registry: saved users to registry ok (total = ${this.users.size})`);
    }

    /**
     * Clear all users from registry.
     * @returns {Registry} Registry instance.
     */
    clearUsers() {
        this.users.clear();

        return this;
    }

    /**
     * Register a new user.
     * @param {string} discord id.
     * @param {string} ally code.
     */
    registerUser(discordId, allyCode) {
        this.logger.info(`registerUser@registry: registering user (discord id=${discordId}, allycode=${allyCode})`);

        var result = true;

        // check if ally code is already registered
        const registeredId = this.getDiscordId(allyCode);

        if (registeredId) {
            this.logger.error(`registerUser@registry: ally code "${allyCode}" is already registered to discord id "${registeredId}"`);
            result = false;
        } else {
            // no discord id for this ally code yet
            if (this.users.has(discordId)) {
                // discord id alreay exists, must add ally code
                const user = this.users.get(discordId);

                // add new allycode to array
                user.allyCodes.push(allyCode);
                this.saveUsers(this.userRegistryFilename);
                
                this.logger.info(`registerUser@registry: added ally code "${allyCode}" to existing discord id "${discordId}"`);
            } else {
                /** @type {User} */
                const user = { id: discordId, allyCodes: [ allyCode ], vipUnitsGAC: [] };
                
                // new user
                this.users.set(discordId, user);

                this.saveUsers(this.userRegistryFilename);

                this.logger.info(`registerUser@registry: added discord id "${discordId}" with ally code "${allyCode}"`);
            }
        }

        return result;
    }

    /**
     * Unregister a user.
     * @param {string} discord The discord id.
     * @param {string} allyCode The ally code to unregister (optional).
     */
    unregisterUser(discordId, allyCode) {
        this.logger.info(`unregisterUser@registry: unregistering user (discord id=${discordId})`);

        var result = true;

        if (this.users.has(discordId)) {
            // get allyCodes for this user
            var user = this.users.get(discordId);

            if (user.allyCodes.length == 1) {
                // only one ally code
                this.users.delete(discordId);

                this.saveUsers(this.userRegistryFilename);
            } else {
                // sanity check
                if (allyCode) {
                    const allyCodeIdx = user.allyCodes.findIndex(code => code == allyCode);

                    if (allyCodeIdx == -1) {
                        this.logger.error(`unregisterUser@registry: could not find ally code ${allyCode} for discord id "${discordId}"`);
                        result = false;    
                    } else {
                        user.allyCodes = user.allyCodes.splice(allyCodeIdx, 1);
                        
                        this.saveUsers(this.userRegistryFilename);
                    }
                } else {
                    result = false;
                    this.logger.error(`unregisterUser@registry: multiple ally codes for discord id "${discordId}" and none given`);
                }
            }

            if (result) this.logger.info(`unregisterUser@registry: discord id "${discordId}" deleted`);
        } else {
            result = false;
            this.logger.error(`unregisterUser@registry: unknown discord id "${discordId}" to unregister`);
        }

        return result;
    }

    /**
     * Get the list of registered users.
     * @returns {User[]} An array with discord id, allycode entries.
     */
    getUsers() {
        return Array.from(this.users.values());
    }

    /**
     * Get user from discord id.
     * @param {string} discord id.
     * @return {User} User for the given discord id.
     */
    getUser(discordId) {
        this.logger.info(`getUser@registry: getting user for discord id "${discordId}"`);
        var result;

        if (!this.users.has(discordId)) {
            this.logger.error(`getUser@registry: discord id "${discordId}" does not exist`);
        } else {
            result = this.users.get(discordId);
        }

        return result;
    }

    /**
     * Get registerd user count.
     * @returns {number} The number of registered users.
     */
    getUserCount() {
        return this.users.size;
    }

    /**
     * Get first ally code from discord id.
     * @param {string} discord id.
     * @return {string} First ally code for the given discord id.
     */
    getAllyCode(discordId) {
        this.logger.info(`getAllyCode@registry: getting ally code for discord id "${discordId}"`);
        var result;

        if (!this.users.has(discordId)) {
            this.logger.error(`getAllyCode@registry: discord id "${discordId}" does not exist`);
        } else {
            result = this.users.get(discordId).allyCodes[0];
        }

        return result;
    }

    /**
     * Get array of ally codes for discord id.
     * @param {string} discord id.
     * @return {string[]} Array of ally codes for the given discord id.
     */
    getAllyCodes(discordId) {
        this.logger.info(`getAllyCodes@registry: getting ally codes for discord id "${discordId}"`);
        var result = [];

        if (!this.users.has(discordId)) {
            this.logger.error(`getAllyCode@registry: discord id "${discordId}" does not exist`);
        } else {
            result = this.users.get(discordId).allyCodes;
        }

        return result;
    }

    /**
     * Gets the registered discord id from an ally code.
     * @param {string} allyCode The ally code to check.
     * @returns {string} The registered discord id for the given ally code.
     */
    getDiscordId(allyCode) {
        this.logger.debug(`getAllyCode@registry: getting discord id for ally code "${allyCode}"`);
        var result;

        // loop over users
        Array.from(this.users.values()).every(user => {
            if (user.allyCodes.find(oneCode => oneCode == allyCode)) {
                result = user.id;
                
                return false;
            } else return true;
        });

        return result;
    }

    /**
     * Set the guild registry filename.
     * @param {string} filename Guild registry JSON filename.
     * @returns {Registry} The registry instance.
     */
    setGuildsFilename(filename) {
        this.guildRegistryFilename = filename;

        return this;
    }

    /**
     * Get the guild registry filename.
     * @returns {string} Users registry filename.
     */
    getGuildsFilename() {
        return this.guildRegistryFilename;
    }

    /**
     * Save registered guilds to JSON file.
     * @param {string} fileName Guild JSON filename.
     */
    saveGuilds(fileName) {
        this.logger.info(`saveGuilds@registry: saving guilds to "${fileName}"`);

        try {
            this.logger.debug(`saveGuilds@registry: Saving guilds to file`);

            fs.writeFileSync(fileName, JSON.stringify(Array.from(this.guilds.values())));
        } catch (err) {
            this.logger.error(`saveGuilds@registry: Error saving guilds - ${err}`);
        }

        this.logger.info(`saveGuilds@registry: saved guilds to registry ok (total = ${this.guilds.size})`);
    }

    /**
     * Clear all guilds from registry.
     * @returns {Registry} Registry instance.
     */
    clearGuilds() {
        this.guilds.clear();

        return this;
    }

    /**
     * Register a new guild.
     * @param {string} guildId Guild id.
     */
    registerGuild(guildId) {
        this.logger.info(`registerGuild@registry: registering guild (guild id=${guildId})`);

        var result = true;

        if (this.guilds.has(guildId)) {
            this.logger.error(`registerGuild@registry: guild with id "${guildId}" already registered`);

            result = false;
        } else {
            /** @type {Guild} */
            const guild = { id: guildId, vipUnitsTW: [] };
            
            // new guild
            this.guilds.set(guildId, guild);

            this.saveGuilds(this.guildRegistryFilename);

            this.logger.info(`registerGuild@registry: added guild id "${guildId}"`);
        }

        return result;
    }

    /**
     * Unregister a guild.
     * @param {string} guildId Guild id.
     */
    unregisterGuild(guildId) {
        this.logger.info(`unregisterGuild@registry: unregistering guild (guild id=${guildId})`);

        var result = true;

        if (this.guilds.has(guildId)) {
            this.guilds.delete(guildId);

            this.saveGuilds(this.guildRegistryFilename);

            this.logger.info(`unregisterUser@registry: guild id "${guildId}" deleted`);
        } else {
            result = false;
            this.logger.error(`unregisterGuild@registry: unknown guild id "${guildId}" to unregister`);
        }

        return result;
    }

    /**
     * Get the list of registered guilds.
     * @returns {Guild[]} An array with guilds.
     */
    getGuilds() {
        return Array.from(this.guilds.values());
    }

    /**
     * Get registerd guild count.
     * @returns {number} The number of registered guilds.
     */
    getGuildCount() {
        return this.guilds.size;
    }

    /**
     * Get guild info from id.
     * @param {string} id Guild id.
     * @return {Guild} Guild information.
     */
    getGuild(guildId) {
        this.logger.info(`getGuild@registry: getting guild info for guild id "${guildId}"`);

        var result;

        if (!this.guilds.has(guildId)) {
            this.logger.error(`getGuild@registry: guild id "${guildId}" does not exist`);
        } else {
            result = this.guilds.get(guildId);
        }

        return result;
    }
 }

 module.exports = Registry;