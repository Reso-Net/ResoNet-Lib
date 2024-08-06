# ResoNet-Lib
ResoNet-Lib is a Node.js library that provides an easy way to interface with the [Resonite](https://resonite.com) Api and its [SignalR](https://dotnet.microsoft.com/en-us/apps/aspnet/signalr) endpoints.

## How to setup
- Install the library by running ``npm install github:LeCloutPanda/ResoNet-Lib``
- Create a new instance of ``ResoNetLib`` and supply a custom ``config`` that follows the config scheme below
- Call ``client.start()`` to login and start SignalR
- Call what ever functions you may need for example ``const user = await client.fetchUser("U-LeCloutPanda");``

## Example Config
```json
{
	"username": "",
	"password": "",
	"totp": "" 
}
```
*TOTP  is only needed if you use TOTP on the account*

## Example Class
```js
const ResoNetLib = require('resonet-lib');
const config = require('config.json');

const client = new  ResoNetLib(config);

async function  setup() {
	await client.start();
	const contacts = await  client.fetchContacts();
  contacts.forEach(contact  => {
    client.log(`Username ${contact.contactUsername}, Contact Status ${contact.contactStatus}, Is Accepted: ${contact.isAccepted}`);
	})
}
setup();
```
More examples can be found in the [examples](https://github.com/LeCloutPanda/ResoNet-Lib/tree/main/examples) folder.
