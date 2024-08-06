// This is to load the library
const ResoNetLib = require('resonet-lib');

// This is to instantiate an instance of the ResoNetLib client
const client = new ResoNetLib();

async function setup() {
    // We fetch the users data
    const user = await client.fetchUser("U-LeCloutPanda");
    // We then format the icon url so we can use read it elsewhere, we do profile? because some users don't have profile data let alone an icon
    const iconUrl = client.formatIconUrl(user.profile?.iconUrl);
    // Print the output of the formatted url
    client.log(iconUrl);
}

setup();