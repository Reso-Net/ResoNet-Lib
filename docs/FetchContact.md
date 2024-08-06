# Fetch User
Fetch Contact takes in a ``userid`` which starts with ``U-`` for example ``U-Resonite`` and returns the json of the found contact if the id was valid and is contacts with the signed in user.

## Example Output
```json
{
  "id": "U-Resonite",
  "contactUsername": "Resonite",
  "contactStatus": "Accepted",
  "isAccepted": true,
  "profile": {
    "iconUrl": "resdb:///264a3cdc5c149326aefd44d40b23a068032c716d3966ca5dc883775eb236ac10.webp",
    "displayBadges": []
  },
  "latestMessageTime": "2024-05-21T19:59:16.9062582Z",
  "isMigrated": false,
  "isCounterpartMigrated": true,
  "ownerId": "U-LeCloutPanda"
}
```

## Example Class
```js
const ResoNetLib = require('resonet-lib');
const config = require('../config.json');
const client = new ResoNetLib(config);

async function setup() {
    await client.login();
    const contact = await client.fetchContact("U-Resonite");
    client.log(JSON.stringify(contact));
}

setup();
```