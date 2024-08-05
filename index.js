const {randomUUID, createHash, randomBytes} = require("crypto");
const signalR = require("@microsoft/signalr");
const fetch = require('node-fetch');

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
            throw new Error(`Unexpected return code ${res.status}: ${await res.text()}`);
        }
    
        console.log("Successfully Logged in");
    }
    
    async logout() {
        if(!data.loggedIn){
            throw new Error("Failed logging out, no user is logged in.");
        }
    
        const res = await fetch(`${API}/userSessions/${data.userId}/${data.token}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": data.fullToken
            }
        }
        );
    
        if (res.status !== 200){
            throw new Error(`Unexpected HTTP status when logging out (${res.status} ${res.statusText}): ${res.body}`);
        }
    
        this.data.loggedIn = false;
        this.data.fullToken = "";
        this.data.token = "";
        this.data.userId = "";
    }
    
    async startSignalR() {
        signalRConnection = new signalR.HubConnectionBuilder()
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
        console.log("Starting SignalR");
    }
    
    async stopSignalR(){
        await signalRConnection.stop();
        this.signalRConnection = undefined;
        console.log("Stopping SignalR.");
    }
}

module.exports = ResoNetLib;