const {randomUUID, createHash, randomBytes} = require("crypto");
const signalR = require("@microsoft/signalr");

const Message = require('./message');
const User = require('./user');
const Utils = require('./utils');
const Session = require('./session');
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
            this.message = undefined;
            this.user = undefined;
            this.utils = undefined;
            this.session = undefined;
        }
    }

    async start() {
        await this.login();
        await this.startSignalR();
        await this.setupVariables();
        this.emit("clientStartedEvent");
    }
    
    async stop() {
        await this.logout();
        await this.stopSignalR();
        this.emit("clientStoppedEvent");
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
        this.message = undefined;
        this.user = undefined;
        this.utils = undefined;
        this.session = undefined;
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

        this.signalRConnection.start();
    }
    
    // Stops SignalIR and unassigns the signalRConnection variable
    async stopSignalR() {
        await this.signalRConnection.stop();
        this.signalRConnection = undefined;
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
}

module.exports = ResoNetLib;