import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const access=await requireAdmin(); if(access.response)return access.response;
  const q=(new URL(request.url).searchParams.get("q")??"").trim().slice(0,80);
  if(q.length<2)return NextResponse.json({users:[],posts:[],comments:[],reports:[],messages:[]});
  const [users,posts,comments,reports,messages]=await Promise.all([
    prisma.user.findMany({where:{OR:[{name:{contains:q,mode:"insensitive"}},{username:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}}]},take:10,select:{id,name,username,email,image,role,isActive,isVerified}}),
    prisma.post.findMany({where:{content:{contains:q,mode:"insensitive"}},take:10,orderBy:{createdAt:"desc"},select:{id,content,createdAt,author:{select:{id,name,username}}}}),
    prisma.comment.findMany({where:{content:{contains:q,mode:"insensitive"}},take:10,orderBy:{createdAt:"desc"},select:{id,content,createdAt,author:{select:{id,name,username}},postId}}),
    prisma.report.findMany({where:{OR:[{reason:{contains:q,mode:"insensitive"}},{moderatorNote:{contains:q,mode:"insensitive"}}]},take:10,orderBy:{createdAt:"desc"},select:{id,reason,status,priority,createdAt,reportedUserId}}),
    prisma.message.findMany({where:{content:{contains:q,mode:"insensitive"}},take:20,orderBy:{createdAt:"desc"},select:{id,content,createdAt,conversationId,sender:{select:{id,name,username}}}})
  ]);
  await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"GLOBAL_ADMIN_SEARCH",targetType:"SEARCH",details:JSON.stringify({q})}});
  return NextResponse.json({users,posts,comments,reports,messages});
}
