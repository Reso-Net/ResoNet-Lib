class User {
    constructor(signalRConnection, data) {
        this.signalRConnection = signalRConnection;
        this.data = data;
    }

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
    async addFriend(userid) {
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
    async removeFriend(userid) {
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
}

module.exports = User;