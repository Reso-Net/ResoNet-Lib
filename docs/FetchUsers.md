# Fetch User
Fetch User takes in a ``query`` and returns the json of the of the founds users that has the ``query`` at the start of their name.

## Example Output
```json
{
  "id": "U-Resonite",
  "username": "Resonite",
  "normalizedUsername": "resonite",
  "registrationDate": "2023-07-24T05:32:10.1300682Z",
  "isVerified": true,
  "isLocked": false,
  "supressBanEvasion": false,
  "2fa_login": false,
  "profile": {
    "iconUrl": "resdb:///264a3cdc5c149326aefd44d40b23a068032c716d3966ca5dc883775eb236ac10.webp",
    "displayBadges": []
  }
},
{
  "id": "U-Resonite-DevBot",
  "username": "Resonite DevBot",
  "normalizedUsername": "resonite devbot",
  "registrationDate": "2023-07-24T05:32:14.641007Z",
  "isVerified": true,
  "isLocked": false,
  "supressBanEvasion": false,
  "2fa_login": false,
  "tags": [
    "platform admin",
    "moderation lead"
  ]
}
```

## Example Class
```js
const ResoNetLib = require('resonet-lib');

const client = new ResoNetLib();

async function setup() {
    let query = "Resonite";
    const users = await client.fetchUsers(query);
    client.log(`Found ${users.length} users named ${query}`);
    users.forEach(user => {
        client.log(`UserName ${user.username}, Id ${user.id}`);
    });
}

setup();
```