const { EventEmitter } = require("events");

class Session extends EventEmitter {
    constructor(signalRConnection, data) {
        super();
        this.signalRConnection = signalRConnection;
        this.data = data;

        this.signalRConnection.on("ReceiveSessionUpdate", async (session) => {
            this.updateSessions(session);
            this.emit("sessionUpdateEvent", session);
        });

        this.signalRConnection.on("RemoveSession", async (sessionId) => {
            this.removeSession(sessionId);
            this.emit("sessionRemoveEvent", sessionId);
        });
    }

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
    
    async updateSessions(sessionUpdate) {
        // Assuming this.data.sessions is the array where session objects are stored
        const sessions = this.data.sessions;
        const index = sessions.findIndex(session => session.sessionId === sessionUpdate.sessionId);
      
        if (index !== -1) {
            sessions[index] = sessionUpdate;
        } else {
            sessions.push(sessionUpdate);
        }
    }

    async removeSession(sessionId) {
        const sessions = this.data.sessions;
        const index = sessions.findIndex(session => session.sessionId === sessionId);
        
        if (index !== -1) {
            sessions.splice(index, 1);
        } else {
            console.log(`Session with ID ${sessionId} not found.`);
        }
    }
}

module.exports = Session;