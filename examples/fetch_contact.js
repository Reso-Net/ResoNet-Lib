// This is to load the library
const ResoNetLib = require('resonet-lib');
// Load the config to be used for the client
const config = require('../config.json');

// This is to instantiate an instance of the ResoNetLib client
const client = new ResoNetLib(config);

async function setup() {
    // Here we actually log the client into the api
    // We call client.login() here because we don't need the use of the SignalR stuff but if we did we would just call client.start()
    await client.login();

    // We fetch the logged in users contacts
    const contact = await client.fetchContact("U-LeCloutPanda");
    // Log the contact if one is found
    if (contact) {
        client.log(`Username ${contact.contactUsername}, Contact Status ${contact.contactStatus}, Is Accepted: ${contact.isAccepted}`);
    }
}

setup();