const {randomUUID} = require("crypto");
const { EventEmitter } = require("events");

class Message extends EventEmitter{
    constructor(signalRConnection, data) {
        super();
        this.signalRConnection = signalRConnection;
        this.data = data;
        
        this.signalRConnection.on("ReceiveMessage", async (message) => {
            this.emit("messageRecieveEvent", message);
        });
    }

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
}

module.exports = Message;