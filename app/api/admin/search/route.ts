import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission, hasAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: Request) {
  const access=await requireAdminPermission("USERS_VIEW"); if(access.response)return access.response;
  const q=(new URL(request.url).searchParams.get("q")??"").trim().slice(0,80);
  if(q.length<2)return NextResponse.json({users:[],posts:[],comments:[],reports:[],messages:[]});
  const canSearchMessages = await hasAdminPermission(access.user.id, access.user.role, "MESSAGES_VIEW");
  const [users,posts,comments,reports,messages]=await Promise.all([
    prisma.user.findMany({where:{OR:[{name:{contains:q,mode:"insensitive"}},{username:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}}]},take:10,select:{id:true,name:true,username:true,email:true,image:true,role:true,isActive:true,isVerified:true}}),
    prisma.post.findMany({where:{content:{contains:q,mode:"insensitive"}},take:10,orderBy:{createdAt:"desc"},select:{id:true,content:true,createdAt:true,author:{select:{id:true,name:true,username:true}}}}),
    prisma.comment.findMany({where:{content:{contains:q,mode:"insensitive"}},take:10,orderBy:{createdAt:"desc"},select:{id:true,content:true,createdAt:true,author:{select:{id:true,name:true,username:true}},postId:true}}),
    prisma.report.findMany({where:{OR:[{reason:{contains:q,mode:"insensitive"}},{moderatorNote:{contains:q,mode:"insensitive"}}]},take:10,orderBy:{createdAt:"desc"},select:{id:true,reason:true,status:true,priority:true,createdAt:true,reportedUserId:true}}),
    canSearchMessages
      ? prisma.message.findMany({where:{content:{contains:q,mode:"insensitive"}},take:20,orderBy:{createdAt:"desc"},select:{id:true,content:true,createdAt:true,conversationId:true,sender:{select:{id:true,name:true,username:true}}}})
      : Promise.resolve([])
  ]);
  await prisma.adminAuditLog.create({data:{adminId:access.user.id,action:"GLOBAL_ADMIN_SEARCH",targetType:"SEARCH",details:JSON.stringify({queryLength:q.length,messagesIncluded:canSearchMessages})}});
  return NextResponse.json({users,posts,comments,reports,messages});
}
