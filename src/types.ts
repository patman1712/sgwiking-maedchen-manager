export type UserRole = "admin" | "trainer" | "player" | "board";

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  season: string;
  trainingDay: string;
  location: string;
  notes: string;
  fussballDeTeamId?: string;
  photoUrl?: string | null;
  createdAt: string;
}

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  kickoffAt: string;
  location: string;
  isHome: boolean;
  competition?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  result: string | null;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  teamId: string;
  category: string;
  name: string;
  quantity: number;
  productInfo: string;
  notes: string;
  condition: string;
  imageUrl?: string | null;
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
  memberNumber?: string;
  birthday?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  isMember?: boolean;
  hasMembershipApplication?: boolean;
  hasMedicalCertificate?: boolean;
  hasPhotoConsentSocial?: boolean;
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
