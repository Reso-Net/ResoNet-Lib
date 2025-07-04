class Contact {
  constructor(data = {}) {
    this.contactUserId = data.id || null;
    this.ownerId = data.ownerId || null;
    this.contactUsername = data.contactUsername || null;
    this.alternateUsernames = data.alternateUsernames || [];
    this.contactStatus = data.contactStatus || ContactStatus.None;
    this.isAccepted = data.isAccepted || false;
    this.latestMessageTime = data.latestMessageTime ? new Date(data.latestMessageTime) : null;
    this.currentUser = data.currentUser || null;
    this.currentStatus = data.currentStatus || null;
  }

  UpdateContact(updates = {}) {
    if ('id' in updates) this.contactUserId = updates.id;
    if ('ownerId' in updates) this.ownerId = updates.ownerId;
    if ('contactUsername' in updates) this.contactUsername = updates.contactUsername;
    if ('alternateUsernames' in updates) this.alternateUsernames = updates.alternateUsernames;
    if ('contactStatus' in updates) this.contactStatus = updates.contactStatus;
    if ('isAccepted' in updates) this.isAccepted = updates.isAccepted;
    if ('latestMessageTime' in updates) this.latestMessageTime = updates.latestMessageTime ? new Date(updates.latestMessageTime) : null; 
    if ('currentUser' in updates) this.currentUser = updates.currentUser;
    if ('currentStatus' in updates) this.currentStatus = updates.currentStatus;
  }
}

module.exports = Contact;