export interface InputLink {
  id: string
  source: string
  url: string
  metadata?: Record<string, any>
  createdAt?: number
  updatedAt?: number
}

export interface InputLinkResult {
  success: boolean
  link?: InputLink
  error?: string
}

export class InputLinkHandler {
  private links = new Map<string, InputLink>()

  register(link: InputLink): InputLinkResult {
    if (this.links.has(link.id)) {
      return { success: false, error: `Link with id "${link.id}" already exists.` }
    }
    const enriched: InputLink = {
      ...link,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.links.set(link.id, enriched)
    return { success: true, link: enriched }
  }

  get(id: string): InputLinkResult {
    const link = this.links.get(id)
    if (!link) {
      return { success: false, error: `No link found for id "${id}".` }
    }
    return { success: true, link }
  }

  list(): InputLink[] {
    return Array.from(this.links.values())
  }

  unregister(id: string): boolean {
    return this.links.delete(id)
  }

  update(id: string, updates: Partial<Omit<InputLink, "id">>): InputLinkResult {
    const existing = this.links.get(id)
    if (!existing) {
      return { success: false, error: `No link found for id "${id}".` }
    }
    const updated: InputLink = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    }
    this.links.set(id, updated)
    return { success: true, link: updated }
  }

  exists(id: string): boolean {
    return this.links.has(id)
  }

  clear(): void {
    this.links.clear()
  }
}
