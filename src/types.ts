export type UserRole = "admin" | "trainer" | "player" | "board" | "social";
export type PlayerDocumentType =
  | "member"
  | "membershipApplication"
  | "medicalCertificate"
  | "photoConsentSocial";

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

export type CashbookEntryType = "in" | "out";

export interface CashbookEntry {
  id: string;
  teamId: string;
  entryType: CashbookEntryType;
  amountCents: number;
  title: string;
  notes: string;
  bookedAt: string;
  receiptUrl?: string | null;
  originalReceived: boolean;
  originalReceivedBy?: string | null;
  originalReceivedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  isMemberFileUrl?: string | null;
  membershipApplicationFileUrl?: string | null;
  medicalCertificateFileUrl?: string | null;
  photoConsentSocialFileUrl?: string | null;
  mustChangePassword?: boolean;
  privacyAcceptedAt?: string | null;
  requiresOnboarding?: boolean;
  socialMediaEnabled?: boolean;
  createdAt: string;
}

export interface PendingPlayerApplication {
  id: string;
  teamId: string;
  fullName: string;
  email: string;
  phone: string;
  birthday?: string;
  address: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  notes: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdUserId?: string | null;
}

export type MatchRescheduleRequestStatus = "pending" | "in_progress" | "done";

export interface MatchRescheduleRequest {
  id: string;
  teamId: string;
  matchId?: string | null;
  matchLabel: string;
  proposedKickoffAt: string;
  reason: string;
  coordinationNotes: string;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  status: MatchRescheduleRequestStatus;
  handledBy?: string | null;
  handledAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  adminNotificationAt?: string | null;
  trainerNotificationAt?: string | null;
}

export type KeyType = "haupttor" | string;
export type KeyHandoverStatus = "not_handed_over" | "handed_over" | "returned";

export interface KeyAssignment {
  id: string;
  keyType: KeyType;
  keyLabel: string;
  trainerId: string;
  status: KeyHandoverStatus;
  handedOverBy?: string | null;
  handedOverAt?: string | null;
  returnedBy?: string | null;
  returnedAt?: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FleaMarketListing {
  id: string;
  title: string;
  description: string;
  condition: string;
  priceCents: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  imageUrls: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TournamentOfferResponseStatus = "pending" | "accepted" | "declined";
export type TournamentOfferRegistrationStatus = "open" | "registered" | "cancelled";
export type TournamentOfferReplyStatus = "pending" | "accepted" | "declined";

export interface TournamentOffer {
  id: string;
  groupId: string;
  teamId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  tournamentPlanUrl?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  responseStatus: TournamentOfferResponseStatus;
  respondedBy?: string | null;
  respondedAt?: string | null;
  registrationStatus: TournamentOfferRegistrationStatus;
  registrationUpdatedBy?: string | null;
  registrationUpdatedAt?: string | null;
  tournamentReplyStatus: TournamentOfferReplyStatus;
  tournamentReplyUpdatedBy?: string | null;
  tournamentReplyUpdatedAt?: string | null;
  trainerNotificationAt?: string | null;
  adminNotificationAt?: string | null;
}

export type SocialMediaDraftType = "feed" | "story";

export type SocialMediaLayerKind =
  | "image"
  | "title"
  | "subtitle"
  | "caption"
  | "cta"
  | "badge";

export type SocialMediaLayerPosition =
  | "full"
  | "topLeft"
  | "topRight"
  | "center"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

export type SocialMediaLayerStyle =
  | "cover"
  | "original"
  | "soft"
  | "cutout"
  | "glass"
  | "solid"
  | "pill"
  | "clean";

export type SocialMediaTextAlign = "left" | "center" | "right";

export type SocialMediaTextEffect = "none" | "shadow" | "outline";

export interface SocialMediaLayer {
  id: string;
  kind: SocialMediaLayerKind;
  label: string;
  position: SocialMediaLayerPosition;
  style: SocialMediaLayerStyle;
  imageRef?: string;
  imageFileName?: string;
  text?: string;
  enabled: boolean;
  centerX?: number;
  centerY?: number;
  widthPercent?: number;
  heightPercent?: number;
  lockPosition?: boolean;
  lockSize?: boolean;
  keepAspectRatio?: boolean;
  baseAspectRatio?: number;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  textAlign?: SocialMediaTextAlign;
  textEffect?: SocialMediaTextEffect;
  strokeColor?: string;
  strokeWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface SocialMediaDraft {
  id: string;
  draftType: SocialMediaDraftType;
  layout: string;
  title: string;
  subtitle: string;
  caption: string;
  callToAction: string;
  imageUrls: string[];
  layers: SocialMediaLayer[];
  isTemplate: boolean;
  postingText: string;
  hashtags: string[];
  status: "draft" | "submitted";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  adminNotificationAt?: string | null;
}

export interface SocialMediaCrest {
  id: string;
  name: string;
  imageUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMediaAssetFolder {
  id: string;
  name: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMediaAsset {
  id: string;
  folderId: string | null;
  name: string;
  imageUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMediaTextSnippet {
  id: string;
  label: string;
  content: string;
  category: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialMediaFont {
  id: string;
  name: string;
  family: string;
  fileUrl: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  socialMediaLayouts: SocialMediaLayoutOption[];
}

export interface SocialMediaLayoutOption {
  value: string;
  label: string;
  enabled: boolean;
}
