const {randomUUID, createHash, randomBytes} = require("crypto");
const signalR = require("@microsoft/signalr");
const EventEmitter = require("events");

const User = require("./classes/User");
const Enums = require("./classes/Enums");

const API = "https://api.resonite.com/";
const ASSET_URL = "https://assets.resonite.com/"
const BADGES_URL = "https://gist.github.com/art0007i/018c94ee9c8701a8c2a0419599d80fbc/raw";
const KEY = "oi+ISZuYtMYtpruYHLQLPkXgPaD+IcaRNXPI7b3Z0iYe5+AcccouLYFI9vloMmYEYDlE1PhDL52GsddfxgQeK4Z_hem84t1OXGUdScFkLSMhJA2te86LBL_rFL4JjO4F_hHHIJH1Gm1IYVuvBQjpb89AJ0D6eamd7u4MxeWeEVE="
const MACHINEID = GenerateRandomMachineId();
const UID = GenerateUID();

function GenerateRandomMachineId(){
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
    for (let i = 0; i < 128; i++){
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function GenerateUID(){ 
    let result = "";
    const data = `resonet-${randomBytes(16).toString("base64")}`;
    result = createHash("sha256").update(data).digest("hex").toUpperCase();
    return result;
}

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
                "users": [],
                "sessions": [],
                "badges": []
            }
    
            this.signalRConnection = undefined;
        }
    }

    async login() {  
        this.log(`Attempting to log in as ${this.config.username}`);

        if (this.data.loggedIn) {
            this.error("Already logged in!");
            throw new Error(`Already logged in!`);
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
            await this.fetchContacts();
            await this.fetchSessions();
            await this.parseBadges();
            
            this.log(`Successfully logged in as ${this.config.username}!`);
        }
        else {
            let response = await res.text();
            this.error(response);
            throw new Error(`Unexpected return code ${res.status}: ${response}`);
        }
    }

    async logout() {
        this.log("Logging out.");
        const res = await fetch(`${API}/userSessions/${this.data.userId}/${this.data.token}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": this.data.fullToken
            }
        });
    
        if (!res.ok){
            throw new Error(`Unexpected HTTP status when logging out (${res.status} ${res.statusText}): ${res.body}`);
        }
    
        this.data.loggedIn = false;
        this.data.fullToken = "";
        this.data.token = "";
        this.data.userId = "";
        this.data.users = [];

        this.signalRConnection = undefined;
    }

    async startSignalR() {
        this.log("Starting SignalR");
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
            this.updateSession(session);
            this.emit("sessionUpdateEvent", session);
        });

        this.signalRConnection.on("RemoveSession", async (sessionId) => {
            this.removeSession(sessionId);
            this.emit("sessionRemoveEvent", sessionId);
        });

        this.signalRConnection.on("ReceiveMessage", async (message) => {
            if (this.fetchUser(message.senderId).messages == null) await this.fetchMessages(message.senderId);
            else this.updateUserMessages(message);
            this.emit("messageRecieveEvent", message);
        });

        this.signalRConnection.on("ReceiveStatusUpdate", async (status) => {
            this.data.users.find(u => u.userId === status.userId).UpdateContact({ "currentStatus": status });
            this.data.users.find(u => u.userId === status.userId).UpdateContact({ "currentSessions": await this.fetchUserSessions(status.userId) });
            this.emit("receiveStatusUpdate", status);
        });

        await this.signalRConnection.start();
        this.signalRConnection.stream("InitializeContacts");
    }
    
    async stopSignalR() {
        this.log("Stopping SignalR.");
        await this.signalRConnection.stop();
        this.signalRConnection = undefined;
    }

    async start() {
        await this.login();
        await this.startSignalR();
    }
    
    async stop() {
        await this.logout();
        await this.stopSignalR();
    }

    async updateStatus(status) {
        try {
            const statusUpdateData = {
                "userId": status.userId,
                "onlineStatus": status.onlineStatus,
                "outputDevice": status.outputDevice,
                "sessionType": status.sessionType,
                "userSessionId": status.userSessionId,
                "isPresent": status.isPresent,
                "lastPresenceTimestamp": status.lastPresenceTimestamp,
                "lastStatusChange": status.lastStatusChange,
                "compatibilityHash": status.compatibilityHash,
                "appVersion": status.appVersion,
                "isMobile": status.isMobile
            }
            
            const statusUpdateGroup = {
                "group": status.group,
                "targetIds": status.targetIds
            }   

            await this.signalRConnection.send("BroadcastStatus", statusUpdateData, statusUpdateGroup)
            .then(() => {
                this.log(`Updating status: ${JSON.stringify(statusUpdateData)}`);
            })
            .catch((err) => {
                throw new Error(err);
            });
        } catch (error) {
            this.error(error);
        }
    }

    //#region Contacts
    async fetchContacts() {
        try {
            this.log(`Fetching Contacts.`)
            const res = await fetch(`${this.data.api}/users/${this.data.userId}/contacts`, {headers: {"Authorization": this.data.fullToken}});
            if (!res.ok) throw (res.status);
            let json = await res.json();   
            await Promise.all(json.filter(user => user.contactStatus == "Accepted" && user.isAccepted).map(user => this.GetUser(user))); 
        } catch (error) {
            this.error(error);
        }
    }

    fetchUser(userId) {
        try {
            return this.data.users.find(user => user.userId === userId);
        } catch (error) {
            this.error(error);
            return null;
        }
    }

    async fetchUserProfile(userId) {
            try {
            this.log(`Fetching User: ${userId}`);
            const res = await fetch(`${this.data.api}/users/${userId}`, {headers: {"Authorization": this.data.fullToken}});
            if (!res.ok) throw (res.status);
            let json = await res.json();  
            return json; 
        } catch (error) {
            this.error(error);
            return null;
        }
    }

    async requestUserUpdate(userId) {
        try {
            await this.signalRConnection.send("RequestStatus", userId, true);
        } catch (error) {
            this.error(error);
        }
    }

    async addContact(userId){
        try {
            if (userId.trim().toLowerCase() == "") return;
            this.log(`Adding Contact: ${userId}`);
            const profile = await this.fetchUserProfile(userId);
            await this.updateContact({ "ownerId": this.data.userId, "id": userId, "contactUsername": profile.username, "contactStatus": "Accepted" })
            await this.fetchContacts();
        } catch (error) {
            this.error(error);
        }
    }

    async removeContact(userId){
        try {
            if (userId.trim().toLowerCase() == "") return;
            this.log(`Removing Contact: ${userId}`);
            let user = this.fetchUser(userId);
            user.currentContact.contactStatus = "Ignored";
            await this.updateContact(user.currentContact);       
            await this.fetchContacts();
        } catch (error) {
            this.error(error);
        }
    }

    async updateContact(data) {
        try {
            await this.signalRConnection.send("UpdateContact", data)
        } catch (error) {
            this.error(error);
        }
    }
    //#endregion
    
    async parseBadges() {
        try {
            const res = await fetch(BADGES_URL);
            if (!res.ok) throw (res.status);
            res.text().then(data => {
                data = data.split("\n");
                for (let index = 1; index < data.length - 1; index++) {
                    const splitData = data[index].split(",");
                    this.data.badges[splitData[0]] = splitData[1];
                }
            });
        } catch (error) {
            this.error(error);
        }
    }

    //#region User Searching
    async searchUsers(query) {      
        try {
            this.log(`Searching users with term "${query}"`);
            const res = await fetch(`${this.data.api}/users?name=${query}`);
            if (!res.ok) throw (res.status);
            let json = await res.json();
            await Promise.all(json.map(user => this.GetUser(user)));
        } catch (error) {
            this.error(error);
        }
    }

    async GetUser(user) {
        try {
            var newUser = new User({ userId: user.id, username: user.contactUsername ?? user.username });
            if (user.contactUsername != null) newUser.currentContact = user;
            if (this.fetchUser(newUser.userId) == null) {
                newUser.UpdateContact({ "currentUser": await this.fetchUserProfile(newUser.userId)} );
                this.data.users.push(newUser);
            }
        } catch (error) {
            this.error(error);
        }
    }

    //#endregion

    //#region Messaging
    async sendMessage(userId, content) {
        try {
            this.log(`Sending "${content}" to ${userId}.`);
            const messageData = {
                "id": `MSG-${ randomUUID() }`,
                "senderId": this.data.userId,
                "recipientId": userId,
                "messageType": "Text",
                "sendTime": (new Date(Date.now())).toISOString(),
                "lastUpdateTime": (new Date(Date.now())).toISOString(),
                "content": content
            }
            await this.signalRConnection.send("SendMessage", messageData);
            this.updateUserMessages(messageData, true);
            return messageData;
        } catch (error) {
            this.error(error);
            return null;
        }
    }

    async fetchMessages(userId, maxItems = -1, unreadOnly = false) {
        try {
            this.log(`Fetching messages for ${userId}.`);
            const res = await fetch(`${this.data.api}/users/${this.data.userId}/messages?user=${userId}`, { method: "GET", headers: { "Authorization": this.data.fullToken }}); // ?maxItems=${maxItems}&maxItems=${maxItems}&fromTime=${fromTime}&unread=${unreadOnly}
            if (!res.ok) throw (res.status);
            let json = await res.json();      
            if (json == null) return;
            this.fetchUser(userId).UpdateContact({ messages: json.reverse() });
        } catch (error) {
            this.error(error);
        }
    }

    async markMessagesAsRead(readMessageData) {
        try {
            await this.signalRConnection.send("MarkMessagesRead", readMessageData);
        } catch (error) {
            this.error(error);
        }
    }

    updateUserMessages(message, sender = false) {
        try {
            let thing = sender ? message.recipientId : message.senderId;        
            let user = this.fetchUser(thing);
            let containsMessage = user.messages.find(m => m.id === message.id)
            if (!containsMessage) { 
                this.log(`Updating messages for ${thing}`);
                user.messages.push(message);
                this.data.users.find(u => u.userId === message.senderId).UpdateContact({ messages: user.messages });
            }
        } catch (error) {
            this.error(error);
        }
    }
    //#endregion

    //#region Session Stuff
    async fetchSessions() {
        try {
            this.log(`Fetching Sessions.`)
            const res = await fetch(`${this.data.api}/sessions`, {headers: {"Authorization": this.data.fullToken}});
            if (!res.ok) throw (res.status);
            let json = await res.json();   
            json.forEach(async sessionData => {
                this.data.sessions.push(sessionData);
            });   
        } catch (error) {
            this.error(error);
        }
    }

    fetchSession(sessionId) {
        try {
            return this.data.sessions.find(session => session.sessionId === sessionId) || null;
        } catch (error) {
            this.error(error);
        }
    }

    removeSession(sessionId) {
        try {
            const index = this.data.sessions.findIndex(session => session.sessionId === sessionId);
            if (index !== -1) {
                this.data.sessions.splice(index, 1); 
            }
        } catch (error) {
            this.error(error);
        }
    }

    updateSession(sessionData) {
        try {
            const index = this.data.sessions.findIndex(
                session => session.sessionId === sessionData.sessionId
            );

            if (index === -1) {
                this.data.sessions.push(sessionData);
            } else {
                this.data.sessions[index] = sessionData;
            }
        } catch (error) {
            this.error(error);
        }
    }

    async fetchUserSessions(userId) {
        try {
            var sessions = [];

            var contact = this.fetchUser(userId);
            var status = contact.currentStatus;
            if (status == null) throw `Status for ${userId} is null, returning.`;
            var userSessions = status.sessions;
            var hashSalt = status.hashSalt;
        
            for (let index = 0; index < this.data.sessions.length; index++) {
                const sessionId = this.data.sessions[index].sessionId;
                const sessionHash = await this.idHash(sessionId + hashSalt);

                userSessions.forEach(userSession => {
                    if (sessionHash == userSession.sessionHash) {
                        sessions.push(sessionId);
                    }
                });
            }  

            return sessions;
        } catch (error) {
            this.error(error);
            return null;
        }
    }

    async fetchUserSession(userId) {
        try {
            var user = this.fetchUser(userId);
            var status = user.currentStatus;
            if (status == null) return { accessLevel: "Unknown" };
            var hashSalt = status.hashSalt;
            var currentSession = status.sessions[status.currentSessionIndex];

            for (let index = 0; index < this.data.sessions.length; index++) {
                const session = this.data.sessions[index];
                const sessionId = session.sessionId;
                const sessionHash = await this.idHash(sessionId + hashSalt);
                
                if (sessionHash == null) return { accessLevel: "Unknown" };
                if (sessionHash == currentSession?.sessionHash ?? "") {
                    return session;
                }
            } 

            return currentSession;
        } catch (error) {
            this.error(error);
            return null;
        }
    }
    //#endregion
    
    //#region Utils
    // Formats given resdb url into a usable asset url
    formatAssetUrl(url) {
        try {
            if (url.includes("resdb:///")) {
                // Replace the prefix and remove extensions
                return url.replace("resdb:///", this.data.assetUrl).replace(".webp", "").replace(".png", "").replace(".ogg", "");
            } else {
                // Just prepend assetUrl and remove extensions if any
                return this.data.assetUrl + url.replace(".webp", "").replace(".png", "");
            }
        } catch {
            return null;
        }
    }

    // Basic logging stuff with time stamps
    log(message) {
        console.log(`[${Date.now()} INFO] ${message}`);
        this.emit("logEvent", message);
    }

    // Basic warning stuff with time stamps
    warning(message) {
        console.warn(`[${Date.now()} WARN] ${message}`);
        this.emit("warnEvent", message);
    }

    // Basic error stuff with time stamps
    error(message) {
        console.error(`[${Date.now()} ERROR] ${message}`);
        this.emit("errorEvent", message);
    }

    
    stripTags(str) {
        try {
            return str.replace(/<[^>]*>/g, "")
        } catch {
            return str;
        }
    }

    async idHash(id) {
        const encoder = new TextEncoder();
        const data = encoder.encode(id);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        return hashHex.replace(/-/g, "").toUpperCase();
    }
    //#endregion
}

module.exports = ResoNetLib;