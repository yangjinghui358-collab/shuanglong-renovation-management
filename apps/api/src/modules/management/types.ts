export type Role = "owner" | "management" | "employee";
export type CandidateModule = "projects" | "procurement" | "crm" | "finance" | "inventory" | "tasks" | "alerts";
export type AgentKey = "chat_archive" | "todo_reminder" | "owner_alert";

export interface AuthUser { id: string; phone: string; role: Role; mustChangePassword: boolean }
export interface AgentCandidate {
  id: string; module: CandidateModule; kind: string; payload: Record<string, unknown>;
  confidence: number; status: "pending_review" | "projected" | "rejected";
  version: number; createdAt: string;
}
export interface ManagementStore {
  initialize(): Promise<void>;
  bootstrapOwner(phone: string, passwordHash: string): Promise<void>;
  createUser(phone: string, passwordHash: string, role: Exclude<Role,"owner">): Promise<AuthUser>;
  listUsers(): Promise<AuthUser[]>;
  findUserByPhone(phone: string): Promise<(AuthUser & { passwordHash: string }) | null>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findSession(tokenHash: string): Promise<AuthUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
  changePassword(userId: string, passwordHash: string): Promise<void>;
  createCandidate(input: Omit<AgentCandidate, "id" | "status" | "version" | "createdAt">, sourceKey: string): Promise<AgentCandidate>;
  listCandidates(): Promise<AgentCandidate[]>;
  findCandidate(id: string): Promise<AgentCandidate | null>;
  confirmCandidate(id: string, version: number, idempotencyKey: string, actorId: string, payload?: Record<string, unknown>): Promise<AgentCandidate>;
  rejectCandidate(id: string, version: number, actorId: string, reason: string): Promise<AgentCandidate>;
  listModuleRecords(module: CandidateModule): Promise<Array<Record<string, unknown>>>;
  queueAgentRun(agentKey: AgentKey, actorId: string): Promise<Record<string, unknown>>;
  listAgentRuns(): Promise<Array<Record<string, unknown>>>;
}
