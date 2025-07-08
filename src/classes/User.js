class User {
  constructor(data = {}) {
    this.userId = data.userId || null;
    this.username = data.username || null;
    this.currentUser = data.currentUser || null;
    this.currentStatus = data.currentStatus || null;
    this.currentSessions = data.currentSessions || null;
    this.currentContact = data.currentContact || null;
  }

  UpdateContact(updates = {}) {
    if ('userId' in updates) this.userId = updates.userId;
    if ('username' in updates) this.username = updates.username;
    if ('currentUser' in updates) this.currentUser = updates.currentUser;
    if ('currentStatus' in updates) this.currentStatus = updates.currentStatus;
    if ('currentSessions' in updates) this.currentSessions = updates.currentSessions;
    if ('currentContact' in updates) this.currentContact = updates.currentContact;
  }
}

module.exports = User;