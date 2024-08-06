// This is to load the library
const ResoNetLib = require('resonet-lib');

// This is to instantiate an instance of the ResoNetLib client
const client = new ResoNetLib();

async function setup() {
    // This is the username we are going to search for
    let query = "Resonite";
    // Call the Fetch Users function with a seach query and print out the username and id for each found result
    const users = await client.fetchUsers(query);
    // Print out the fact we found x amount of users with our search query
    client.log(`Found ${users.length} users named ${query}`);
    // Iterate over each user item
    users.forEach(user => {
        // Print the formatted output
        client.log(`UserName ${user.username}, Id ${user.id}`);
    });
}

setup();