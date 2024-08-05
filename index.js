const {randomUUID, createHash, randomBytes} = require("crypto");
const signalR = require("@microsoft/signalr");

const API = "https://api.resonite.com/";
const ASSET_URL = "https://assets.resonite.com/"
const BADGES_URL = "https://gist.github.com/art0007i/018c94ee9c8701a8c2a0419599d80fbc/raw";
const KEY = "oi+ISZuYtMYtpruYHLQLPkXgPaD+IcaRNXPI7b3Z0iYe5+AcccouLYFI9vloMmYEYDlE1PhDL52GsddfxgQeK4Z_hem84t1OXGUdScFkLSMhJA2te86LBL_rFL4JjO4F_hHHIJH1Gm1IYVuvBQjpb89AJ0D6eamd7u4MxeWeEVE="
const MACHINEID = GenerateRandomMachineId();
const UID = GenerateUID();

function GenerateRandomMachineId(){
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    for (let i = 0; i < 128; i++){
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function GenerateUID(){ 
    let result = '';
    const data = `resonet-${randomBytes(16).toString('base64')}`;
    result = createHash('sha256').update(data).digest('hex').toUpperCase();
    return result;
}

class ResoNetLib {
    constructor(config) {
        this.config = {
            "username": config.username,
            "password": config.password,
            "TOTP": config.TOTP ?? ""
        }

        this.data = {
            "currentMachineID": MACHINEID,
            "sessionId": UID,
            "userId": "",
            "token": "",
            "fullToken": "",
            "tokenExpiry": "",
            "loggedIn": false
        }

        this.signalRConnection = undefined;
        this.log("Intializing Client.");
    }

    async start() {
        await this.login();
        await this.startSignalR();
    }
    
    async stop() {
        await this.logout();
        await this.stopSignalR();
    }

    async login() {   
        if (this.data.loggedIn) {
            this.error("Already logged in!");
        }

        const loginData = {
            "username": this.config.username,
            "authentication": {
                "$type": "password",
                "password": this.config.password
            },
            "rememberMe": false,
            "secretMachineId": this.data.currentMachineID
        };
    
        const res = await fetch(`${API}/userSessions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": JSON.stringify(loginData).length,
                "UID": UID,
                "TOTP": this.config.TOTP
            },
            body: JSON.stringify(loginData)
        });
    
        if (res.status === 200){
            const loginResponse = await res.json();
            this.data.userId = loginResponse.entity.userId;
            this.data.token = loginResponse.entity.token;
            this.data.fullToken = `res ${loginResponse.entity.userId}:${loginResponse.entity.token}`;
            this.data.tokenExpiry = loginResponse.entity.expire;
            this.data.loggedIn = true;
        }
        else {
            let response = await res.text();
            //this.error(`Unexpected return code ${res.status}: ${response}`);
            throw new Error(`Unexpected return code ${res.status}: ${response}`);
        }
    
        this.log("Successfully Logged in");
    }
    
    async logout() {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't log out.");
        }
    
        const res = await fetch(`${API}/userSessions/${this.data.userId}/${this.data.token}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": this.data.fullToken
            }
        });
    
        if (res.status !== 200){
            //this.error(`Unexpected HTTP status when logging out (${res.status} ${res.statusText}): ${res.body}`);
            throw new Error(`Unexpected HTTP status when logging out (${res.status} ${res.statusText}): ${res.body}`);
        }
    
        this.data.loggedIn = false;
        this.data.fullToken = "";
        this.data.token = "";
        this.data.userId = "";
    }
    
    async startSignalR() {
        this.signalRConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${API}/hub`, {
            headers: {
                "Authorization": this.data.fullToken,
                "UID": this.data.currentMachineID,
                "SecretClientAccessKey": KEY
            }
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Critical)
        .build();
    
        /*
        signalRConnection.on("ReceiveMessage", async (message) => {
            let sender = message.senderId;
            let content = message.content;
            let type = message.messageType;
            mainWindow.webContents.send('recieveMessage', { sender, content, type });
        
            let readMessageData = {
                "senderId": message.senderId,
                "readTime": (new Date(Date.now())).toISOString(),
                "ids": [
                message.id
                ]
            }
        
            await signalRConnection.send("MarkMessagesRead", readMessageData);
        });
        */
    
        this.signalRConnection.start();
        this.log("Starting SignalR");
    }
    
    async stopSignalR() {
        await this.signalRConnection.stop();
        this.signalRConnection = undefined;
        this.log("Stopping SignalR.");
    }

    // Create side function that automatically parses all avaliable varaibles into a string and return that instead of just raw json
    async fetchUser(userid) {
        let url = `${API}users/${userid}` + (userid.startsWith('U-') ? "" : "?byusername=true");
        this.log(`Fetching user data for "${userid}"`);
        const res = await fetch(url);

        if (res.ok) {
            const json = await res.json();
            return json;
        } else {
            const text = await res.text();
            return text;
        }
    }

    async fetchUsers(query) {
        var apiUrl = ""
        if (query.startsWith("U-")) apiUrl = `${API}/users/${query}`;
        else apiUrl = `${API}/users?name=${query}`;
        
        this.log(`Fetching users with name of "${query}"`);
        const res = await fetch(apiUrl);

        if (res.ok) {
            const json = await res.json();
            return json;
        } else {
            const text = await res.text();
            return text;
        }
    }

    async addFriend(user) {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't add friend");
        }

        user = await this.fetchUser(user);

        contact = {};
        //contact.OwnerId = this.data.userId;
        //contact.ContactUserId = user.id;
        //contact.ContactUsername = user.username;
        //contact.friendStatus = "Requested";
    }

    async removeFriend(userid) {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't remove friend");
        }

        await fetch(`${baseAPIURL}/users/${this.data.userId}/friends/${userid}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": this.data.fullToken
            }
        }).then(() => {
            this.log(`Successfully removed "${userid}" as a contact.`);
        }).catch(async (error) => {
            this.error(error);
        });
    }

    async blockuser(user) {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't block friend");
        }
    }

    async sendRawMessage(messageData){
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't send raw message.");
        }

        await this.signalRConnection.send("SendMessage", messageData).catch(async (error) => {
            this.error(error);
        });
    }

    async sendTextMessage(userid, content) {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't send message.");
        }

        if (!userid.startsWith('U-')) {
            this.error("UserId is not a user id.")
            return;
        } 
        else if (content.trim() == "") {
            this.error("Content is null");
            return;
        }

        const messageData = {
            "id": `MSG-${randomUUID()}`,
            "senderId": this.data.userId,
            "recipientId": userid,
            "messageType": "Text",
            "sendTime": (new Date(Date.now())).toISOString(),
            "lastUpdateTime": (new Date(Date.now())).toISOString(),
            "content": content
        }

        await this.signalRConnection.send("SendMessage", messageData).catch(async (error) => {
            this.error(error);
        });
    }

    async fetchContacts() {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't fetch contacts.");
        }

        const res = await fetch(`${API}/users/${this.data.userId}/contacts`, {headers: {"Authorization": this.data.fullToken}});
        let json = await res.json();      
        return json;
    }

    log(message) {
        console.log(`[${Date.now()} INFO] ${message}`);
    }
    
    warning(message) {
        console.warn(`[${Date.now()} WARN] ${message}`);
    }
    
    error(message) {
        console.error(`[${Date.now()} ERROR] ${message}`);
    }

    formatIconUrl(url) {
        try {
            return url.replace('resdb://', ASSET_URL).replace('.webp', '').replace('.png', '');
        }
        catch {
            return 'INVALID_URL';
        }
    }
}
module.exports = ResoNetLib;