import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const requests = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      sender: { select: { id: true, name: true, username: true, image: true, bio: true } },
      receiver: { select: { id: true, name: true, username: true, image: true, bio: true } },
    },
  });

  const friends = requests.map((request) =>
    request.senderId === session.user.id ? request.receiver : request.sender,
  );

  return NextResponse.json({ friends });
}
