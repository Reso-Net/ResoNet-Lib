const {randomUUID, createHash, randomBytes} = require("crypto");
const signalR = require("@microsoft/signalr");
const EventEmitter = require("events");

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

// Library initialization 
class ResoNetLib extends EventEmitter {
    constructor(config = null) {
        super();
        if (config == null) {
            this.warning("No config found! Some functions may not work.");
        } else {
            this.config = {
                "username": config.username,
                "password": config.password,
                "TOTP": config.TOTP ?? ""
            }
    
            this.data = {
                "api": API,
                "assetUrl": ASSET_URL,
                "currentMachineID": MACHINEID,
                "sessionId": UID,
                "userId": "",
                "token": "",
                "fullToken": "",
                "tokenExpiry": "",
                "loggedIn": false,
                "contacts": [],
                "sessions": []
            }
    
            this.signalRConnection = undefined;
        }
    }

    async start() {
        await this.login();
        await this.startSignalR();
    }
    
    async stop() {
        await this.logout();
        await this.stopSignalR();
    }

    // Log into Resonite using user Credentials. 
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

            this.data.sessions = await this.fetchSessions();
            this.data.contacts = await this.fetchContacts();

            this.emit("loginSuccessfulEvent");
        }
        else {
            let response = await res.text();
            this.emit("loginFaileEvent");
            throw new Error(`Unexpected return code ${res.status}: ${response}`);
        }
    }

    // Logs out signed in user. 
    async logout() {
        const res = await fetch(`${API}/userSessions/${this.data.userId}/${this.data.token}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": this.data.fullToken
            }
        });
    
        if (res.status !== 200){
            throw new Error(`Unexpected HTTP status when logging out (${res.status} ${res.statusText}): ${res.body}`);
        }
    
        this.data.loggedIn = false;
        this.data.fullToken = "";
        this.data.token = "";
        this.data.userId = "";
        this.data.contacts = [];
        this.data.sessions = [];

        this.signalRConnection = undefined;
    }

    // Starts SignalIR after login, Use other functions as required from here on.
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

        this.signalRConnection.on("ReceiveSessionUpdate", async (session) => {
            this.updateSessionsList(session);
            this.emit("sessionUpdateEvent", session);
        });

        this.signalRConnection.on("RemoveSession", async (sessionId) => {
            this.removeSessionFromList(sessionId);
            this.emit("sessionRemoveEvent", sessionId);
        });

        this.signalRConnection.on("ReceiveMessage", async (message) => {
            this.emit("messageRecieveEvent", message);
        });

        this.signalRConnection.start();
    }
    
    // Stops SignalIR and unassigns the signalRConnection variable
    async stopSignalR() {
        await this.signalRConnection.stop();
        this.signalRConnection = undefined;
    }

    //#region Message related things
    // Sends RAW message
    async sendRawMessage(messageData){
        await this.signalRConnection.send("SendMessage", messageData).catch(async (error) => {
            this.error(error);
        });
    }
    
    // Sends a standard text message to the specified contact using the signed in account. 
    async sendTextMessage(userid, content) {
        if (!userid.startsWith('U-')) {
            this.error("UserId is not a user id.")
            return;
        } else if (content.trim() == "") {
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
    
    async setupVariables() {
        this.message = new Message(this.signalRConnection, this.data);
        this.user = new User(this.signalRConnection, this.data);
        this.utils = new Utils(this.signalRConnection, this.data);
        this.session = new Session(this.signalRConnection, this.data);

        this.user.fetchContacts().then(array => {
            this.data.contacts = array;
        });

        this.session.fetchSessions().then(array => {
            this.data.sessions = array;
        });
    }
    //#endregion

    //#region User/Contact related things
    // Fetches user data of inputted userid, this is the equivalent of https://api.resonite.com/users/U-LecloutPanda or https://api.resonite.com/users/lecloutpanda?byusername=true
    async fetchUser(userid) {
        let url = `${this.data.api}users/${userid}` + (userid.startsWith('U-') ? "" : "?byusername=true");
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

    // Searches users based on query returning list of users, this is the equivalent of https://api.resonite.com/users?name=panda
    async searchUsers(query) {      
        this.log(`Fetching users with name of "${query}"`);
        const res = await fetch(`${this.data.api}/users?name=${query}`);
        if (res.ok) {
            const json = await res.json();
            return json;
        } else {
            const text = await res.text();
            return text;
        }
    }
    
    // Fetches the contact list of the signed in account from the api.
    async fetchContacts() {
        const res = await fetch(`${this.data.api}/users/${this.data.userId}/contacts`, {headers: {"Authorization": this.data.fullToken}});
        let json = await res.json();      
        return json;
    }

    async isContact(userid) {
        if (!userid.startsWith("U-")) {
            this.error("Failed to get contact, Invalid UserID.");
        }
        
        const contacts = await this.fetchContacts();
        const contact = contacts.find(contact => contact.id === userid);

        console.log(contact);

        if (contact != null && contact.contactStatus == "Accepted") {
            return true;
        } else {
            return false;
        }
    }

    // Fetches contact information using the U-userID, Must be logged in.
    async fetchContact(userid) {
        if (!userid.startsWith("U-")) {
            this.error("Failed to get contact, Invalid UserID.");
        }
        
        const contacts = await this.fetchContacts();
        const contact = contacts.find(contact => contact.id === userid);
        
        if (contact == null) {
            this.error("No valid contact found.");
        }
        
        return contact;
    }

    // Use this function to add a contact using the signed in account. Requires the full User ID with leading U-
    async addContact(userid) {
        if (!userid.startsWith("U-")) {
            this.error("Not a valid user id!");
        }
        this.log(`Attempting to add user ${userid} as a contact`);
        const user = await this.fetchUser(userid);
        const contactData = {
            "ownerId": this.data.userId,
            "id": user.id,
            "contactUsername": user.username,
            "contactStatus": "Accepted"
        };
        await this.signalRConnection.send("UpdateContact", contactData).then(() => {
            this.log(`Successfully added user ${userid} as a contact`);
        }).catch(async (error) => {
            this.error(error);
        });
    }

    // Use this function to remove contact for the signed in account using the userID Must be logged in. 
    async removeContact(userid) {
        if (!this.data.loggedIn) {
            this.error("Not logged in! Can't remove friend.");
        }
        if (!userid.startsWith("U-")) {
            this.error("Not a valid user id!");
        }
        this.log(`Attempting to remove user ${userid} as a contact`);
        await fetch(`${this.data.api}/users/${this.data.userId}/friends/${userid}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": this.data.fullToken
            }
        }).catch(async (error) => {
            this.error(error);
        });
        const contact = this.fetchContact(userid);
        contact.contactStatus = "Ignored";

        await this.signalRConnection.send("UpdateContact", contact).then(() => {
            this.log(`Successfully removed user ${userid} as a contact`);
        }).catch(async (error) => {
            this.error(error);
        });
    }

    // Blocks user for the signed in account
    async blockuser(user) {
        // TODO: finish implementing this function
        this.error("Not implemented yet.")
    }
    //#endregion

    //#region Session related things 
    // Fetch all public facing sessions
    async fetchSessions() {
        const res = await fetch(`${this.data.api}/sessions`);
        let json = await res.json();
        return json;
    }

    // Fetch session data for specific session
    async fetchSession(sessionId) {
        const res = await fetch(`${this.data.api}/sessions/sessionId`);
        let json = await res.json();
        return json;
    }
    
    async updateSessionsList(sessionUpdate) {
        const sessions = this.data.sessions;
        const index = sessions.findIndex(session => session.sessionId === sessionUpdate.sessionId);
      
        if (index !== -1) {
            sessions[index] = sessionUpdate;
        } else {
            sessions.push(sessionUpdate);
        }
    }

    async removeSessionsFromList(sessionId) {
        const sessions = this.data.sessions;
        const index = sessions.findIndex(session => session.sessionId === sessionId);
        
        if (index !== -1) {
            sessions.splice(index, 1);
        } else {
            console.log(`Session with ID ${sessionId} not found.`);
        }
    }
    //#endregion

    //#region Utils
    // Formats image urls to be usable 
    formatIconUrl(url) {
        try {
            return url.replace('resdb:///', this.data.ASSET_URL).replace('.webp', '').replace('.png', '');
        }
        catch {
            return 'INVALID_URL';
        }
    }

    // Basic logging stuff with time stamps
    log(message) {
        console.log(`[${Date.now()} INFO] ${message}`);
    }

    // Basic warning stuff with time stamps
    warning(message) {
        console.warn(`[${Date.now()} WARN] ${message}`);
    }

    // Basic error stuff with time stamps
    error(message) {
        console.error(`[${Date.now()} ERROR] ${message}`);
    }
    //#endregion
}

module.exports = ResoNetLib;