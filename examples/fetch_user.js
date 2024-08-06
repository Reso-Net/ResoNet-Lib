// This is to load the library
const ResoNetLib = require('resonet-lib');

// This is to instantiate an instance of the ResoNetLib client
const client = new ResoNetLib();

async function setup() {
    // Call the Fetch User function with a User Id and have it return the same data you can get from visiting the users endpoint, example: https://api.resonite.com/users/U-LeCloutPanda
    const user = await client.fetchUser("U-LeCloutPanda");
    client.log("User ID: " + user.id);
    client.log("User Name: " + user.username);
    client.log("Normalized User Name: " + user.normalizedUsername);
}

setup();