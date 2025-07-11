import * as signalR from "@microsoft/signalr";
import EventEmitter from "events";

import { User } from './classes/User.js';
import * as Enums from './classes/Enums.js';

const API = import.meta.env.DEV ? "/api" : "https://api.resonite.com/";
const ASSET_URL = import.meta.env.DEV ? "/assets" : "https://assets.resonite.com/"
const BADGES_URL =import.meta.env.DEV ? "/badges" : "https://gist.github.com/art0007i/018c94ee9c8701a8c2a0419599d80fbc/raw";
const KEY = "oi+ISZuYtMYtpruYHLQLPkXgPaD+IcaRNXPI7b3Z0iYe5+AcccouLYFI9vloMmYEYDlE1PhDL52GsddfxgQeK4Z_hem84t1OXGUdScFkLSMhJA2te86LBL_rFL4JjO4F_hHHIJH1Gm1IYVuvBQjpb89AJ0D6eamd7u4MxeWeEVE="
const MACHINEID = GenerateRandomMachineId();
const UID = await GenerateUID();

function GenerateRandomMachineId(){
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    for (let i = 0; i < 128; i++){
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function GenerateUID() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const randomBase64 = btoa(String.fromCharCode(...array));
  const data = `resonet-${randomBase64}`;

  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))
    .then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    });
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
    
        if (res.status !== 200){
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
            this.log(`Received Message: ${ JSON.stringify(message)}`);
            if (this.fetchUser(message.senderId).messages == null) await this.fetchMessages(message.senderId);
            else this.updateUserMessages(message);
            //this.data.users.find(u => u.userId === message.senderId).UpdateContact({ "messages": this.fetchUser(message.recipientId).messages.push(message) });
            this.emit("messageRecieveEvent", message);
        });

        this.signalRConnection.on("ReceiveStatusUpdate", async (status) => {
            //this.log(`Received Status Update: ${JSON.stringify(status)}`);
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
    }

    //#region Contacts
    async fetchContacts() {
        this.log(`Fetching Contacts.`)
        const res = await fetch(`${this.data.api}/users/${this.data.userId}/contacts`, {headers: {"Authorization": this.data.fullToken}});
        let json = await res.json();   
        await Promise.all(json.filter(user => user.contactStatus == "Accepted" && user.isAccepted).map(user => this.GetUser(user))); 
    }

    fetchUser(userId) {
        return this.data.users.find(user => user.userId === userId) ?? null;
    }

    async fetchUserProfile(userId) {
        this.log(`Fetching User: ${userId}`);
        const res = await fetch(`${this.data.api}/users/${userId}`, {headers: {"Authorization": this.data.fullToken}});
        let json = await res.json();  
        return json; 
    }

    async requestUserUpdate(userId) {
        await this.signalRConnection.send("RequestStatus", userId, true);
    }
    //#endregion
    
    async parseBadges() {
        const res = await fetch(BADGES_URL);
        res.text().then(data => {
            data = data.split("\n");
            for (let index = 1; index < data.length - 1; index++) {
                const splitData = data[index].split(",");
                this.data.badges[splitData[0]] = splitData[1];
            }
        });
    }

    //#region User Searching
    async searchUsers(query) {      
        this.log(`Searching users with term "${query}"`);
        const res = await fetch(`${this.data.api}/users?name=${query}`);
        let json = await res.json();
        await Promise.all(json.map(user => this.GetUser(user)));
    }

    async GetUser(user) {
        var newUser = new User({ userId: user.id, username: user.contactUsername ?? user.username });
        if (user.contactUsername != null) newUser.currentContact = user;
        if (this.fetchUser(newUser.userId) == null) {
            newUser.UpdateContact({ "currentUser": await this.fetchUserProfile(newUser.userId)} );
            this.data.users.push(newUser);
        }
    }

    //#endregion

    //#region Messaging
    async sendMessage(userId, content) {
        this.log(`Sending "${content}" to ${userId}.`);
        const messageData = {
            "id": `MSG-${ crypto.randomUUID() }`,
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
    }

    async fetchMessages(userId, maxItems = -1, unreadOnly = false) {
        this.log(`Fetching messages for ${userId}.`);
        const res = await fetch(`${this.data.api}/users/${this.data.userId}/messages?user=${userId}`, { method: "GET", headers: { "Authorization": this.data.fullToken }}); // ?maxItems=${maxItems}&maxItems=${maxItems}&fromTime=${fromTime}&unread=${unreadOnly}
        let json = await res.json();      
        if (json == null) return;
        this.fetchUser(userId).UpdateContact({ messages: json.reverse() });
    }

    async markMessagesAsRead(readMessageData) {
        await this.signalRConnection.send("MarkMessagesRead", readMessageData);
    }

    updateUserMessages(message, sender = false) {
        let thing = sender ? message.recipientId : message.senderId;        
        let user = this.fetchUser(thing);
        let containsMessage = user.messages.find(m => m.id === message.id)
        if (!containsMessage) { 
            this.log(`Updating messages for ${thing}`);
            user.messages.push(message);
            this.data.users.find(u => u.userId === message.senderId).UpdateContact({ messages: user.messages });
        }
    }
    //#endregion

    //#region Session Stuff
    async fetchSessions() {
        this.log(`Fetching Sessions.`)
        const res = await fetch(`${this.data.api}/sessions`, {headers: {"Authorization": this.data.fullToken}});
        let json = await res.json();   
        json.forEach(async sessionData => {
            this.data.sessions.push(sessionData);
        });   
    }

    fetchSession(sessionId) {
        return this.data.sessions.find(session => session.sessionId === sessionId) || null;
    }

    removeSession(sessionId) {
        const index = this.data.sessions.findIndex(session => session.sessionId === sessionId);
        if (index !== -1) {
            this.data.sessions.splice(index, 1); 
        }
    }

    updateSession(sessionData) {
        const index = this.data.sessions.findIndex(
            session => session.sessionId === sessionData.sessionId
        );

        if (index === -1) {
            this.data.sessions.push(sessionData);
        } else {
            this.data.sessions[index] = sessionData;
        }
    }

    async fetchUserSessions(userId) {
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
    }

    async fetchUserSession(userId) {
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
    }
    //#endregion
    
    //#region Utils
    // Formats given resdb url into a usable asset url
    formatAssetUrl(url) {
        try {
            if (url.includes('resdb:///')) {
                // Replace the prefix and remove extensions
                return url.replace('resdb:///', this.data.assetUrl).replace('.webp', '').replace('.png', '').replace('.ogg', '');
            } else {
                // Just prepend assetUrl and remove extensions if any
                return this.data.assetUrl + url.replace('.webp', '').replace('.png', '');
            }
        } catch {
            return null;
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

    
    stripTags(str) {
        return str.replace(/<[^>]*>/g, '');
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

export default ResoNetLib;