export class SenderNameResolver {
  constructor({ client, store }) {
    this.client = client
    this.store = store
  }

  async enrich(db, messages) {
    if (!this.client || !messages.length) return messages
    const ids = [...new Set(messages.map(item => item.sender_id).filter(Boolean))]
    const known = await this.store.getSenderNames(db, ids)
    const resolved = { ...known }
    for (const id of ids) {
      if (resolved[id]) continue
      try {
        const name = await this.client.getSenderName(id)
        if (name && name !== id) {
          resolved[id] = name
          await this.store.updateSenderName(db, id, name)
        }
      } catch {
        // A sender can be outside the app's visible contact scope. Keep collection running;
        // the owner alias remains the safe fallback until permissions are expanded.
      }
    }
    return messages.map(item => ({
      ...item,
      sender_name: meaningfulName(item.sender_name, item.sender_id) || resolved[item.sender_id] || ''
    }))
  }
}

function meaningfulName(name, id) {
  const value = String(name || '').trim()
  return value && value !== id ? value : ''
}
