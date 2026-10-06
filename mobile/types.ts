export type User = {
  id: string;
  name: string;
  username?: string | null;
  image?: string | null;
  isVerified?: boolean;
};

export type Post = {
  id: string;
  content?: string | null;
  mediaUrl?: string | null;
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
};