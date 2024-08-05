# ResoNet-Lib
This Node.js library provides an interface to interact with the [Resonite](https://resonite.com) API. It also supports connections to the [SignalR](https://dotnet.microsoft.com/en-us/apps/aspnet/signalr) endpoints for real-time communication.

# Basic Usage(Docs coming soon™)
- Install the library by running ``npm install github:LeCloutPanda/ResoNet-Lib``
- Create a new instance of ``ResoNetLib`` and supply a custom ``config`` that follows the config scheme below
- Call ``ResoNetLib.start()`` and it should login to the api and start SignalR
- Call what ever functions you may need to by doing ``await functionName();``

# Config example 
```json
{
  "username": "",
  "password": "",
  "totp": "" 
}
```

# Notes
- If the Resonite account has TOTP enabled for login make sure you have it in the config, it should be 6 digits long.
- I used [mvcontact-bot](https://github.com/Lexevolution/mvcontact-bot) by [Lexevolution](https://github.com/Lexevolution) as learning material to figure out how some things worked.
