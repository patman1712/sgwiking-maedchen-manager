export type UserRole = "admin" | "trainer" | "player" | "board";

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  season: string;
  trainingDay: string;
  location: string;
  notes: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  phone: string;
  role: UserRole;
  teamIds: string[];
  notes: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export type ConversationType = "team" | "direct";

export interface Conversation {
  id: string;
  title: string;
  type: ConversationType;
  participantIds: string[];
  teamId?: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface AppSettings {
  clubName: string;
  logoUrl: string | null;
}
