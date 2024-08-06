# Fetch User
Fetch User takes in a ``userid`` which starts with ``U-`` for example ``U-Resonite`` and returns the json of the of the given ``userid`` if the id was valid.

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
}
```

## Example Class
```js
const ResoNetLib = require('resonet-lib');

const client = new ResoNetLib();

async function setup() {
    const user = await client.fetchUser("U-LeCloutPanda");
    client.log("User ID: " + user.id);
    client.log("User Name: " + user.username);
    client.log("Normalized User Name: " + user.normalizedUsername);
}

setup();
```