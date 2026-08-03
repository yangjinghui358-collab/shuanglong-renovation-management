export type Role = "owner" | "admin";
export type CandidateModule = "projects" | "procurement" | "crm";

export interface AuthUser { id: string; phone: string; role: Role; mustChangePassword: boolean }
export interface AgentCandidate {
  id: string; module: CandidateModule; kind: string; payload: Record<string, unknown>;
  confidence: number; status: "pending_review" | "projected" | "rejected";
  version: number; createdAt: string;
}
export interface ManagementStore {
  initialize(): Promise<void>;
  bootstrapOwner(phone: string, passwordHash: string): Promise<void>;
  findUserByPhone(phone: string): Promise<(AuthUser & { passwordHash: string }) | null>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findSession(tokenHash: string): Promise<AuthUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
  changePassword(userId: string, passwordHash: string): Promise<void>;
  createCandidate(input: Omit<AgentCandidate, "id" | "status" | "version" | "createdAt">, sourceKey: string): Promise<AgentCandidate>;
  listCandidates(): Promise<AgentCandidate[]>;
  confirmCandidate(id: string, version: number, idempotencyKey: string, actorId: string, payload?: Record<string, unknown>): Promise<AgentCandidate>;
  rejectCandidate(id: string, version: number, actorId: string, reason: string): Promise<AgentCandidate>;
  listModuleRecords(module: CandidateModule): Promise<Array<Record<string, unknown>>>;
}
