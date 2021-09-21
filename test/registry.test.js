/*jshint esversion: 8 */

const Registry = require('../registry.js');
const assert = require('assert');
const fs  = require('fs');
const { isSymbol } = require('util');

const USERS_FILENAME = './data/dummyusers.json';
const GUILDS_FILENAME = './data/dummyguilds.json';

before(async () => {
    // start fresh
    if (fs.existsSync(USERS_FILENAME)) fs.unlinkSync(USERS_FILENAME);
    if (fs.existsSync(GUILDS_FILENAME)) fs.unlinkSync(GUILDS_FILENAME);
});

after(async () => {
    // remove dummy files
    if (fs.existsSync(USERS_FILENAME)) fs.unlinkSync(USERS_FILENAME);
    if (fs.existsSync(GUILDS_FILENAME)) fs.unlinkSync(GUILDS_FILENAME);
});

describe('Static methods', () => {
    it('loadUsers', () => {
        const users = Registry.loadUsers('./data/users.json');

        assert.strictEqual(typeof users, "object");
        assert.strictEqual(users.size > 0, true);
    });

    it('loadGuilds', () => {
        const guilds = Registry.loadGuilds('./data/guilds.json');

        assert.strictEqual(typeof guilds, "object");
        assert.strictEqual(guilds.size > 0, true);
    });
});

describe('Base methods (users)', () => {
    const registry = new Registry(USERS_FILENAME, GUILDS_FILENAME);

    it ('Constructor', () => {
        assert.strictEqual(registry.getUsersFilename(), USERS_FILENAME);
        assert.strictEqual(typeof registry.users, "object");
    });

    it ('setUsersFilename/getUsersFilename', () => {
        registry.setUsersFilename(USERS_FILENAME);
        
        assert.strictEqual(registry.getUsersFilename(), USERS_FILENAME);
    });

    it ('saveUsers', () => {

    });

    it('registerUser', () => {
        registry.clearUsers();

        // first user
        assert.strictEqual(registry.registerUser('X', '123'), true);
        assert.strictEqual(registry.getUsers().length, 1);
        assert.notStrictEqual(registry.getAllyCodes('X'), [ '123' ]);

        // duplicate
        assert.strictEqual(registry.registerUser('X', '123'), false);

        // second ally code, same user
        assert.strictEqual(registry.registerUser('X', '456'), true);
        assert.strictEqual(registry.getUsers().length, 1);
        assert.notStrictEqual(registry.getAllyCodes('X'), [ '123', '456' ]);

        // second user
        assert.strictEqual(registry.registerUser('Y', '999'), true);
        assert.strictEqual(registry.getUsers().length, 2);
        assert.notStrictEqual(registry.getAllyCodes('Y'), [ '999' ]);

        // existing ally code, different user
        assert.strictEqual(registry.registerUser('X', '999'), false);
    });

    it('unregisterUser', () => {
        registry.clearUsers();

        registry.registerUser('X', '123');
        registry.registerUser('X', '456');
        registry.registerUser('Y', '999');

        // discord user not found
        assert.strictEqual(registry.unregisterUser('Z', 'AAA'), false);

        // ally code not found
        assert.strictEqual(registry.unregisterUser('X', 'AAA'), false);

        // user has multiple ally codes, none was given
        assert.strictEqual(registry.unregisterUser('X'), false);

        // found
        assert.strictEqual(registry.unregisterUser('X', '123'), true);
        assert.strictEqual(registry.getUsers().length, 2);
        assert.notStrictEqual(registry.getAllyCodes('X'), [ '456' ]);

        // found, last one for this user
        assert(registry.unregisterUser('X', '456'), true);
        assert.strictEqual(registry.getUsers().length, 1);
        assert.notStrictEqual(registry.getAllyCodes('X'), undefined);

        // found, last user
        assert(registry.unregisterUser('Y', '999'), true);
        assert.strictEqual(registry.getUsers().length, 0);
    });
    
    it('getUsers', () => {
        registry.clearUsers();

        registry.registerUser('X', '123');
        registry.registerUser('X', '456');
        registry.registerUser('Y', '999');

        // not found
        assert.notStrictEqual
            (registry.getUsers(), 
            [ 
                { id: 'X', allyCodes: [ '123', '456' ] },
                { id: 'Y', allyCodes: [ '999'] } 
            ]);
    });

    it('getUserCount', () => {
        registry.clearUsers();

        registry.registerUser('X', '123');
        registry.registerUser('X', '456');

        assert.strictEqual(registry.getUserCount(), 1);

        registry.registerUser('Y', '999');
        assert.strictEqual(registry.getUserCount(), 2);
    });

    it('getAllyCode', () => {
        registry.clearUsers();

        registry.registerUser('X', '123');
        assert.strictEqual(registry.getAllyCode('X'), '123');

        registry.registerUser('X', '456');
        assert.strictEqual(registry.getAllyCode('X'), '123');

        registry.registerUser('Y', '999');
        assert.strictEqual(registry.getAllyCode('Y'), '999');

        // non-existing discord id
        assert.strictEqual(registry.getAllyCode('Z'), undefined);
    });

    it('getAllyCodes', () => {
        registry.clearUsers();

        registry.registerUser('X', '123');
        assert.notStrictEqual(registry.getAllyCodes('X'), [ '123' ] );

        registry.registerUser('X', '456');
        assert.notStrictEqual(registry.getAllyCodes('X'), [ '123', '456'] );

        registry.registerUser('Y', '999');
        assert.notStrictEqual(registry.getAllyCodes('Y'), [ '999' ] );
    });

    it('getDiscordId', () => {
        registry.clearUsers();

        assert.strictEqual(registry.getDiscordId('aaa'), undefined);

        registry.registerUser('X', '123');
        assert.strictEqual(registry.getDiscordId('123'), 'X' );

        registry.registerUser('X', '456');
        assert.strictEqual(registry.getDiscordId('456'), 'X');

        registry.registerUser('Y', '999');
        assert.strictEqual(registry.getDiscordId('999'), 'Y' );
    });

});

describe('Base methods (guilds)', () => {
    const registry = new Registry(USERS_FILENAME, GUILDS_FILENAME);

    it ('Constructor', () => {
        assert.strictEqual(registry.getGuildsFilename(), GUILDS_FILENAME);
        assert.strictEqual(typeof registry.guilds, "object");
    });

    it ('setGuildsFilename/getGuildsFilename', () => {
        registry.setGuildsFilename(GUILDS_FILENAME);
        
        assert.strictEqual(registry.getGuildsFilename(), GUILDS_FILENAME);
    });

    it('registerGuild', () => {
        registry.clearGuilds();

        // first guild
        assert.strictEqual(registry.registerGuild('X'), true);
        assert.strictEqual(registry.getGuilds().length, 1);

        // duplicate
        assert.strictEqual(registry.registerGuild('X'), false);        
    });

    it('unregisterGuild', () => {
        registry.clearGuilds();

        registry.registerGuild('X');
        registry.registerGuild('Y');

        // guild not found
        assert.strictEqual(registry.unregisterGuild('Z'), false);

         // found
         assert.strictEqual(registry.unregisterGuild('X'), true);
         assert.strictEqual(registry.getGuilds().length, 1);
         assert.strictEqual(registry.unregisterGuild('Y'), true);
         assert.strictEqual(registry.getGuilds().length, 0);
    });

    it('getGuilds', () => {
        registry.clearGuilds();

        registry.registerGuild('X');
        registry.registerGuild('Y');

        // not found
        assert.notStrictEqual
            (registry.getGuilds(), 
            [ 
                { id: 'X', vipUnitsTW: [] },
                { id: 'Y', vipUnitsTW: [] } 
            ]);
    });

    it('getGuildCount', () => {
        registry.clearGuilds();

        registry.registerGuild('X');

        assert.strictEqual(registry.getGuildCount(), 1);

        registry.registerGuild('Y');
        assert.strictEqual(registry.getGuildCount(), 2);
    });
});