const ResoNetLib = require("./src/client");
const fs = require('fs').promises;
const path = require('path');

var config;
var client;

async function tryLoadConfig() {
    const configFilePath = path.join(__dirname, 'config.json');
    console.log("Looking for config in directory", configFilePath);

    const data = await fs.readFile(configFilePath, 'utf8');
    const json = JSON.parse(data);
    return json;
}

async function attemptLogin() {
    config = await tryLoadConfig();
    if (config == null) return;

    const loginData = {
        "username": `${config.username}`,
        "password": `${config.password}`,
        "totp": ""
    }

    client = new ResoNetLib(loginData);
    await client.start().then(() => {
        client.on("receiveStatusUpdate", () => {
                    console.log(client.data.contacts[0]);

        })
    }).catch((error) => {
        console.error(error);
    });
}

attemptLogin();