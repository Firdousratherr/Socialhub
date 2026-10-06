export type User = {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  image?: string | null;
  bio?: string | null;
  isVerified?: boolean;
  isOwner?: boolean;
  role?: string;

};

export type Post = {
  id: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | string | null;
  createdAt: string;
  author: User;
  displayCounts: {
    likes: number;
    comments: number;
    shares: number;
  };
  liked: boolean;
  saved: boolean;
  reactions: { emoji: string; count: number }[];
  myReaction?: string | null;
};

export type Story = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | string;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
  author: User;
  viewCount: number;
  replyCount: number;
  reactionCount: number;
  hasViewed: boolean;
};

export type ConversationMember = {
  userId: string;
  role?: string;
  lastReadAt?: string | null;
  mutedUntil?: string | null;
  archivedAt?: string | null;
  user: User;
};

export type Conversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  updatedAt: string;
  members: ConversationMember[];
  messages?: Message[];
  unreadCount: number;
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  deletedAt?: string | null;
  editedAt?: string | null;
  sender: User;
  attachments?: { id: string; url: string; kind: string }[];
};

export type Notification = {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  createdAt: string;
  readAt?: string | null;
  actor?: User | null;
  post?: { id: string; content?: string | null; mediaUrl?: string | null } | null;
  comment?: { id: string; content: string } | null;
  message?: { id: string; conversationId: string } | null;
  story?: { id: string } | null;
};

export type SearchUser = User & {
  displayCounts?: { followers: number; following: number };
  isFollowing?: boolean;
  isFriend?: boolean;
  friendRequestStatus?: "SELF_PENDING" | "OUTGOING_PENDING" | "INCOMING_PENDING" | "NONE";
  canFollow?: boolean;
  canSendFriendRequest?: boolean;
  isPrivate?: boolean;
};

export type Profile = User & {
  email: string;
  coverImage?: string | null;
  website?: string | null;
  location?: string | null;
  isPrivate?: boolean;
  role?: string;
  createdAt: string;
  visibleCounts: {
    posts: number;
    followers: number;
    following: number;
    likesReceived: number;
    commentsReceived: number;
    shares: number;
    profileViews: number;
  };
};
